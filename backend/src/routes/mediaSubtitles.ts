import { Hono } from 'hono';
import { db } from '../db/connection.js';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
export const subtitleRouter = new Hono();

const DISK_CACHE_DIR = '/tmp/ums_subtitles_cache';
if (!fs.existsSync(DISK_CACHE_DIR)) {
  try {
    fs.mkdirSync(DISK_CACHE_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create subtitle cache directory:', err);
  }
}

const subtitleMemoryCache = new Map<string, string>();
const inFlightOcrPromises = new Map<string, Promise<string | null>>();

function srtToVtt(srt: string): string {
  // Conversion fiable de SRT vers WebVTT : virgules en points pour les millisecondes (RFC 8216 / W3C)
  return 'WEBVTT\n\n' + srt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/(\d{2}:\d{2}:\d{2})[,.](\d{3})/g, '$1.$2');
}

const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

function getDiskCachePath(cacheKey: string): string {
  const hash = crypto.createHash('sha256').update(cacheKey).digest('hex');
  return path.join(DISK_CACHE_DIR, `${hash}.vtt`);
}

/**
 * Extraction et OCR d'une piste bitmap (hdmv_pgs_subtitle / dvd_subtitle) via pgsrip et Tesseract
 */
async function ripPgsSubtitleTrack(videoPath: string, trackIndex: string, langHint?: string): Promise<string | null> {
  const ocrKey = `${videoPath}:${trackIndex}`;
  if (inFlightOcrPromises.has(ocrKey)) {
    return inFlightOcrPromises.get(ocrKey)!;
  }

  const ocrPromise = (async () => {
    let ocrLang = (langHint || '').toLowerCase();
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-select_streams', String(trackIndex),
        '-show_entries', 'stream=codec_name:stream_tags=language',
        '-of', 'json',
        videoPath,
      ], { timeout: 15000 });
      const info = JSON.parse(stdout);
      const s = info.streams?.[0];
      const l = s?.tags?.language?.toLowerCase();
      if (l?.startsWith('en')) ocrLang = 'eng';
      else if (l?.startsWith('fr')) ocrLang = 'fra';
      else if (l) ocrLang = l;
    } catch {}

    if (!ocrLang) ocrLang = 'fra';

    const tempId = `pgs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const tempSup = path.join('/tmp', `${tempId}.${ocrLang}.sup`);

    // pgsrip normalise le code langue du nom de sortie (ex: `fra` -> `fr`, `eng` -> `en`).
    // On ne peut donc pas prédire exactement le nom du fichier SRT : on scanne les fichiers
    // générés à partir de notre identifiant temporaire unique.
    const findGeneratedSrt = async (): Promise<string | null> => {
      try {
        const entries = await fsp.readdir('/tmp');
        const match = entries.find(
          (name) => name.startsWith(`${tempId}`) && name.toLowerCase().endsWith('.srt')
        );
        return match ? path.join('/tmp', match) : null;
      } catch {
        return null;
      }
    };

    try {
      // 1. Extraction du flux SUP par FFmpeg (rapide, ~5-15s à >100x de vitesse)
      await execFileAsync('ffmpeg', [
        '-nostdin',
        '-i', videoPath,
        '-map', `0:${trackIndex}`,
        '-c:s', 'copy',
        tempSup,
        '-y',
      ], { timeout: 120000 });

      // 2. Transcription OCR via pgsrip + Tesseract
      await execFileAsync('pgsrip', [
        'rip',
        '-l', ocrLang,
        tempSup,
      ], { timeout: 180000 });

      const generatedSrt = await findGeneratedSrt();
      if (generatedSrt) {
        const srt = await fsp.readFile(generatedSrt, 'utf-8');
        // Ne jamais considérer un SRT vide comme un succès (sinon un WebVTT vide serait mis en cache).
        if (srt.trim().length > 0 && srt.includes('-->')) {
          return srtToVtt(srt);
        }
        console.warn(`OCR pgsrip a produit un SRT vide pour la piste ${trackIndex}.`);
      } else {
        console.warn(`OCR pgsrip n'a produit aucun fichier SRT pour la piste ${trackIndex}.`);
      }
    } catch (err) {
      console.error(`Erreur OCR pgsrip pour piste ${trackIndex}:`, err);
    } finally {
      // pgsrip peut générer plusieurs fichiers (SUP, SRT, éventuels intermédiaires) :
      // on nettoie tout ce qui commence par notre identifiant temporaire unique.
      try {
        const leftovers = await fsp.readdir('/tmp').catch(() => [] as string[]);
        await Promise.all(
          leftovers
            .filter((name) => name.startsWith(tempId))
            .map((name) => fsp.unlink(path.join('/tmp', name)).catch(() => {}))
        );
      } catch {}
    }
    return null;
  })();

  inFlightOcrPromises.set(ocrKey, ocrPromise);
  try {
    return await ocrPromise;
  } finally {
    inFlightOcrPromises.delete(ocrKey);
  }
}

