import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, doublePrecision, uniqueIndex, } from 'drizzle-orm/pg-core';
import { mediaNodes } from './nodes.js';
export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash'),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    pinHash: text('pin_hash'),
    isAdmin: boolean('is_admin').default(false).notNull(),
    profileRole: text('profile_role').default('STANDARD'),
    canDownload: boolean('can_download').default(true).notNull(),
    canTranscode: boolean('can_transcode').default(true).notNull(),
    canWatchIptv: boolean('can_watch_iptv').default(true).notNull(),
    maxConcurrentStreams: integer('max_concurrent_streams').default(3).notNull(),
    maxCsaAgeLimit: integer('max_csa_age_limit'),
    allowedValueIds: jsonb('allowed_value_ids').$type().default([]),
    blockedValueIds: jsonb('blocked_value_ids').$type().default([]),
    allowedTags: jsonb('allowed_tags').$type().default([]),
    blockedTags: jsonb('blocked_tags').$type().default([]),
    blockedFolders: jsonb('blocked_folders').$type().default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const watchProgress = pgTable('watch_progress', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
        .references(() => users.id, { onDelete: 'cascade' })
        .notNull(),
    nodeId: uuid('node_id')
        .references(() => mediaNodes.id, { onDelete: 'cascade' })
        .notNull(),
    positionSeconds: doublePrecision('position_seconds').default(0).notNull(),
    durationSeconds: doublePrecision('duration_seconds').default(0).notNull(),
    isCompleted: boolean('is_completed').default(false).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    userNodeUnique: uniqueIndex('idx_progress_user_node').on(table.userId, table.nodeId),
}));
