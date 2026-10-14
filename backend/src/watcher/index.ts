import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { parseNfoXml } from './nfoParser.js';
import { ingestMediaNode } from './mediaIngester.js';

async function calculateFileSha256(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

export async function processNfoFile(filePath: string): Promise<void> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const sha256 = await calculateFileSha256(filePath);
    const parsed = parseNfoXml(content);
    await ingestMediaNode(filePath, parsed, sha256);
    console.log(`🎬 Ingested NFO [${parsed.type}]: ${parsed.title}`);
  } catch (err) {
    console.error(`❌ Failed to process NFO file ${filePath}:`, err);
  }
}

export function startNfoWatcher(watchDir: string): FSWatcher {
  console.log(`👀 Starting NFO Watcher on: ${watchDir}`);
  const watcher = chokidar.watch(path.join(watchDir, '**/*.nfo'), {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 200,
    },
  });

  watcher
    .on('add', (filePath) => processNfoFile(filePath))
    .on('change', (filePath) => processNfoFile(filePath))
    .on('error', (err) => console.error('Watcher error:', err));

  return watcher;
}
