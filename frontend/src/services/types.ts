export interface MediaNode {
  id: string;
  nodeType: 'MOVIE' | 'SHOW' | 'SEASON' | 'EPISODE' | 'COLLECTION' | 'LIVE_CHANNEL';
  title: string;
  originalTitle?: string;
  slug: string;
  tagline?: string;
  overview?: string;
  releaseYear?: number | string;
  runtimeSeconds?: number;
  communityRating?: number;
  posterPath?: string;
  fanartPath?: string;
  clearlogoPath?: string;
  thumbPath?: string;
  streamUrl?: string;
  seasonEpisodeTag?: string | null;
  displayBadge?: string | null;
  positionSeconds?: number;
  durationSeconds?: number;
  progressPercent?: number;
  isCompleted?: boolean;
  edition?: string | null;
  confidenceScore?: number;
  isExtra?: boolean;
  extraType?: string | null;
  chaptersJson?: any[];
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
  metadata_json?: {
    thumbUrl?: string;
  };
}

export interface RelatedTagGroup {
  label: string;
  slug: string;
  colorTheme?: string;
  medias: any[];
}

export interface ParentSaga {
  id: string;
  title: string;
  nodeType?: string;
  overview?: string;
  posterPath?: string;
  fanartPath?: string;
  movies: Array<{
    id: string;
    title: string;
    releaseYear?: number;
    nodeType: string;
    orderIndex?: number;
    communityRating?: number;
    posterPath?: string;
  }>;
}

export interface StudioMediaGroup {
  studioName: string;
  medias: Array<{
    id: string;
    title: string;
    releaseYear?: number;
    nodeType: string;
    communityRating?: number;
    posterPath?: string;
  }>;
}

export interface MediaDetailResponse {
  media: MediaNode;
  tags: {
    HERO_BADGE: TagBadge[];
    PRIMARY_PILL: TagBadge[];
    PERSON_CAROUSEL: TagBadge[];
    TECHNICAL_DRAWER: TagBadge[];
  };
  children?: MediaNode[];
  extras?: MediaNode[];
  parentSaga?: ParentSaga | null;
  studioMedias?: StudioMediaGroup[];
  relatedTags?: RelatedTagGroup[];
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
