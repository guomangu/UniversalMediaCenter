import path from 'node:path';
import { sanitizeReleaseTags, extractYearFromText, extractCanonicalShowTitle, cleanMediaTitle, normalizePhoneticSpelling, normalizeRomanNumerals } from './titleCleaner.js';
import { parseSeasonEpisode } from './seasonEpisodeHelper.js';
import { isExtraMediaFile, analyzeFolderGrouping } from './folderGrouper.js';
import { detectSagaNameFromFolder, resolveSeriesRoot } from './hierarchyResolver.js';
import { stringSimilarity } from './externalMetadata.js';
const testCases = [
    // 1. Anime avec sous-dossiers d'arcs et numérotation absolue (Bleach)
    {
        name: 'Anime Arc Subfolder 3-digit Episode',
        filePath: "/home/tele/Vidéos/drive/Animes/Bleach/04- Karakura's Battle/Bleach - 214 - Karakurizer Konsô le justicier. La cape super-utile.mkv",
        expectedType: 'EPISODE',
        expectedShowTitle: 'Bleach',
        expectedEpisode: 214,
        expectedIsExtra: false,
    },
    // 2. Série téléchargée avec préfixe tracker torrent entre crochets
    {
        name: 'Torrent Tracker Prefix',
        filePath: '/home/tele/Vidéos/drive/Series/[ Torrent911.rs ] Le.Flambeau.Les.Aventuriers.de.Chupacabra.S01.FRENCH.1080p.WEB.H264-PROPJOE/Le.Flambeau.Les.Aventuriers.de.Chupacabra.S01E04.FRENCH.1080p.WEB.H264-PROPJOE.mkv',
        expectedType: 'EPISODE',
        expectedShowTitle: 'Le Flambeau Les Aventuriers De Chupacabra',
        expectedSeason: 1,
        expectedEpisode: 4,
        expectedIsExtra: false,
    },
    // 3. Fansub Anime avec nom de team et épisode absolu
    {
        name: 'Fansub Group and Absolute Episode',
        filePath: '/run/media/tele/gudbug/PARTAGED/SERIES/[Neutrinome] Darling in the FranXX - VOSTFR [1080p BDRip FLAC]/[Neutrinome] Darling in the FranXX - 02 - VOSTFR [1080p BDRip FLAC].mkv',
        expectedType: 'EPISODE',
        expectedShowTitle: 'Darling in the FranXX',
        expectedSeason: 1,
        expectedEpisode: 2,
        expectedIsExtra: false,
    },
    // 4. Série avec dossier français "saison 1" et numéro simple "7 - conjonctivite"
    {
        name: 'French Season Folder Simple Number',
        filePath: '/run/media/tele/My Passport/anime/south park/south park - saison 1/7 - conjonctivite.avi',
        expectedType: 'EPISODE',
        expectedShowTitle: 'South Park',
        expectedSeason: 1,
        expectedEpisode: 7,
        expectedIsExtra: false,
    },
    // 5. Série avec notation 5x07
    {
        name: 'Season Episode SxEE format',
        filePath: '/run/media/tele/My Passport/anime/south park/south park - saison 5/south park 5x07.avi',
        expectedType: 'EPISODE',
        expectedShowTitle: 'South Park',
        expectedSeason: 5,
        expectedEpisode: 7,
        expectedIsExtra: false,
    },
    // 6. Film avec underscore initial et sous-dossier de qualité
    {
        name: 'Leading Underscore and Quality Folder Movie',
        filePath: '/run/media/tele/gudbug/PARTAGED/FILMS/_LOW_QUALITY_720p/_American Sniper 720p (2014).mkv',
        expectedType: 'MOVIE',
        expectedTitle: 'American Sniper',
        expectedIsExtra: false,
    },
    // 7. Saga Studio Ghibli avec span d'années
    {
        name: 'Studio Ghibli Saga Folder',
        filePath: '/run/media/tele/My Passport/film/collection studio ghibli (1984 - 2023) multi 1080p 10bits bluray av1 opus -punisher694/porco rosso (1992) multi 1080p 10bits bluray av1 opus -punisher694.mkv',
        expectedType: 'MOVIE',
        expectedTitle: 'Porco Rosso',
        expectedSaga: 'Studio Ghibli - Saga',
        expectedIsExtra: false,
    },
    // 8. Film Pixar dans collection avec résolution 1920x804
    {
        name: 'Pixar Movie in Collection with Video Resolution in Filename',
        filePath: '/home/tele/Vidéos/drive/Films/The Pixar-Disney Animations Collection (1995-2024)/2017.Coco.1920x804.BDRip.x264.DTS-HD.MA.mkv',
        expectedType: 'MOVIE',
        expectedTitle: 'Coco',
        expectedSaga: 'The Pixar-Disney Animations - Saga',
        expectedIsExtra: false,
    },
    // 9. Extra / Bonus NCED avec hash CRC32
    {
        name: 'Anime Bonus NCED',
        filePath: '/home/tele/Vidéos/drive/Animes/Angel Beats! - iNTEGRALE (2010) MULTi 1080p 10bits BluRay x265 AAC v2 -Punisher694/Bonus/NCED04 [1060C7B0].mkv',
        expectedType: 'EXTRA',
        expectedIsExtra: true,
    },
    // 10. Film autonome avec suffixe "vf en entier"
    {
        name: 'Movie with French Suffix "vf en entier"',
        filePath: '/run/media/tele/My Passport/film/amityville - vf en entier.mp4',
        expectedType: 'MOVIE',
        expectedTitle: 'Amityville',
        expectedIsExtra: false,
    },
    // 11. Film avec titre alternatif français "Searching - Portée disparue (2018)"
    {
        name: 'Movie with French Subtitle Title',
        filePath: '/run/media/tele/gudbug/PARTAGED/FILMS/Science Fiction/Searching - Portée disparue (2018).mkv',
        expectedType: 'MOVIE',
        expectedTitle: 'Searching - Portée disparue',
        expectedIsExtra: false,
    },
    // 12. Ghost in the Shell Movie in Saga
    {
        name: 'Ghost in the Shell Movie in Saga',
        filePath: '/run/media/tele/My Passport/film/ghost in the shell (1995-2015) - 4 movies, 2 complete series, 4 ovas - 720p dual audio x264/a. movies (1995-2008)/2a. ghost in the shell 2 - innocence (2004 - 720p dual audio).mkv',
        expectedType: 'MOVIE',
        expectedSaga: 'Ghost in the Shell - Saga',
        expectedIsExtra: false,
    },
    // 13. Ghost in the Shell Series Episode
    {
        name: 'Ghost in the Shell Series SAC Episode',
        filePath: '/run/media/tele/My Passport/film/ghost in the shell (1995-2015) - 4 movies, 2 complete series, 4 ovas - 720p dual audio x264/b. stand alone complex (2002-06)/2a. 2nd gig (2004-05)/ghost in the shell (s.a.c) - s02 e04 - du - natural enemy (720p - dual audio).mkv',
        expectedType: 'EPISODE',
        expectedShowTitle: 'Ghost in the Shell: Stand Alone Complex',
        expectedSeason: 2,
        expectedEpisode: 4,
        expectedSaga: 'Ghost in the Shell - Saga',
        expectedIsExtra: false,
    },
    // 14. Release team avec email/URL
    {
        name: 'Scene Release with Site URL',
        filePath: '/run/media/tele/My Passport/serie/deadwood/deadwood - saison 3/deadwood.s03e11.internal.french.dvdrip.xvid-cinephile@zone-telechargement.com.avi',
        expectedType: 'EPISODE',
        expectedShowTitle: 'Deadwood',
        expectedSeason: 3,
        expectedEpisode: 11,
        expectedIsExtra: false,
    },
    // 15. Multi-épisode concaténé S01E01-E02
    {
        name: 'Multi-Episode Concatenated S01E01-E02',
        filePath: '/home/tele/Vidéos/drive/Series/Friends/Season 1/Friends.S01E01-E02.1080p.mkv',
        expectedType: 'EPISODE',
        expectedShowTitle: 'Friends',
        expectedSeason: 1,
        expectedEpisode: 1,
        expectedIsExtra: false,
    },
    // 16. Film avec titre et année entre parenthèses
    {
        name: 'Film with Year in Parentheses',
        filePath: '/run/media/tele/gudbug/PARTAGED/FILMS/Action/The Avengers (2012).mkv',
        expectedType: 'MOVIE',
        expectedTitle: 'The Avengers',
        expectedIsExtra: false,
    },
    // 17. Chiffres romains dans un titre de film (Rocky III -> Rocky 3)
    {
        name: 'Roman Numerals Normalization',
        filePath: '/run/media/tele/gudbug/PARTAGED/FILMS/Action/Rocky III (1982).mkv',
        expectedType: 'MOVIE',
        expectedTitle: 'Rocky 3',
        expectedIsExtra: false,
    },
    // 18. Fichier échantillon sample.mkv (Extra)
    {
        name: 'Sample Video File as Extra',
        filePath: '/home/tele/Vidéos/drive/Films/Inception (2010)/sample.mkv',
        expectedType: 'EXTRA',
        expectedIsExtra: true,
    },
    // 19. Série avec saison explicite dans le nom
    {
        name: 'Anime with Season in Title',
        filePath: '/home/tele/Vidéos/drive/Animes/Shingeki no Kyojin Season 3/Shingeki.no.Kyojin.S03E01.1080p.mkv',
        expectedType: 'EPISODE',
        expectedShowTitle: 'Shingeki no Kyojin',
        expectedSeason: 3,
        expectedEpisode: 1,
        expectedIsExtra: false,
    },
    // 20. Profil Kai 1 : One Pace format standard Arc & Épisode dans sous-dossier
    {
        name: 'One Pace Standard Arc & Episode in Folder',
        filePath: '/run/media/tele/My Passport/anime/one_piece_kai/one piece kai/[one pace][1-7] romance dawn [1080p]/[one pace][1] romance dawn 01 [1080p][d767799c].mkv',
        expectedType: 'EPISODE',
        expectedShowTitle: 'One Piece Kai',
        expectedSeason: 1,
        expectedEpisode: 1,
        expectedIsExtra: false,
    },
    // 21. Profil Kai 2 : One Pace avec plage de chapitres manga dans le nom de fichier
    {
        name: 'One Pace Arc with Chapter Range in Filename',
        filePath: '/run/media/tele/My Passport/anime/one_piece_kai/one piece kai/[one pace][11-16] orange town [480p]/[one pace][11-16] orange town 02 [480p][488b0a5c].mkv',
        expectedType: 'EPISODE',
        expectedShowTitle: 'One Piece Kai',
        expectedSeason: 2,
        expectedEpisode: 2,
        expectedIsExtra: false,
    },
    // 22. Profil Kai 3 : One Pace Dressrosa avec numérotation de chapitres (700-701)
    {
        name: 'One Pace Dressrosa Arc Chapter Mapping',
        filePath: '/run/media/tele/My Passport/anime/one_piece_kai/one piece kai/[one pace][700-800] dressrosa [720p]/[one pace] chapter 700-701 [720p][1bdf0d43].mkv',
        expectedType: 'EPISODE',
        expectedShowTitle: 'One Piece Kai',
        expectedSeason: 26,
        expectedEpisode: 1,
        expectedIsExtra: false,
    },
    // 23. Profil Kai 4 : Épisode spécial One Pace (Gaimon April Fools)
    {
        name: 'One Pace Special April Fools Gaimon',
        filePath: '/run/media/tele/My Passport/anime/one_piece_kai/one piece kai/[one pace] specials/april fools specials/[one pace][42,22] gaimon [480p][eff6059a].mkv',
        expectedType: 'EPISODE',
        expectedShowTitle: 'One Piece Kai',
        expectedSeason: 0,
        expectedEpisode: 42,
        expectedIsExtra: false,
    },
    // 24. Profil Kai 5 : Dragon Ball Z Kai en nomenclature standard S01E05
    {
        name: 'Dragon Ball Z Kai Standard Episode',
        filePath: '/home/tele/Vidéos/drive/Animes/Dragon Ball Z Kai/Dragon.Ball.Z.Kai.S01E05.1080p.mkv',
        expectedType: 'EPISODE',
        expectedShowTitle: 'Dragon Ball Z Kai',
        expectedSeason: 1,
        expectedEpisode: 5,
        expectedIsExtra: false,
    },
    // 25. Profil Kai 6 : One Pace Arc Wano (Saison 30, Chapitre 909+)
    {
        name: 'One Pace Wano Arc Late Season Mapping',
        filePath: '/run/media/tele/My Passport/anime/one_piece_kai/one piece kai/[one pace][909-xxx] wano [1080p]/[one pace][909-910] wano 01 [1080p][abc12345].mkv',
        expectedType: 'EPISODE',
        expectedShowTitle: 'One Piece Kai',
        expectedSeason: 30,
        expectedEpisode: 1,
        expectedIsExtra: false,
    },
    // 26. Saga Star Wars : dossier de release avec points, mot « hexalogie »
    //     et NFO texte non-XML (le film doit tout de même être indexé).
    {
        name: 'Star Wars Hexalogy Release Folder (Roman Episode)',
        filePath: '/run/media/tele/My Passport/film/[ oxtorrent.com ] star.wars.hexalogie.1977-2005.multi.1080p.bluray.x264-lost/star.wars.episode.i.the.phantom.menace.1999.multi.1080p.bluray.x264-lost/star.wars.episode.i.the.phantom.menace.1999.multi.1080p.bluray.x264-lost.mkv',
        expectedType: 'MOVIE',
        expectedTitle: 'star wars episode i the phantom menace',
        expectedSaga: 'Star Wars - Saga',
        expectedIsExtra: false,
    },
    // 27. Saga Star Wars : épisode V avec suffixe français et groupe de release
    {
        name: 'Star Wars Episode V French Release Folder',
        filePath: '/run/media/tele/My Passport/film/[ oxtorrent.com ] star.wars.hexalogie.1977-2005.multi.1080p.bluray.x264-lost/star.wars.episode.v.the.empire.strikes.back.1980.french.1080p.bluray.x264-lost/star.wars.episode.v.the.empire.strikes.back.1980.multi.1080p.bluray.x264-lost.mkv',
        expectedType: 'MOVIE',
        expectedTitle: 'star wars episode v the empire strikes back',
        expectedSaga: 'Star Wars - Saga',
        expectedIsExtra: false,
    },
];
async function runTests() {
    console.log('🧪 Starting isolated profile test suite (25 Profiles)...');
    let passed = 0;
    let failed = 0;
    for (const tc of testCases) {
        console.log(`\n--- Test: ${tc.name} ---`);
        console.log(`File: ${tc.filePath}`);
        const failures = [];
        // Test 1: Extra detection
        const isExtra = isExtraMediaFile(tc.filePath);
        if (tc.expectedIsExtra !== undefined && isExtra !== tc.expectedIsExtra) {
            failures.push(`isExtra expected ${tc.expectedIsExtra}, got ${isExtra}`);
        }
        // Test 2: Saga detection
        const saga = detectSagaNameFromFolder(tc.filePath);
        if (tc.expectedSaga) {
            if (!saga || !saga.toLowerCase().includes(tc.expectedSaga.toLowerCase().replace(' - saga', ''))) {
                failures.push(`Saga expected to match "${tc.expectedSaga}", got "${saga}"`);
            }
        }
        // Test 3: Series root detection
        const seriesCtx = await resolveSeriesRoot(tc.filePath);
        if (tc.expectedType === 'EPISODE' && !seriesCtx) {
            failures.push(`Expected series context for EPISODE, but resolveSeriesRoot returned null`);
        }
        else if (tc.expectedType === 'MOVIE' && seriesCtx) {
            failures.push(`Expected NO series context for MOVIE, but resolveSeriesRoot returned ${seriesCtx.showTitleCandidate}`);
        }
        // Test 4: Show title extraction
        if (tc.expectedShowTitle && seriesCtx) {
            const canonicalShow = extractCanonicalShowTitle(seriesCtx.showTitleCandidate);
            const sim = stringSimilarity(canonicalShow, tc.expectedShowTitle);
            if (sim < 0.60 && !canonicalShow.toLowerCase().includes(tc.expectedShowTitle.toLowerCase())) {
                failures.push(`Canonical show title "${canonicalShow}" does not match expected "${tc.expectedShowTitle}" (sim=${sim.toFixed(2)})`);
            }
        }
        // Test 5: Season & Episode extraction
        if (tc.expectedSeason !== undefined || tc.expectedEpisode !== undefined) {
            const se = parseSeasonEpisode(tc.filePath) || parseSeasonEpisode(path.basename(tc.filePath));
            const grouping = seriesCtx ? analyzeFolderGrouping(tc.filePath, seriesCtx.showDir) : null;
            const actualSeason = grouping?.seasonNumber ?? se?.season;
            const actualEpisode = se?.episode;
            if (tc.expectedSeason !== undefined && actualSeason !== tc.expectedSeason) {
                failures.push(`Season expected ${tc.expectedSeason}, got ${actualSeason}`);
            }
            if (tc.expectedEpisode !== undefined && actualEpisode !== tc.expectedEpisode) {
                failures.push(`Episode expected ${tc.expectedEpisode}, got ${actualEpisode}`);
            }
        }
        // Test 6: Movie title cleaning
        if (tc.expectedTitle && tc.expectedType === 'MOVIE') {
            const rawBase = path.basename(tc.filePath, path.extname(tc.filePath));
            const cleaned = cleanMediaTitle(rawBase);
            const sim = stringSimilarity(cleaned, tc.expectedTitle);
            if (sim < 0.60 && !cleaned.toLowerCase().includes(tc.expectedTitle.toLowerCase())) {
                failures.push(`Cleaned movie title "${cleaned}" does not match expected "${tc.expectedTitle}" (sim=${sim.toFixed(2)})`);
            }
        }
        if (failures.length === 0) {
            console.log(`✅ PASSED`);
            passed++;
        }
        else {
            console.log(`❌ FAILED:`);
            for (const f of failures)
                console.log(`   - ${f}`);
            failed++;
        }
    }
    console.log(`\n========================================`);
    console.log(`Results: ${passed} PASSED, ${failed} FAILED out of ${testCases.length} tests.`);
    console.log(`========================================`);
    if (failed > 0)
        process.exit(1);
}
runTests().catch(console.error);
