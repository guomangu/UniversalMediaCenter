import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/connection.js';
import { parseMediaChaosRoots } from '../watcher/rootConfig.js';

export interface PhysicalFolderItem {
  path: string;
  name: string;
  rootPath: string;
  parentPath: string | null;
  relativePath: string;
  mediaCount: number;
  directMediaCount: number;
  subfolderCount: number;
  depth: number;
  existsOnDisk: boolean;
}

export interface FolderDiscoveryResult {
  success: boolean;
  roots: string[];
  folders: PhysicalFolderItem[];
  totalFolders: number;
  totalMedia: number;
}

const IGNORED_NAMES = new Set([
  '.git',
  '.svn',
  'node_modules',
  '@eaDir',
  '#recycle',
  'lost+found',
  '.system_generated',
  '.DS_Store',
]);

/**
 * Explore et agrège les dossiers physiques de la médiathèque
 * en croisant l'arborescence disque et l'indexation de la base de données.
 */
export async function discoverPhysicalFolders(): Promise<FolderDiscoveryResult> {
  // 1. Récupérer les médias indexés en base avec leurs chemins
  const nodes = await db.query.mediaNodes.findMany({
    columns: { videoFilePath: true, nfoFilePath: true },
  });

  const totalMedia = nodes.length;
  const dirDirectCount = new Map<string, number>();

  for (const n of nodes) {
    const filePath = n.videoFilePath || n.nfoFilePath;
    if (filePath) {
      const norm = path.normalize(filePath).replace(/\\/g, '/');
      const dir = path.dirname(norm);
      dirDirectCount.set(dir, (dirDirectCount.get(dir) || 0) + 1);
    }
  }

  // 2. Déterminer les racines candidates
  const configuredRoots = parseMediaChaosRoots();
  const detectedRoots = new Set<string>();

  for (const r of configuredRoots) {
    const norm = path.normalize(r).replace(/\\/g, '/');
    detectedRoots.add(norm);
  }

  // Détection de racines majeures depuis les chemins en base
  for (const dir of dirDirectCount.keys()) {
    if (dir.startsWith('/home/tele/Vidéos/drive') || dir.startsWith('/var/home/tele/Vidéos/drive')) {
      detectedRoots.add('/home/tele/Vidéos/drive');
    } else if (dir.startsWith('/run/media/tele/')) {
      const match = dir.match(/^(\/run\/media\/tele\/[^/]+)/);
      if (match) detectedRoots.add(match[1]);
    } else if (dir.startsWith('./media')) {
      detectedRoots.add('./media/chaos');
    }
  }

  const rootsList = Array.from(detectedRoots);
  const foldersMap = new Map<string, PhysicalFolderItem>();

  // 3. Crawler sécurisé du disque pour les racines existantes (jusqu'à profondeur 3)
  function scanDiskDir(currentDir: string, rootPath: string, depth: number) {
    if (depth > 3) return;
    try {
      if (!fs.existsSync(currentDir)) return;
      const stat = fs.statSync(currentDir);
      if (!stat.isDirectory()) return;

      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      const normCurrent = path.normalize(currentDir).replace(/\\/g, '/');
      const baseName = path.basename(normCurrent);

      if (normCurrent !== rootPath && !foldersMap.has(normCurrent)) {
        const parentPath = path.dirname(normCurrent);
        const relPath = path.relative(rootPath, normCurrent).replace(/\\/g, '/');
        foldersMap.set(normCurrent, {
          path: normCurrent,
          name: baseName,
          rootPath,
          parentPath: parentPath === normCurrent ? null : parentPath,
          relativePath: relPath,
          mediaCount: 0,
          directMediaCount: dirDirectCount.get(normCurrent) || 0,
          subfolderCount: 0,
          depth,
          existsOnDisk: true,
        });
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (IGNORED_NAMES.has(entry.name) || entry.name.startsWith('.')) continue;
        const subPath = path.join(currentDir, entry.name);
        scanDiskDir(subPath, rootPath, depth + 1);
      }
    } catch {
      // Ignorer les erreurs d'accès ou permissions
    }
  }

  for (const root of rootsList) {
    scanDiskDir(root, root, 1);
  }

  // 4. Intégrer également les dossiers indexés en base qui ne seraient pas sur le disque actif
  for (const [dbDir, count] of dirDirectCount.entries()) {
    if (!foldersMap.has(dbDir)) {
      let matchedRoot = rootsList.find((r) => dbDir.startsWith(r)) || path.dirname(dbDir);
      const relPath = path.relative(matchedRoot, dbDir).replace(/\\/g, '/');
      const parent = path.dirname(dbDir);
      const baseName = path.basename(dbDir);

      foldersMap.set(dbDir, {
        path: dbDir,
        name: baseName,
        rootPath: matchedRoot,
        parentPath: parent === dbDir ? null : parent,
        relativePath: relPath,
        mediaCount: count,
        directMediaCount: count,
        subfolderCount: 0,
        depth: relPath.split('/').length,
        existsOnDisk: fs.existsSync(dbDir),
      });

      // Remonter aux dossiers intermédiaires si absents
      let currentParent = parent;
      let currDepth = relPath.split('/').length - 1;
      while (currentParent && currentParent !== matchedRoot && currentParent !== '/' && currentParent !== '.') {
        if (!foldersMap.has(currentParent)) {
          const pName = path.basename(currentParent);
          const pRel = path.relative(matchedRoot, currentParent).replace(/\\/g, '/');
          foldersMap.set(currentParent, {
            path: currentParent,
            name: pName,
            rootPath: matchedRoot,
            parentPath: path.dirname(currentParent),
            relativePath: pRel,
            mediaCount: 0,
            directMediaCount: dirDirectCount.get(currentParent) || 0,
            subfolderCount: 0,
            depth: currDepth,
            existsOnDisk: fs.existsSync(currentParent),
          });
        }
        currentParent = path.dirname(currentParent);
        currDepth--;
      }
    }
  }

  // 5. Calculer le nombre cumulé de médias (mediaCount) et le nombre de sous-dossiers
  const allFolders = Array.from(foldersMap.values());

  for (const folder of allFolders) {
    let sum = folder.directMediaCount;
    let subCount = 0;
    const prefix = folder.path.endsWith('/') ? folder.path : `${folder.path}/`;

    for (const [dPath, dCount] of dirDirectCount.entries()) {
      if (dPath !== folder.path && dPath.startsWith(prefix)) {
        sum += dCount;
      }
    }

    for (const other of allFolders) {
      if (other.parentPath === folder.path) {
        subCount++;
      }
    }

    folder.mediaCount = sum;
    folder.subfolderCount = subCount;
  }

  // Trier logiquement : par racine, puis par profondeur, puis alphabétiquement
  allFolders.sort((a, b) => {
    if (a.rootPath !== b.rootPath) return a.rootPath.localeCompare(b.rootPath);
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  return {
    success: true,
    roots: rootsList,
    folders: allFolders,
    totalFolders: allFolders.length,
    totalMedia,
  };
}
