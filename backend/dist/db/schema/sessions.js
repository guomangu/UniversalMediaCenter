import { pgTable, uuid, text, timestamp, doublePrecision, boolean, index, uniqueIndex, } from 'drizzle-orm/pg-core';
import { mediaNodes } from './nodes.js';
import { users } from './users.js';
export const mediaSessions = pgTable('media_sessions', {
    id: uuid('id').defaultRandom().primaryKey(),
    nodeId: uuid('node_id')
        .references(() => mediaNodes.id, { onDelete: 'cascade' })
        .notNull(),
    topicSlug: text('topic_slug').notNull(),
    hostUserId: uuid('host_user_id')
        .references(() => users.id, { onDelete: 'cascade' })
        .notNull(),
    hostDisplayName: text('host_display_name').notNull(),
    title: text('title').notNull(),
    scheduledAt: timestamp('scheduled_at').defaultNow().notNull(),
    status: text('status').default('ACTIVE').notNull(),
    currentPosition: doublePrecision('current_position').default(0).notNull(),
    isPlaying: boolean('is_playing').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    nodeIdx: index('idx_media_sessions_node').on(table.nodeId),
    topicIdx: index('idx_media_sessions_topic').on(table.topicSlug),
}));
export const mediaSessionParticipants = pgTable('media_session_participants', {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
        .references(() => mediaSessions.id, { onDelete: 'cascade' })
        .notNull(),
    userId: uuid('user_id')
        .references(() => users.id, { onDelete: 'cascade' })
        .notNull(),
    displayName: text('display_name').notNull(),
    isHost: boolean('is_host').default(false).notNull(),
    isMuted: boolean('is_muted').default(false).notNull(),
    lastPingAt: timestamp('last_ping_at').defaultNow().notNull(),
}, (table) => ({
    sessionUserUnique: uniqueIndex('idx_session_user_unique').on(table.sessionId, table.userId),
}));
