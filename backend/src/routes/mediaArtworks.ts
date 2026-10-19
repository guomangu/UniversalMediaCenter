import { Hono } from 'hono';
import { db } from '../db/connection.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isTaintedArtwork } from '../watcher/kaiPaceResolver.js';
import { getSafeOutboundUrl, safeFetch } from '../utils/safeUrl.js';

const execFileAsync = promisify(execFile);
const MAX_REMOTE_ARTWORK_BYTES = 15 * 1024 * 1024;
const thumbInFlight = new Map<string, Promise<boolean>>();

const MAX_CONCURRENT_THUMB_JOBS = 2;
let activeThumbJobs = 0;
const thumbWaiters: Array<() => void> = [];

async function withThumbSlot<T>(task: () => Promise<T>): Promise<T | null> {
  if (activeThumbJobs >= MAX_CONCURRENT_THUMB_JOBS) {
    if (thumbWaiters.length >= 60) return null;
    await new Promise<void>((resolve) => thumbWaiters.push(resolve));
  }
  activeThumbJobs++;
  try {
    return await task();
  } finally {
    activeThumbJobs--;
    const next = thumbWaiters.shift();
    if (next) next();
  }
}

export const artworkRouter = new Hono();

function generateFallbackSvgPoster(title: string, nodeType?: string): Response {
  const safeTitle = (title || 'UMS Média')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const badge = nodeType === 'SHOW' ? 'SÉRIE' : nodeType === 'LIVE_CHANNEL' ? 'DIRECT' : nodeType === 'COLLECTION' ? 'SAGA' : 'FILM';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#020617"/>
      </linearGradient>
    </defs>
    <rect width="300" height="450" fill="url(#bg)"/>
    <rect x="12" y="12" width="276" height="426" rx="12" fill="none" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 4"/>
    <circle cx="150" cy="180" r="46" fill="#3b82f6" fill-opacity="0.12"/>
    <path d="M140 162 L168 180 L140 198 Z" fill="#60a5fa"/>
    <rect x="105" y="115" width="90" height="24" rx="12" fill="#2563eb" fill-opacity="0.25"/>
    <text x="150" y="131" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#93c5fd" text-anchor="middle" letter-spacing="1.5">${badge}</text>
    <text x="150" y="270" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="600" fill="#f8fafc" text-anchor="middle">
      ${safeTitle.length > 28 ? safeTitle.slice(0, 26) + '...' : safeTitle}
    </text>
  </svg>`;
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}

function generateFallbackSvgLandscape(title: string, nodeType?: string): Response {
  const safeTitle = (title || 'UMS Média')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const badge = nodeType === 'SHOW' ? 'SÉRIE' : nodeType === 'LIVE_CHANNEL' ? 'DIRECT' : nodeType === 'COLLECTION' ? 'SAGA' : 'FILM';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <defs>
      <linearGradient id="bgL" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#020617"/>
      </linearGradient>
    </defs>
    <rect width="640" height="360" fill="url(#bgL)"/>
    <rect x="16" y="16" width="608" height="328" rx="12" fill="none" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 4"/>
    <circle cx="320" cy="150" r="44" fill="#3b82f6" fill-opacity="0.12"/>
    <path d="M312 135 L336 150 L312 165 Z" fill="#60a5fa"/>
    <rect x="275" y="85" width="90" height="24" rx="12" fill="#2563eb" fill-opacity="0.25"/>
    <text x="320" y="101" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#93c5fd" text-anchor="middle" letter-spacing="1.5">${badge}</text>
    <text x="320" y="240" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600" fill="#f8fafc" text-anchor="middle">
      ${safeTitle.length > 45 ? safeTitle.slice(0, 42) + '...' : safeTitle}
    </text>
  </svg>`;
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}

async function extractThumbnailWithFfmpeg(videoPath: string, targetPath: string): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const result = await withThumbSlot(() =>
      execFileAsync(
        'ffmpeg',
        ['-ss', '00:02:30', '-i', videoPath, '-vframes', '1', '-q:v', '2', targetPath, '-y'],
        { timeout: 8000 }
      )
    );
    return result !== null;
  } catch {
    return false;
  }
}

