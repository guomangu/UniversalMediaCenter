import { pgTable, uuid, text, integer, boolean, timestamp, index, } from 'drizzle-orm/pg-core';
import { mediaNodes } from './nodes.js';
export const iptvSources = pgTable('iptv_sources', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    m3uUrl: text('m3u_url').notNull(),
    epgXmltvUrl: text('epg_xmltv_url'),
    refreshIntervalHours: integer('refresh_interval_hours').default(6).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    userAgent: text('user_agent').default('UniversalMediaStack/3.0'),
    lastSyncedAt: timestamp('last_synced_at'),
});
export const epgPrograms = pgTable('epg_programs', {
    id: uuid('id').defaultRandom().primaryKey(),
    channelNodeId: uuid('channel_node_id')
        .references(() => mediaNodes.id, { onDelete: 'cascade' })
        .notNull(),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    description: text('description'),
    category: text('category'),
    iconUrl: text('icon_url'),
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time').notNull(),
}, (table) => ({
    channelTimeIdx: index('idx_epg_channel_time').on(table.channelNodeId, table.startTime, table.endTime),
}));
