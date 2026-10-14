export interface ServerParams {
  siteName: string;
  siteTagline: string;
  locale: string;
  port: number;
  corsOrigins?: string[];
  publicBaseUrl?: string;
}

export interface ProfileDefaultsParams {
  defaultRole: string;
  defaultCanDownload: boolean;
  defaultCanTranscode: boolean;
  defaultCanWatchIptv: boolean;
  defaultMaxCsaAge: number | null;
  defaultBlockedTags: string[];
  defaultAllowedTags: string[];
  defaultBlockedFolders: string[];
}

export interface SecurityParams {
  invitationOnly: boolean;
  invitationCodes: string[];
  allowOnTheFlyCreation: boolean;
  defaultPasswordRequired: boolean;
  defaultPinRequired?: boolean;
  defaultMaxCsaAge: number | null;
}

export interface UiParams {
  theme: string;
  defaultView: string;
  enableHeroSpotlight: boolean;
  enableCastModal: boolean;
  enableSkipIntro: boolean;
  skipIntroDurationSeconds: number;
  cardsPerRail: number;
  bannerHeight?: number;
}

export interface MediaParams {
  autoEnrichMetadata: boolean;
  enrichmentBatchSize: number;
  autoReindexOnStart: boolean;
  enableLiveTvProxy: boolean;
  supportedVideoCodecs: string[];
  globalExcludedFolders?: string[];
  defaultAudioLanguage?: string;
  defaultSubtitleLanguage?: string;
}

export interface SiteParams {
  server: ServerParams;
  security: SecurityParams;
  ui: UiParams;
  media: MediaParams;
  profiles: ProfileDefaultsParams;
}

export const defaultSiteParams: SiteParams = {
  server: {
    siteName: 'The Universal Media Stack',
    siteTagline: 'Le hub multimédia zéro-config out-of-the-box',
    locale: 'fr-FR',
    port: 3000,
    corsOrigins: ['*'],
    publicBaseUrl: 'https://api.cool.sweaw.com',
  },
  security: {
    invitationOnly: false,
    invitationCodes: ['UMS-WELCOME-2026', 'COOL-MEDIA-VIP'],
    allowOnTheFlyCreation: true,
    defaultPasswordRequired: false,
    defaultPinRequired: false,
    defaultMaxCsaAge: null,
  },
  profiles: {
    defaultRole: 'STANDARD',
    defaultCanDownload: true,
    defaultCanTranscode: true,
    defaultCanWatchIptv: true,
    defaultMaxCsaAge: null,
    defaultBlockedTags: [],
    defaultAllowedTags: [],
    defaultBlockedFolders: [],
  },
  ui: {
    theme: 'dark',
    defaultView: 'HOME',
    enableHeroSpotlight: true,
    enableCastModal: true,
    enableSkipIntro: true,
    skipIntroDurationSeconds: 85,
    cardsPerRail: 15,
    bannerHeight: 460,
  },
  media: {
    autoEnrichMetadata: true,
    enrichmentBatchSize: 30,
    autoReindexOnStart: true,
    enableLiveTvProxy: true,
    supportedVideoCodecs: ['h264', 'hevc', 'vp9', 'av1'],
    globalExcludedFolders: ['@eaDir', '#recycle', '.git', 'lost+found'],
    defaultAudioLanguage: 'fra',
    defaultSubtitleLanguage: 'fra',
  },
};