async function sendArtworkFile(filePath: string, c: any) {
  if (!filePath || typeof filePath !== 'string') return null;

  // 1. Image distante (TMDb, TVmaze, etc.) : Proxy transparent avec en-têtes CORS universels.
  // Les URLs provenant des NFO/métadonnées ne doivent jamais permettre d'atteindre
  // un service interne (SSRF).
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    try {
      const safeUrl = getSafeOutboundUrl(filePath, { allowPrivate: false, allowHttp: true });
      if (!safeUrl) return null;

      const upstream = await safeFetch(
        safeUrl.toString(),
        { allowPrivate: false, allowHttp: true },
        { signal: AbortSignal.timeout(8000) }
      );
      if (!upstream.ok) return null;

      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      // Pas de SVG distant : un SVG peut contenir du script et serait servi
      // depuis l'origine de l'API.
      if (!/^image\/(jpeg|jpg|png|webp|gif|avif)/i.test(contentType)) return null;

      const announcedLength = parseInt(upstream.headers.get('content-length') || '0', 10);
      if (announcedLength > MAX_REMOTE_ARTWORK_BYTES) return null;

      const arrayBuf = await upstream.arrayBuffer();
      if (arrayBuf.byteLength > MAX_REMOTE_ARTWORK_BYTES) return null;

      return new Response(arrayBuf, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      });
    } catch {
      return null;
    }
  }

  // 2. Image locale physique avec tolérance symlink OS immuables (/var/home <-> /home)
  const candidatePaths = [filePath];
  if (filePath.startsWith('/var/home/')) {
    candidatePaths.push(filePath.replace('/var/home/', '/home/'));
  } else if (filePath.startsWith('/home/')) {
    candidatePaths.push(filePath.replace('/home/', '/var/home/'));
  }

  for (const p of candidatePaths) {
    try {
      const fileStat = await fs.stat(p);
      if (!fileStat.isFile() || fileStat.size > MAX_REMOTE_ARTWORK_BYTES) continue;

      const data = await fs.readFile(p);
      const ext = path.extname(p).toLowerCase();
      const contentType =
        ext === '.png' ? 'image/png'
        : ext === '.webp' ? 'image/webp'
        : ext === '.gif' ? 'image/gif'
        : ext === '.avif' ? 'image/avif'
        : 'image/jpeg';
      return new Response(data, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      });
    } catch {}
  }

  return null;
}

artworkRouter.get('/:id/poster', async (c) => {
  const id = c.req.param('id');
  const media = await db.query.mediaNodes.findFirst({
    where: (t, { or, eq }) => or(eq(t.id, id), eq(t.slug, id)),
    columns: { id: true, title: true, posterPath: true, thumbPath: true, fanartPath: true, parentId: true, nodeType: true, videoFilePath: true },
  });
  if (!media) return c.notFound();

  // 1. Affiche directe
  if (media.posterPath) {
    const isBad = await isTaintedArtwork(media.posterPath);
    if (!isBad) {
      const res = await sendArtworkFile(media.posterPath, c);
      if (res) return res;
    }
  }

  // 2. Fallback vignette ou fanart
  if (media.thumbPath) {
    const res = await sendArtworkFile(media.thumbPath, c);
    if (res) return res;
  }
  if (media.fanartPath) {
    const res = await sendArtworkFile(media.fanartPath, c);
    if (res) return res;
  }

  // 3. Héritage de l'affiche du parent (Série ou Saga)
  if (media.parentId) {
    const parent = await db.query.mediaNodes.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.id, media.parentId!),
      columns: { posterPath: true, thumbPath: true, fanartPath: true },
    });
    if (parent?.posterPath) {
      const isBad = await isTaintedArtwork(parent.posterPath);
      if (!isBad) {
        const res = await sendArtworkFile(parent.posterPath, c);
        if (res) return res;
      }
    }
    if (parent?.thumbPath) {
      const res = await sendArtworkFile(parent.thumbPath, c);
      if (res) return res;
    }
    if (parent?.fanartPath) {
      const res = await sendArtworkFile(parent.fanartPath, c);
      if (res) return res;
    }
  }

  // 4. Si c'est un conteneur (COLLECTION ou SHOW), hériter du premier enfant ayant une affiche
  if (media.nodeType === 'COLLECTION' || media.nodeType === 'SHOW') {
    const firstChild = await db.query.mediaNodes.findFirst({
      where: (t, { and: aOp, eq: eqOp, isNotNull: innOp }) =>
        aOp(eqOp(t.parentId, media.id), innOp(t.posterPath)),
      columns: { posterPath: true, thumbPath: true },
      orderBy: (t, { asc }) => [asc(t.orderIndex), asc(t.releaseYear)],
    });
    if (firstChild?.posterPath) {
      const isBad = await isTaintedArtwork(firstChild.posterPath);
      if (!isBad) {
        const res = await sendArtworkFile(firstChild.posterPath, c);
        if (res) return res;
      }
    }
    if (firstChild?.thumbPath) {
      const res = await sendArtworkFile(firstChild.thumbPath, c);
      if (res) return res;
    }
  }

  // 5. Fallback élégant SVG dynamique : ne renvoie JAMAIS 404 pour un média existant
  return generateFallbackSvgPoster(media.title, media.nodeType);
});

