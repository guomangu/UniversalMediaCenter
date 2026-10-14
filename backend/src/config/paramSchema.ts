export interface ServerParams {
  siteName: string;
  siteTagline: string;
  locale: string;
  port: number;
}

export interface SecurityParams {
  invitationOnly: boolean;
  invitationCodes: string[];
  allowOnTheFlyCreation: boolean;
  defaultPinRequired: boolean;
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
}

export interface MediaParams {
  autoEnrichMetadata: boolean;
  enrichmentBatchSize: number;
  autoReindexOnStart: boolean;
  enableLiveTvProxy: boolean;
  supportedVideoCodecs: string[];
}

export interface SiteParams {
  server: ServerParams;
  security: SecurityParams;
  ui: UiParams;
  media: MediaParams;
}

export const defaultSiteParams: SiteParams = {
  server: {
    siteName: 'The Universal Media Stack',
    siteTagline: 'Le hub multimédia zéro-config out-of-the-box',
    locale: 'fr-FR',
    port: 3000,
  },
  security: {
    invitationOnly: false,
    invitationCodes: ['UMS-WELCOME-2026'],
    allowOnTheFlyCreation: true,
    defaultPinRequired: false,
    defaultMaxCsaAge: null,
  },
  ui: {
    theme: 'dark',
    defaultView: 'HOME',
    enableHeroSpotlight: true,
    enableCastModal: true,
    enableSkipIntro: true,
    skipIntroDurationSeconds: 85,
    cardsPerRail: 15,
  },
  media: {
    autoEnrichMetadata: true,
    enrichmentBatchSize: 30,
    autoReindexOnStart: true,
    enableLiveTvProxy: true,
    supportedVideoCodecs: ['h264', 'hevc', 'vp9', 'av1'],
  },
};
