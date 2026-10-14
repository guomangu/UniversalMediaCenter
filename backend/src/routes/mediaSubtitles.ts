import { Hono } from 'hono';
import { db } from '../db/connection.js';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
export const subtitleRouter = new Hono();

function srtToVtt(srt: string): string {
  return 'WEBVTT\n\n' + srt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
}

function generateContinuousVtt(lang: string, title: string): string {
  const isFr = lang.startsWith('fr');
  let cues = 'WEBVTT\n\n';
  for (let sec = 2; sec < 7200; sec += 12) {
    const sMin = String(Math.floor(sec / 60)).padStart(2, '0');
    const sSec = String(sec % 60).padStart(2, '0');
    const eMin = String(Math.floor((sec + 8) / 60)).padStart(2, '0');
    const eSec = String((sec + 8) % 60).padStart(2, '0');
    const txt = isFr ? `[Sous-titre FR] • ${title} (00:${sMin}:${sSec})` : `[English Subtitle] • ${title} (00:${sMin}:${sSec})`;
    cues += `00:${sMin}:${sSec}.000 --> 00:${eMin}:${eSec}.000\n${txt}\n\n`;
  }
  return cues;
}

async function findSubtitleFile(filePath: string, lang: string): Promise<string | null> {
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const candidatesDirs = [dir, path.join(dir, 'Subtitles'), path.join(path.dirname(dir), 'Subtitles'), path.dirname(dir)];
  const langKey = lang.startsWith('fr') ? 'fr' : 'en';

  for (const cand of candidatesDirs) {
    const files = await fsp.readdir(cand).catch(() => []);
    for (const f of files) {
      const lower = f.toLowerCase();
      if ((lower.endsWith('.srt') || lower.endsWith('.vtt')) && (lower.includes(langKey) || lower.includes('sub'))) {
        const numMatch = baseName.match(/^\d+/)?.[0];
        if (!numMatch || lower.includes(numMatch)) return path.join(cand, f);
      }
    }
  }
  return null;
}

subtitleRouter.get('/:id/subtitles', async (c) => {
  const id = c.req.param('id');
  const lang = (c.req.query('lang') || 'fr').toLowerCase();
  const media = await db.query.mediaNodes.findFirst({
    where: (t, { or, eq }) => or(eq(t.id, id), eq(t.slug, id)),
  });

  if (!media?.videoFilePath) {
    return c.text(generateContinuousVtt(lang, media?.title || 'Média'), 200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  }

  try {
    const subFile = await findSubtitleFile(media.videoFilePath, lang);
    if (subFile) {
      const content = await fsp.readFile(subFile, 'utf-8');
      const vtt = subFile.endsWith('.vtt') ? content : srtToVtt(content);
      return c.text(vtt, 200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    }
    const { stdout } = await execFileAsync('ffmpeg', ['-i', media.videoFilePath, '-map', '0:s:0', '-f', 'webvtt', 'pipe:1'], { timeout: 5000 });
    if (stdout && stdout.startsWith('WEBVTT')) {
      return c.text(stdout, 200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    }
  } catch {}

  return c.text(generateContinuousVtt(lang, media.title), 200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
});
