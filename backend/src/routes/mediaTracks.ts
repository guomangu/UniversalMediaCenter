import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { getSiteParams } from '../config/paramManager.js';
import type { UserSession } from '../middleware/access.js';
import { checkMediaAccess } from '../auth/mediaAccess.js';
import { verifySessionToken } from '../auth/token.js';

const execFileAsync = promisify(execFile);
export const tracksRouter = new Hono();

const tracksCache = new Map<string, any>();

export const LANG_NAMES: Record<string, string> = {
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

const LANG_MAP: Record<string, string[]> = {
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

export function normalizeLangCode(val: string): string {
  if (!val) return 'und';
  const clean = val.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(LANG_MAP)) {
    if (canonical === clean || aliases.includes(clean)) {
      return canonical;
    }
  }
  return clean;
}

export function matchesLanguagePreference(trackLang: string, trackLabel: string, preference: string): boolean {
  if (!preference) return false;
  const preferences = preference
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const normalizedTrack = normalizeLangCode(trackLang);
  const lowerLabel = (trackLabel || '').toLowerCase();

  for (const pref of preferences) {
    const normalizedPref = normalizeLangCode(pref);
    if (normalizedTrack === normalizedPref) return true;
    if (trackLang.toLowerCase() === pref) return true;
    const aliases = LANG_MAP[normalizedPref] || [normalizedPref];
    if (aliases.some((alias) => lowerLabel.includes(alias))) return true;
  }
  return false;
}

export interface AudioTrackInfo {
  index: number;
  language: string;
  codec: string;
  label: string;
}

export interface SubtitleTrackInfo {
  index: number;
  language: string;
  label: string;
  fileName?: string;
}

const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

const BROWSER_NATIVE_AUDIO_CODECS = ['aac', 'mp3', 'opus', 'vorbis', 'flac'];
const BROWSER_NATIVE_VIDEO_CODECS = ['h264', 'av1', 'vp8', 'vp9'];

tracksRouter.get('/:id/tracks', async (c) => {
  const id = c.req.param('id');
  let user = (c as any).get('user') as UserSession | undefined;
  const shareToken = c.req.query('share') || c.req.query('share_token');
  const queryToken = c.req.query('token') || c.req.query('auth');

  // Support transparent du token en paramètre d'URL si le middleware ne l'a pas résolu
  if (!user && queryToken) {
    const userId = verifySessionToken(queryToken.trim());
    if (userId) {
      user = (await db.query.users.findFirst({
        where: (t, { eq }) => eq(t.id, userId),
      })) as any;
    }
  }

  const media = await db.query.mediaNodes.findFirst({
    where: (t, { or, eq }) => isUuid(id) ? or(eq(t.id, id), eq(t.slug, id)) : eq(t.slug, id),
  });

  if (!media) {
    return c.json({ error: 'Média introuvable' }, 404);
  }

  // Contrôle d'accès : vérification uniquement si utilisateur explicite ou shareToken fourni
  let isAuthorized = true;
  if (user) {
    isAuthorized = checkMediaAccess(user, media.id, shareToken, media.parentId, media.nodeType, {
      videoFilePath: media.videoFilePath,
      nfoFilePath: media.nfoFilePath,
      searchVectorText: media.searchVectorText,
    });
  } else if (shareToken) {
    isAuthorized = checkMediaAccess(null, media.id, shareToken, media.parentId, media.nodeType, {
      videoFilePath: media.videoFilePath,
      nfoFilePath: media.nfoFilePath,
      searchVectorText: media.searchVectorText,
    });
  }

  if (!isAuthorized) {
    return c.json({ error: 'Accès non autorisé', code: 'FORBIDDEN' }, 403);
  }

  const siteParams = getSiteParams();
  const mediaConfig = siteParams.media || {};
  const prefAudio = (mediaConfig.defaultAudioLanguage || 'fra').trim();
  const prefSub = (mediaConfig.defaultSubtitleLanguage || 'fra').trim();
  const subMode = mediaConfig.subtitleMode || 'fallback_if_audio_missing';

  if (!media.videoFilePath) {
    return c.json({
      durationSeconds: 0,
      audioTracks: [],
      subtitleTracks: [],
      qualities: [],
      requiresHls: false,
      streamType: 'direct',
      defaultAudioTrack: 'auto',
      defaultSubtitle: 'off',
      isDefaultAudioAvailable: true,
      subtitleFallbackTriggered: false,
      configuredAudioLanguage: prefAudio,
      configuredSubtitleLanguage: prefSub,
      subtitleMode: subMode,
    });
  }

  const cacheKey = `${media.id}:${prefAudio}:${prefSub}:${subMode}`;
  if (tracksCache.has(cacheKey)) {
    return c.json(tracksCache.get(cacheKey));
  }

  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-show_entries',
      'stream=index,codec_type,codec_name,width,height:stream_tags=language,title:format=duration',
      '-show_chapters', '-of', 'json', media.videoFilePath,
    ], { timeout: 15000 });

    const info = JSON.parse(stdout);
    const streams = info.streams || [];
    const videoStream = streams.find((s: any) => s.codec_type === 'video');

    const audioTracks: AudioTrackInfo[] = streams.filter((s: any) => s.codec_type === 'audio').map((s: any) => {
      const lang = (s.tags?.language || 'und').toLowerCase();
      const norm = normalizeLangCode(lang);
      const langLabel = LANG_NAMES[norm] || LANG_NAMES[lang] || (lang && lang !== 'und' ? lang.toUpperCase() : `Piste #${s.index}`);
      const title = s.tags?.title ? ` - ${s.tags.title}` : '';
      return {
        index: s.index,
        language: lang,
        codec: s.codec_name || 'aac',
        label: `${langLabel}${title} (${(s.codec_name || 'audio').toUpperCase()})`,
      };
    });

    const internalSubtitles: SubtitleTrackInfo[] = streams.filter((s: any) => s.codec_type === 'subtitle').map((s: any) => {
      const lang = (s.tags?.language || 'und').toLowerCase();
      const norm = normalizeLangCode(lang);
      const langLabel = LANG_NAMES[norm] || LANG_NAMES[lang] || (lang && lang !== 'und' ? lang.toUpperCase() : `Piste #${s.index}`);
      const title = s.tags?.title ? ` - ${s.tags.title}` : '';
      return {
        index: s.index,
        language: lang,
        label: `${langLabel}${title} [Intégré]`,
      };
    });

    // Recherche de fichiers de sous-titres externes (.srt, .vtt) dans le dossier et sous-dossiers Subtitles/
    const externalSubtitles: SubtitleTrackInfo[] = [];
    try {
      const dir = path.dirname(media.videoFilePath);
      const dirsToScan = [dir, path.join(dir, 'Subtitles'), path.join(dir, 'Subs')];

      for (const d of dirsToScan) {
        const files = await fsp.readdir(d).catch(() => []);
        for (const file of files) {
          const fileExt = path.extname(file).toLowerCase();
          if (fileExt === '.srt' || fileExt === '.vtt') {
            const relFileName = d === dir ? file : path.join(path.basename(d), file);
            let subLang = 'fra';
            const lowerFile = file.toLowerCase();
            if (lowerFile.includes('eng') || lowerFile.includes('en.')) subLang = 'eng';
            else if (lowerFile.includes('spa') || lowerFile.includes('es.')) subLang = 'spa';
            else if (lowerFile.includes('fre') || lowerFile.includes('fra') || lowerFile.includes('fr.')) subLang = 'fra';

            const langLabel = LANG_NAMES[subLang] || subLang.toUpperCase();
            externalSubtitles.push({
              index: 100 + externalSubtitles.length,
              language: subLang,
              label: `${langLabel} [Fichier externe: ${path.basename(file)}]`,
              fileName: relFileName,
            });
          }
        }
      }
    } catch {}

    const allSubtitles = [...internalSubtitles, ...externalSubtitles];

    // Détermination de la piste audio préférée avec priorité stricte aux codecs compatibles navigateur web
    let defaultAudioTrack = 'auto';
    let isDefaultAudioAvailable = false;

    if (audioTracks.length > 0) {
      // 1. Chercher d'abord une piste dans la langue préférée avec un codec nativement supporté par les navigateurs web (AAC, etc.)
      const matchedNativeAudio = audioTracks.find(
        (t) => matchesLanguagePreference(t.language, t.label, prefAudio) && BROWSER_NATIVE_AUDIO_CODECS.includes(t.codec.toLowerCase())
      );

      // 2. Sinon chercher n'importe quelle piste dans la langue préférée
      const matchedAudio = matchedNativeAudio || audioTracks.find((t) => matchesLanguagePreference(t.language, t.label, prefAudio));

      if (matchedAudio) {
        defaultAudioTrack = String(matchedAudio.index);
        isDefaultAudioAvailable = true;
      } else {
        // 3. Fallback : chercher une piste native toute langue, sinon la première
        const fallbackNative = audioTracks.find((t) => BROWSER_NATIVE_AUDIO_CODECS.includes(t.codec.toLowerCase()));
        defaultAudioTrack = String(fallbackNative ? fallbackNative.index : audioTracks[0].index);
        isDefaultAudioAvailable = false;
      }
    } else {
      isDefaultAudioAvailable = true;
    }

    // Détermination automatique du sous-titre
    let defaultSubtitle = 'off';
    let subtitleFallbackTriggered = false;

    if (subMode === 'always') {
      const matchedSub = allSubtitles.find((s) => matchesLanguagePreference(s.language, s.label, prefSub));
      if (matchedSub) {
        defaultSubtitle = matchedSub.fileName ? `file:${matchedSub.fileName}` : `track:${matchedSub.index}`;
      } else if (allSubtitles.length > 0) {
        const first = allSubtitles[0];
        defaultSubtitle = first.fileName ? `file:${first.fileName}` : `track:${first.index}`;
      }
    } else if (subMode === 'fallback_if_audio_missing') {
      if (!isDefaultAudioAvailable && audioTracks.length > 0) {
        const matchedSub = allSubtitles.find((s) => matchesLanguagePreference(s.language, s.label, prefSub));
        if (matchedSub) {
          defaultSubtitle = matchedSub.fileName ? `file:${matchedSub.fileName}` : `track:${matchedSub.index}`;
          subtitleFallbackTriggered = true;
        } else if (allSubtitles.length > 0) {
          const first = allSubtitles[0];
          defaultSubtitle = first.fileName ? `file:${first.fileName}` : `track:${first.index}`;
          subtitleFallbackTriggered = true;
        }
      }
    }

    const duration = parseFloat(info.format?.duration || '0');
    const width = videoStream?.width;
    const height = videoStream?.height;
    const qualities: string[] = [];
    if (height) {
      if (height >= 2160) qualities.push('4K (2160p)');
      if (height >= 1080) qualities.push('Full HD (1080p)');
      if (height >= 720) qualities.push('HD (720p)');
      if (height >= 480) qualities.push('SD (480p)');
    }

    // Détection de la nécessité de transcodage / HLS (non-compatibilité vidéo, conteneur non-web ex: .mkv/.avi, ou audio non-stéréo AAC)
    const videoCodec = (videoStream?.codec_name || '').toLowerCase();
    const ext = path.extname(media.videoFilePath || '').toLowerCase();
    const isContainerNative = ext === '.mp4' || ext === '.webm';
    const isVideoNative = BROWSER_NATIVE_VIDEO_CODECS.includes(videoCodec) && isContainerNative;
    const selectedTrack = audioTracks.find((t) => String(t.index) === String(defaultAudioTrack)) || audioTracks[0];
    const isAudioNative = selectedTrack ? (selectedTrack.codec.toLowerCase() === 'aac') : true;
    const requiresHls = !isVideoNative || !isAudioNative || !isContainerNative;

    const result = {
      durationSeconds: Math.round(duration),
      width,
      height,
      videoCodec,
      isVideoNative,
      requiresHls,
      streamType: requiresHls ? 'hls' : 'direct',
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
    };

    tracksCache.set(cacheKey, result);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: 'Erreur lors de la lecture des pistes du fichier', details: err?.message }, 500);
  }
});
