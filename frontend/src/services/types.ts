export interface MediaNode {
  id: string;
  nodeType: 'MOVIE' | 'SHOW' | 'SEASON' | 'EPISODE' | 'COLLECTION' | 'LIVE_CHANNEL';
  title: string;
  originalTitle?: string;
  slug: string;
  tagline?: string;
  overview?: string;
  releaseYear?: number;
  runtimeSeconds?: number;
  communityRating?: number;
  posterPath?: string;
  fanartPath?: string;
  clearlogoPath?: string;
  thumbPath?: string;
  streamUrl?: string;
}

export interface UiRailItem {
  id: string;
  title: string;
  railType: string;
  cardStyle: string;
  sortOrder: number;
  items: MediaNode[];
}

export interface TagBadge {
  attr_code: string;
  display_name: string;
  ui_zone: string;
  color_theme: string;
  icon_name: string;
  value_text: string;
  value_slug: string;
  context_role?: string;
}

export interface MediaDetailResponse {
  media: MediaNode;
  tags: {
    HERO_BADGE: TagBadge[];
    PRIMARY_PILL: TagBadge[];
    PERSON_CAROUSEL: TagBadge[];
    TECHNICAL_DRAWER: TagBadge[];
  };
}

export interface MediaStatsResponse {
  totalMovies: number;
  totalShows: number;
  totalEpisodes: number;
  totalLiveChannels: number;
  totalSeasons: number;
  totalAll: number;
  topGenres: { name: string; count: number }[];
  recent: MediaNode[];
}
