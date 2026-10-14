import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fsp from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);
export const tracksRouter = new Hono();

const LANG_NAMES: Record<string, string> = {
  fre: 'Français', fra: 'Français', fr: 'Français', eng: 'English', en: 'English',
  jpn: 'Japonais', ja: 'Japonais', rus: 'Russe', ru: 'Russe', spa: 'Espagnol', es: 'Espagnol', und: 'Piste',
};

const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

tracksRouter.get('/:id/tracks', async (c) => {
  const id = c.req.param('id');
  const media = await db.query.mediaNodes.findFirst({
    where: (t, { or, eq }) => isUuid(id) ? or(eq(t.id, id), eq(t.slug, id)) : eq(t.slug, id),
  });

  if (!media?.videoFilePath) return c.json({ audioTracks: [], subtitleTracks: [], qualities: [] });

  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-show_entries',
      'stream=index,codec_type,codec_name,width,height:stream_tags=language,title:format=duration',
      '-show_chapters', '-of', 'json', media.videoFilePath,
    ], { timeout: 4000 });

    const info = JSON.parse(stdout);
    const streams = info.streams || [];
    const chapters = info.chapters || [];
    const videoStream = streams.find((s: any) => s.codec_type === 'video');

    const audioTracks = streams.filter((s: any) => s.codec_type === 'audio').map((s: any) => {
      const lang = (s.tags?.language || 'und').toLowerCase();
      const langLabel = LANG_NAMES[lang] || lang.toUpperCase();
      const title = s.tags?.title ? ` - ${s.tags.title}` : '';
      return { index: s.index, language: lang, codec: s.codec_name, label: `${langLabel}${title} (${s.codec_name.toUpperCase()})` };
    });

    const subtitleTracks = streams
      .filter((s: any) => s.codec_type === 'subtitle' && !['hdmv_pgs_subtitle', 'dvd_subtitle'].includes(s.codec_name))
      .map((s: any) => {
        const lang = (s.tags?.language || 'und').toLowerCase();
        return { index: s.index, language: lang, label: `${LANG_NAMES[lang] || lang.toUpperCase()} (Intégré)` };
      });

    const dir = path.dirname(media.videoFilePath);
    const baseName = path.basename(media.videoFilePath, path.extname(media.videoFilePath)).toLowerCase();
    const numMatch = baseName.match(/^\d+/)?.[0];
    const subDirs = [dir, path.join(dir, 'Subtitles'), path.join(path.dirname(dir), 'Subtitles')];

    for (const d of subDirs) {
      const files = await fsp.readdir(d).catch(() => []);
      for (const f of files) {
        const lower = f.toLowerCase();
        if ((lower.endsWith('.srt') || lower.endsWith('.vtt')) && (!numMatch || lower.includes(numMatch))) {
          const lKey = lower.includes('fre') || lower.includes('fr') ? 'fre' : lower.includes('eng') || lower.includes('en') ? 'eng' : 'und';
          subtitleTracks.push({ index: -1, language: lKey, fileName: f, label: `${LANG_NAMES[lKey] || 'Sous-titre'} (${f.slice(0, 32)}...)` });
        }
      }
    }

    const height = videoStream?.height || 1080;
    const qualities = [
      { label: `Auto (Original ${height}p)`, value: 'auto' },
      ...(height >= 1080 ? [{ label: '1080p FHD', value: '1080p' }] : []),
      ...(height >= 720 ? [{ label: '720p HD', value: '720p' }] : []),
      { label: '480p SD', value: '480p' },
    ];

    let intro = { start: 0, end: 90 };
    if (chapters.length > 0) {
      const end = parseFloat(chapters[0].end_time || '90');
      if (end >= 15 && end <= 180) intro = { start: parseFloat(chapters[0].start_time || '0'), end };
    }
    const duration = parseFloat(info.format?.duration || '0');

    return c.json({ audioTracks, subtitleTracks, qualities, intro, duration });
  } catch (err) {
    return c.json({ audioTracks: [], subtitleTracks: [], qualities: [{ label: 'Auto', value: 'auto' }], intro: { start: 0, end: 90 }, duration: 0 });
  }
});
