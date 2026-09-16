import { pgTable, uuid, text, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core';

export const otpVerifications = pgTable(
  'otp_verifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: text('phone').notNull(),
    phoneHash: text('phone_hash').notNull(),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    password: text('password').notNull(),
    otpHash: text('otp_hash').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    isUsed: boolean('is_used').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('otp_verifications_phone_hash_idx').on(table.phoneHash),
  ],
);

export type OtpVerification = typeof otpVerifications.$inferSelect;
export type NewOtpVerification = typeof otpVerifications.$inferInsert;
