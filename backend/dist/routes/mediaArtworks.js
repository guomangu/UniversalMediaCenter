import { Hono } from 'hono';
import { db } from '../db/connection.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isTaintedArtwork } from '../watcher/kaiPaceResolver.js';
const execFileAsync = promisify(execFile);
export const artworkRouter = new Hono();
async function extractThumbnailWithFfmpeg(videoPath, targetPath) {
    try {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await execFileAsync('ffmpeg', ['-ss', '00:02:30', '-i', videoPath, '-vframes', '1', '-q:v', '2', targetPath, '-y'], { timeout: 8000 });
        return true;
    }
    catch {
        return false;
    }
}
async function sendArtworkFile(filePath, c) {
    // 1. Image distante (TMDb, TVmaze, etc.) : Proxy transparent avec en-têtes CORS universels
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        try {
            const upstream = await fetch(filePath);
            if (!upstream.ok)
                return null;
            const contentType = upstream.headers.get('content-type') || 'image/jpeg';
            const arrayBuf = await upstream.arrayBuffer();
            return new Response(arrayBuf, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=31536000, immutable',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                },
            });
        }
        catch {
            return null;
        }
    }
    // 2. Image locale physique avec tolérance symlink OS immuables (/var/home <-> /home)
    const candidatePaths = [filePath];
    if (filePath.startsWith('/var/home/')) {
        candidatePaths.push(filePath.replace('/var/home/', '/home/'));
    }
    else if (filePath.startsWith('/home/')) {
        candidatePaths.push(filePath.replace('/home/', '/var/home/'));
    }
    for (const p of candidatePaths) {
        try {
            const data = await fs.readFile(p);
            const ext = path.extname(p).toLowerCase();
            const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
            return new Response(data, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=31536000, immutable',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                },
            });
        }
        catch { }
    }
    return null;
}
artworkRouter.get('/:id/poster', async (c) => {
    const id = c.req.param('id');
    const media = await db.query.mediaNodes.findFirst({
        where: (t, { or, eq }) => or(eq(t.id, id), eq(t.slug, id)),
        columns: { id: true, posterPath: true, parentId: true, nodeType: true },
    });
    if (!media)
        return c.notFound();
    if (media.posterPath) {
        const isBad = await isTaintedArtwork(media.posterPath);
        if (!isBad) {
            const res = await sendArtworkFile(media.posterPath, c);
            if (res)
                return res;
        }
    }
    // Héritage de l'affiche du parent (Série ou Saga) pour les épisodes ou films en saga
    if (media.parentId) {
        const parent = await db.query.mediaNodes.findFirst({
            where: (t, { eq: eqOp }) => eqOp(t.id, media.parentId),
            columns: { posterPath: true },
        });
        if (parent?.posterPath) {
            const isBad = await isTaintedArtwork(parent.posterPath);
            if (!isBad) {
                const res = await sendArtworkFile(parent.posterPath, c);
                if (res)
                    return res;
            }
        }
    }
    // Si c'est une collection sans affiche propre, hériter du premier enfant ayant une affiche
    if (media.nodeType === 'COLLECTION') {
        const firstChild = await db.query.mediaNodes.findFirst({
            where: (t, { and: aOp, eq: eqOp, isNotNull: innOp }) => aOp(eqOp(t.parentId, media.id), innOp(t.posterPath)),
            columns: { posterPath: true },
            orderBy: (t, { asc }) => [asc(t.orderIndex), asc(t.releaseYear)],
        });
        if (firstChild?.posterPath) {
            const isBad = await isTaintedArtwork(firstChild.posterPath);
            if (!isBad) {
                const res = await sendArtworkFile(firstChild.posterPath, c);
                if (res)
                    return res;
            }
        }
    }
    return c.notFound();
});
artworkRouter.get('/:id/fanart', async (c) => {
    const id = c.req.param('id');
    const media = await db.query.mediaNodes.findFirst({
        where: (t, { or, eq }) => or(eq(t.id, id), eq(t.slug, id)),
        columns: { id: true, fanartPath: true, parentId: true, nodeType: true },
    });
    if (!media)
        return c.notFound();
    if (media.fanartPath) {
        const res = await sendArtworkFile(media.fanartPath, c);
        if (res)
            return res;
    }
    if (media.parentId) {
        const parent = await db.query.mediaNodes.findFirst({
            where: (t, { eq: eqOp }) => eqOp(t.id, media.parentId),
            columns: { fanartPath: true },
        });
        if (parent?.fanartPath) {
            const res = await sendArtworkFile(parent.fanartPath, c);
            if (res)
                return res;
        }
    }
    if (media.nodeType === 'COLLECTION') {
        const firstChild = await db.query.mediaNodes.findFirst({
            where: (t, { and: aOp, eq: eqOp, isNotNull: innOp }) => aOp(eqOp(t.parentId, media.id), innOp(t.fanartPath)),
            columns: { fanartPath: true },
            orderBy: (t, { asc }) => [asc(t.orderIndex), asc(t.releaseYear)],
        });
        if (firstChild?.fanartPath) {
            const res = await sendArtworkFile(firstChild.fanartPath, c);
            if (res)
                return res;
        }
    }
    return c.notFound();
});
artworkRouter.get('/:id/thumb', async (c) => {
    const id = c.req.param('id');
    const media = await db.query.mediaNodes.findFirst({
        where: (t, { or, eq }) => or(eq(t.id, id), eq(t.slug, id)),
        columns: { id: true, thumbPath: true, posterPath: true, videoFilePath: true, parentId: true, nodeType: true },
    });
    if (!media)
        return c.notFound();
    const fileToServe = media.thumbPath || media.posterPath;
    if (fileToServe) {
        const isBad = await isTaintedArtwork(fileToServe);
        if (!isBad) {
            const res = await sendArtworkFile(fileToServe, c);
            if (res)
                return res;
        }
    }
    // Si c'est un épisode avec fichier vidéo, génération ou récupération du thumbnail extrait
    if (media.videoFilePath) {
        const cacheDir = path.join(process.env.HOME || '/home/tele', '.cache', 'ums', 'thumbnails');
        const cachedThumb = path.join(cacheDir, `${media.id}.jpg`);
        try {
            await fs.access(cachedThumb);
            const res = await sendArtworkFile(cachedThumb, c);
            if (res)
                return res;
        }
        catch {
            const extracted = await extractThumbnailWithFfmpeg(media.videoFilePath, cachedThumb);
            if (extracted) {
                const res = await sendArtworkFile(cachedThumb, c);
                if (res)
                    return res;
            }
        }
    }
    if (media.parentId) {
        const parent = await db.query.mediaNodes.findFirst({
            where: (t, { eq: eqOp }) => eqOp(t.id, media.parentId),
            columns: { thumbPath: true, posterPath: true },
        });
        const parentFile = parent?.thumbPath || parent?.posterPath;
        if (parentFile) {
            const isBad = await isTaintedArtwork(parentFile);
            if (!isBad) {
                const res = await sendArtworkFile(parentFile, c);
                if (res)
                    return res;
            }
        }
    }
    return c.notFound();
});
artworkRouter.get('/:id/clearlogo', async (c) => {
    const id = c.req.param('id');
    const media = await db.query.mediaNodes.findFirst({
        where: (t, { or, eq }) => or(eq(t.id, id), eq(t.slug, id)),
        columns: { clearlogoPath: true, parentId: true },
    });
    if (media?.clearlogoPath) {
        const res = await sendArtworkFile(media.clearlogoPath, c);
        if (res)
            return res;
    }
    if (media?.parentId) {
        const parent = await db.query.mediaNodes.findFirst({
            where: (t, { eq: eqOp }) => eqOp(t.id, media.parentId),
            columns: { clearlogoPath: true },
        });
        if (parent?.clearlogoPath) {
            const res = await sendArtworkFile(parent.clearlogoPath, c);
            if (res)
                return res;
        }
    }
    return c.notFound();
});
