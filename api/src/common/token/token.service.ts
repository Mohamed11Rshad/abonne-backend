import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface TokenPayload {
  id: string ;
  role: string;
  changecredentialtime: Date;
}

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  async generateTokens(payload: TokenPayload) {
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.ACCESS_TOKEN_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRATION as any,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.REFRESH_TOKEN_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRATION as any,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async createAccessToken(payload: TokenPayload) {
    return this.jwtService.signAsync(payload, {
      secret: process.env.ACCESS_TOKEN_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRATION as any,
    });
  }

  async verifyToken(token: string, isRefresh = false) {
    try {
      const res = await this.jwtService.verify(token, {
        secret: isRefresh
          ? process.env.REFRESH_TOKEN_SECRET
          : process.env.ACCESS_TOKEN_SECRET,
      });

      return res;
    } catch (error) {
      throw error;
    }
  }

  decodeToken(token: string): TokenPayload {
    return this.jwtService.decode(token);
  }
}
