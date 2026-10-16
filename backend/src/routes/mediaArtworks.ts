import { Hono } from 'hono';
import { db } from '../db/connection.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export const artworkRouter = new Hono();

async function sendArtworkFile(filePath: string, c: any) {
  // 1. Image distante (TMDb, TVmaze, etc.) : Proxy transparent avec en-têtes CORS universels
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    try {
      const upstream = await fetch(filePath);
      if (!upstream.ok) return null;
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
    } catch {
      return null;
    }
  }

  // 2. Image locale physique avec tolérance symlink OS immuables (/var/home <-> /home)
  const candidatePaths = [filePath];
  if (filePath.startsWith('/var/home/')) {
    candidatePaths.push(filePath.replace('/var/home/', '/home/'));
  } else if (filePath.startsWith('/home/')) {
    candidatePaths.push(filePath.replace('/home/', '/var/home/'));
  }

  for (const p of candidatePaths) {
    try {
      const data = await fs.readFile(p);
      const ext = path.extname(p).toLowerCase();
      const contentType =
        ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return new Response(data, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      });
    } catch {}
  }

  return null;
}

artworkRouter.get('/:id/poster', async (c) => {
  const id = c.req.param('id');
  const media = await db.query.mediaNodes.findFirst({
    where: (t, { or, eq }) => or(eq(t.id, id), eq(t.slug, id)),
    columns: { id: true, posterPath: true, parentId: true, nodeType: true },
  });
  if (!media) return c.notFound();

  if (media.posterPath) {
    const res = await sendArtworkFile(media.posterPath, c);
    if (res) return res;
  }

  // Héritage de l'affiche du parent (Série ou Saga) pour les épisodes ou films en saga
  if (media.parentId) {
    const parent = await db.query.mediaNodes.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.id, media.parentId!),
      columns: { posterPath: true },
    });
    if (parent?.posterPath) {
      const res = await sendArtworkFile(parent.posterPath, c);
      if (res) return res;
    }
  }

  // Si c'est une collection sans affiche propre, hériter du premier enfant ayant une affiche
  if (media.nodeType === 'COLLECTION') {
    const firstChild = await db.query.mediaNodes.findFirst({
      where: (t, { and: aOp, eq: eqOp, isNotNull: innOp }) =>
        aOp(eqOp(t.parentId, media.id), innOp(t.posterPath)),
      columns: { posterPath: true },
      orderBy: (t, { asc }) => [asc(t.orderIndex), asc(t.releaseYear)],
    });
    if (firstChild?.posterPath) {
      const res = await sendArtworkFile(firstChild.posterPath, c);
      if (res) return res;
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
  if (!media) return c.notFound();

  if (media.fanartPath) {
    const res = await sendArtworkFile(media.fanartPath, c);
    if (res) return res;
  }

  if (media.parentId) {
    const parent = await db.query.mediaNodes.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.id, media.parentId!),
      columns: { fanartPath: true },
    });
    if (parent?.fanartPath) {
      const res = await sendArtworkFile(parent.fanartPath, c);
      if (res) return res;
    }
  }

  if (media.nodeType === 'COLLECTION') {
    const firstChild = await db.query.mediaNodes.findFirst({
      where: (t, { and: aOp, eq: eqOp, isNotNull: innOp }) =>
        aOp(eqOp(t.parentId, media.id), innOp(t.fanartPath)),
      columns: { fanartPath: true },
      orderBy: (t, { asc }) => [asc(t.orderIndex), asc(t.releaseYear)],
    });
    if (firstChild?.fanartPath) {
      const res = await sendArtworkFile(firstChild.fanartPath, c);
      if (res) return res;
    }
  }

  return c.notFound();
});

artworkRouter.get('/:id/thumb', async (c) => {
  const id = c.req.param('id');
  const media = await db.query.mediaNodes.findFirst({
    where: (t, { or, eq }) => or(eq(t.id, id), eq(t.slug, id)),
    columns: { thumbPath: true, posterPath: true, parentId: true, nodeType: true },
  });
  const fileToServe = media?.thumbPath || media?.posterPath;
  if (fileToServe) {
    const res = await sendArtworkFile(fileToServe, c);
    if (res) return res;
  }

  if (media?.parentId) {
    const parent = await db.query.mediaNodes.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.id, media.parentId!),
      columns: { thumbPath: true, posterPath: true },
    });
    const parentFile = parent?.thumbPath || parent?.posterPath;
    if (parentFile) {
      const res = await sendArtworkFile(parentFile, c);
      if (res) return res;
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
    if (res) return res;
  }

  if (media?.parentId) {
    const parent = await db.query.mediaNodes.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.id, media.parentId!),
      columns: { clearlogoPath: true },
    });
    if (parent?.clearlogoPath) {
      const res = await sendArtworkFile(parent.clearlogoPath, c);
      if (res) return res;
    }
  }

  return c.notFound();
});
