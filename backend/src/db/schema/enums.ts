import { pgEnum } from 'drizzle-orm/pg-core';

export const nodeTypeEnum = pgEnum('node_type', [
  'COLLECTION',
  'SHOW',
  'SEASON',
  'MOVIE',
  'EPISODE',
  'EXTRA',
  'LIVE_CHANNEL',
]);

export const nodeStateEnum = pgEnum('node_state', [
  'DISCOVERED',
  'PARSING_NFO',
  'READY',
  'MISSING_FILE',
  'ERROR',
]);

export const tagZoneEnum = pgEnum('tag_zone', [
  'HERO_BADGE',
  'PRIMARY_PILL',
  'PERSON_CAROUSEL',
  'TECHNICAL_DRAWER',
  'HIDDEN_SEARCHABLE',
]);

export const railTypeEnum = pgEnum('rail_type', [
  'HERO_SPOTLIGHT',
  'CONTINUE_WATCHING',
  'RECENTLY_ADDED',
  'LIVE_TV_GRID',
  'COLLECTIONS_ROW',
  'DYNAMIC_TAG_QUERY',
  'SPATIAL_NEARBY',
]);
