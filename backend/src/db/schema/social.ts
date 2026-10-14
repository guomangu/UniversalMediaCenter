import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { mediaNodes } from './nodes.js';

export const userFavorites = pgTable(
  'user_favorites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    nodeId: uuid('node_id')
      .references(() => mediaNodes.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userNodeFavUnique: uniqueIndex('idx_favorites_user_node').on(
      table.userId,
      table.nodeId
    ),
  })
);

export const userFriends = pgTable(
  'user_friends',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    friendId: uuid('friend_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    status: text('status').default('PENDING').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userFriendUnique: uniqueIndex('idx_friends_user_friend').on(
      table.userId,
      table.friendId
    ),
  })
);

export const mediaReposts = pgTable(
  'media_reposts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    nodeId: uuid('node_id')
      .references(() => mediaNodes.id, { onDelete: 'cascade' })
      .notNull(),
    rating: integer('rating'),
    comment: text('comment'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }
);
