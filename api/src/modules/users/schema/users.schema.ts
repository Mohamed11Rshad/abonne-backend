import { pgTable, uuid, text, timestamp, pgEnum, varchar, boolean } from 'drizzle-orm/pg-core';
import { USER_ROLE } from '../constant/user-roles';

export const userRoleEnum = pgEnum('user_role', [
  USER_ROLE.USER,
  USER_ROLE.ADMIN,
  USER_ROLE.SUPER_ADMIN,
  USER_ROLE.PARENT,
  USER_ROLE.DRIVER,
]);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  fullName: varchar('fullName', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: text('phone').notNull(),
  phoneHash: text('phone_hash').notNull().unique(),
  password: text('password').notNull(),
  role: userRoleEnum('role').default(USER_ROLE.PARENT).notNull(),
  isVerified: boolean('is_verified').default(false).notNull(),
  isBlocked: boolean('is_blocked').default(false).notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  changeCredentialTime: timestamp('change_credential_time', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
