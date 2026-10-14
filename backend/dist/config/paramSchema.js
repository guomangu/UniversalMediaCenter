export const defaultSiteParams = {
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
