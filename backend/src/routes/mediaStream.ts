import { Hono } from 'hono';
import { db } from '../db/connection.js';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';

export const streamRouter = new Hono();

const MIME_MAP: Record<string, string> = {
  '.mp4': 'video/mp4', '.mkv': 'video/mp4', '.webm': 'video/webm',
  '.avi': 'video/x-msvideo', '.mov': 'video/quicktime', '.ts': 'video/mp2t',
};

const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

function buildFfmpegArgs(file: string, audio?: string, quality?: string, startTime = 0): string[] {
  const args = ['-hide_banner', '-loglevel', 'error'];
  if (startTime > 0) args.push('-ss', String(startTime));
  args.push('-i', file);

  if (quality === '480p') args.push('-vf', 'scale=-2:480', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23');
  else if (quality === '720p') args.push('-vf', 'scale=-2:720', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23');
  else if (quality === '1080p') args.push('-vf', 'scale=-2:1080', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23');
  else args.push('-c:v', 'copy');

  if (audio && audio !== 'auto') args.push('-map', '0:v:0', '-map', `0:${audio}`);
  else args.push('-map', '0:v:0', '-map', '0:a:0?');

  args.push('-c:a', 'aac', '-b:a', '192k', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4', 'pipe:1');
  return args;
}

streamRouter.get('/:id/stream', async (c) => {
  const id = c.req.param('id');
  const media = await db.query.mediaNodes.findFirst({
    where: (t, { or, eq }) => isUuid(id) ? or(eq(t.id, id), eq(t.slug, id)) : eq(t.slug, id),
  });

  if (!media) return c.notFound();
  if (media.streamUrl) return c.redirect(media.streamUrl);
  if (!media.videoFilePath) return c.json({ error: 'Fichier vidéo absent' }, 404);

  const audio = c.req.query('audio');
  const quality = c.req.query('quality');
  const startSec = parseFloat(c.req.query('startTime') || c.req.query('t') || '0');
  const isTranscode = (audio && audio !== 'auto') || (quality && quality !== 'auto') || startSec > 0;

  if (isTranscode) {
    const args = buildFfmpegArgs(media.videoFilePath, audio, quality, startSec);
    const proc = spawn('ffmpeg', args);
    c.req.raw.signal.addEventListener('abort', () => proc.kill('SIGKILL'));
    return new Response(Readable.toWeb(proc.stdout) as any, {
      headers: { 'Content-Type': 'video/mp4', 'Access-Control-Allow-Origin': '*' },
    });
  }

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
    return new Response(Readable.toWeb(fs.createReadStream(filePath, { start, end })) as any, {
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

  return new Response(Readable.toWeb(fs.createReadStream(filePath)) as any, {
    status: 200,
    headers: { 'Content-Length': String(fileSize), 'Accept-Ranges': 'bytes', 'Content-Type': mime, 'Access-Control-Allow-Origin': '*' },
  });
});
