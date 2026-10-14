import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
export const forumMessages = pgTable('forum_messages', {
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
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    topicSlugIdx: index('idx_forum_topic_slug').on(table.topicSlug),
    createdIdx: index('idx_forum_created_at').on(table.createdAt),
}));
