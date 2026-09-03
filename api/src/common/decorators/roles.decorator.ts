import { SetMetadata } from "@nestjs/common";
import { USER_ROLE } from "../../modules/users/constant/user-roles";

export const ROLES_KEY = 'roles';
export const Roles = (...roles: USER_ROLE[]) => SetMetadata(ROLES_KEY, roles);