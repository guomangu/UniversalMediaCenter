import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { eq, or, like } from 'drizzle-orm';
import { parseNfoXml } from './nfoParser.js';
import { ingestMediaNode, ingestStandaloneVideoFile } from './mediaIngester.js';
import { detectAdjacentFiles } from './mediaFileDetector.js';
import {
  isVideoExtension,
  isIgnoredDirectoryName,
  isIgnoredMediaFileName,
} from './mediaExtensions.js';

async function calculateFileSha256(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

export async function processNfoFile(filePath: string): Promise<string | null> {
  let parsed = null;
  let readError: unknown = null;

  try {
    const raw = await fs.readFile(filePath);
    let content: string;
    // Certains outils Windows exportent les NFO en UTF-16 LE/BE.
    if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) {
      content = raw.subarray(2).toString('utf16le');
    } else if (raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff) {
      const swapped = Buffer.from(raw.subarray(2));
      swapped.swap16();
      content = swapped.toString('utf16le');
    } else {
      content = raw.toString('utf8');
    }
    parsed = parseNfoXml(content, filePath);
  } catch (err) {
    readError = err;
  }

  if (!parsed) {
    // Cas très fréquent des « NFO » de release qui sont en réalité des fichiers
    // texte/ANSI (infos de groupe) et non du XML Kodi. Auparavant, la vidéo
    // associée n'était jamais indexée : on bascule sur le pipeline autonome.
    const adjacent = await detectAdjacentFiles(filePath).catch(() => ({} as any));
    if (adjacent?.videoFilePath) {
      try {
        const id = await ingestStandaloneVideoFile(adjacent.videoFilePath);
        console.warn(
          `⚠️ [Ingester] NFO non-XML (${readError ? 'illisible' : 'invalide'}) : « ${path.basename(filePath)} » ignoré, indexation de la vidéo via le pipeline autonome.`
        );
        return id;
      } catch (err) {
        console.error(`❌ Fallback d'ingestion vidéo impossible pour ${adjacent.videoFilePath}:`, err);
      }
    } else {
      console.warn(`⚠️ [Ingester] NFO non-XML sans vidéo adjacente, ignoré : ${filePath}`);
    }
    return null;
  }

  try {
    const sha256 = await calculateFileSha256(filePath);
    const id = await ingestMediaNode(filePath, parsed, sha256);
    if (id) {
      console.log(`🎬 Ingested NFO [${parsed.type}] in-place: ${parsed.title}`);
    }
    return id || null;
  } catch (err) {
    console.error(`❌ Failed to process NFO file ${filePath}:`, err);
    // Dernier filet de sécurité : un NFO valide mais dont l'ingestion échoue
    // (données incohérentes, contrainte SQL...) ne doit pas faire disparaître
    // la vidéo de la bibliothèque.
    const adjacent = await detectAdjacentFiles(filePath).catch(() => ({} as any));
    if (adjacent?.videoFilePath) {
      try {
        return await ingestStandaloneVideoFile(adjacent.videoFilePath);
      } catch (fallbackErr) {
        console.error(`❌ Fallback vidéo impossible pour ${adjacent.videoFilePath}:`, fallbackErr);
      }
    }
    return null;
  }
}

export async function processAnyMediaFile(filePath: string): Promise<void> {
  const normalizedPath = filePath.replace(/\\/g, '/');
  // Les structures DVD/Blu-ray sont traitées comme un seul film par le
  // scanner ; les fragments internes ne doivent jamais devenir des médias.
  if (/\/(?:bdmv|video_ts)\//i.test(normalizedPath)) return;

  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.nfo') {
    await processNfoFile(filePath);
    return;
  }

  if (isVideoExtension(ext)) {
    // Si un NFO existe, il est traité de son côté. S'il est invalide/non-XML,
    // processNfoFile bascule automatiquement sur l'ingestion autonome.
    const dir = path.dirname(filePath);
    const base = path.basename(filePath, ext);
    const candidateNfo = path.join(dir, `${base}.nfo`);
    try {
      await fs.access(candidateNfo);
      return;
    } catch {
      // Pas de NFO -> ingestion autonome par pipeline multimodal Kyoo++
    }

    try {
      await ingestStandaloneVideoFile(filePath);
      console.log(`🎬 Ingested standalone video in-place (Kyoo++): ${path.basename(filePath)}`);
    } catch (err) {
      console.error(`❌ Failed to process standalone video ${filePath}:`, err);
    }
  }
}

