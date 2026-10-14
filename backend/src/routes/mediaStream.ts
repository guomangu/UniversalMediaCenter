import { Hono } from 'hono';
import { db } from '../db/connection.js';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

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

  if (!media) return c.notFound();
  if (media.streamUrl) return c.redirect(media.streamUrl);
  if (!media.videoFilePath) return c.json({ error: 'Fichier vidéo absent' }, 404);

  try {
    const filePath = media.videoFilePath;
    const stat = await fsp.stat(filePath);
    const fileSize = stat.size;
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_MAP[ext] || 'video/mp4';
    const range = c.req.header('range');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const webStream = Readable.toWeb(fs.createReadStream(filePath, { start, end }));

      return new Response(webStream as any, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': mime,
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const webStream = Readable.toWeb(fs.createReadStream(filePath));
    return new Response(webStream as any, {
      status: 200,
      headers: {
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Content-Type': mime,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Streaming error:', err);
    return c.json({ error: 'Erreur lors de la lecture du flux vidéo' }, 500);
  }
});
