import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Validates registration input, stores pending registration, and sends a 6-digit OTP code to the user WhatsApp via Evolution API. The code expires in 15 minutes.',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'OTP successfully sent to WhatsApp.',
    schema: {
      example: {
        success: true,
        message: 'تم إرسال رمز التحقق بنجاح إلى رقم الواتساب الخاص بك',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User already exists or cooldown (60s) is still active.',
  })
  register(@Body() data: RegisterDto) {
    return this.authService.register(data);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify WhatsApp OTP and complete registration',
    description:
      'Verifies the 6-digit OTP code sent to WhatsApp. On success, creates the user account in the database and returns JWT access and refresh tokens for automatic login.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Phone verified successfully, account created, and tokens issued.',
    schema: {
      example: {
        success: true,
        message: 'تم تأكيد رقم الهاتف وإنشاء الحساب بنجاح',
        data: {
          user: {
            id: 'd9b3a0b1-1234-5678-9abc-def012345678',
            fullName: 'Ahmed Ali',
            email: 'ahmed@example.com',
            phone: '+201012345678',
            role: 'parent',
            isVerified: true,
            createdAt: '2026-09-07T19:00:00.000Z',
          },
          accessToken: 'eyJhbGciOi...',
          refreshToken: 'eyJhbGciOi...',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'No pending registration found, OTP expired (15m), or maximum attempts exceeded.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid OTP code.',
  })
  verifyOtp(@Body() data: VerifyOtpDto) {
    return this.authService.verifyOtp(data);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend WhatsApp OTP',
    description:
      'Generates a new 6-digit OTP code and resends it via WhatsApp. Requires a 60-second cooldown between resend requests.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'New OTP sent to WhatsApp.',
    schema: {
      example: {
        success: true,
        message: 'تم إرسال رمز التحقق بنجاح إلى رقم الواتساب الخاص بك',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cooldown active or no pending registration found.',
  })
  resendOtp(@Body() data: ResendOtpDto) {
    return this.authService.resendOtp(data);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with phone and password',
    description: 'Authenticates a user with phone number and password, returning JWT tokens.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful.',
    schema: {
      example: {
        success: true,
        message: 'تمت العملية بنجاح',
        data: {
          user: {
            id: 'd9b3a0b1-1234-5678-9abc-def012345678',
            fullName: 'Ahmed Ali',
            email: 'ahmed@example.com',
            phone: '+201012345678',
            role: 'parent',
            isVerified: true,
          },
          accessToken: 'eyJhbGciOi...',
          refreshToken: 'eyJhbGciOi...',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid phone or password.',
  })
  login(@Body() data: LoginDto) {
    return this.authService.login(data);
  }
}
