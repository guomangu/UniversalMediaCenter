import path from 'node:path';
import fs from 'node:fs/promises';
import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { eq, and, or, like } from 'drizzle-orm';
import { generateSlug } from './slugify.js';

export interface SeriesContext {
  showDir: string;
  tvshowNfoPath: string | null;
  showTitleCandidate: string;
}

export function cleanShowFolderName(folder: string): string {
  return folder
    .replace(/^\s*\[.*?\]/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\b(1080p|720p|2160p|4k|bluray|remux|hevc|x265|x264|vff|vostfr|multi|proper|repack|web-dl|web|aac|ac3|dts|flac|intégral|integrale)\b/gi, '')
    .replace(/[._]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Détermine le dossier racine d'une série pour n'importe quel fichier
 */
export async function resolveSeriesRoot(filePath: string): Promise<SeriesContext | null> {
  let currentDir = path.dirname(filePath);
  const rootLimit = path.parse(currentDir).root;

  // 1. Remonter l'arborescence pour chercher un tvshow.nfo
  let checkDir = currentDir;
  while (checkDir && checkDir !== rootLimit && checkDir !== path.dirname(checkDir)) {
    const parent = path.dirname(checkDir);
    const parentName = path.basename(parent).toLowerCase();

    // Arrêt si on a atteint la racine de catégorie (ex: Series, Animes)
    if (['animes', 'anime', 'series', 'séries', 'tv', 'shows'].includes(parentName)) {
      const candidateNfo = path.join(checkDir, 'tvshow.nfo');
      try {
        await fs.access(candidateNfo);
        return { showDir: checkDir, tvshowNfoPath: candidateNfo, showTitleCandidate: path.basename(checkDir) };
      } catch {
        return { showDir: checkDir, tvshowNfoPath: null, showTitleCandidate: path.basename(checkDir) };
      }
    }

    const candidateNfo = path.join(checkDir, 'tvshow.nfo');
    try {
      await fs.access(candidateNfo);
      return { showDir: checkDir, tvshowNfoPath: candidateNfo, showTitleCandidate: path.basename(checkDir) };
    } catch {}

    checkDir = parent;
  }

  return null;
}

/**
 * Résout le SHOW parent id de manière déterministe pour n'importe quel fichier (trouve ou crée si absent)
 */
export async function resolveParentShowNodeId(filePath: string): Promise<string | null> {
  const seriesCtx = await resolveSeriesRoot(filePath);
  if (!seriesCtx) return null;

  const cleanedTitle = cleanShowFolderName(seriesCtx.showTitleCandidate);

  // 1. Recherche par tvshowNfoPath exact (avec compatibilité /var/home <=> /home)
  if (seriesCtx.tvshowNfoPath) {
    const altPath = seriesCtx.tvshowNfoPath.startsWith('/var/home/')
      ? seriesCtx.tvshowNfoPath.replace('/var/home/', '/home/')
      : seriesCtx.tvshowNfoPath.replace('/home/', '/var/home/');

    const showByNfo = await db.query.mediaNodes.findFirst({
      where: (t, { and: aOp, eq: eOp, or: oOp }) =>
        aOp(
          eOp(t.nodeType, 'SHOW'),
          oOp(eOp(t.nfoFilePath, seriesCtx.tvshowNfoPath!), eOp(t.nfoFilePath, altPath))
        ),
    });
    if (showByNfo) return showByNfo.id;
  }

  // 2. Recherche par nom de dossier ou titre nettoyé
  const showByName = await db.query.mediaNodes.findFirst({
    where: (t, { and: aOp, eq: eOp, or: oOp }) =>
      aOp(
        eOp(t.nodeType, 'SHOW'),
        oOp(
          eOp(t.title, seriesCtx.showTitleCandidate),
          eOp(t.sortTitle, seriesCtx.showTitleCandidate),
          eOp(t.title, cleanedTitle),
          eOp(t.sortTitle, cleanedTitle)
        )
      ),
  });
  if (showByName) return showByName.id;

  // 3. Si aucun SHOW n'existe pour cette série (ex: Lain sans tvshow.nfo), le créer proprement
  const slug = `${generateSlug(cleanedTitle || seriesCtx.showTitleCandidate)}-show`;
  const [createdShow] = await db
    .insert(mediaNodes)
    .values({
      nodeType: 'SHOW',
      title: cleanedTitle || seriesCtx.showTitleCandidate,
      sortTitle: cleanedTitle || seriesCtx.showTitleCandidate,
      slug: `${slug}-${Date.now().toString().slice(-4)}`,
      state: 'READY',
      confidenceScore: 0.95,
      updatedAt: new Date(),
    })
    .returning();

  return createdShow.id;
}

/**
 * Trouve ou crée de façon déterministe le nœud COLLECTION pour un film
 */
export async function findOrCreateCollectionNode(
  collectionName: string,
  extraMeta?: {
    tmdbId?: number;
    posterUrl?: string;
    fanartUrl?: string;
    overview?: string;
  }
): Promise<any> {
  const cleanName = collectionName.trim();
  if (!cleanName) return null;

  // 1. Recherche par titre exact
  const existing = await db.query.mediaNodes.findFirst({
    where: (t, { and: aOp, eq: eOp, or: oOp }) =>
      aOp(
        eOp(t.nodeType, 'COLLECTION'),
        oOp(eOp(t.title, cleanName), eOp(t.sortTitle, cleanName))
      ),
  });
  if (existing) return existing;

  // 2. Recherche par racine normalisée (sans " - Saga" ou " Collection")
  const normalizedBase = cleanName.replace(/\s*-\s*saga$/i, '').replace(/\s*collection$/i, '').trim();
  if (normalizedBase.length > 2) {
    const existingFuzzy = await db.query.mediaNodes.findFirst({
      where: (t, { and: aOp, eq: eOp, or: oOp, like: lOp }) =>
        aOp(
          eOp(t.nodeType, 'COLLECTION'),
          oOp(
            lOp(t.title, `%${normalizedBase}%`),
            lOp(t.sortTitle, `%${normalizedBase}%`)
          )
        ),
    });
    if (existingFuzzy) return existingFuzzy;
  }

  // 3. Création du conteneur COLLECTION
  const baseSlug = generateSlug(cleanName) || 'saga';
  const slug = `${baseSlug}-collection-${Date.now().toString().slice(-4)}`;
  const cleanSort = cleanName.replace(/^(le|la|les|the|l')\s+/i, '').trim() || cleanName;

  const [created] = await db
    .insert(mediaNodes)
    .values({
      nodeType: 'COLLECTION',
      title: cleanName,
      sortTitle: cleanSort,
      slug,
      state: 'READY',
      confidenceScore: 1.0,
      posterPath: extraMeta?.posterUrl,
      fanartPath: extraMeta?.fanartUrl,
      overview: extraMeta?.overview,
      updatedAt: new Date(),
    })
    .returning();

  return created;
}

/**
 * Détecte si un fichier se trouve dans un dossier représentant une Saga ou Intégrale de films
 */
export function detectSagaNameFromFolder(filePath: string): string | null {
  const norm = filePath.replace(/\\/g, '/');
  const parts = norm.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const parentFolder = parts[parts.length - 2];

  const isSagaFolder =
    /\b(int[ée]grale|saga|collection|trilogie|quadrilogie|boxset|anthologie)\b/i.test(parentFolder) ||
    /\bfilms?\s*\(\s*(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}\s*\)/i.test(parentFolder);

  if (!isSagaFolder) return null;

  // Nettoyage pour obtenir le nom de la franchise
  let baseName = parentFolder
    .replace(/\s*[-–]\s*int[ée]grale.*$/i, '')
    .replace(/\s*int[ée]grale.*$/i, '')
    .replace(/\s*[-–]\s*saga.*$/i, '')
    .replace(/\s*collection.*$/i, '')
    .replace(/\s*[-–]\s*boxset.*$/i, '')
    .replace(/\s*\(.*?\)/g, '')
    .trim();

  if (baseName.length < 2) return null;

  // Title case basique si tout en minuscules
  if (baseName === baseName.toLowerCase()) {
    baseName = baseName.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return `${baseName} - Saga`;
}
