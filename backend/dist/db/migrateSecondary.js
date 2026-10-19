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
      bio TEXT,
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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_incognito BOOLEAN DEFAULT FALSE NOT NULL;
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
    CREATE TABLE IF NOT EXISTS user_favorites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      node_id UUID NOT NULL REFERENCES media_nodes(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      CONSTRAINT idx_favorites_user_node UNIQUE (user_id, node_id)
    );
    CREATE TABLE IF NOT EXISTS iptv_sources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      m3u_url TEXT NOT NULL,
      epg_xmltv_url TEXT,
      refresh_interval_hours INTEGER DEFAULT 24 NOT NULL,
      is_active BOOLEAN DEFAULT TRUE NOT NULL,
      user_agent TEXT,
      last_synced_at TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS epg_programs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_node_id UUID NOT NULL REFERENCES media_nodes(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      subtitle TEXT,
      description TEXT,
      category TEXT,
      thumbnail_url TEXT,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_devices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      device_type TEXT DEFAULT 'BROWSER' NOT NULL,
      last_active_at TIMESTAMP DEFAULT NOW() NOT NULL,
      ip_address TEXT,
      is_current BOOLEAN DEFAULT FALSE NOT NULL,
      CONSTRAINT idx_user_device_unique UNIQUE (user_id, device_id)
    );
    CREATE TABLE IF NOT EXISTS forum_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      topic_slug TEXT NOT NULL,
      author_id UUID,
      author_name TEXT DEFAULT 'Visiteur' NOT NULL,
      author_avatar TEXT,
      content TEXT NOT NULL,
      media_attachment_json JSONB,
      quoted_media_json JSONB,
      reply_to_id UUID,
      reply_to_author TEXT,
      reply_to_content TEXT,
      upvotes INTEGER DEFAULT 0 NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS forum_voice_participants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      topic_slug TEXT NOT NULL,
      user_id UUID,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      is_speaking BOOLEAN DEFAULT FALSE NOT NULL,
      is_muted BOOLEAN DEFAULT FALSE NOT NULL,
      last_ping_at TIMESTAMP DEFAULT NOW() NOT NULL,
      joined_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_friendships (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'ACCEPTED' NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      CONSTRAINT idx_friendship_unique UNIQUE (user_id, friend_id)
    );
    CREATE TABLE IF NOT EXISTS media_reposts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      node_id UUID NOT NULL REFERENCES media_nodes(id) ON DELETE CASCADE,
      comment TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      CONSTRAINT idx_repost_user_node UNIQUE (user_id, node_id)
    );
    CREATE TABLE IF NOT EXISTS media_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      node_id UUID REFERENCES media_nodes(id) ON DELETE SET NULL,
      topic_slug TEXT,
      host_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      host_display_name TEXT NOT NULL,
      title TEXT NOT NULL,
      scheduled_at TIMESTAMP DEFAULT NOW() NOT NULL,
      status TEXT DEFAULT 'ACTIVE' NOT NULL,
      current_position DOUBLE PRECISION DEFAULT 0 NOT NULL,
      is_playing BOOLEAN DEFAULT TRUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS media_session_participants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES media_sessions(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      is_host BOOLEAN DEFAULT FALSE NOT NULL,
      is_muted BOOLEAN DEFAULT FALSE NOT NULL,
      last_ping_at TIMESTAMP DEFAULT NOW() NOT NULL,
      CONSTRAINT idx_session_user_unique UNIQUE (session_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS user_ratings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rated_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      CONSTRAINT idx_user_rating_unique UNIQUE (target_user_id, rated_by_user_id)
    );
    CREATE TABLE IF NOT EXISTS user_invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token TEXT NOT NULL UNIQUE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      email TEXT NOT NULL,
      raw_password TEXT NOT NULL,
      profile_role TEXT DEFAULT 'STANDARD' NOT NULL,
      clicks_count INTEGER DEFAULT 0 NOT NULL,
      last_used_at TIMESTAMP,
      expires_at TIMESTAMP,
      is_used BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
    ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
    ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS is_used BOOLEAN DEFAULT FALSE NOT NULL;
    CREATE TABLE IF NOT EXISTS device_revocations (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      PRIMARY KEY (user_id, device_id)
    );
    CREATE INDEX IF NOT EXISTS idx_device_revocations_user ON device_revocations (user_id);
    ALTER TABLE media_nodes ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION DEFAULT 1.0 NOT NULL;
    ALTER TABLE media_nodes ADD COLUMN IF NOT EXISTS oshash TEXT;
    ALTER TABLE media_nodes ADD COLUMN IF NOT EXISTS crc32 TEXT;
    ALTER TABLE media_nodes ADD COLUMN IF NOT EXISTS edition TEXT;
    ALTER TABLE media_nodes ADD COLUMN IF NOT EXISTS is_extra BOOLEAN DEFAULT FALSE NOT NULL;
    ALTER TABLE media_nodes ADD COLUMN IF NOT EXISTS extra_type TEXT;
    ALTER TABLE media_nodes ADD COLUMN IF NOT EXISTS translations_json JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE media_nodes ADD COLUMN IF NOT EXISTS iptv_source_id UUID REFERENCES iptv_sources(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_media_nodes_iptv_source ON media_nodes (iptv_source_id);
    CREATE INDEX IF NOT EXISTS idx_media_nodes_confidence ON media_nodes (confidence_score);
    CREATE INDEX IF NOT EXISTS idx_media_nodes_is_extra ON media_nodes (is_extra);
    CREATE INDEX IF NOT EXISTS idx_media_nodes_oshash ON media_nodes (oshash);
    CREATE INDEX IF NOT EXISTS idx_media_nodes_trgm ON media_nodes USING gin (search_vector_text gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_eav_values_trgm ON eav_values USING gin (value_text gin_trgm_ops);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_node_val_role_coalesce ON node_eav_links (node_id, value_id, COALESCE(context_role, ''));
    CREATE INDEX IF NOT EXISTS idx_media_sessions_node ON media_sessions (node_id);
    CREATE INDEX IF NOT EXISTS idx_media_sessions_topic ON media_sessions (topic_slug);
    CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations (token);
  `);
}
