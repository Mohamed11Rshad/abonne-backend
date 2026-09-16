import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly instance: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl =
      this.configService.get<string>('EVOLUTION_API_URL') || 'http://localhost:8080';
    this.apiKey =
      this.configService.get<string>('EVOLUTION_API_KEY') ||
      'YOUR_SUPER_SECRET_GLOBAL_API_KEY';
    this.instance =
      this.configService.get<string>('EVOLUTION_INSTANCE') || 'abone';
  }

  /**
   * Send an OTP message via WhatsApp using Evolution API
   * @param phone Phone number in E.164 format (+2010...) or local digits
   * @param otp The 6-digit OTP code
   */
  async sendOTP(phone: string, otp: string): Promise<boolean> {
    // Format phone number for Evolution API: strip '+' so it's country code + number (e.g. 201012345678)
    const formattedNumber = phone.replace(/^\+/, '').replace(/\s+/g, '');

    const url = `${this.apiUrl.replace(/\/$/, '')}/message/sendText/${this.instance}`;
    const text = `رمز التحقق الخاص بك في Abonne هو: *${otp}*\nهذا الرمز صالح لمدة 15 دقيقة. لا تشاركه مع أي شخص.\n\nYour Abonne verification code is: *${otp}*\nValid for 15 minutes. Do not share this code.`;

    try {
      this.logger.log(`Sending WhatsApp OTP to ${formattedNumber} via instance [${this.instance}]`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify({
          number: formattedNumber,
          text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Failed to send WhatsApp message via Evolution API. Status: ${response.status}. Response: ${errorText}`,
        );
        throw new InternalServerErrorException(
          'Failed to send WhatsApp verification code. Please try again.',
        );
      }

      this.logger.log(`WhatsApp OTP sent successfully to ${formattedNumber}`);
      return true;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(`Error connecting to Evolution API: ${error?.message || error}`);
      throw new InternalServerErrorException(
        'Unable to connect to WhatsApp notification service. Please try again later.',
      );
    }
  }
}
