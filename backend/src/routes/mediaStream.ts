import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { sql } from 'drizzle-orm';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import { checkMediaAccess } from '../auth/mediaAccess.js';
import type { UserSession } from '../middleware/access.js';
import { proxyLiveStream } from '../iptv/liveProxyService.js';
import { checkMediaFile } from '../utils/mediaFileStatus.js';

const execFileAsync = promisify(execFile);
export const streamRouter = new Hono();

const MIME_MAP: Record<string, string> = {
  ".mp4": "video/mp4", ".mkv": "video/mp4", ".webm": "video/webm",
  ".avi": "video/x-msvideo", ".mov": "video/quicktime", ".ts": "video/mp2t",
};

const BROWSER_NATIVE_AUDIO_CODECS = ['aac', 'mp3', 'opus', 'vorbis', 'flac'];
const BROWSER_NATIVE_VIDEO_CODECS = ['h264', 'av1', 'vp8', 'vp9'];

const inFlightSegments = new Map<string, Promise<string>>();

const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

function setStreamCors(c: any) {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Origin, Range, Content-Type, Accept, Authorization, X-Requested-With, X-Device-Id, x-device-id');
  c.header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
}

async function findMediaByIdOrSlug(idOrSlug?: string) {
  if (!idOrSlug) return null;
  if (isUuid(idOrSlug)) {
    return await db.query.mediaNodes.findFirst({
      where: (t, { eq }) => eq(t.id, idOrSlug),
    });
  }
  return await db.query.mediaNodes.findFirst({
    where: (t, { eq }) => eq(t.slug, idOrSlug),
  });
}

interface MediaProbeInfo {
  duration: number;
  videoCodec: string;
  isVideoNative: boolean;
  mtimeMs: number;
  audioStreams: Array<{ index: number; codec: string; channels: number; language?: string }>;
}

const probeCache = new Map<string, MediaProbeInfo>();
const MAX_PROBE_CACHE_ENTRIES = 500;

async function getMediaProbe(filePath: string): Promise<MediaProbeInfo> {
  const stat = await fsp.stat(filePath);
  // La clé inclut mtime + taille : si un fichier est remplacé sur disque, le
  // cache est automatiquement invalidé au lieu de servir des métadonnées périmées.
  const cacheKey = `${filePath}:${stat.mtimeMs}:${stat.size}`;
  const cached = probeCache.get(cacheKey);
  if (cached) return cached;

  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=index,codec_type,codec_name,channels:stream_tags=language:format=duration',
    '-of', 'json',
    filePath,
  ], { timeout: 10000 });

  const info = JSON.parse(stdout);
  const duration = Math.max(1, parseFloat(info.format?.duration || '0'));
  const streams = info.streams || [];
  const videoStream = streams.find((s: any) => s.codec_type === 'video');
  const videoCodec = (videoStream?.codec_name || '').toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  const isContainerNative = ext === '.mp4' || ext === '.webm';
  const isVideoNative = BROWSER_NATIVE_VIDEO_CODECS.includes(videoCodec) && isContainerNative;

  const audioStreams = streams
    .filter((s: any) => s.codec_type === 'audio')
    .map((s: any) => ({
      index: s.index,
      codec: (s.codec_name || '').toLowerCase(),
      channels: typeof s.channels === 'number' ? s.channels : 2,
      language: s.tags?.language,
    }));

  const probe: MediaProbeInfo = {
    duration,
    videoCodec,
    isVideoNative,
    mtimeMs: Math.floor(stat.mtimeMs),
    audioStreams,
  };
  if (probeCache.size >= MAX_PROBE_CACHE_ENTRIES) {
    const oldest = probeCache.keys().next().value;
    if (oldest !== undefined) probeCache.delete(oldest);
  }
  probeCache.set(cacheKey, probe);
  return probe;
}

// ---------------------------------------------------------------------------
// Limitation de la concurrence FFmpeg & entretien du cache de segments
// ---------------------------------------------------------------------------
const parsedFfmpegConcurrency = parseInt(process.env.FFMPEG_MAX_CONCURRENCY || '4', 10);
const MAX_CONCURRENT_FFMPEG = Number.isFinite(parsedFfmpegConcurrency) && parsedFfmpegConcurrency > 0
  ? parsedFfmpegConcurrency
  : 4;
