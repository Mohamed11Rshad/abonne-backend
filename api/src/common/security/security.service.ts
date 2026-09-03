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

  // --- Hashing ---

  async hashPassword(password: string): Promise<string> {
    const saltRounds = Number(process.env.SALT_ROUNDS);
    return await bcrypt.hash(password, saltRounds);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
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
}
