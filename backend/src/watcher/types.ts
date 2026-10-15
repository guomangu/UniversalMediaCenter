export interface ParsedActor {
  name: string;
  role?: string;
  thumb?: string;
}

export interface ParsedChapter {
  title: string;
  startSeconds: number;
  endSeconds: number;
  type?: 'INTRO' | 'OUTRO' | 'NORMAL';
}

export interface ParsedAudioTrack {
  codec?: string;
  language?: string;
  channels?: number;
  bitrate?: number;
  samplingRate?: number;
}

export interface ParsedSubtitleTrack {
  codec?: string;
  language?: string;
  forced?: boolean;
}

export interface ParsedStreamDetails {
  videoCodec?: string;
  videoQuality?: string;
  videoWidth?: number;
  videoHeight?: number;
  aspectRatio?: string;
  framerate?: number | string;
  durationSeconds?: number;
  bitrate?: number;
  audioTracks: ParsedAudioTrack[];
  subtitleTracks: ParsedSubtitleTrack[];
}

export interface ParsedNfo {
  type: 'COLLECTION' | 'SHOW' | 'SEASON' | 'MOVIE' | 'EPISODE' | 'EXTRA';
  title: string;
  originalTitle?: string;
  sortTitle?: string;
  showTitle?: string;
  collectionName?: string;
  collectionTmdbId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  absoluteEpisodeNumber?: number;
  folderSeason?: number;
  folderTitle?: string;
  tagline?: string;
  plot?: string;
  outline?: string;
  year?: number;
  premiered?: string;
  runtime?: number;
  rating?: number;
  certification?: string;
  genres: string[];
  tags: string[];
  studios: string[];
  countries: string[];
  directors: string[];
  writers: string[];
  producers?: string[];
  composers?: string[];
  actors: ParsedActor[];
  chapters: ParsedChapter[];
  streamDetails: ParsedStreamDetails;
  customFields: Record<string, string>;
}