const MAX_QUEUED_FFMPEG = 64;
let activeFfmpeg = 0;
const ffmpegWaiters: Array<() => void> = [];
let segmentsSincePrune = 0;
const SEGMENTS_BEFORE_PRUNE = 250;
const MAX_CACHED_SEGMENTS = 3000;
const MAX_SEGMENT_AGE_MS = 12 * 60 * 60 * 1000;

async function withFfmpegSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeFfmpeg >= MAX_CONCURRENT_FFMPEG) {
    if (ffmpegWaiters.length >= MAX_QUEUED_FFMPEG) {
      throw new Error('Trop de transcodages simultanés, réessayez dans un instant.');
    }
    await new Promise<void>((resolve) => ffmpegWaiters.push(resolve));
  }
  activeFfmpeg++;
  try {
    return await task();
  } finally {
    activeFfmpeg--;
    const next = ffmpegWaiters.shift();
    if (next) next();
  }
}

async function pruneSegmentCache(rootDir: string): Promise<void> {
  if (segmentsSincePrune < SEGMENTS_BEFORE_PRUNE) return;
  segmentsSincePrune = 0;
  try {
    const entries = await fsp.readdir(rootDir, { withFileTypes: true }).catch(() => []);
    const now = Date.now();
    const files: Array<{ path: string; mtimeMs: number }> = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
      const fullPath = path.join(rootDir, entry.name);
      const s = await fsp.stat(fullPath).catch(() => null);
      if (!s) continue;
      if (now - s.mtimeMs > MAX_SEGMENT_AGE_MS) {
        await fsp.unlink(fullPath).catch(() => {});
      } else {
        files.push({ path: fullPath, mtimeMs: s.mtimeMs });
      }
    }

    if (files.length > MAX_CACHED_SEGMENTS) {
      files.sort((a, b) => a.mtimeMs - b.mtimeMs);
      const excess = files.length - MAX_CACHED_SEGMENTS;
      for (let i = 0; i < excess; i++) {
        await fsp.unlink(files[i].path).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Nettoyage du cache de segments impossible:', err);
  }
}

interface ByteRange {
  start: number;
  end: number;
}

/** Analyse fiable d'un en-tête Range (y compris les suffixes « bytes=-N »). */
function parseByteRange(header: string | undefined, fileSize: number): ByteRange | null {
  if (!header || fileSize <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;

  if (rawStart === '') {
    const suffixLength = parseInt(rawEnd, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    return { start: Math.max(0, fileSize - suffixLength), end: fileSize - 1 };
  }

  const start = parseInt(rawStart, 10);
  const end = rawEnd === '' ? fileSize - 1 : parseInt(rawEnd, 10);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || start >= fileSize || end < start) return null;

  return { start, end: Math.min(end, fileSize - 1) };
}

// ---------------------------------------------------------------------------
// HLS VOD Streaming Routes (Zero-latency on-the-fly transcoding for any media)
// ---------------------------------------------------------------------------

streamRouter.options('/:id/hls/:file', (c) => {
  setStreamCors(c);
  return c.body(null, 204);
});

streamRouter.get('/:id/hls/:file', async (c) => {
  setStreamCors(c);
  const id = c.req.param('id');
  const file = c.req.param('file') || '';
  const user = (c as any).get('user') as UserSession | null;
  const shareToken = c.req.query('share') || c.req.query('share_token');
  const queryToken = c.req.query('token') || c.req.query('auth');
  // L'index audio provient du client : on n'accepte qu'un entier positif.
  // Cela empêche toute injection dans le nom de fichier du cache ou dans -map.
  const rawAudio = (c.req.query('audio') || 'auto').trim();
  const targetAudio = /^\d{1,3}$/.test(rawAudio) ? rawAudio : 'auto';

  const media = await findMediaByIdOrSlug(id);
  if (!media) return c.json({ error: 'Média introuvable' }, 404);

  const isAuthorized = checkMediaAccess(user, media.id, shareToken, media.parentId, media.nodeType, {
    videoFilePath: media.videoFilePath,
    nfoFilePath: media.nfoFilePath,
    searchVectorText: media.searchVectorText,
  });

  if (!isAuthorized) {
    return c.json({
      error: user ? "Accès refusé pour votre profil" : 'Connexion requise',
      code: user ? 'FORBIDDEN' : 'UNAUTHORIZED',
    }, user ? 403 : 401);
  }

  // Chaînes TV en direct (après contrôle d'accès)
  if (media.nodeType === 'LIVE_CHANNEL' && media.streamUrl) {
    return await proxyLiveStream(c, media.streamUrl);
  }

  if (!media.videoFilePath) {
    return c.json({ error: 'Fichier vidéo introuvable sur le disque', code: 'FILE_INACCESSIBLE' }, 404);
  }

  // Distingue un fichier supprimé d'un disque externe débranché ou en erreur E/S.
  // Sans cela, une panne de volume était présentée comme une erreur de flux générique.
  const hlsFileStatus = await checkMediaFile(media.videoFilePath);
  if (!hlsFileStatus.ok) {
    return c.json(
      {
        error: hlsFileStatus.reason || 'Fichier vidéo introuvable sur le disque',
        code: hlsFileStatus.code,
        diskName: hlsFileStatus.diskName,
      },
      hlsFileStatus.code === 'STORAGE_OFFLINE' ? 503 : 404
    );
  }

  let probe: MediaProbeInfo;
  try {
    probe = await getMediaProbe(media.videoFilePath);
  } catch (err: any) {
    return c.json({ error: 'Erreur analyse média', details: err?.message }, 500);
  }

  // 1. Fichier Manifeste Master M3U8
  if (file === 'master.m3u8') {
    const tokenParam = queryToken ? `&token=${encodeURIComponent(queryToken)}` : '';
    const shareParam = shareToken ? `&share=${encodeURIComponent(shareToken)}` : '';

    const segmentDuration = 6.0;
    const totalSegments = Math.max(1, Math.ceil(probe.duration / segmentDuration));

    let manifest = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:7\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:VOD\n';

    for (let i = 0; i < totalSegments; i++) {
      const isLast = i === totalSegments - 1;
      const dur = isLast ? Math.max(0.1, Number((probe.duration - i * segmentDuration).toFixed(3))) : segmentDuration;
      if (i > 0) {
        manifest += '#EXT-X-DISCONTINUITY\n';
      }
      manifest += `#EXTINF:${dur.toFixed(3)},\n`;
      manifest += `/api/media/${media.id}/hls/segment_${i}.ts?audio=${encodeURIComponent(targetAudio)}${tokenParam}${shareParam}\n`;
    }
    manifest += '#EXT-X-ENDLIST\n';

    c.header('Content-Type', 'application/vnd.apple.mpegurl');
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    return c.text(manifest);
  }

  // 2. Segments Vidéo TS
  if (file.startsWith('segment_') && file.endsWith('.ts')) {
    const indexStr = file.slice('segment_'.length, -'.ts'.length);
    const index = parseInt(indexStr, 10);
    if (isNaN(index) || index < 0) return c.text('Invalid segment index', 400);

    const segmentDuration = 6.0;
    const totalSegments = Math.max(1, Math.ceil(probe.duration / segmentDuration));
    if (index >= totalSegments) return c.text('Segment index out of range', 404);

    // La version du fichier source fait partie du nom de chaque segment : si le
    // média est remplacé, les anciens segments ne sont jamais resservis.
    const cacheRoot = '/tmp/ums_cache/segments';
    await fsp.mkdir(cacheRoot, { recursive: true });
    await pruneSegmentCache(cacheRoot);

    const generateSegment = async (segIdx: number): Promise<string> => {
      const segFile = path.join(cacheRoot, `${media.id}_${probe.mtimeMs}_a${targetAudio}_seg${segIdx}.ts`);
      if (fs.existsSync(segFile)) return segFile;

      if (!inFlightSegments.has(segFile)) {
        const segPromise = (async () => {
          const tempSeg = `${segFile}.tmp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.ts`;
          const startTime = segIdx * segmentDuration;
          const isLastSeg = segIdx === totalSegments - 1;
          const segDur = isLastSeg ? Math.max(0.1, Number((probe.duration - segIdx * segmentDuration).toFixed(3))) : segmentDuration;

          const hasAudio = probe.audioStreams.length > 0;
          let resolvedAudio = targetAudio;
          const requestedAudioExists = probe.audioStreams.some((s) => String(s.index) === String(resolvedAudio));
          if (hasAudio && (!resolvedAudio || resolvedAudio === 'auto' || !requestedAudioExists)) {
            const firstStereoAac = probe.audioStreams.find((s) => s.codec === 'aac' && (s.channels ?? 2) <= 2);
            resolvedAudio = String(firstStereoAac ? firstStereoAac.index : probe.audioStreams[0].index);
          }

          const selectedAudioStream = probe.audioStreams.find((s) => String(s.index) === String(resolvedAudio));
          const isStereoAac = selectedAudioStream ? (selectedAudioStream.codec === 'aac' && (selectedAudioStream.channels ?? 2) <= 2) : false;

          const preSeek = Math.max(0, startTime - 5);
          const postSeek = startTime > 5 ? 5 : startTime;

          const ffmpegArgs = [
            ...(preSeek > 0 ? ['-ss', String(preSeek)] : []),
            '-i', media.videoFilePath!,
            ...(postSeek > 0 ? ['-ss', String(postSeek)] : []),
            '-t', String(segDur),
            '-map', '0:v:0',
            ...(hasAudio ? ['-map', `0:${resolvedAudio}`] : ['-an']),
            ...(probe.isVideoNative
              ? ['-c:v', 'copy']
              : ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '23', '-pix_fmt', 'yuv420p']),
            ...(!hasAudio
              ? []
              : isStereoAac
                ? ['-c:a', 'copy']
                : ['-c:a', 'aac', '-b:a', '192k', '-ac', '2']),
            '-muxpreload', '0',
            '-muxdelay', '0',
            '-output_ts_offset', String(startTime),
            '-f', 'mpegts',
            '-y',
            tempSeg,
          ];

          try {
            await withFfmpegSlot(() => execFileAsync('ffmpeg', ffmpegArgs, { timeout: 25000 }));
            if (fs.existsSync(tempSeg)) {
              await fsp.rename(tempSeg, segFile);
              segmentsSincePrune++;
            }
          } catch (err) {
            console.error(`Erreur génération segment HLS ${segFile}:`, err);
            try { if (fs.existsSync(tempSeg)) await fsp.unlink(tempSeg); } catch {}
          } finally {
            inFlightSegments.delete(segFile);
          }
          return segFile;
        })();
        inFlightSegments.set(segFile, segPromise);
      }
      return await inFlightSegments.get(segFile)!;
    };

    const targetSegFile = await generateSegment(index);

    // Préchauffage / pré-génération anticipée du segment suivant en tâche de fond pour lecture 100% fluide sans micro-coupure
    if (index + 1 < totalSegments) {
      generateSegment(index + 1).catch(() => {});
    }

    if (fs.existsSync(targetSegFile)) {
      const stat = await fsp.stat(targetSegFile);
      c.header('Content-Type', 'video/mp2t');
      c.header('Content-Length', String(stat.size));
      c.header('Cache-Control', 'public, max-age=86400');
      if (c.req.method === 'HEAD') return c.body(null, 200);
      const stream = fs.createReadStream(targetSegFile);
      return c.body(Readable.toWeb(stream) as any, 200);
    }

    return c.text('Segment generation failed', 500);
  }

  return c.text('File not found', 404);
});

// ---------------------------------------------------------------------------
// Standard Direct Byte-Range Streaming Route
// ---------------------------------------------------------------------------

streamRouter.options('/:id/stream', (c) => {
  setStreamCors(c);
  return c.body(null, 204);
});

streamRouter.on(['GET', 'HEAD'], '/:id/stream', async (c) => {
  setStreamCors(c);
  const id = c.req.param('id');
  const user = (c as any).get('user') as UserSession | null;
  const shareToken = c.req.query('share') || c.req.query('share_token');
  const audio = c.req.query('audio');

  const media = await findMediaByIdOrSlug(id);
  if (!media) return c.json({ error: 'Média introuvable' }, 404);

  const isAuthorized = checkMediaAccess(user, media.id, shareToken, media.parentId, media.nodeType, {
    videoFilePath: media.videoFilePath,
    nfoFilePath: media.nfoFilePath,
    searchVectorText: media.searchVectorText,
  });

  if (!isAuthorized) {
    return c.json({
      error: user ? "Accès refusé pour votre profil" : 'Connexion requise',
      code: user ? 'FORBIDDEN' : 'UNAUTHORIZED',
    }, user ? 403 : 401);
  }

  if (media.streamUrl) {
    return await proxyLiveStream(c, media.streamUrl);
  }

  if (!media.videoFilePath) {
    return c.json({ error: 'Fichier vidéo absent ou introuvable', code: 'FILE_INACCESSIBLE' }, 404);
  }

  const fileStatus = await checkMediaFile(media.videoFilePath);
  if (!fileStatus.ok) {
    return c.json(
      {
        error: fileStatus.reason || 'Fichier vidéo absent ou introuvable',
        code: fileStatus.code,
        diskName: fileStatus.diskName,
      },
      fileStatus.code === 'STORAGE_OFFLINE' ? 503 : 404
    );
  }

  let activeFilePath = media.videoFilePath;
  const originalExt = path.extname(activeFilePath).toLowerCase();

  // Vérification de l'intégrité minimale du conteneur
  try {
    const fh = await fsp.open(activeFilePath, 'r');
    const headerBuf = Buffer.alloc(16);
    await fh.read(headerBuf, 0, 16, 0);
    await fh.close();

    const isAllZero = headerBuf.subarray(0, 4).every((b) => b === 0);
    const isCorruptMkv = originalExt === '.mkv' && headerBuf.subarray(0, 4).toString('hex') !== '1a45dfa3';
    if (isAllZero || isCorruptMkv) {
      await db.execute(sql`UPDATE media_nodes SET state = 'ERROR' WHERE id = ${media.id}`);
      return c.json(
        {
          error: "Ce fichier vidéo est incomplet ou corrompu sur le disque de stockage.",
          code: 'CORRUPTED_FILE',
        },
        422
      );
    }
  } catch (err: any) {
    const readStatus = await checkMediaFile(activeFilePath);
    return c.json(
      {
        error: readStatus.reason || 'Fichier vidéo inaccessible ou introuvable sur le disque',
        code: readStatus.code === 'STORAGE_OFFLINE' ? 'STORAGE_OFFLINE' : 'FILE_INACCESSIBLE',
        diskName: readStatus.diskName,
      },
      readStatus.code === 'STORAGE_OFFLINE' ? 503 : 404
    );
  }

  // Sonde de compatibilité navigateur pour orienter vers HLS si nécessaire (.avi, HEVC, audio non-native)
  let probe: MediaProbeInfo | null = null;
  try {
    probe = await getMediaProbe(activeFilePath);
  } catch {}

  const isContainerNative = originalExt === '.mp4' || originalExt === '.webm';
  const isVideoNative = probe ? (probe.isVideoNative && isContainerNative) : isContainerNative;
  let isAudioNative = true;
  if (probe) {
    const targetA = audio && audio !== 'auto' ? audio : String(probe.audioStreams[0]?.index ?? '1');
    const stream = probe.audioStreams.find((s) => String(s.index) === String(targetA)) || probe.audioStreams[0];
    if (stream) {
      isAudioNative = stream.codec === 'aac' && (stream.channels ?? 2) <= 2;
    }
  }

  // Si le média nécessite un transcodage (ex: .mkv, .avi, hevc, dts/ac3/5.1 surround), rediriger vers le flux HLS on-the-fly
  if (!isVideoNative || !isAudioNative || !isContainerNative) {
    const p = new URLSearchParams();
    if (audio) p.set('audio', audio);
    if (shareToken) p.set('share', shareToken);
    const token = c.req.query('token') || c.req.query('auth');
    if (token) p.set('token', token);
    const qs = p.toString();
    return c.redirect(`/api/media/${media.id}/hls/master.m3u8${qs ? `?${qs}` : ''}`, 307);
  }

  const stat = await fsp.stat(activeFilePath);
  const fileSize = stat.size;
  const currentExt = path.extname(activeFilePath).toLowerCase();
  const mimeType = MIME_MAP[currentExt] || 'video/mp4';
  const range = c.req.header('range');
  const isHead = c.req.method === 'HEAD';

  if (!range) {
    c.header('Content-Type', mimeType);
    c.header('Content-Length', String(fileSize));
    c.header('Accept-Ranges', 'bytes');
    if (isHead) return c.body(null, 200);

    const stream = fs.createReadStream(activeFilePath);
    return c.body(Readable.toWeb(stream) as any, 200);
  }

  const byteRange = parseByteRange(range, fileSize);
  if (!byteRange) {
    c.header('Content-Range', `bytes */${fileSize}`);
    c.header('Accept-Ranges', 'bytes');
    return c.body(null, 416);
  }

  const { start, end } = byteRange;
  const chunksize = end - start + 1;
  c.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
  c.header('Accept-Ranges', 'bytes');
  c.header('Content-Length', String(chunksize));
  c.header('Content-Type', mimeType);

  if (isHead) return c.body(null, 206);

  const stream = fs.createReadStream(activeFilePath, { start, end });
  return c.body(Readable.toWeb(stream) as any, 206);
});
