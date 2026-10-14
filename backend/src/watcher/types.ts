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

export interface ParsedNfo {
  type: 'MOVIE' | 'SHOW' | 'EPISODE';
  title: string;
  originalTitle?: string;
  sortTitle?: string;
  tagline?: string;
  plot?: string;
  year?: number;
  premiered?: string;
  runtime?: number;
  rating?: number;
  genres: string[];
  tags: string[];
  studios: string[];
  countries: string[];
  directors: string[];
  writers: string[];
  actors: ParsedActor[];
  chapters: ParsedChapter[];
  streamDetails: {
    videoCodec?: string;
    videoQuality?: string;
    audioCodec?: string;
    audioChannels?: number;
    audioLanguage?: string;
    subtitleLanguage?: string;
  };
  customFields: Record<string, string>;
}