/**
 * Gestionnaire réactif de suppression de fichier en temps réel
 */
export async function handleFileUnlink(filePath: string): Promise<void> {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (!isVideoExtension(ext) && ext !== '.nfo') return;

    console.log(`🗑️ [Watcher] Fichier supprimé détecté : ${filePath}`);

    const node = await db.query.mediaNodes.findFirst({
      where: (t, { or: oOp, eq: eOp }) =>
        oOp(eOp(t.videoFilePath, filePath), eOp(t.nfoFilePath, filePath)),
    });

    if (!node) return;

    if (ext === '.nfo') {
      const videoExists = node.videoFilePath
        ? await fs.access(node.videoFilePath).then(() => true).catch(() => false)
        : false;

      if (!videoExists) {
        await db.delete(mediaNodes).where(eq(mediaNodes.id, node.id));
        console.log(`🗑️ [Watcher] Nœud orphelin supprimé : "${node.title}"`);
      } else {
        await db
          .update(mediaNodes)
          .set({ nfoFilePath: null, nfoSha256: null, updatedAt: new Date() })
          .where(eq(mediaNodes.id, node.id));
      }
    } else if (isVideoExtension(ext)) {
      await db.delete(mediaNodes).where(eq(mediaNodes.id, node.id));
      console.log(`🗑️ [Watcher] Nœud vidéo supprimé : "${node.title}"`);
    }
  } catch (err) {
    console.error(`Erreur lors du traitement de la suppression de ${filePath}:`, err);
  }
}

/**
 * Gestionnaire réactif de suppression de dossier en temps réel
 */
export async function handleDirUnlink(dirPath: string): Promise<void> {
  try {
    console.log(`📁🗑️ [Watcher] Dossier supprimé détecté : ${dirPath}`);
    const normDir = path.normalize(dirPath).replace(/\\/g, '/');

    await db.delete(mediaNodes).where(
      or(
        like(mediaNodes.videoFilePath, `${normDir}/%`),
        like(mediaNodes.nfoFilePath, `${normDir}/%`),
        eq(mediaNodes.videoFilePath, normDir),
        eq(mediaNodes.nfoFilePath, normDir)
      )
    );
  } catch (err) {
    console.error(`Erreur lors du traitement de la suppression du dossier ${dirPath}:`, err);
  }
}

export function startMultiRootNfoWatcher(watchDirs: string[]): FSWatcher[] {
  const watchers: FSWatcher[] = [];

  for (const dir of watchDirs) {
    console.log(`👀 Watching media directory (in-place tagging): ${dir}`);
    const watcher = chokidar.watch(path.join(dir, '**/*'), {
      persistent: true,
      ignoreInitial: false,
      ignored: (p, stats) => {
        const name = path.basename(p);
        if (name.startsWith('.') && name !== '.nfo') return true;
        if (isIgnoredDirectoryName(name) || isIgnoredMediaFileName(name)) return true;
        // Ne JAMAIS filtrer sur l'extension d'un dossier : les releases utilisent
        // des noms comme « star.wars.hexalogie.1977-2005... » dont l'extension
        // apparente ferait ignorer tout le dossier par chokidar.
        if (stats?.isDirectory()) return false;
        if (stats?.isFile()) {
          const ext = path.extname(p).toLowerCase();
          return ext !== '' && ext !== '.nfo' && !isVideoExtension(ext);
        }
        return false;
      },
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 200,
      },
    });

    watcher
      .on('add', (filePath) => processAnyMediaFile(filePath))
      .on('change', (filePath) => processAnyMediaFile(filePath))
      .on('unlink', (filePath) => handleFileUnlink(filePath))
      .on('unlinkDir', (dirPath) => handleDirUnlink(dirPath))
      .on('error', (err) => console.error(`Watcher error on ${dir}:`, err));

    watchers.push(watcher);
  }

  return watchers;
}
