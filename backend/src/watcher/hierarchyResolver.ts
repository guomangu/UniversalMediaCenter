import path from 'node:path';
import fs from 'node:fs/promises';
import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { eq, and, or, sql } from 'drizzle-orm';
import { generateSlug } from './slugify.js';
import { extractCanonicalShowTitle } from './titleCleaner.js';

export interface SeriesContext {
  showDir: string;
  tvshowNfoPath: string | null;
  showTitleCandidate: string;
}

export function cleanShowFolderName(folder: string): string {
  return extractCanonicalShowTitle(folder);
}

const SERIES_ROOT_CATEGORIES = new Set([
  'animes', 'anime', 'series', 'séries', 'serie', 'série', 'tv', 'shows', 'show',
]);

/**
 * Détermine le dossier racine d'une série pour n'importe quel fichier
 * Supporte les catégories singulières/plurielles (series/serie), les dossiers de saisons orphelins (ex: Peaky Blinders - Saison 4 dans FILMS)
 */
export async function resolveSeriesRoot(filePath: string): Promise<SeriesContext | null> {
  let currentDir = path.dirname(filePath);
  const rootLimit = path.parse(currentDir).root;

  // 1. Remonter l'arborescence pour chercher un tvshow.nfo ou un conteneur de série
  let checkDir = currentDir;
  while (checkDir && checkDir !== rootLimit && checkDir !== path.dirname(checkDir)) {
    const parent = path.dirname(checkDir);
    const parentName = path.basename(parent).toLowerCase();
    const currentName = path.basename(checkDir);

    // Détection immédiate d'un tvshow.nfo
    const candidateNfo = path.join(checkDir, 'tvshow.nfo');
    try {
      await fs.access(candidateNfo);
      return { showDir: checkDir, tvshowNfoPath: candidateNfo, showTitleCandidate: currentName };
    } catch {}

    // Arrêt si on a atteint la racine de catégorie (ex: Series, Saisons, Anime, Serie au singulier)
    if (SERIES_ROOT_CATEGORIES.has(parentName)) {
      return { showDir: checkDir, tvshowNfoPath: null, showTitleCandidate: currentName };
    }

    // Détection d'un dossier intermédiaire de série parente (ex: /serie/peacky blinders/peaky blinders - saison 1)
    const grandParent = path.dirname(parent);
    const grandParentName = path.basename(grandParent).toLowerCase();
    if (SERIES_ROOT_CATEGORIES.has(grandParentName)) {
      return { showDir: parent, tvshowNfoPath: null, showTitleCandidate: path.basename(parent) };
    }

    // Détection d'un dossier de saison autonome (ex: "Peaky Blinders - Saison 4 (2017)")
    if (/(?:^|[-_ ])(?:saison|season|s)\s*0*\d+/i.test(currentName)) {
      return { showDir: checkDir, tvshowNfoPath: null, showTitleCandidate: currentName };
    }

    checkDir = parent;
  }

  // 2. Si aucun répertoire parent formel n'a été trouvé mais que le fichier porte un code SxxExx
  const fileName = path.basename(filePath);
  if (/S\d+[\s._-]*E\d+|\b\d+x\d+\b/i.test(fileName)) {
    const candidate = extractCanonicalShowTitle(fileName) || extractCanonicalShowTitle(path.basename(currentDir));
    if (candidate && candidate.length > 2) {
      return { showDir: currentDir, tvshowNfoPath: null, showTitleCandidate: candidate };
    }
  }

  return null;
}

/**
 * Résout le SHOW parent id de manière déterministe pour n'importe quel fichier
 * Consolide canoniquement vers un SHOW unique même avec variations orthographiques ("peacky blinders" -> "Peaky Blinders")
 */
export async function resolveParentShowNodeId(filePath: string): Promise<string | null> {
  const seriesCtx = await resolveSeriesRoot(filePath);
  const rawCandidate = seriesCtx ? seriesCtx.showTitleCandidate : path.basename(filePath);
  const cleanedTitle = extractCanonicalShowTitle(rawCandidate);
  if (!cleanedTitle || cleanedTitle.length < 2) return null;

  // 1. Recherche par tvshowNfoPath exact si disponible
  if (seriesCtx?.tvshowNfoPath) {
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

  // 2. Recherche directe par titre canonique exact ou insensible à la casse
  const showByName = await db.query.mediaNodes.findFirst({
    where: (t, { and: aOp, eq: eOp, or: oOp, ilike: iOp }) =>
      aOp(
        eOp(t.nodeType, 'SHOW'),
        oOp(
          iOp(t.title, cleanedTitle),
          iOp(t.sortTitle, cleanedTitle),
          eOp(t.title, rawCandidate),
          eOp(t.sortTitle, rawCandidate)
        )
      ),
  });
  if (showByName) return showByName.id;

  // 3. Recherche par racine si un SHOW préexistant porte un suffixe de saison (ex: "Peaky Blinders - Saison 1 360p")
  const showByPrefix = await db.query.mediaNodes.findFirst({
    where: (t, { and: aOp, eq: eOp, ilike: iOp }) =>
      aOp(
        eOp(t.nodeType, 'SHOW'),
        iOp(t.title, `${cleanedTitle}%`)
      ),
  });
  if (showByPrefix) {
    // Promouvoir ce SHOW au titre canonique propre
    await db
      .update(mediaNodes)
      .set({
        title: cleanedTitle,
        sortTitle: cleanedTitle,
        updatedAt: new Date(),
      })
      .where(eq(mediaNodes.id, showByPrefix.id));
    return showByPrefix.id;
  }

  // 4. Recherche par similarité trigramme PostgreSQL (tolérance aux fautes de frappe comme "peacky blinders")
  try {
    const fuzzyShows = await db.execute(sql`
      SELECT id, title FROM media_nodes
      WHERE node_type = 'SHOW' AND similarity(title, ${cleanedTitle}) > 0.65
      ORDER BY similarity(title, ${cleanedTitle}) DESC
      LIMIT 1;
    `);
    const fuzzyRows = Array.isArray(fuzzyShows) ? fuzzyShows : (fuzzyShows as any).rows || [];
    if (fuzzyRows.length > 0 && fuzzyRows[0]?.id) {
      return fuzzyRows[0].id;
    }
  } catch {}

  // 5. Si aucun SHOW n'existe pour cette série, créer le SHOW canonique unique
  const cleanSort = cleanedTitle.replace(/^(le|la|les|the|l')\s+/i, '').trim() || cleanedTitle;
  const slug = `${generateSlug(cleanedTitle)}-show`;
  const [createdShow] = await db
    .insert(mediaNodes)
    .values({
      nodeType: 'SHOW',
      title: cleanedTitle,
      sortTitle: cleanSort,
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
