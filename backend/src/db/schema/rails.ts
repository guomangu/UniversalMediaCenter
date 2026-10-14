import { pgTable, uuid, text, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { railTypeEnum } from './enums.js';

export interface UiRailQueryConfig {
  includeTagSlugsAll?: string[];
  includeTagSlugsAny?: string[];
  excludeTagSlugs?: string[];
  nodeTypes?: Array<'MOVIE' | 'SHOW' | 'COLLECTION' | 'LIVE_CHANNEL'>;
  sortBy?: 'RELEASE_DATE_DESC' | 'ADDED_DATE_DESC' | 'RATING_DESC' | 'RANDOM';
  limit?: number;
}

export const uiRails = pgTable('ui_rails', {
  id: uuid('id').defaultRandom().primaryKey(),
  pageTarget: text('page_target').default('HOME').notNull(),
  title: text('title').notNull(),
  railType: railTypeEnum('rail_type').notNull(),
  cardStyle: text('card_style').default('POSTER_VERTICAL').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  queryConfigJson: jsonb('query_config_json').$type<UiRailQueryConfig>().default({}),
});
