import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { getSiteParams } from '../config/paramManager.js';
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
    const siteParams = getSiteParams();
    const mediaConfig = siteParams.media || {};
    const prefAudio = (mediaConfig.defaultAudioLanguage || 'fra').trim();
    const prefSub = (mediaConfig.defaultSubtitleLanguage || 'fra').trim();
    const subMode = mediaConfig.subtitleMode || 'fallback_if_audio_missing';
    const media = await db.query.mediaNodes.findFirst({
        where: (t, { or, eq }) => isUuid(id) ? or(eq(t.id, id), eq(t.slug, id)) : eq(t.slug, id),
    });
    if (!media?.videoFilePath) {
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
            return { index: s.index, language: lang, codec: s.codec_name, label: `${langLabel}${title} (${s.codec_name.toUpperCase()})` };
        });
        const subtitleTracks = streams
            .filter((s) => s.codec_type === 'subtitle' && !['hdmv_pgs_subtitle', 'dvd_subtitle'].includes(s.codec_name))
            .map((s) => {
            const lang = (s.tags?.language || 'und').toLowerCase();
            const langLabel = LANG_NAMES[lang] || lang.toUpperCase();
            const title = s.tags?.title ? ` - ${s.tags.title}` : '';
            return { index: s.index, language: lang, label: `${langLabel}${title} (Intégré)` };
        });
        const dir = path.dirname(media.videoFilePath);
        const baseName = path.basename(media.videoFilePath, path.extname(media.videoFilePath)).toLowerCase();
        const numMatch = baseName.match(/^\d+/)?.[0];
        const subDirs = [dir, path.join(dir, 'Subtitles'), path.join(path.dirname(dir), 'Subtitles')];
        for (const d of subDirs) {
            const files = await fsp.readdir(d).catch(() => []);
            for (const f of files) {
                const lower = f.toLowerCase();
                if ((lower.endsWith('.srt') || lower.endsWith('.vtt')) && (!numMatch || lower.includes(numMatch))) {
                    let lKey = 'und';
                    if (lower.includes('fre') || lower.includes('fra') || lower.includes('.fr.') || lower.endsWith('.fr.srt') || lower.endsWith('.fr.vtt') || lower.includes('french') || lower.includes('vostfr')) {
                        lKey = 'fra';
                    }
                    else if (lower.includes('eng') || lower.includes('.en.') || lower.endsWith('.en.srt') || lower.endsWith('.en.vtt') || lower.includes('english')) {
                        lKey = 'eng';
                    }
                    else if (lower.includes('jpn') || lower.includes('jap') || lower.includes('.ja.') || lower.includes('japanese')) {
                        lKey = 'jpn';
                    }
                    else if (lower.includes('spa') || lower.includes('.es.') || lower.includes('spanish')) {
                        lKey = 'spa';
                    }
                    else if (lower.includes('deu') || lower.includes('ger') || lower.includes('.de.') || lower.includes('german')) {
                        lKey = 'deu';
                    }
                    else if (lower.includes('ita') || lower.includes('.it.') || lower.includes('italian')) {
                        lKey = 'ita';
                    }
                    const labelPrefix = LANG_NAMES[lKey] || 'Sous-titre';
                    subtitleTracks.push({
                        index: -1,
                        language: lKey,
                        fileName: f,
                        label: `${labelPrefix} (${f.length > 32 ? f.slice(0, 29) + '...' : f})`,
                    });
                }
            }
        }
        // Calcul de la correspondance audio par défaut
        const matchedAudio = audioTracks.find((t) => matchesLanguagePreference(t.language, t.label, prefAudio));
        const isDefaultAudioAvailable = Boolean(matchedAudio);
        const defaultAudioTrack = matchedAudio ? String(matchedAudio.index) : 'auto';
        // Calcul de la correspondance sous-titres par défaut
        const matchedSubtitle = subtitleTracks.find((s) => matchesLanguagePreference(s.language, s.fileName || s.label, prefSub));
        let defaultSubtitle = 'off';
        let subtitleFallbackTriggered = false;
        if (subMode === 'always') {
            if (matchedSubtitle) {
                defaultSubtitle = matchedSubtitle.fileName ? `file:${matchedSubtitle.fileName}` : `track:${matchedSubtitle.index}`;
            }
        }
        else if (subMode === 'fallback_if_audio_missing') {
            if (!isDefaultAudioAvailable && matchedSubtitle) {
                defaultSubtitle = matchedSubtitle.fileName ? `file:${matchedSubtitle.fileName}` : `track:${matchedSubtitle.index}`;
                subtitleFallbackTriggered = true;
            }
        }
        const height = videoStream?.height || 1080;
        const qualities = [
            { label: `Auto (Original ${height}p)`, value: 'auto' },
            ...(height >= 1080 ? [{ label: '1080p FHD', value: '1080p' }] : []),
            ...(height >= 720 ? [{ label: '720p HD', value: '720p' }] : []),
            { label: '480p SD', value: '480p' },
        ];
        let intro = { start: 0, end: 90 };
        if (chapters.length > 0) {
            const end = parseFloat(chapters[0].end_time || '90');
            if (end >= 15 && end <= 180)
                intro = { start: parseFloat(chapters[0].start_time || '0'), end };
        }
        const duration = parseFloat(info.format?.duration || '0');
        return c.json({
            audioTracks,
            subtitleTracks,
            qualities,
            intro,
            duration,
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
        return c.json({
            audioTracks: [],
            subtitleTracks: [],
            qualities: [{ label: 'Auto', value: 'auto' }],
            intro: { start: 0, end: 90 },
            duration: 0,
            defaultAudioTrack: 'auto',
            defaultSubtitle: 'off',
            isDefaultAudioAvailable: true,
            subtitleFallbackTriggered: false,
            configuredAudioLanguage: prefAudio,
            configuredSubtitleLanguage: prefSub,
            subtitleMode: subMode,
        });
    }
});
