import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
const execFileAsync = promisify(execFile);
const DISAMBIGUATION_PROFILES = [
    {
        triggerTitleRegex: /\bthe\s+office\b/i,
        candidates: [
            {
                canonicalTitle: 'The Office (US)',
                imdbId: 'tt0386676',
                tmdbId: 2316,
                entities: ['michael scott', 'dwight', 'schrute', 'jim halpert', 'pam beesly', 'dunder mifflin', 'scranton', 'angela', 'kevin malone'],
            },
            {
                canonicalTitle: 'The Office (UK)',
                imdbId: 'tt0379632',
                tmdbId: 2996,
                entities: ['david brent', 'tim canterbury', 'gareth keenan', 'dawn tinsley', 'wernham hogg', 'slough', 'finchy'],
            },
        ],
    },
    {
        triggerTitleRegex: /\bshameless\b/i,
        candidates: [
            {
                canonicalTitle: 'Shameless (US)',
                imdbId: 'tt1586680',
                tmdbId: 34307,
                entities: ['fiona', 'lip gallagher', 'south side', 'chicago', 'kewball', 'alibi room', 'veronica', 'kevin ball'],
            },
            {
                canonicalTitle: 'Shameless (UK)',
                imdbId: 'tt0397788',
                tmdbId: 1618,
                entities: ['chatsworth estate', 'manchester', 'karen maguire', 'mickey maguire', 'paddy maguire', 'sheila jackson'],
            },
        ],
    },
    {
        triggerTitleRegex: /\bbeing\s+human\b/i,
        candidates: [
            {
                canonicalTitle: 'Being Human (US)',
                imdbId: 'tt1595680',
                tmdbId: 34392,
                entities: ['aidan waite', 'josh levison', 'sally malik', 'boston'],
            },
            {
                canonicalTitle: 'Being Human (UK)',
                imdbId: 'tt1349938',
                tmdbId: 4426,
                entities: ['john mitchell', 'george sands', 'annie sawyer', 'bristol', 'barry island'],
            },
        ],
    },
    {
        triggerTitleRegex: /\bhouse\s+of\s+cards\b/i,
        candidates: [
            {
                canonicalTitle: 'House of Cards (US)',
                imdbId: 'tt1856010',
                tmdbId: 1425,
                entities: ['frank underwood', 'claire underwood', 'doug stamper', 'zoe barnes', 'washington dc'],
            },
            {
                canonicalTitle: 'House of Cards (UK)',
                imdbId: 'tt0098825',
                tmdbId: 2289,
                entities: ['francis urquhart', 'mattie storin', 'westminster', 'collingridge'],
            },
        ],
    },
    {
        triggerTitleRegex: /\bdoctor\s+who\b/i,
        candidates: [
            {
                canonicalTitle: 'Doctor Who (2005)',
                imdbId: 'tt0436992',
                tmdbId: 57243,
                entities: ['rose tyler', 'martha jones', 'donna noble', 'amy pond', 'rory williams', 'clara oswald', 'tardis', 'bad wolf'],
            },
            {
                canonicalTitle: 'Doctor Who (1963)',
                imdbId: 'tt0056751',
                tmdbId: 121,
                entities: ['susan foreman', 'ian chesterton', 'barbara wright', 'sarah jane smith', 'gallifrey', 'time lord'],
            },
        ],
    },
];
/**
 * Extrait un échantillon rapide de sous-titres (piste interne ou fichier sidecar .srt).
 */
export async function extractSubtitlesSample(videoFilePath, maxDurationSeconds = 120) {
    const lines = [];
    // 1. Vérifier d'abord s'il existe un sous-titre sidecar (.srt) dans le même dossier
    const dir = path.dirname(videoFilePath);
    const baseNoExt = path.basename(videoFilePath, path.extname(videoFilePath));
    const candidateSidecars = [
        path.join(dir, `${baseNoExt}.srt`),
        path.join(dir, `${baseNoExt}.fr.srt`),
        path.join(dir, `${baseNoExt}.en.srt`),
    ];
    for (const sidecar of candidateSidecars) {
        try {
            const content = await fs.readFile(sidecar, 'utf-8');
            const srtLines = content
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l.length > 0 && !/^\d+$/.test(l) && !l.includes('-->'));
            return srtLines.slice(0, 150);
        }
        catch {
            // continuer
        }
    }
    // 2. Si pas de sidecar, extraire les 2 premières minutes du premier sous-titre interne avec ffmpeg
    try {
        const { stdout } = await execFileAsync('ffmpeg', ['-v', 'error', '-i', videoFilePath, '-map', '0:s:0', '-f', 'srt', '-t', String(maxDurationSeconds), '-'], { timeout: 8000, maxBuffer: 1024 * 512 });
        const srtLines = stdout
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && !/^\d+$/.test(l) && !l.includes('-->'));
        return srtLines.slice(0, 150);
    }
    catch {
        return lines;
    }
}
/**
 * Analyse sémantique NLP des sous-titres :
 * - Détection des entités nommées de personnages pour désambiguïser US vs UK
 * - Détection du carton de titre du film
 */
export async function analyzeSubtitlesNlp(videoFilePath, contextTitle) {
    const sampleLines = await extractSubtitlesSample(videoFilePath);
    const hasSubtitles = sampleLines.length > 0;
    if (!hasSubtitles) {
        return { sampleLines: [], hasSubtitles: false };
    }
    const fullText = sampleLines.join(' ').toLowerCase();
    // 1. Détection de carton de titre en début de sous-titre
    let detectedTitle;
    for (let i = 0; i < Math.min(10, sampleLines.length); i++) {
        const line = sampleLines[i];
        // Un titre est souvent en majuscules ou isolé sur une ligne courte sans ponctuation terminale
        if (/^[A-Z0-9\s:''-]{4,40}$/.test(line) && !/synchronisation|traduction|resync|subtitles/i.test(line)) {
            detectedTitle = line.trim();
            break;
        }
    }
    // 2. Désambiguïsation d'entités nommées si titre ambigu
    let detectedDisambiguation;
    const testTitle = contextTitle || detectedTitle || path.basename(videoFilePath);
    for (const profile of DISAMBIGUATION_PROFILES) {
        if (profile.triggerTitleRegex.test(testTitle)) {
            let bestCandidate = null;
            let maxScore = 0;
            let bestEntities = [];
            for (const cand of profile.candidates) {
                const matches = [];
                for (const entity of cand.entities) {
                    if (fullText.includes(entity)) {
                        matches.push(entity);
                    }
                }
                if (matches.length > maxScore) {
                    maxScore = matches.length;
                    bestCandidate = cand;
                    bestEntities = matches;
                }
            }
            if (bestCandidate && maxScore >= 1) {
                detectedDisambiguation = {
                    canonicalTitle: bestCandidate.canonicalTitle,
                    imdbId: bestCandidate.imdbId,
                    tmdbId: bestCandidate.tmdbId,
                    matchedEntities: bestEntities,
                    confidence: Math.min(1, maxScore * 0.35),
                };
                break;
            }
        }
    }
    return {
        detectedTitle,
        detectedDisambiguation,
        sampleLines,
        hasSubtitles: true,
    };
}
