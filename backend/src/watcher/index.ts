import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { parseNfoXml } from './nfoParser.js';
import { ingestMediaNode, ingestStandaloneVideoFile } from './mediaIngester.js';

const VIDEO_EXTENSIONS = new Set([
  '.mkv', '.mp4', '.avi', '.mov', '.m4v', '.webm', '.ts', '.wmv', '.flv',
]);

async function calculateFileSha256(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

export async function processNfoFile(filePath: string): Promise<void> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = parseNfoXml(content, filePath);
    if (!parsed) return;
    const sha256 = await calculateFileSha256(filePath);
    await ingestMediaNode(filePath, parsed, sha256);
    console.log(`🎬 Ingested NFO [${parsed.type}] in-place: ${parsed.title}`);
  } catch (err) {
    console.error(`❌ Failed to process NFO file ${filePath}:`, err);
  }
}

export async function processAnyMediaFile(filePath: string): Promise<void> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.nfo') {
    await processNfoFile(filePath);
    return;
  }

  if (VIDEO_EXTENSIONS.has(ext)) {
    // Vérifier si un NFO direct existe
    const dir = path.dirname(filePath);
    const base = path.basename(filePath, ext);
    const candidateNfo = path.join(dir, `${base}.nfo`);
    try {
      await fs.access(candidateNfo);
      // NFO présent, sera ou a déjà été traité
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

export function startMultiRootNfoWatcher(watchDirs: string[]): FSWatcher[] {
  const watchers: FSWatcher[] = [];

  for (const dir of watchDirs) {
    console.log(`👀 Watching media directory (in-place tagging): ${dir}`);
    const watcher = chokidar.watch(path.join(dir, '**/*'), {
      persistent: true,
      ignoreInitial: false,
      ignored: (p) => {
        const ext = path.extname(p).toLowerCase();
        return ext ? !VIDEO_EXTENSIONS.has(ext) && ext !== '.nfo' : false;
      },
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 200,
      },
    });

    watcher
      .on('add', (filePath) => processAnyMediaFile(filePath))
      .on('change', (filePath) => processAnyMediaFile(filePath))
      .on('error', (err) => console.error(`Watcher error on ${dir}:`, err));

    watchers.push(watcher);
  }

  return watchers;
}
