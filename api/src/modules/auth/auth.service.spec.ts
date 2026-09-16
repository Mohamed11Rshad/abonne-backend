import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { DRIZZLE } from '../../drizzle/drizzle.provider';
import { I18nService } from 'nestjs-i18n';
import { SecurityService } from '../../common/security/security.service';
import { TokenService } from '../../common/token/token.service';
import { EvolutionService } from '../../common/evolution/evolution.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let dbMock: any;
  let securityServiceMock: any;
  let tokenServiceMock: any;
  let evolutionServiceMock: any;

  beforeEach(async () => {
    dbMock = {
      query: {
        users: { findFirst: jest.fn() },
        otpVerifications: { findFirst: jest.fn() },
      },
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: 'user-uuid',
              fullName: 'Ahmed Ali',
              email: 'ahmed@example.com',
              phone: '+201012345678',
              phoneHash: 'hmac_+201012345678',
              password: 'hashed_password',
              role: 'parent',
              isVerified: true,
              changeCredentialTime: null,
            },
          ]),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(true),
        }),
      }),
    };

    securityServiceMock = {
      normalizePhone: jest.fn((p) => (p.startsWith('+') ? p : `+2${p}`)),
      hmac: jest.fn((t) => `hmac_${t}`),
      hash: jest.fn((p) => `hash_${p}`),
      compare: jest.fn().mockResolvedValue(true),
      generateOTP: jest.fn(() => '123456'),
    };

    tokenServiceMock = {
      generateTokens: jest.fn().mockResolvedValue({
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
      }),
    };

    evolutionServiceMock = {
      sendOTP: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DRIZZLE, useValue: dbMock },
        {
          provide: I18nService,
          useValue: { t: jest.fn((k: string) => k) },
        },
        { provide: SecurityService, useValue: securityServiceMock },
        { provide: TokenService, useValue: tokenServiceMock },
        { provide: EvolutionService, useValue: evolutionServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should throw BadRequestException if user already exists', async () => {
      dbMock.query.users.findFirst.mockResolvedValueOnce({ id: 'existing' });

      await expect(
        service.register({
          fullName: 'Ahmed',
          email: 'test@example.com',
          phone: '+201012345678',
          password: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if OTP was requested less than 60 seconds ago', async () => {
      dbMock.query.users.findFirst.mockResolvedValueOnce(null);
      dbMock.query.otpVerifications.findFirst.mockResolvedValueOnce({
        lastSentAt: new Date(Date.now() - 30 * 1000), // 30s ago
      });

      await expect(
        service.register({
          fullName: 'Ahmed',
          email: 'test@example.com',
          phone: '+201012345678',
          password: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should store OTP and call evolutionService.sendOTP on valid registration', async () => {
      dbMock.query.users.findFirst.mockResolvedValueOnce(null);
      dbMock.query.otpVerifications.findFirst.mockResolvedValueOnce(null);

      const result = await service.register({
        fullName: 'Ahmed',
        email: 'test@example.com',
        phone: '+201012345678',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(evolutionServiceMock.sendOTP).toHaveBeenCalledWith(
        '+201012345678',
        '123456',
      );
      expect(dbMock.insert).toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    it('should throw BadRequestException if no pending registration exists', async () => {
      dbMock.query.otpVerifications.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.verifyOtp({ phone: '+201012345678', otp: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if OTP has expired (>15 minutes)', async () => {
      dbMock.query.otpVerifications.findFirst.mockResolvedValueOnce({
        id: 'otp-1',
        expiresAt: new Date(Date.now() - 60 * 1000), // Expired 1 min ago
        attempts: 0,
        otpHash: 'hmac_123456',
      });

      await expect(
        service.verifyOtp({ phone: '+201012345678', otp: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException and increment attempts if OTP does not match', async () => {
      dbMock.query.otpVerifications.findFirst.mockResolvedValueOnce({
        id: 'otp-1',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        otpHash: 'hmac_999999', // different code
      });

      await expect(
        service.verifyOtp({ phone: '+201012345678', otp: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(dbMock.update).toHaveBeenCalled();
    });

    it('should create user, mark OTP used, and return JWT tokens on valid OTP', async () => {
      dbMock.query.otpVerifications.findFirst.mockResolvedValueOnce({
        id: 'otp-1',
        fullName: 'Ahmed Ali',
        email: 'ahmed@example.com',
        phone: '+201012345678',
        phoneHash: 'hmac_+201012345678',
        password: 'hashed_password',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        otpHash: 'hmac_123456',
      });
      dbMock.query.users.findFirst.mockResolvedValueOnce(null);

      const result = await service.verifyOtp({
        phone: '+201012345678',
        otp: '123456',
      });

      expect(result.success).toBe(true);
      expect(result.data.accessToken).toBe('mock_access_token');
      expect(result.data.refreshToken).toBe('mock_refresh_token');
      expect(result.data.user.email).toBe('ahmed@example.com');
      expect(tokenServiceMock.generateTokens).toHaveBeenCalled();
    });
  });

  describe('resendOtp', () => {
    it('should throw BadRequestException if cooldown not reached', async () => {
      dbMock.query.users.findFirst.mockResolvedValueOnce(null);
      dbMock.query.otpVerifications.findFirst.mockResolvedValueOnce({
        id: 'otp-1',
        lastSentAt: new Date(Date.now() - 20 * 1000), // 20s ago
      });

      await expect(
        service.resendOtp({ phone: '+201012345678' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should regenerate OTP and send via WhatsApp if cooldown passed', async () => {
      dbMock.query.users.findFirst.mockResolvedValueOnce(null);
      dbMock.query.otpVerifications.findFirst.mockResolvedValueOnce({
        id: 'otp-1',
        phone: '+201012345678',
        lastSentAt: new Date(Date.now() - 70 * 1000), // 70s ago
      });

      const result = await service.resendOtp({ phone: '+201012345678' });

      expect(result.success).toBe(true);
      expect(evolutionServiceMock.sendOTP).toHaveBeenCalledWith(
        '+201012345678',
        '123456',
      );
    });
  });
});
