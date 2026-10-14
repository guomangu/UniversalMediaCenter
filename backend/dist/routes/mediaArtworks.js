import { Hono } from 'hono';
import { db } from '../db/connection.js';
import fs from 'node:fs/promises';
import path from 'node:path';
export const artworkRouter = new Hono();
async function sendArtworkFile(filePath, c) {
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        return c.redirect(filePath);
    }
    try {
        const data = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        return new Response(data, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400, immutable',
            },
        });
    }
    catch {
        return c.notFound();
    }
}
artworkRouter.get('/:id/poster', async (c) => {
    const id = c.req.param('id');
    const media = await db.query.mediaNodes.findFirst({
        where: (t, { or, eq }) => or(eq(t.id, id), eq(t.slug, id)),
        columns: { posterPath: true },
    });
    if (!media?.posterPath)
        return c.notFound();
    return sendArtworkFile(media.posterPath, c);
});
artworkRouter.get('/:id/fanart', async (c) => {
    const id = c.req.param('id');
    const media = await db.query.mediaNodes.findFirst({
        where: (t, { or, eq }) => or(eq(t.id, id), eq(t.slug, id)),
        columns: { fanartPath: true },
    });
    if (!media?.fanartPath)
        return c.notFound();
    return sendArtworkFile(media.fanartPath, c);
});
artworkRouter.get('/:id/thumb', async (c) => {
    const id = c.req.param('id');
    const media = await db.query.mediaNodes.findFirst({
        where: (t, { or, eq }) => or(eq(t.id, id), eq(t.slug, id)),
        columns: { thumbPath: true, posterPath: true },
    });
    const fileToServe = media?.thumbPath || media?.posterPath;
    if (!fileToServe)
        return c.notFound();
    return sendArtworkFile(fileToServe, c);
});
artworkRouter.get('/:id/clearlogo', async (c) => {
    const id = c.req.param('id');
    const media = await db.query.mediaNodes.findFirst({
        where: (t, { or, eq }) => or(eq(t.id, id), eq(t.slug, id)),
        columns: { clearlogoPath: true },
    });
    if (!media?.clearlogoPath)
        return c.notFound();
    return sendArtworkFile(media.clearlogoPath, c);
});
