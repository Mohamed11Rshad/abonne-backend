import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
@Injectable()
export class SecurityService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key = crypto.scryptSync(
    process.env.ENCRYPTION_KEY as string,
    'salt',
    32,
  );

  private readonly hmacKey = process.env.HMAC_KEY as string;

  // --- Hashing ---

  async hash(password: string): Promise<string> {
    const saltRounds = Number(process.env.SALT_ROUNDS);
    return await bcrypt.hash(password, saltRounds);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
      return false;
    }
    return await bcrypt.compare(password, hash);
  }

  generateOTP(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  // --- Encryption ---

  encrypt(text: string): { iv: string; content: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag().toString('hex');

    return {
      iv: iv.toString('hex'),
      content: encrypted,
      tag: tag,
    };
  }

  decrypt(encryptedData: { iv: string; content: string; tag: string }): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(encryptedData.iv, 'hex'),
    );

    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

    let decrypted = decipher.update(encryptedData.content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // --- HMAC ---
  hmac(text: string): string {
    return crypto.createHmac('sha256', this.hmacKey).update(text).digest('hex');
  }

  // normalize egyptian phone
  normalizePhone(phone: string): string {
    let normalized = phone.replace(/\s+/g, '');
      
    if (normalized.startsWith('002')) {
      normalized = '+' + normalized.substring(2);
    }
      
    if (normalized.startsWith('01') && normalized.length === 11) {
      normalized = '+2' + normalized;
    }
  
    if (/^201[0125]\d{8}$/.test(normalized)) {
      normalized = '+' + normalized;
    }
      
    // Fix common typo +021 for the Egyptian prefix +201
    if (normalized.startsWith('+021')) {
      normalized = '+201' + normalized.substring(4);
    }
  
    if (!/^\+201[0125]\d{8}$/.test(normalized)) {
      throw new BadRequestException('Invalid phone number format');
    }
  
    return normalized;
  }

  
}
