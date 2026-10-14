import { sqlClient } from './connection.js';
export async function createSecondaryTables() {
    await sqlClient.unsafe(`
    CREATE TABLE IF NOT EXISTS eav_values (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      attribute_id UUID NOT NULL REFERENCES eav_attributes(id) ON DELETE CASCADE,
      value_text TEXT NOT NULL,
      value_slug TEXT NOT NULL,
      metadata_json JSONB DEFAULT '{}'::jsonb,
      CONSTRAINT idx_eav_attr_val_unique UNIQUE (attribute_id, value_slug)
    );
    CREATE TABLE IF NOT EXISTS node_eav_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      node_id UUID NOT NULL REFERENCES media_nodes(id) ON DELETE CASCADE,
      value_id UUID NOT NULL REFERENCES eav_values(id) ON DELETE CASCADE,
      context_role TEXT,
      order_index INTEGER DEFAULT 0 NOT NULL,
      CONSTRAINT idx_node_val_role UNIQUE (node_id, value_id, context_role)
    );
    CREATE TABLE IF NOT EXISTS ui_rails (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page_target TEXT DEFAULT 'HOME' NOT NULL,
      title TEXT NOT NULL,
      rail_type rail_type NOT NULL,
      card_style TEXT DEFAULT 'POSTER_VERTICAL' NOT NULL,
      sort_order INTEGER DEFAULT 0 NOT NULL,
      is_active BOOLEAN DEFAULT TRUE NOT NULL,
      query_config_json JSONB DEFAULT '{}'::jsonb
    );
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      pin_hash TEXT,
      is_admin BOOLEAN DEFAULT FALSE NOT NULL,
      can_download BOOLEAN DEFAULT TRUE NOT NULL,
      can_transcode BOOLEAN DEFAULT TRUE NOT NULL,
      can_watch_iptv BOOLEAN DEFAULT TRUE NOT NULL,
      max_concurrent_streams INTEGER DEFAULT 3 NOT NULL,
      max_csa_age_limit INTEGER,
      allowed_value_ids JSONB DEFAULT '[]'::jsonb,
      blocked_value_ids JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS watch_progress (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      node_id UUID NOT NULL REFERENCES media_nodes(id) ON DELETE CASCADE,
      position_seconds DOUBLE PRECISION DEFAULT 0 NOT NULL,
      duration_seconds DOUBLE PRECISION DEFAULT 0 NOT NULL,
      is_completed BOOLEAN DEFAULT FALSE NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
      CONSTRAINT idx_progress_user_node UNIQUE (user_id, node_id)
    );
    CREATE TABLE IF NOT EXISTS iptv_sources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      m3u_url TEXT NOT NULL,
      epg_xmltv_url TEXT,
      refresh_interval_hours INTEGER DEFAULT 6 NOT NULL,
      is_active BOOLEAN DEFAULT TRUE NOT NULL,
      user_agent TEXT DEFAULT 'UniversalMediaStack/3.0',
      last_synced_at TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS epg_programs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_node_id UUID NOT NULL REFERENCES media_nodes(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      subtitle TEXT,
      description TEXT,
      category TEXT,
      icon_url TEXT,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_media_nodes_trgm ON media_nodes USING gin (search_vector_text gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_eav_values_trgm ON eav_values USING gin (value_text gin_trgm_ops);
  `);
}
