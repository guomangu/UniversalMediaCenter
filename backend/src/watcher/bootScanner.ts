import fs from 'node:fs/promises';
import path from 'node:path';
import { processNfoFile } from './index.js';
import { ingestStandaloneVideoFile } from './mediaIngester.js';
import { repairAllMediaHierarchy } from './hierarchyRepair.js';

const VIDEO_EXTENSIONS = new Set([
  '.mkv', '.mp4', '.avi', '.mov', '.m4v', '.webm', '.ts', '.wmv', '.flv',
]);

const EXCLUDED_FOLDERS = new Set([
  '@eadir', '#recycle', '.git', 'lost+found', 'node_modules', '.cache',
]);

export interface DiscoveredScanFiles {
  nfoPaths: string[];
  standaloneVideoPaths: string[];
}

export interface ScanStatus {
  isScanning: boolean;
  totalDiscovered: number;
  processedCount: number;
  nfoCount: number;
  standaloneCount: number;
  currentFile?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

const activeScanStatus: ScanStatus = {
  isScanning: false,
  totalDiscovered: 0,
  processedCount: 0,
  nfoCount: 0,
  standaloneCount: 0,
};

export function getScanStatus(): ScanStatus {
  return { ...activeScanStatus };
}

/**
 * Crawler récursif in-place découvrant :
 * 1. Tous les fichiers .nfo
 * 2. Toutes les vidéos isolées (standalone) sans .nfo associé
 */
export async function findMediaFilesRecursive(dir: string): Promise<DiscoveredScanFiles> {
  const nfoPaths: string[] = [];
  const standaloneVideoPaths: string[] = [];

  async function crawl(currentDir: string) {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (err) {
      console.warn(`Could not read directory ${currentDir}:`, err);
      return;
    }

    const fileNames = new Set(entries.filter((e) => e.isFile()).map((e) => e.name));

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.nfo') continue;
      if (EXCLUDED_FOLDERS.has(entry.name.toLowerCase())) continue;

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await crawl(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();

        if (ext === '.nfo') {
          nfoPaths.push(fullPath);
        } else if (VIDEO_EXTENSIONS.has(ext)) {
          // Ignorer les dossiers ou fichiers de trickplay
          if (fullPath.includes('/.trickplay/')) continue;

          // Vérifier si un .nfo avec le même nom de base existe
          const baseName = path.basename(entry.name, ext);
          const hasMatchingNfo = fileNames.has(`${baseName}.nfo`) || fileNames.has(`${baseName}.NFO`);
          if (!hasMatchingNfo) {
            standaloneVideoPaths.push(fullPath);
          }
        }
      }
    }
  }

  await crawl(dir);
  return { nfoPaths, standaloneVideoPaths };
}

/**
 * Lance le scan universel complet des bibliothèques (Pass 1 NFO + Pass 2 Standalone + Pass 3 Hiérarchie)
 */
export const runBootMediaScan = triggerMediaScan;
export async function triggerMediaScan(roots: string[]): Promise<void> {
  if (activeScanStatus.isScanning) {
    console.warn('⚠️ A media scan is already in progress. Ignoring trigger request.');
    return;
  }

  activeScanStatus.isScanning = true;
  activeScanStatus.totalDiscovered = 0;
  activeScanStatus.processedCount = 0;
  activeScanStatus.nfoCount = 0;
  activeScanStatus.standaloneCount = 0;
  activeScanStatus.startedAt = new Date().toISOString();
  activeScanStatus.finishedAt = undefined;
  activeScanStatus.error = undefined;

  try {
    const allNfos: string[] = [];
    const allStandalones: string[] = [];

    for (const root of roots) {
      const { nfoPaths, standaloneVideoPaths } = await findMediaFilesRecursive(root);
      allNfos.push(...nfoPaths);
      allStandalones.push(...standaloneVideoPaths);
    }

    activeScanStatus.totalDiscovered = allNfos.length + allStandalones.length;
    console.log(`📁 Found ${allNfos.length} .nfo and ${allStandalones.length} standalone video(s) across all roots.`);

    // 1ère passe : Fichiers avec NFO
    for (const p of allNfos) {
      activeScanStatus.currentFile = path.basename(p);
      await processNfoFile(p);
      activeScanStatus.nfoCount++;
      activeScanStatus.processedCount++;
    }

    // 2ème passe : Vidéos sans NFO via le pipeline Waterfall Kyoo++
    for (const vp of allStandalones) {
      try {
        activeScanStatus.currentFile = path.basename(vp);
        await ingestStandaloneVideoFile(vp);
        activeScanStatus.standaloneCount++;
        activeScanStatus.processedCount++;
      } catch (err) {
        console.warn(`Failed standalone ingestion of ${vp}:`, err);
      }
    }

    // 3ème passe : Réconciliation déterministe de toute la hiérarchie
    console.log('🔄 Running deterministic hierarchy reconciliation...');
    const repairReport = await repairAllMediaHierarchy();
    console.log(`✨ Hierarchy reconciliation finished:`, repairReport);

    activeScanStatus.finishedAt = new Date().toISOString();
    console.log(`✅ Media scan complete: ${activeScanStatus.processedCount} media file(s) processed.`);
  } catch (err: any) {
    activeScanStatus.error = err.message || 'Unknown scan error';
    console.error('❌ Media scan failed with error:', err);
  } finally {
    activeScanStatus.isScanning = false;
    activeScanStatus.currentFile = undefined;
  }
}