async function handleSubtitleRequest(c: any, id: string, rawTrackIndex?: string, rawFileName?: string, rawLang?: string) {
  let trackIndex = rawTrackIndex;
  let fileName = rawFileName;
  let lang = (rawLang || '').toLowerCase();

  const cacheKey = `${id}:${trackIndex || ''}:${fileName || ''}:${lang || ''}`;
  const diskPath = getDiskCachePath(cacheKey);

  const headers = {
    'Content-Type': 'text/vtt; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=86400',
  };

  // 1. Vérification Cache L1 (Mémoire vive)
  if (subtitleMemoryCache.has(cacheKey)) {
    const vtt = subtitleMemoryCache.get(cacheKey)!;
    return c.req.method === 'HEAD' ? c.body(null, 200, headers) : c.text(vtt, 200, headers);
  }

  // 2. Vérification Cache L2 (Disque persistant)
  try {
    const cachedDisk = await fsp.readFile(diskPath, 'utf-8').catch(() => null);
    if (cachedDisk && cachedDisk.length > 10) {
      subtitleMemoryCache.set(cacheKey, cachedDisk);
      return c.req.method === 'HEAD' ? c.body(null, 200, headers) : c.text(cachedDisk, 200, headers);
    }
  } catch {}

  const media = await db.query.mediaNodes.findFirst({
    where: (t, { or, eq }) => isUuid(id) ? or(eq(t.id, id), eq(t.slug, id)) : eq(t.slug, id),
  });

  if (!media?.videoFilePath) {
    return c.text('WEBVTT\n\n', 200, { ...headers, 'Cache-Control': 'no-store' });
  }

  try {
    const dir = path.dirname(media.videoFilePath);

    // Extraction depuis fichier externe adjacent (.srt, .vtt)
    if (fileName) {
      const candidates = [
        path.join(dir, fileName),
        path.join(dir, 'Subtitles', fileName),
        path.join(dir, 'Subs', fileName),
        path.join(path.dirname(dir), 'Subtitles', fileName)
      ];
      for (const cand of candidates) {
        const content = await fsp.readFile(cand, 'utf-8').catch(() => null);
        if (content) {
          const vtt = cand.endsWith('.vtt') ? content : srtToVtt(content);
          subtitleMemoryCache.set(cacheKey, vtt);
          await fsp.writeFile(diskPath, vtt, 'utf-8').catch(() => {});
          return c.req.method === 'HEAD' ? c.body(null, 200, headers) : c.text(vtt, 200, headers);
        }
      }
    }

    // Extraction depuis flux interne par index de piste
    if (trackIndex !== undefined && trackIndex !== '') {
      try {
        const { stdout } = await execFileAsync('ffmpeg', [
          '-nostdin',
          '-vn',
          '-an',
          '-i', media.videoFilePath,
          '-map', `0:${trackIndex}`,
          '-c:s', 'webvtt',
          '-f', 'webvtt',
          'pipe:1',
        ], { timeout: 180000, maxBuffer: 20 * 1024 * 1024 });

        if (stdout && stdout.includes('WEBVTT')) {
          const vtt = stdout.substring(stdout.indexOf('WEBVTT'));
          subtitleMemoryCache.set(cacheKey, vtt);
          await fsp.writeFile(diskPath, vtt, 'utf-8').catch(() => {});
          return c.req.method === 'HEAD' ? c.body(null, 200, headers) : c.text(vtt, 200, headers);
        }
      } catch (directErr: any) {
        // Encodage direct impossible (ex: sous-titre bitmap PGS ou DVD) -> Déclenchement de l'OCR haute fidélité
        console.log(`Direct text extraction failed for track ${trackIndex}, attempting OCR extraction...`);
        const vtt = await ripPgsSubtitleTrack(media.videoFilePath, trackIndex, lang);
        if (vtt && vtt.includes('WEBVTT')) {
          subtitleMemoryCache.set(cacheKey, vtt);
          await fsp.writeFile(diskPath, vtt, 'utf-8').catch(() => {});
          return c.req.method === 'HEAD' ? c.body(null, 200, headers) : c.text(vtt, 200, headers);
        }
      }
    }

    // Extraction par code de langue
    if (lang) {
      try {
        const { stdout } = await execFileAsync('ffmpeg', [
          '-nostdin',
          '-vn',
          '-an',
          '-i', media.videoFilePath,
          '-map', `0:m:language:${lang}?`,
          '-c:s', 'webvtt',
          '-f', 'webvtt',
          'pipe:1',
        ], { timeout: 180000, maxBuffer: 20 * 1024 * 1024 });

        if (stdout && stdout.includes('WEBVTT')) {
          const vtt = stdout.substring(stdout.indexOf('WEBVTT'));
          subtitleMemoryCache.set(cacheKey, vtt);
          await fsp.writeFile(diskPath, vtt, 'utf-8').catch(() => {});
          return c.req.method === 'HEAD' ? c.body(null, 200, headers) : c.text(vtt, 200, headers);
        }
      } catch (directErr) {
        // Fallback OCR par langue
      }
    }
  } catch (err) {
    console.error('Subtitle extraction error:', err);
  }

  // Safety Fallback : Toujours retourner un WebVTT valide 200 OK (même vide) plutôt qu'une erreur 404
  // Cela empêche le crash du tag <track> et évite les erreurs fatales dans la console du navigateur.
  // Un résultat vide n'est jamais mis en cache navigateur afin qu'une extraction ultérieure réussie
  // puisse être immédiatement visible (notamment pour les pistes bitmap en cours d'OCR).
  return c.text('WEBVTT\n\n', 200, { ...headers, 'Cache-Control': 'no-store' });
}

