import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const forumUploadRouter = new Hono();

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

// Envoi d'un fichier média (image, vidéo, audio, document)
forumUploadRouter.post('/upload', async (c) => {
  try {
    const contentType = c.req.header('content-type') || '';
    let buffer: Buffer;
    let fileName: string = 'media';
    let ext: string = '.jpg';
    let mediaType: string = 'IMAGE';

    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      fileName = body.fileName || 'media';
      const fileData = body.fileData || '';
      ext = path.extname(fileName) || '.jpg';
      mediaType = body.mediaType || 'IMAGE';

      const base64Str = fileData.includes(',') ? fileData.split(',')[1] : fileData;
      buffer = Buffer.from(base64Str, 'base64');
    } else {
      const body = await c.req.parseBody();
      const file = body['file'];
      if (!file || typeof file === 'string') {
        return c.json({ error: 'Fichier invalide ou manquant' }, 400);
      }
      const rawFile = file as File;
      fileName = rawFile.name || 'media';
      ext = path.extname(fileName) || '.jpg';
      const arrayBuffer = await rawFile.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);

      if (rawFile.type.startsWith('image/')) mediaType = 'IMAGE';
      else if (rawFile.type.startsWith('video/')) mediaType = 'VIDEO';
      else if (rawFile.type.startsWith('audio/')) mediaType = 'AUDIO';
      else mediaType = 'DOCUMENT';
    }

    const randomName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    const targetPath = path.join(UPLOADS_DIR, randomName);
    fs.writeFileSync(targetPath, buffer);

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

  const fileStream = fs.createReadStream(filePath);
  return c.body(fileStream as any);
});
