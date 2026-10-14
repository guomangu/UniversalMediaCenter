import { pgTable, uuid, text, timestamp, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const forumMessages = pgTable(
  'forum_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    topicSlug: text('topic_slug').notNull(),
    topicTitle: text('topic_title').notNull(),
    authorId: uuid('author_id'),
    authorName: text('author_name').default('Visiteur').notNull(),
    content: text('content').notNull(),
    mediaType: text('media_type').default('TEXT').notNull(),
    mediaUrl: text('media_url'),
    fileName: text('file_name'),
    replyToId: uuid('reply_to_id'),
    replyToText: text('reply_to_text'),
    replyToAuthor: text('reply_to_author'),
    voteCount: integer('vote_count').default(0).notNull(),
    quotedMediaId: uuid('quoted_media_id'),
    quotedMediaTitle: text('quoted_media_title'),
    quotedMediaPoster: text('quoted_media_poster'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    topicSlugIdx: index('idx_forum_topic_slug').on(table.topicSlug),
    createdIdx: index('idx_forum_created_at').on(table.createdAt),
  })
);

export const forumMessageVotes = pgTable(
  'forum_message_votes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .references(() => forumMessages.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    voteUnique: uniqueIndex('idx_forum_msg_user_vote').on(table.messageId, table.userId),
  })
);
