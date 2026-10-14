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

export interface ProfileTypeDefinition {
  id: string;
  label: string;
  description?: string;
  isAdmin?: boolean;
  canDownload?: boolean;
  canTranscode?: boolean;
  canWatchIptv?: boolean;
  maxCsaAgeLimit?: number | null;
  allowedTags?: string[];
  blockedTags?: string[];
  blockedFolders?: string[];
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
  profileTypes: ProfileTypeDefinition[];
}

export const defaultProfileTypes: ProfileTypeDefinition[] = [
  {
    id: 'ADMINISTRATEUR',
    label: 'Administrateur',
    description: 'Accès complet sans restriction, gestion de la plateforme',
    isAdmin: true,
    canDownload: true,
    canTranscode: true,
    canWatchIptv: true,
    maxCsaAgeLimit: null,
    allowedTags: [],
    blockedTags: [],
    blockedFolders: [],
  },
  {
    id: 'MEMBRE',
    label: 'Membre Standard',
    description: 'Accès standard à l’ensemble de la médiathèque',
    isAdmin: false,
    canDownload: true,
    canTranscode: true,
    canWatchIptv: true,
    maxCsaAgeLimit: null,
    allowedTags: [],
    blockedTags: [],
    blockedFolders: [],
  },
  {
    id: 'ENFANT',
    label: 'Enfant (Jeunesse)',
    description: 'Dessins animés & famille, CSA -10, blocage violence et horreur',
    isAdmin: false,
    canDownload: false,
    canTranscode: true,
    canWatchIptv: false,
    maxCsaAgeLimit: 10,
    allowedTags: ['Animation', 'Jeunesse', 'Famille', 'Kids'],
    blockedTags: ['Horreur', '+18', 'Gore', 'Violence', 'Thriller'],
    blockedFolders: ['/Films/Horreur', '/Films/Adultes', 'Horreur'],
  },
  {
    id: 'SAFEZONE',
    label: 'Safezone',
    description: 'Tous publics et adolescents (CSA -12), blocage contenus violents et adultes',
    isAdmin: false,
    canDownload: true,
    canTranscode: true,
    canWatchIptv: true,
    maxCsaAgeLimit: 12,
    allowedTags: [],
    blockedTags: ['Horreur', '+18', 'Gore', 'Épouvante'],
    blockedFolders: ['/Films/Adultes', 'Horreur'],
  },
  {
    id: 'SEULEMENT_DES_MARVEL',
    label: 'Seulement des Marvel',
    description: 'Pack spécialisé restreint exclusivement aux contenus Marvel & Super-héros',
    isAdmin: false,
    canDownload: true,
    canTranscode: true,
    canWatchIptv: false,
    maxCsaAgeLimit: null,
    allowedTags: ['Marvel', 'Super-héros', 'MCU', 'Avengers'],
    blockedTags: [],
    blockedFolders: [],
  },
];

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
    defaultRole: 'MEMBRE',
    defaultCanDownload: true,
    defaultCanTranscode: true,
    defaultCanWatchIptv: true,
    defaultMaxCsaAge: null,
    defaultBlockedTags: [],
    defaultAllowedTags: [],
    defaultBlockedFolders: [],
  },
  profileTypes: defaultProfileTypes,
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
