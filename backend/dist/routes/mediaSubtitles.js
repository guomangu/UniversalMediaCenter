import { Hono } from 'hono';
import { db } from '../db/connection.js';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
export const subtitleRouter = new Hono();
function srtToVtt(srt) {
    return 'WEBVTT\n\n' + srt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
}
const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
subtitleRouter.get('/:id/subtitles', async (c) => {
    const id = c.req.param('id');
    const trackIndex = c.req.query('trackIndex');
    const fileName = c.req.query('fileName');
    const lang = (c.req.query('lang') || '').toLowerCase();
    const media = await db.query.mediaNodes.findFirst({
        where: (t, { or, eq }) => isUuid(id) ? or(eq(t.id, id), eq(t.slug, id)) : eq(t.slug, id),
    });
    if (!media?.videoFilePath) {
        return c.text('WEBVTT\n\n', 404, { 'Content-Type': 'text/vtt; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    }
    try {
        const dir = path.dirname(media.videoFilePath);
        if (fileName) {
            const candidates = [path.join(dir, fileName), path.join(dir, 'Subtitles', fileName), path.join(path.dirname(dir), 'Subtitles', fileName)];
            for (const cand of candidates) {
                const content = await fsp.readFile(cand, 'utf-8').catch(() => null);
                if (content) {
                    const vtt = cand.endsWith('.vtt') ? content : srtToVtt(content);
                    return c.text(vtt, 200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                }
            }
        }
        if (trackIndex !== undefined && trackIndex !== '') {
            const { stdout } = await execFileAsync('ffmpeg', ['-i', media.videoFilePath, '-map', `0:${trackIndex}`, '-f', 'webvtt', 'pipe:1'], { timeout: 6000 });
            if (stdout && stdout.startsWith('WEBVTT')) {
                return c.text(stdout, 200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            }
        }
        if (lang) {
            const { stdout } = await execFileAsync('ffmpeg', ['-i', media.videoFilePath, '-map', `0:m:language:${lang}?`, '-f', 'webvtt', 'pipe:1'], { timeout: 6000 }).catch(() => ({ stdout: '' }));
            if (stdout && stdout.startsWith('WEBVTT')) {
                return c.text(stdout, 200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            }
        }
    }
    catch (err) {
        console.error('Subtitle extraction error:', err);
    }
    return c.text('WEBVTT\n\n', 404, { 'Content-Type': 'text/vtt; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
});
