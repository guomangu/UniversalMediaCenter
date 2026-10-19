import { Hono } from 'hono';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/access.js';

export const forumUploadRouter = new Hono();

const parsedMaxUpload = parseInt(process.env.FORUM_MAX_UPLOAD_BYTES || String(100 * 1024 * 1024), 10);
const MAX_UPLOAD_BYTES = Number.isFinite(parsedMaxUpload) && parsedMaxUpload > 0
  ? parsedMaxUpload
  : 100 * 1024 * 1024;

function mediaTypeForExtension(ext: string): string {
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return 'IMAGE';
  if (['.mp4', '.webm'].includes(ext)) return 'VIDEO';
  if (['.mp3', '.wav', '.ogg'].includes(ext)) return 'AUDIO';
  return 'DOCUMENT';
}

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads/forum');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
};

const ALLOWED_UPLOAD_EXTENSIONS = new Set(Object.keys(MIME_MAP));

// Envoi d'un fichier média (image, vidéo, audio, document)
forumUploadRouter.post('/upload', requireAuth, async (c) => {
  try {
    const announcedLength = parseInt(c.req.header('content-length') || '0', 10);
    if (Number.isFinite(announcedLength) && announcedLength > MAX_UPLOAD_BYTES) {
      return c.json({ error: 'Fichier trop volumineux' }, 413);
    }

    const contentType = c.req.header('content-type') || '';
    let buffer: Buffer;
    let fileName: string = 'media';
    let ext: string = '.jpg';
    let mediaType: string = 'IMAGE';

    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      fileName = body.fileName || 'media';
      const fileData = body.fileData || '';
      ext = path.extname(fileName).toLowerCase() || '.jpg';

      const base64Str = fileData.includes(',') ? fileData.split(',')[1] : fileData;
      // Estimation de la taille décodée sans allouer un buffer démesuré.
      if (base64Str.length > Math.ceil(MAX_UPLOAD_BYTES * 4 / 3) + 8) {
        return c.json({ error: 'Fichier trop volumineux' }, 413);
      }
      buffer = Buffer.from(base64Str, 'base64');
      if (buffer.byteLength > MAX_UPLOAD_BYTES) {
        return c.json({ error: 'Fichier trop volumineux' }, 413);
      }
      mediaType = mediaTypeForExtension(ext);
    } else {
      const body = await c.req.parseBody();
      const file = body['file'];
      if (!file || typeof file === 'string') {
        return c.json({ error: 'Fichier invalide ou manquant' }, 400);
      }
      const rawFile = file as File;
      fileName = rawFile.name || 'media';
      ext = path.extname(fileName).toLowerCase() || '.jpg';
      const arrayBuffer = await rawFile.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      if (buffer.byteLength > MAX_UPLOAD_BYTES) {
        return c.json({ error: 'Fichier trop volumineux' }, 413);
      }
      mediaType = mediaTypeForExtension(ext);
    }

    // Liste blanche stricte : l'extension contrôle le Content-Type servi plus tard.
    // Sans cela, un fichier .html/.svg pouvait être déposé puis servi depuis l'origine de l'API.
    if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
      return c.json({ error: 'Type de fichier non autorisé' }, 415);
    }

    const randomName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    const targetPath = path.join(UPLOADS_DIR, randomName);
    await fsp.writeFile(targetPath, buffer, { flag: 'wx' });

    return c.json({
      success: true,
      url: `/api/forum/attachments/${randomName}`,
      fileName,
      mediaType,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Distribution publique des pièces jointes du forum
forumUploadRouter.get('/attachments/:filename', (c) => {
  const filename = path.basename(c.req.param('filename'));
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return c.text('Pièce jointe introuvable', 404);
  }

  const ext = path.extname(filename).toLowerCase();
  const mime = MIME_MAP[ext] || 'application/octet-stream';

  c.header('Content-Type', mime);
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Cache-Control', 'public, max-age=31536000, immutable');
  c.header('X-Content-Type-Options', 'nosniff');
  const safeHeaderFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  c.header('Content-Disposition', `inline; filename="${safeHeaderFilename}"`);

  const fileStream = fs.createReadStream(filePath);
  return c.body(fileStream as any);
});