// 1. Support de l'endpoint avec paramètres d'URL (ex: /api/media/:id/subtitles?trackIndex=4 ou ?fileName=...)
subtitleRouter.on(['GET', 'HEAD'], '/:id/subtitles', async (c) => {
  const id = c.req.param('id');
  const trackIndex = c.req.query('trackIndex');
  const fileName = c.req.query('fileName');
  const lang = (c.req.query('lang') || '').toLowerCase();
  return handleSubtitleRequest(c, id, trackIndex, fileName, lang);
});

// 2. Support de l'endpoint avec identifiant de sous-titre en sous-chemin (ex: /api/media/:id/subtitles/track:4 ou /subtitles/file:...)
subtitleRouter.on(['GET', 'HEAD'], '/:id/subtitles/:subId', async (c) => {
  const id = c.req.param('id');
  const rawSubId = decodeURIComponent(c.req.param('subId') || '');
  let trackIndex: string | undefined;
  let fileName: string | undefined;
  let lang: string | undefined;

  if (rawSubId.startsWith('track:')) {
    trackIndex = rawSubId.slice(6);
  } else if (rawSubId.startsWith('file:')) {
    fileName = rawSubId.slice(5);
  } else if (rawSubId.length === 2 || rawSubId.length === 3) {
    lang = rawSubId;
  } else if (/^\d+$/.test(rawSubId)) {
    trackIndex = rawSubId;
  } else {
    fileName = rawSubId;
  }

  return handleSubtitleRequest(c, id, trackIndex, fileName, lang);
});
