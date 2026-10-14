import { Hono } from 'hono';
import { db } from '../db/connection.js';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import { checkMediaAccess } from '../auth/mediaAccess.js';
import { proxyLiveStream } from '../iptv/liveProxyService.js';
const execFileAsync = promisify(execFile);
export const streamRouter = new Hono();
const MIME_MAP = {
    '.mp4': 'video/mp4', '.mkv': 'video/mp4', '.webm': 'video/webm',
    '.avi': 'video/x-msvideo', '.mov': 'video/quicktime', '.ts': 'video/mp2t',
};
const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
async function findMediaByIdOrSlug(idOrSlug) {
    if (!idOrSlug)
        return null;
    if (isUuid(idOrSlug)) {
        return await db.query.mediaNodes.findFirst({
            where: (t, { eq }) => eq(t.id, idOrSlug),
        });
    }
    return await db.query.mediaNodes.findFirst({
        where: (t, { eq }) => eq(t.slug, idOrSlug),
    });
}
streamRouter.get('/:id/stream', async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const shareToken = c.req.query('share');
    const media = await findMediaByIdOrSlug(id);
    if (!media)
        return c.json({ error: 'Média introuvable' }, 404);
    // 1. Chaînes TV en direct ou flux externes : proxy HLS direct avec gestion d'erreurs diffuseur
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
            error: 'Connexion requise pour visionner cette vidéo ou lien expiré',
            code: 'UNAUTHORIZED',
        }, 401);
    }
    if (media.streamUrl) {
        return await proxyLiveStream(c, media.streamUrl);
    }
    if (!media.videoFilePath)
        return c.json({ error: 'Fichier vidéo absent' }, 404);
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
        if (fs.existsSync(cacheFile))
            activeFilePath = cacheFile;
    }
    const stat = await fsp.stat(activeFilePath);
    const fileSize = stat.size;
    const mimeType = MIME_MAP[ext] || 'video/mp4';
    const range = c.req.header('range');
    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        if (start >= fileSize || end >= fileSize) {
            c.header('Content-Range', `bytes */${fileSize}`);
            return c.text('Range Not Satisfiable', 416);
        }
        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(activeFilePath, { start, end });
        const webStream = Readable.toWeb(fileStream);
        c.status(206);
        c.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        c.header('Accept-Ranges', 'bytes');
        c.header('Content-Length', String(chunksize));
        c.header('Content-Type', mimeType);
        return c.body(webStream);
    }
    const fileStream = fs.createReadStream(activeFilePath);
    const webStream = Readable.toWeb(fileStream);
    c.header('Content-Length', String(fileSize));
    c.header('Content-Type', mimeType);
    c.header('Accept-Ranges', 'bytes');
    return c.body(webStream);
});
