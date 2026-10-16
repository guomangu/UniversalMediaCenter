import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { getSiteParams } from '../config/paramManager.js';
import { checkMediaAccess } from '../auth/mediaAccess.js';
const execFileAsync = promisify(execFile);
export const tracksRouter = new Hono();
export const LANG_NAMES = {
    fre: 'Français', fra: 'Français', fr: 'Français',
    eng: 'English', en: 'English',
    jpn: 'Japonais', ja: 'Japonais',
    rus: 'Russe', ru: 'Russe',
    spa: 'Espagnol', es: 'Espagnol',
    deu: 'Allemand', ger: 'Allemand', de: 'Allemand',
    ita: 'Italien', it: 'Italien',
    por: 'Portugais', pt: 'Portugais',
    zho: 'Chinois', chi: 'Chinois', zh: 'Chinois',
    kor: 'Coréen', ko: 'Coréen',
    ara: 'Arabe', ar: 'Arabe',
    nld: 'Néerlandais', dut: 'Néerlandais', nl: 'Néerlandais',
    und: 'Piste',
};
const LANG_MAP = {
    fra: ['fra', 'fre', 'fr', 'french', 'francais', 'français', 'vostfr', 'vf', 'vff', 'vfq'],
    eng: ['eng', 'en', 'english', 'anglais', 'vo', 'vost'],
    jpn: ['jpn', 'ja', 'japanese', 'japonais'],
    spa: ['spa', 'es', 'spanish', 'espagnol'],
    deu: ['deu', 'ger', 'de', 'german', 'allemand'],
    ita: ['ita', 'it', 'italian', 'italien'],
    por: ['por', 'pt', 'portuguese', 'portugais'],
    rus: ['rus', 'ru', 'russian', 'russe'],
    zho: ['zho', 'chi', 'zh', 'chinese', 'chinois'],
    kor: ['kor', 'ko', 'korean', 'coreen', 'coréen'],
    ara: ['ara', 'ar', 'arabic', 'arabe'],
    nld: ['nld', 'dut', 'nl', 'dutch', 'neerlandais', 'néerlandais'],
};
export function normalizeLangCode(val) {
    if (!val)
        return 'und';
    const clean = val.toLowerCase().trim();
    for (const [canonical, aliases] of Object.entries(LANG_MAP)) {
        if (canonical === clean || aliases.includes(clean)) {
            return canonical;
        }
    }
    return clean;
}
export function matchesLanguagePreference(trackLang, trackLabel, preference) {
    if (!preference)
        return false;
    const preferences = preference
        .split(',')
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
    const normalizedTrack = normalizeLangCode(trackLang);
    const lowerLabel = (trackLabel || '').toLowerCase();
    for (const pref of preferences) {
        const normalizedPref = normalizeLangCode(pref);
        if (normalizedTrack === normalizedPref)
            return true;
        if (trackLang.toLowerCase() === pref)
            return true;
        const aliases = LANG_MAP[normalizedPref] || [normalizedPref];
        if (aliases.some((alias) => lowerLabel.includes(alias)))
            return true;
    }
    return false;
}
const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
tracksRouter.get('/:id/tracks', async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const shareToken = c.req.query('share') || c.req.query('share_token');
    const siteParams = getSiteParams();
    const mediaConfig = siteParams.media || {};
    const prefAudio = (mediaConfig.defaultAudioLanguage || 'fra').trim();
    const prefSub = (mediaConfig.defaultSubtitleLanguage || 'fra').trim();
    const subMode = mediaConfig.subtitleMode || 'fallback_if_audio_missing';
    const media = await db.query.mediaNodes.findFirst({
        where: (t, { or, eq }) => isUuid(id) ? or(eq(t.id, id), eq(t.slug, id)) : eq(t.slug, id),
    });
    if (!media) {
        return c.json({ error: 'Média introuvable' }, 404);
    }
    const isAuthorized = checkMediaAccess(user, media.id, shareToken, media.parentId, media.nodeType, {
        videoFilePath: media.videoFilePath,
        nfoFilePath: media.nfoFilePath,
        searchVectorText: media.searchVectorText,
    });
    if (!isAuthorized) {
        return c.json({ error: 'Accès non autorisé', code: 'FORBIDDEN' }, 403);
    }
    if (!media.videoFilePath) {
        return c.json({
            audioTracks: [],
            subtitleTracks: [],
            qualities: [],
            defaultAudioTrack: 'auto',
            defaultSubtitle: 'off',
            isDefaultAudioAvailable: true,
            subtitleFallbackTriggered: false,
            configuredAudioLanguage: prefAudio,
            configuredSubtitleLanguage: prefSub,
            subtitleMode: subMode,
        });
    }
    try {
        const { stdout } = await execFileAsync('ffprobe', [
            '-v', 'error', '-show_entries',
            'stream=index,codec_type,codec_name,width,height:stream_tags=language,title:format=duration',
            '-show_chapters', '-of', 'json', media.videoFilePath,
        ], { timeout: 4000 });
        const info = JSON.parse(stdout);
        const streams = info.streams || [];
        const chapters = info.chapters || [];
        const videoStream = streams.find((s) => s.codec_type === 'video');
        const audioTracks = streams.filter((s) => s.codec_type === 'audio').map((s) => {
            const lang = (s.tags?.language || 'und').toLowerCase();
            const langLabel = LANG_NAMES[lang] || lang.toUpperCase();
            const title = s.tags?.title ? ` - ${s.tags.title}` : '';
            return {
                index: s.index,
                language: lang,
                codec: s.codec_name || 'aac',
                label: `${langLabel}${title} (${s.codec_name || 'audio'})`,
            };
        });
        const internalSubtitles = streams.filter((s) => s.codec_type === 'subtitle').map((s) => {
            const lang = (s.tags?.language || 'und').toLowerCase();
            const langLabel = LANG_NAMES[lang] || lang.toUpperCase();
            const title = s.tags?.title ? ` - ${s.tags.title}` : '';
            return {
                index: s.index,
                language: lang,
                label: `${langLabel}${title} [Intégré]`,
            };
        });
        // Recherche de fichiers de sous-titres externes (.srt, .vtt)
        const externalSubtitles = [];
        try {
            const dir = path.dirname(media.videoFilePath);
            const ext = path.extname(media.videoFilePath);
            const baseName = path.basename(media.videoFilePath, ext);
            const files = await fsp.readdir(dir);
            for (const file of files) {
                const fileExt = path.extname(file).toLowerCase();
                if (fileExt === '.srt' || fileExt === '.vtt') {
                    if (file.startsWith(baseName) || file.toLowerCase().includes('vostfr') || file.toLowerCase().includes('french')) {
                        let subLang = 'fra';
                        const lowerFile = file.toLowerCase();
                        if (lowerFile.includes('eng') || lowerFile.includes('en.'))
                            subLang = 'eng';
                        else if (lowerFile.includes('spa') || lowerFile.includes('es.'))
                            subLang = 'spa';
                        else if (lowerFile.includes('fre') || lowerFile.includes('fra') || lowerFile.includes('fr.'))
                            subLang = 'fra';
                        const langLabel = LANG_NAMES[subLang] || subLang.toUpperCase();
                        externalSubtitles.push({
                            index: 100 + externalSubtitles.length,
                            language: subLang,
                            label: `${langLabel} [Fichier externe: ${path.basename(file)}]`,
                            fileName: file,
                        });
                    }
                }
            }
        }
        catch { }
        const allSubtitles = [...internalSubtitles, ...externalSubtitles];
        // Détermination de la piste audio préférée
        let defaultAudioTrack = 'auto';
        let isDefaultAudioAvailable = false;
        if (audioTracks.length > 0) {
            const matchedAudio = audioTracks.find((t) => matchesLanguagePreference(t.language, t.label, prefAudio));
            if (matchedAudio) {
                defaultAudioTrack = String(matchedAudio.index);
                isDefaultAudioAvailable = true;
            }
            else {
                defaultAudioTrack = String(audioTracks[0].index);
                isDefaultAudioAvailable = false;
            }
        }
        else {
            isDefaultAudioAvailable = true;
        }
        // Détermination automatique du sous-titre
        let defaultSubtitle = 'off';
        let subtitleFallbackTriggered = false;
        if (subMode === 'always') {
            const matchedSub = allSubtitles.find((s) => matchesLanguagePreference(s.language, s.label, prefSub));
            if (matchedSub) {
                defaultSubtitle = matchedSub.fileName ? `file:${matchedSub.fileName}` : `track:${matchedSub.index}`;
            }
            else if (allSubtitles.length > 0) {
                const first = allSubtitles[0];
                defaultSubtitle = first.fileName ? `file:${first.fileName}` : `track:${first.index}`;
            }
        }
        else if (subMode === 'fallback_if_audio_missing') {
            if (!isDefaultAudioAvailable && audioTracks.length > 0) {
                const matchedSub = allSubtitles.find((s) => matchesLanguagePreference(s.language, s.label, prefSub));
                if (matchedSub) {
                    defaultSubtitle = matchedSub.fileName ? `file:${matchedSub.fileName}` : `track:${matchedSub.index}`;
                    subtitleFallbackTriggered = true;
                }
                else if (allSubtitles.length > 0) {
                    const first = allSubtitles[0];
                    defaultSubtitle = first.fileName ? `file:${first.fileName}` : `track:${first.index}`;
                    subtitleFallbackTriggered = true;
                }
            }
        }
        const duration = parseFloat(info.format?.duration || '0');
        const width = videoStream?.width;
        const height = videoStream?.height;
        const qualities = [];
        if (height) {
            if (height >= 2160)
                qualities.push('4K (2160p)');
            if (height >= 1080)
                qualities.push('Full HD (1080p)');
            if (height >= 720)
                qualities.push('HD (720p)');
            if (height >= 480)
                qualities.push('SD (480p)');
        }
        return c.json({
            durationSeconds: Math.round(duration),
            width,
            height,
            audioTracks,
            subtitleTracks: allSubtitles,
            qualities,
            defaultAudioTrack,
            defaultSubtitle,
            isDefaultAudioAvailable,
            subtitleFallbackTriggered,
            configuredAudioLanguage: prefAudio,
            configuredSubtitleLanguage: prefSub,
            subtitleMode: subMode,
        });
    }
    catch (err) {
        return c.json({ error: `Erreur d'analyse ffprobe: ${err.message}` }, 500);
    }
});
