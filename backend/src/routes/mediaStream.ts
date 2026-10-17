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

const execFileAsync = promisify(execFile);
export const streamRouter = new Hono();

const MIME_MAP: Record<string, string> = {
  '.mp4': 'video/mp4', '.mkv': 'video/mp4', '.webm': 'video/webm',
  '.avi': 'video/x-msvideo', '.mov': 'video/quicktime', '.ts': 'video/mp2t',
};

const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

function setStreamCors(c: any) {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Origin, Range, Content-Type, Accept, Authorization');
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

streamRouter.options('/:id/stream', (c) => {
  setStreamCors(c);
  return c.body(null, 204);
});

streamRouter.on(['GET', 'HEAD'], '/:id/stream', async (c) => {
  setStreamCors(c);
  const id = c.req.param('id');
  const user = (c as any).get('user') as UserSession | null;
  const shareToken = c.req.query('share');

  const media = await findMediaByIdOrSlug(id);
  if (!media) return c.json({ error: 'Média introuvable' }, 404);

  // 1. Chaînes TV en direct ou flux externes
  if (media.nodeType === 'LIVE_CHANNEL' && media.streamUrl) {
    return await proxyLiveStream(c, media.streamUrl);
  }

  const isAuthorized = checkMediaAccess(user, media.id, shareToken, media.parentId, media.nodeType, {
    videoFilePath: media.videoFilePath,
    nfoFilePath: media.nfoFilePath,
    searchVectorText: media.searchVectorText,
  });

  if (!isAuthorized) {
    return c.json({
      error: user ? "Accès refusé : ce média ou son dossier physique n'est pas autorisé pour votre profil" : 'Connexion requise pour visionner cette vidéo ou lien expiré',
      code: user ? 'FORBIDDEN' : 'UNAUTHORIZED',
    }, user ? 403 : 401);
  }

  if (media.streamUrl) {
    return await proxyLiveStream(c, media.streamUrl);
  }

  if (!media.videoFilePath) return c.json({ error: 'Fichier vidéo absent' }, 404);

  const audio = c.req.query('audio');
  let activeFilePath = media.videoFilePath;
  const ext = path.extname(activeFilePath).toLowerCase();

  // Vérification de l'intégrité minimale du conteneur (détection des fichiers incomplets ou corrompus avec zéros d'en-tête)
  try {
    const fh = await fsp.open(activeFilePath, 'r');
    const headerBuf = Buffer.alloc(16);
    await fh.read(headerBuf, 0, 16, 0);
    await fh.close();

    const isAllZero = headerBuf.subarray(0, 4).every((b) => b === 0);
    const isCorruptMkv = ext === '.mkv' && headerBuf.subarray(0, 4).toString('hex') !== '1a45dfa3';
    if (isAllZero || isCorruptMkv) {
      await db.execute(sql`UPDATE media_nodes SET state = 'ERROR' WHERE id = ${media.id}`);
      return c.json(
        {
          error: "Ce fichier vidéo est incomplet ou corrompu sur le disque de stockage (téléchargement inachevé ou en-tête manquant).",
          code: 'CORRUPTED_FILE',
        },
        422
      );
    }
  } catch {
    return c.json({ error: 'Fichier vidéo inaccessible ou introuvable sur le disque', code: 'FILE_INACCESSIBLE' }, 404);
  }

  if (audio && audio !== 'auto') {
    const cacheDir = '/tmp/ums_cache';
    const cacheFile = path.join(cacheDir, `${media.id}_a${audio}${ext}`);
    if (!fs.existsSync(cacheFile)) {
      await fsp.mkdir(cacheDir, { recursive: true });
      await execFileAsync('ffmpeg', ['-v', 'error', '-i', activeFilePath, '-map', '0:v:0', '-map', `0:${audio}`, '-c', 'copy', cacheFile], { timeout: 15000 }).catch(() => null);
    }
    if (fs.existsSync(cacheFile)) activeFilePath = cacheFile;
  }

  const stat = await fsp.stat(activeFilePath);
  const fileSize = stat.size;
  const mimeType = MIME_MAP[ext] || 'video/mp4';
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

  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize) {
    c.header('Content-Range', `bytes */${fileSize}`);
    return c.body(null, 416);
  }

  const chunksize = end - start + 1;
  c.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
  c.header('Accept-Ranges', 'bytes');
  c.header('Content-Length', String(chunksize));
  c.header('Content-Type', mimeType);

  if (isHead) return c.body(null, 206);

  const stream = fs.createReadStream(activeFilePath, { start, end });
  return c.body(Readable.toWeb(stream) as any, 206);
});