artworkRouter.get('/:id/fanart', async (c) => {
  const id = c.req.param('id');
  const media = await db.query.mediaNodes.findFirst({
    where: (t, { or, eq }) => or(eq(t.id, id), eq(t.slug, id)),
    columns: { id: true, title: true, fanartPath: true, thumbPath: true, posterPath: true, parentId: true, nodeType: true },
  });
  if (!media) return c.notFound();

  if (media.fanartPath) {
    const res = await sendArtworkFile(media.fanartPath, c);
    if (res) return res;
  }

  if (media.thumbPath) {
    const res = await sendArtworkFile(media.thumbPath, c);
    if (res) return res;
  }

  if (media.posterPath) {
    const res = await sendArtworkFile(media.posterPath, c);
    if (res) return res;
  }

  if (media.parentId) {
    const parent = await db.query.mediaNodes.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.id, media.parentId!),
      columns: { fanartPath: true, thumbPath: true, posterPath: true },
    });
    if (parent?.fanartPath) {
      const res = await sendArtworkFile(parent.fanartPath, c);
      if (res) return res;
    }
    if (parent?.thumbPath) {
      const res = await sendArtworkFile(parent.thumbPath, c);
      if (res) return res;
    }
    if (parent?.posterPath) {
      const res = await sendArtworkFile(parent.posterPath, c);
      if (res) return res;
    }
  }

  if (media.nodeType === 'COLLECTION' || media.nodeType === 'SHOW') {
    const firstChild = await db.query.mediaNodes.findFirst({
      where: (t, { and: aOp, eq: eqOp, isNotNull: innOp }) =>
        aOp(eqOp(t.parentId, media.id), innOp(t.fanartPath)),
      columns: { fanartPath: true },
      orderBy: (t, { asc }) => [asc(t.orderIndex), asc(t.releaseYear)],
    });
    if (firstChild?.fanartPath) {
      const res = await sendArtworkFile(firstChild.fanartPath, c);
      if (res) return res;
    }
  }

  return generateFallbackSvgLandscape(media.title, media.nodeType);
});

artworkRouter.get('/:id/thumb', async (c) => {
  const id = c.req.param('id');
  const media = await db.query.mediaNodes.findFirst({
    where: (t, { or, eq }) => or(eq(t.id, id), eq(t.slug, id)),
    columns: { id: true, title: true, thumbPath: true, posterPath: true, fanartPath: true, videoFilePath: true, parentId: true, nodeType: true },
  });
  if (!media) return c.notFound();

  const fileToServe = media.thumbPath || media.posterPath || media.fanartPath;
  if (fileToServe) {
    const isBad = await isTaintedArtwork(fileToServe);
    if (!isBad) {
      const res = await sendArtworkFile(fileToServe, c);
      if (res) return res;
    }
  }

  // Si c'est un épisode avec fichier vidéo, génération ou récupération du thumbnail extrait
  if (media.videoFilePath) {
    const cacheDir = path.join(process.env.HOME || '/home/tele', '.cache', 'ums', 'thumbnails');
    const cachedThumb = path.join(cacheDir, `${media.id}.jpg`);
    try {
      await fs.access(cachedThumb);
      const res = await sendArtworkFile(cachedThumb, c);
      if (res) return res;
    } catch {
      // Dédupliquer les extractions concurrentes pour un même média : sans cela,
      // plusieurs vignettes simultanées lancent autant de processus FFmpeg.
      let extraction = thumbInFlight.get(media.id);
      if (!extraction) {
        extraction = extractThumbnailWithFfmpeg(media.videoFilePath, cachedThumb)
          .finally(() => thumbInFlight.delete(media.id));
        thumbInFlight.set(media.id, extraction);
      }
      const extracted = await extraction;
      if (extracted) {
        const res = await sendArtworkFile(cachedThumb, c);
        if (res) return res;
      }
    }
  }

  if (media.parentId) {
    const parent = await db.query.mediaNodes.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.id, media.parentId!),
      columns: { thumbPath: true, posterPath: true, fanartPath: true },
    });
    const parentFile = parent?.thumbPath || parent?.posterPath || parent?.fanartPath;
    if (parentFile) {
      const isBad = await isTaintedArtwork(parentFile);
      if (!isBad) {
        const res = await sendArtworkFile(parentFile, c);
        if (res) return res;
      }
    }
  }

  return generateFallbackSvgLandscape(media.title, media.nodeType);
});

artworkRouter.get('/:id/clearlogo', async (c) => {
  const id = c.req.param('id');
  const media = await db.query.mediaNodes.findFirst({
    where: (t, { or, eq }) => or(eq(t.id, id), eq(t.slug, id)),
    columns: { clearlogoPath: true, parentId: true },
  });
  if (media?.clearlogoPath) {
    const res = await sendArtworkFile(media.clearlogoPath, c);
    if (res) return res;
  }

  if (media?.parentId) {
    const parent = await db.query.mediaNodes.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.id, media.parentId!),
      columns: { clearlogoPath: true },
    });
    if (parent?.clearlogoPath) {
      const res = await sendArtworkFile(parent.clearlogoPath, c);
      if (res) return res;
    }
  }

  return c.notFound();
});
