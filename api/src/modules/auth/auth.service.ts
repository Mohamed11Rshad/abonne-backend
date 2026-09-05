import { Injectable, Inject, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as drizzleProvider from '../../drizzle/drizzle.provider';
import { users } from '../users/schema/users.schema';
import { eq, or } from 'drizzle-orm';
import { I18nService } from 'nestjs-i18n';
import { SecurityService } from '../../common/security/security.service';

@Injectable()
export class AuthService {
    constructor(
        @Inject(drizzleProvider.DRIZZLE) private db: drizzleProvider.DrizzleDB,
        private readonly i18n: I18nService,
        private readonly securityService: SecurityService,
    ) { }


    async register(data: RegisterDto) {
        const normalizedPhone = this.securityService.normalizePhone(data.phone);
        const phoneHash = this.securityService.hmac(normalizedPhone);

        const existingUser = await this.db.query.users.findFirst({
            where: or(eq(users.email, data.email), eq(users.phoneHash, phoneHash)),
        });

        if (existingUser) {
            throw new BadRequestException(
                this.i18n.t('local.user.USER_ALREADY_EXISTS'),
            );
        }

        const hashedPassword = await this.securityService.hash(data.password);

        const [user] = await this.db
            .insert(users)
            .values({
                ...data,
                phone: normalizedPhone,
                phoneHash: phoneHash,
                password: hashedPassword,
            })
            .returning();

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, phoneHash: _ph, ...result } = user;
        return {
            success: true,
            message: this.i18n.t('local.common.CREATED'),
            data: result,
        };
    }

    async verifyPhone(data: LoginDto) {
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
        
    }
    
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

        const isPasswordValid = await this.securityService.compare(data.password, user.password);

        if (!isPasswordValid) {
            throw new UnauthorizedException(
                this.i18n.t('local.user.INVALID_PHONE_OR_PASSWORD'),
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, phoneHash: _ph, ...result } = user;
        return {
            success: true,
            message: this.i18n.t('local.common.SUCCESS'),
            data: result,
        };
    }
}
