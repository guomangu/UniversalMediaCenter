import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const userInvitations = pgTable('user_invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  token: text('token').notNull().unique(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  displayName: text('display_name').notNull(),
  email: text('email').notNull(),
  rawPassword: text('raw_password').notNull(),
  profileRole: text('profile_role').default('STANDARD').notNull(),
  clicksCount: integer('clicks_count').default(0).notNull(),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
