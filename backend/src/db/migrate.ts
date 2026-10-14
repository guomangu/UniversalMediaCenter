import { sqlClient } from './connection.js';

export async function initDatabaseExtensions(): Promise<void> {
  await sqlClient.unsafe(`
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE EXTENSION IF NOT EXISTS unaccent;
  `);
}

export async function createSchemaTables(): Promise<void> {
  await initDatabaseExtensions();
  
  await sqlClient.unsafe(`
    DO $$ BEGIN
      CREATE TYPE node_type AS ENUM ('COLLECTION', 'SHOW', 'SEASON', 'MOVIE', 'EPISODE', 'EXTRA', 'LIVE_CHANNEL');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      CREATE TYPE node_state AS ENUM ('DISCOVERED', 'PARSING_NFO', 'READY', 'MISSING_FILE', 'ERROR');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      CREATE TYPE tag_zone AS ENUM ('HERO_BADGE', 'PRIMARY_PILL', 'PERSON_CAROUSEL', 'TECHNICAL_DRAWER', 'HIDDEN_SEARCHABLE');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      CREATE TYPE rail_type AS ENUM ('HERO_SPOTLIGHT', 'CONTINUE_WATCHING', 'RECENTLY_ADDED', 'LIVE_TV_GRID', 'COLLECTIONS_ROW', 'DYNAMIC_TAG_QUERY', 'SPATIAL_NEARBY');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);

  await sqlClient.unsafe(`
    CREATE TABLE IF NOT EXISTS media_nodes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      parent_id UUID REFERENCES media_nodes(id) ON DELETE CASCADE,
      node_type node_type NOT NULL,
      state node_state DEFAULT 'DISCOVERED' NOT NULL,
      title TEXT NOT NULL,
      original_title TEXT,
      sort_title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      tagline TEXT,
      overview TEXT,
      order_index INTEGER DEFAULT 0 NOT NULL,
      absolute_order_index INTEGER,
      video_file_path TEXT,
      nfo_file_path TEXT UNIQUE,
      nfo_sha256 TEXT,
      stream_url TEXT,
      poster_path TEXT,
      fanart_path TEXT,
      clearlogo_path TEXT,
      thumb_path TEXT,
      release_year INTEGER,
      premiered_date TIMESTAMP,
      runtime_seconds INTEGER,
      community_rating DOUBLE PRECISION,
      chapters_json JSONB DEFAULT '[]'::jsonb,
      location GEOMETRY(Point, 4326),
      search_vector_text TEXT DEFAULT '' NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  await sqlClient.unsafe(`
    CREATE TABLE IF NOT EXISTS eav_attributes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      ui_zone tag_zone DEFAULT 'PRIMARY_PILL' NOT NULL,
      display_order INTEGER DEFAULT 100 NOT NULL,
      icon_name TEXT DEFAULT 'Tag' NOT NULL,
      color_theme TEXT DEFAULT 'slate' NOT NULL,
      is_filterable BOOLEAN DEFAULT TRUE NOT NULL,
      is_dynamic_catch_all BOOLEAN DEFAULT FALSE NOT NULL
    );
  `);
}
