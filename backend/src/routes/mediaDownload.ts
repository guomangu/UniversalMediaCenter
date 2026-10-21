import { Hono } from 'hono';
import { db } from '../db/connection.js';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { checkMediaAccess } from '../auth/mediaAccess.js';
import { requireAuth } from '../middleware/access.js';
import type { UserSession } from '../middleware/access.js';

export const downloadRouter = new Hono();

const isUuid = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

const MIME_MAP: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.ts': 'video/mp2t',
  '.m2ts': 'video/mp2t',
};

/** Construit un nom de fichier lisible et sûr pour Content-Disposition. */
function buildDownloadFilename(title: string, releaseYear: number | null | undefined, ext: string): string {
  const base = `${title}${releaseYear ? ` (${releaseYear})` : ''}`
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'media';
  return `${base}${ext || '.mp4'}`;
}

function contentDisposition(filename: string): string {
  const asciiFallback = filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/"/g, "'");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Téléchargement hors-ligne d'un média.
 *
 * Le droit `canDownload` était déjà exposé dans les profils utilisateurs mais
 * n'était appliqué par aucun point d'entrée : ce endpoint est le point de
 * contrôle manquant. Il sert toujours le fichier original (sans transcodage)
 * afin que la copie locale conserve la qualité maximale, et respecte les
 * mêmes règles PBAC/ABAC que la lecture.
 */
downloadRouter.on(['GET', 'HEAD'], '/:id/download', requireAuth, async (c) => {
  const user = (c as any).get('user') as UserSession;
  const idOrSlug = c.req.param('id');
  const shareToken = c.req.query('share') || c.req.query('share_token');

  if (!idOrSlug) {
    return c.json({ error: 'Identifiant de média manquant', code: 'BAD_REQUEST' }, 400);
  }

  if (!user) {
    return c.json({ error: 'Connexion requise pour télécharger ce média', code: 'UNAUTHORIZED' }, 401);
  }

  if (!user.isAdmin && user.canDownload === false) {
    return c.json(
      { error: "Le téléchargement hors-ligne n'est pas autorisé pour votre profil", code: 'DOWNLOAD_FORBIDDEN' },
      403
    );
  }

  const media = isUuid(idOrSlug)
    ? await db.query.mediaNodes.findFirst({ where: (t, { eq }) => eq(t.id, idOrSlug) })
    : await db.query.mediaNodes.findFirst({ where: (t, { eq }) => eq(t.slug, idOrSlug) });

  if (!media) {
    return c.json({ error: 'Média introuvable', code: 'NOT_FOUND' }, 404);
  }

  const isAuthorized =
    checkMediaAccess(user, media.id, shareToken, media.parentId, media.nodeType, {
      videoFilePath: media.videoFilePath,
      nfoFilePath: media.nfoFilePath,
      searchVectorText: media.searchVectorText,
    }) ||
    // Un utilisateur connecté qui ouvre un lien de partage valide conserve
    // l'accès même si son profil n'a pas le média en accès direct.
    Boolean(shareToken) &&
      checkMediaAccess(null, media.id, shareToken, media.parentId, media.nodeType, {
        videoFilePath: media.videoFilePath,
        nfoFilePath: media.nfoFilePath,
        searchVectorText: media.searchVectorText,
      });

  if (!isAuthorized) {
    return c.json({ error: 'Accès refusé pour votre profil', code: 'FORBIDDEN' }, 403);
  }

  if (media.streamUrl || media.nodeType === 'LIVE_CHANNEL') {
    return c.json(
      {
        error: "Les flux en direct ne peuvent pas être téléchargés. Lancez la lecture en direct à la place.",
        code: 'LIVE_NOT_DOWNLOADABLE',
      },
      409
    );
  }

  if (!media.videoFilePath || !fs.existsSync(media.videoFilePath)) {
    return c.json(
      {
        error: "Aucun fichier vidéo téléchargeable n'est associé à ce média (série, saison ou collection).",
        code: 'NO_DOWNLOADABLE_FILE',
      },
      404
    );
  }

  const ext = path.extname(media.videoFilePath).toLowerCase();
  const filename = buildDownloadFilename(media.title, media.releaseYear, ext);
  const mimeType = MIME_MAP[ext] || 'application/octet-stream';
  const stat = await fsp.stat(media.videoFilePath);
  const fileSize = stat.size;
  const range = c.req.header('range');
  const isHead = c.req.method === 'HEAD';

  c.header('Content-Type', mimeType);
  c.header('Content-Disposition', contentDisposition(filename));
  c.header('Accept-Ranges', 'bytes');
  c.header('Cache-Control', 'private, no-store');
  c.header('X-Content-Type-Options', 'nosniff');

  if (!range) {
    c.header('Content-Length', String(fileSize));
    if (isHead) return c.body(null, 200);
    return c.body(Readable.toWeb(fs.createReadStream(media.videoFilePath)) as any, 200);
  }

  // Reprise de téléchargement (gestionnaires de téléchargement mobiles).
  const match = range.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) {
    c.header('Content-Range', `bytes */${fileSize}`);
    return c.body(null, 416);
  }

  let start = match[1] ? parseInt(match[1], 10) : 0;
  let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
    c.header('Content-Range', `bytes */${fileSize}`);
    return c.body(null, 416);
  }
  start = Math.max(0, start);
  end = Math.min(end, fileSize - 1);

  c.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
  c.header('Content-Length', String(end - start + 1));
  if (isHead) return c.body(null, 206);

  return c.body(Readable.toWeb(fs.createReadStream(media.videoFilePath, { start, end })) as any, 206);
});
