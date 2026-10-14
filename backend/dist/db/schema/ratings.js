import { pgTable, uuid, integer, text, timestamp, uniqueIndex, } from 'drizzle-orm/pg-core';
import { users } from './users.js';
export const userRatings = pgTable('user_ratings', {
    id: uuid('id').defaultRandom().primaryKey(),
    targetUserId: uuid('target_user_id')
        .references(() => users.id, { onDelete: 'cascade' })
        .notNull(),
    ratedByUserId: uuid('rated_by_user_id')
        .references(() => users.id, { onDelete: 'cascade' })
        .notNull(),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    ratingUnique: uniqueIndex('idx_user_rating_unique').on(table.targetUserId, table.ratedByUserId),
}));
