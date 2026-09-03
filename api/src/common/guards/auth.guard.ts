import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { TokenService } from "../token/token.service";
import { i18nValidationMessage } from "nestjs-i18n";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { USER_ROLE } from "../../modules/users/constant/user-roles";
import { DRIZZLE } from "../../drizzle/drizzle.provider";
import type { DrizzleDB } from "../../drizzle/drizzle.provider";
import { users } from "../../modules/users/schema/users.schema";
import { eq } from "drizzle-orm";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const [key, token] = request.headers.authorization?.split(' ') || [];
    if (!token || key?.toLowerCase() !== 'bearer') {
      throw new UnauthorizedException(i18nValidationMessage('local.common.INVALID_TOKEN'));
    }
    const decodedToken = await this.tokenService.verifyToken(token);
    if (!decodedToken) {
      throw new UnauthorizedException(i18nValidationMessage('local.common.INVALID_TOKEN'));
    }
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, decodedToken.id))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException(i18nValidationMessage('local.user.USER_NOT_FOUND'));
    }
    const requiredRoles = this.reflector.getAllAndOverride<USER_ROLE[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(i18nValidationMessage('local.user.FORBIDDEN'));
    }
    request.user = user;
    return true;
  }
}