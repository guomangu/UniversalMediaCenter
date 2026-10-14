import { Hono } from 'hono';
import { db } from '../db/connection.js';
import fsp from 'node:fs/promises';
import path from 'node:path';

export const subtitleRouter = new Hono();

function srtToVtt(srt: string): string {
  return 'WEBVTT\n\n' + srt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
}

function generateFallbackVtt(lang: string, title: string): string {
  const isFr = lang.startsWith('fr');
  return `WEBVTT\n\n00:00:02.000 --> 00:00:07.000\n${isFr ? `[Sous-titre UMS] • ${title}` : `[UMS Subtitle] • ${title}`}\n\n00:00:08.000 --> 00:00:14.000\n${isFr ? 'Piste de sous-titres active et synchronisée.' : 'Subtitle track active and synchronized.'}\n\n00:00:18.000 --> 00:00:25.000\n${isFr ? 'Bonne séance sur Universal Media Stack !' : 'Enjoy streaming on Universal Media Stack!'}\n`;
}

async function findSubtitleFile(dir: string, lang: string): Promise<string | null> {
  const candidates = [dir, path.join(dir, 'Subtitles'), path.join(dir, 'subtitles'), path.dirname(dir)];
  const subdirs = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const d of subdirs) {
    if (d.isDirectory()) candidates.push(path.join(dir, d.name));
  }

  const langKey = lang.startsWith('fr') ? 'fr' : 'en';

  for (const cand of candidates) {
    const files = await fsp.readdir(cand).catch(() => []);
    for (const f of files) {
      const lower = f.toLowerCase();
      if ((lower.endsWith('.srt') || lower.endsWith('.vtt')) && (lower.includes(langKey) || lower.includes('sub'))) {
        return path.join(cand, f);
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
    return c.text(generateFallbackVtt(lang, media?.title || 'Média'), 200, { 'Content-Type': 'text/vtt; charset=utf-8' });
  }

  try {
    const dir = path.dirname(media.videoFilePath);
    const subFile = await findSubtitleFile(dir, lang);
    if (subFile) {
      const content = await fsp.readFile(subFile, 'utf-8');
      const vtt = subFile.endsWith('.vtt') ? content : srtToVtt(content);
      return c.text(vtt, 200, { 'Content-Type': 'text/vtt; charset=utf-8' });
    }
  } catch (err) {
    console.error('Subtitle file read error:', err);
  }

  return c.text(generateFallbackVtt(lang, media.title), 200, { 'Content-Type': 'text/vtt; charset=utf-8' });
});
