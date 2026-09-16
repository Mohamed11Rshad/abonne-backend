import {
  Injectable,
  Inject,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import * as drizzleProvider from '../../drizzle/drizzle.provider';
import { users } from '../users/schema/users.schema';
import { otpVerifications } from './schema/otp.schema';
import { eq, or, and, desc } from 'drizzle-orm';
import { I18nService } from 'nestjs-i18n';
import { SecurityService } from '../../common/security/security.service';
import { TokenService } from '../../common/token/token.service';
import { EvolutionService } from '../../common/evolution/evolution.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(drizzleProvider.DRIZZLE) private readonly db: drizzleProvider.DrizzleDB,
    private readonly i18n: I18nService,
    private readonly securityService: SecurityService,
    private readonly tokenService: TokenService,
    private readonly evolutionService: EvolutionService,
  ) {}

  /**
   * Start registration: validate inputs, store pending registration and OTP, and send WhatsApp OTP
   */
  async register(data: RegisterDto) {
    const normalizedPhone = this.securityService.normalizePhone(data.phone);
    const phoneHash = this.securityService.hmac(normalizedPhone);

    // 1. Check if user already exists
    const existingUser = await this.db.query.users.findFirst({
      where: or(eq(users.email, data.email), eq(users.phoneHash, phoneHash)),
    });

    if (existingUser) {
      throw new BadRequestException(
        this.i18n.t('local.user.USER_ALREADY_EXISTS'),
      );
    }

    // 2. Check for recent pending OTP and apply 60-second cooldown
    const existingOtp = await this.db.query.otpVerifications.findFirst({
      where: and(
        eq(otpVerifications.phoneHash, phoneHash),
        eq(otpVerifications.isUsed, false),
      ),
      orderBy: [desc(otpVerifications.createdAt)],
    });

    const now = new Date();
    if (existingOtp) {
      const timeSinceLastSent =
        now.getTime() - new Date(existingOtp.lastSentAt).getTime();
      if (timeSinceLastSent < 60 * 1000) {
        const remainingSeconds = Math.ceil((60 * 1000 - timeSinceLastSent) / 1000);
        throw new BadRequestException(
          `${this.i18n.t('local.auth.OTP_RATE_LIMITED')} (${remainingSeconds}s)`,
        );
      }
    }

    // 3. Hash password and generate 6-digit OTP
    const hashedPassword = await this.securityService.hash(data.password);
    const otp = this.securityService.generateOTP();
    const otpHash = this.securityService.hmac(otp);
    // 15 minutes expiration time
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    // 4. Save or update pending OTP record
    if (existingOtp) {
      await this.db
        .update(otpVerifications)
        .set({
          fullName: data.fullName,
          email: data.email,
          phone: normalizedPhone,
          password: hashedPassword,
          otpHash,
          attempts: 0,
          lastSentAt: now,
          expiresAt,
          updatedAt: now,
        })
        .where(eq(otpVerifications.id, existingOtp.id));
    } else {
      await this.db.insert(otpVerifications).values({
        phone: normalizedPhone,
        phoneHash,
        fullName: data.fullName,
        email: data.email,
        password: hashedPassword,
        otpHash,
        attempts: 0,
        lastSentAt: now,
        expiresAt,
      });
    }

    // 5. Send OTP via WhatsApp (Evolution API)
    await this.evolutionService.sendOTP(normalizedPhone, otp);

    return {
      success: true,
      message: this.i18n.t('local.auth.OTP_SENT'),
    };
  }

  /**
   * Verify OTP: validates code, creates user, marks OTP as used, and returns JWT tokens
   */
  async verifyOtp(data: VerifyOtpDto) {
    const normalizedPhone = this.securityService.normalizePhone(data.phone);
    const phoneHash = this.securityService.hmac(normalizedPhone);

    // 1. Find active pending verification
    const pending = await this.db.query.otpVerifications.findFirst({
      where: and(
        eq(otpVerifications.phoneHash, phoneHash),
        eq(otpVerifications.isUsed, false),
      ),
      orderBy: [desc(otpVerifications.createdAt)],
    });

    if (!pending) {
      throw new BadRequestException(
        this.i18n.t('local.auth.NO_PENDING_REGISTRATION'),
      );
    }

    // 2. Check if expired (15 minutes limit)
    if (new Date() > new Date(pending.expiresAt)) {
      throw new BadRequestException(this.i18n.t('local.auth.OTP_EXPIRED'));
    }

    // 3. Check attempt limit (max 3 failed attempts)
    if (pending.attempts >= 3) {
      throw new BadRequestException(
        this.i18n.t('local.auth.TOO_MANY_ATTEMPTS'),
      );
    }

    // 4. Validate OTP code
    const inputOtpHash = this.securityService.hmac(data.otp);
    if (inputOtpHash !== pending.otpHash) {
      // Increment failed attempts
      await this.db
        .update(otpVerifications)
        .set({
          attempts: pending.attempts + 1,
          updatedAt: new Date(),
        })
        .where(eq(otpVerifications.id, pending.id));

      throw new UnauthorizedException(this.i18n.t('local.auth.INVALID_OTP'));
    }

    // 5. Check if user already exists (safety guard)
    const existingUser = await this.db.query.users.findFirst({
      where: or(eq(users.email, pending.email), eq(users.phoneHash, phoneHash)),
    });

    if (existingUser) {
      await this.db
        .update(otpVerifications)
        .set({ isUsed: true, updatedAt: new Date() })
        .where(eq(otpVerifications.id, pending.id));

      throw new BadRequestException(
        this.i18n.t('local.user.USER_ALREADY_EXISTS'),
      );
    }

    // 6. Create verified user
    const [user] = await this.db
      .insert(users)
      .values({
        fullName: pending.fullName,
        email: pending.email,
        phone: pending.phone,
        phoneHash: pending.phoneHash,
        password: pending.password,
        isVerified: true,
      })
      .returning();

    // 7. Mark OTP record as used
    await this.db
      .update(otpVerifications)
      .set({ isUsed: true, updatedAt: new Date() })
      .where(eq(otpVerifications.id, pending.id));

    // 8. Generate JWT tokens for auto-login
    const tokens = await this.tokenService.generateTokens({
      id: user.id,
      role: user.role,
      changeCredentialTime: user.changeCredentialTime ?? undefined,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _p, phoneHash: _ph, ...userData } = user;

    return {
      success: true,
      message: this.i18n.t('local.auth.OTP_VERIFIED'),
      data: {
        user: userData,
        ...tokens,
      },
    };
  }

  /**
   * Resend OTP: enforces 60-second cooldown, generates new OTP, and sends via WhatsApp
   */
  async resendOtp(data: ResendOtpDto) {
    const normalizedPhone = this.securityService.normalizePhone(data.phone);
    const phoneHash = this.securityService.hmac(normalizedPhone);

    // 1. If user already registered, cannot resend registration OTP
    const existingUser = await this.db.query.users.findFirst({
      where: eq(users.phoneHash, phoneHash),
    });

    if (existingUser) {
      throw new BadRequestException(
        this.i18n.t('local.user.USER_ALREADY_EXISTS'),
      );
    }

    // 2. Find pending verification
    const pending = await this.db.query.otpVerifications.findFirst({
      where: and(
        eq(otpVerifications.phoneHash, phoneHash),
        eq(otpVerifications.isUsed, false),
      ),
      orderBy: [desc(otpVerifications.createdAt)],
    });

    if (!pending) {
      throw new BadRequestException(
        this.i18n.t('local.auth.NO_PENDING_REGISTRATION'),
      );
    }

    // 3. Enforce 60-second cooldown
    const now = new Date();
    const timeSinceLastSent =
      now.getTime() - new Date(pending.lastSentAt).getTime();
    if (timeSinceLastSent < 60 * 1000) {
      const remainingSeconds = Math.ceil((60 * 1000 - timeSinceLastSent) / 1000);
      throw new BadRequestException(
        `${this.i18n.t('local.auth.OTP_RATE_LIMITED')} (${remainingSeconds}s)`,
      );
    }

    // 4. Generate fresh OTP and reset attempts with new 15-minute expiration
    const newOtp = this.securityService.generateOTP();
    const newOtpHash = this.securityService.hmac(newOtp);
    const newExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    await this.db
      .update(otpVerifications)
      .set({
        otpHash: newOtpHash,
        attempts: 0,
        lastSentAt: now,
        expiresAt: newExpiresAt,
        updatedAt: now,
      })
      .where(eq(otpVerifications.id, pending.id));

    // 5. Send via WhatsApp
    await this.evolutionService.sendOTP(pending.phone, newOtp);

    return {
      success: true,
      message: this.i18n.t('local.auth.OTP_SENT'),
    };
  }

  /**
   * User login with password
   */
  async login(data: LoginDto) {
    const normalizedPhone = this.securityService.normalizePhone(data.phone);
    const phoneHash = this.securityService.hmac(normalizedPhone);

    const user = await this.db.query.users.findFirst({
      where: eq(users.phoneHash, phoneHash),
    });

    if (!user) {
      throw new UnauthorizedException(
        this.i18n.t('local.user.INVALID_PHONE_OR_PASSWORD'),
      );
    }

    const isPasswordValid = await this.securityService.compare(
      data.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        this.i18n.t('local.user.INVALID_PHONE_OR_PASSWORD'),
      );
    }

    const tokens = await this.tokenService.generateTokens({
      id: user.id,
      role: user.role,
      changeCredentialTime: user.changeCredentialTime ?? undefined,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _p, phoneHash: _ph, ...result } = user;
    return {
      success: true,
      message: this.i18n.t('local.common.SUCCESS'),
      data: {
        user: result,
        ...tokens,
      },
    };
  }
}
