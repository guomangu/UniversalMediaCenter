import { Hono } from 'hono';
import { db } from '../db/connection.js';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';

const execFileAsync = promisify(execFile);
export const streamRouter = new Hono();

const MIME_MAP: Record<string, string> = {
  '.mp4': 'video/mp4', '.mkv': 'video/mp4', '.webm': 'video/webm',
  '.avi': 'video/x-msvideo', '.mov': 'video/quicktime', '.ts': 'video/mp2t',
};

const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

streamRouter.get('/:id/stream', async (c) => {
  const id = c.req.param('id');
  const media = await db.query.mediaNodes.findFirst({
    where: (t, { or, eq }) => isUuid(id) ? or(eq(t.id, id), eq(t.slug, id)) : eq(t.slug, id),
  });

  if (!media?.videoFilePath) return c.json({ error: 'Fichier vidéo absent' }, 404);
  if (media.streamUrl) return c.redirect(media.streamUrl);

  const audio = c.req.query('audio');
  let activeFilePath = media.videoFilePath;
  const ext = path.extname(activeFilePath).toLowerCase();

  if (audio && audio !== 'auto') {
    const cacheDir = '/tmp/ums_cache';
    const cacheFile = path.join(cacheDir, `${media.id}_a${audio}${ext}`);
    if (!fs.existsSync(cacheFile)) {
      await fsp.mkdir(cacheDir, { recursive: true });
      await execFileAsync('ffmpeg', [
        '-v', 'error', '-i', activeFilePath, '-map', '0:v:0', '-map', `0:${audio}`, '-c', 'copy', cacheFile,
      ], { timeout: 15000 }).catch(() => null);
    }
    if (fs.existsSync(cacheFile)) activeFilePath = cacheFile;
  }

  const stat = await fsp.stat(activeFilePath);
  const fileSize = stat.size;
  const mime = MIME_MAP[path.extname(activeFilePath).toLowerCase()] || 'video/mp4';
  const range = c.req.header('range');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    return new Response(Readable.toWeb(fs.createReadStream(activeFilePath, { start, end })) as any, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1),
        'Content-Type': mime,
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  return new Response(Readable.toWeb(fs.createReadStream(activeFilePath)) as any, {
    status: 200,
    headers: {
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
    },
  });
});
