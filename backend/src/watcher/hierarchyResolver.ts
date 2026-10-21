import path from 'node:path';
import fs from 'node:fs/promises';
import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { eq, and, or, sql } from 'drizzle-orm';
import { generateSlug } from './slugify.js';
import { extractCanonicalShowTitle, normalizePhoneticSpelling } from './titleCleaner.js';

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

const GENRE_OR_INTERMEDIATE_CATEGORIES = new Set([
  'crime', 'action', 'drame', 'drama', 'comedie', 'comedy', 'animation', 'thriller',
  'sci-fi', 'horreur', 'horror', 'documentaire', 'aventure', 'fantastique', 'romance',
  'western', 'films', 'film', 'partaged', 'telechargement', 'downloads', 'partage',
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

    // Détection d'un dossier de saison ou arc (ex: "Peaky Blinders - Saison 4 (2017)", "1a. 1st gig (2002-03)")
    const isSeasonOrArc =
      /(?:^|[-_ ])(?:saison|season|\d+(?:st|nd|rd|th)?\s*gig)\s*0*\d+/i.test(currentName) ||
      /\bS0*\d{1,2}\b/i.test(currentName);

    if (isSeasonOrArc) {
      // Si le dossier parent porte le nom de la série (ex: "b. stand alone complex (2002-06)")
      if (parent && parent !== rootLimit && !SERIES_ROOT_CATEGORIES.has(parentName) && !GENRE_OR_INTERMEDIATE_CATEGORIES.has(parentName)) {
        return { showDir: parent, tvshowNfoPath: null, showTitleCandidate: path.basename(parent) };
      }
      return { showDir: checkDir, tvshowNfoPath: null, showTitleCandidate: currentName };
    }

    checkDir = parent;
  }

  // 2. Si aucun répertoire parent formel n'a été trouvé mais que le fichier porte un code SxxExx formel
  const fileName = path.basename(filePath);
  const hasEpisodeCode = /\b(?:S\d{1,2}[\s._-]*E\d{1,3}|\b\d{1,2}x\d{1,3}\b|EP\s*\d{1,3})\b/i.test(fileName);
  if (hasEpisodeCode) {
    // Vérifier qu'il ne s'agit pas d'une résolution vidéo (ex: 1920x1080, 1920x804, 1280x720)
    const xMatch = fileName.match(/\b(\d{1,4})x(\d{1,4})\b/i);
    const isResolution = xMatch && (parseInt(xMatch[1], 10) >= 300 || parseInt(xMatch[2], 10) >= 300);

    if (!isResolution) {
      const candidate = extractCanonicalShowTitle(fileName) || extractCanonicalShowTitle(path.basename(currentDir));
      if (candidate && candidate.length > 2) {
        return { showDir: currentDir, tvshowNfoPath: null, showTitleCandidate: candidate };
      }
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
  // GARDE CRITIQUE : Si le fichier n'est pas dans un contexte de série formel, ne JAMAIS créer de SHOW
  if (!seriesCtx) return null;

  let rawCandidate = seriesCtx.showTitleCandidate;
  if (GENRE_OR_INTERMEDIATE_CATEGORIES.has(rawCandidate.toLowerCase().trim())) {
    rawCandidate = path.basename(filePath);
  }
  const cleanedTitle = extractCanonicalShowTitle(rawCandidate);
  if (!cleanedTitle || cleanedTitle.length < 2) return null;

  // 1. Recherche par tvshowNfoPath exact si disponible
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
  // Protégé : Ne jamais matcher un mot différent (ex: "Soul Eater" ne doit JAMAIS matcher "Soul")
  const showsWithPrefix = await db.query.mediaNodes.findMany({
    where: (t, { and: aOp, eq: eOp, ilike: iOp }) =>
      aOp(
        eOp(t.nodeType, 'SHOW'),
        iOp(t.title, `${cleanedTitle}%`)
      ),
    limit: 10,
  });

  const validSeasonSuffixRegex = /^(?:\s*[-_–]\s*|\s+)(?:saison|season|s\d+|part|partie|vol|volume|cour|\d{3,4}p)\b/i;
  const showByPrefix = showsWithPrefix.find((s) => {
    if (s.title.toLowerCase().trim() === cleanedTitle.toLowerCase().trim()) return true;
    const remainder = s.title.slice(cleanedTitle.length);
    return validSeasonSuffixRegex.test(remainder);
  });

  if (showByPrefix) {
    if (showByPrefix.title.toLowerCase().trim() !== cleanedTitle.toLowerCase().trim()) {
      await db
        .update(mediaNodes)
        .set({
          title: cleanedTitle,
          sortTitle: cleanedTitle,
          updatedAt: new Date(),
        })
        .where(eq(mediaNodes.id, showByPrefix.id));
    }
    return showByPrefix.id;
  }

  // 4. Recherche hybride Phonétique + Trigrammes + Levenshtein (Loi n°2 White Paper)
  const phoneticCandidate = normalizePhoneticSpelling(cleanedTitle);
  try {
    const fuzzyShows = await db.execute(sql`
      SELECT id, title,
             similarity(title, ${cleanedTitle}) AS trgm_sim,
             levenshtein(lower(title), lower(${cleanedTitle})) AS lev_dist,
             CASE WHEN dmetaphone(title) = dmetaphone(${cleanedTitle}) THEN 1 ELSE 0 END AS dm_match
      FROM media_nodes
      WHERE node_type = 'SHOW'
        AND (
          similarity(title, ${cleanedTitle}) >= 0.75
          OR (length(${cleanedTitle}) >= 5 AND levenshtein(lower(title), lower(${cleanedTitle})) <= 2 AND similarity(title, ${cleanedTitle}) >= 0.65)
          ${phoneticCandidate !== cleanedTitle ? sql`OR similarity(title, ${phoneticCandidate}) >= 0.75` : sql``}
        )
      ORDER BY
        dm_match DESC,
        trgm_sim DESC,
        lev_dist ASC
      LIMIT 1;
    `);
    const fuzzyRows = Array.isArray(fuzzyShows) ? fuzzyShows : (fuzzyShows as any).rows || [];
    if (fuzzyRows.length > 0 && fuzzyRows[0]?.id) {
      return fuzzyRows[0].id;
    }
  } catch (err) {
    try {
      const fallbackShows = await db.execute(sql`
        SELECT id FROM media_nodes
        WHERE node_type = 'SHOW' AND similarity(title, ${cleanedTitle}) >= 0.75
        ORDER BY similarity(title, ${cleanedTitle}) DESC
        LIMIT 1;
      `);
      const fbRows = Array.isArray(fallbackShows) ? fallbackShows : (fallbackShows as any).rows || [];
      if (fbRows.length > 0 && fbRows[0]?.id) {
        return fbRows[0].id;
      }
    } catch {}
  }

  // 5. Si aucun SHOW n'existe pour cette série, créer le SHOW canonique unique
  // Vérifier si cette série appartient à une saga / franchise parente (ex: Ghost In The Shell)
  let parentCollectionId: string | undefined;
  const folderSaga = detectSagaNameFromFolder(filePath);
  if (folderSaga) {
    const colNode = await findOrCreateCollectionNode(folderSaga);
    if (colNode) parentCollectionId = colNode.id;
  }

  const cleanSort = cleanedTitle.replace(/^(le|la|les|the|l')\s+/i, '').trim() || cleanedTitle;
  const slug = `${generateSlug(cleanedTitle)}-show`;
  const [createdShow] = await db
    .insert(mediaNodes)
    .values({
      nodeType: 'SHOW',
      parentId: parentCollectionId,
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
 * Trouve ou crée de façon déterministe le nœud COLLECTION pour un film ou une saga
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

  // 2. Recherche par nom normalisé (sans " - Saga", "Collection", accents ni ponctuation).
  // Cela évite de créer « Star Wars Collection » à côté de la saga existante
  // « Star Wars - Saga » et de fragmenter une même franchise en deux collections.
  const normalizeCollectionName = (value: string): string =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\b(saga|collection|integrale|int[ée]grale|coffret|boxset|trilogie|trilogy|hexalogie|hexalogy)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const normalizedBase = normalizeCollectionName(cleanName);
  if (normalizedBase.length > 2) {
    const collections = await db.query.mediaNodes.findMany({
      where: (t, { eq: eOp }) => eOp(t.nodeType, 'COLLECTION'),
      columns: { id: true, title: true, sortTitle: true },
    });
    const existingFuzzy = collections.find((c) => {
      const a = normalizeCollectionName(c.title || '');
      const b = normalizeCollectionName(c.sortTitle || '');
      return (
        a === normalizedBase ||
        b === normalizedBase ||
        (a.length > 2 && (a.includes(normalizedBase) || normalizedBase.includes(a))) ||
        (b.length > 2 && (b.includes(normalizedBase) || normalizedBase.includes(b)))
      );
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

const ROOT_PATH_SEGMENTS = new Set([
  '', 'var', 'home', 'tele', 'run', 'media', 'gudbug', 'my passport', 'partaged',
  'films', 'film', 'series', 'serie', 'animes', 'anime', 'vidéos', 'videos', 'chaos',
  'downloads', 'telechargement',
]);

/**
 * Détecte si un fichier se trouve dans un dossier représentant une Saga ou Intégrale de films/univers
 * Remonte l'arborescence pour trouver le dossier englobant (ex: Ghost In The Shell, Studio Ghibli, Pixar)
 */
export function detectSagaNameFromFolder(filePath: string): string | null {
  const norm = filePath.replace(/\\/g, '/');
  const parts = norm.split('/').filter(Boolean);
  if (parts.length < 2) return null;

  for (let i = 0; i < parts.length - 1; i++) {
    const folder = parts[i];
    if (ROOT_PATH_SEGMENTS.has(folder.toLowerCase())) continue;

    const cleanFolder = folder
      .replace(/^\[.*?\]_?/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/[_]/g, ' ')
      .trim();

    if (/tarantino/i.test(cleanFolder)) {
      return 'Quentin Tarantino - Saga';
    }

    // Dossiers de type release : les mots sont souvent séparés par des points
    // (ex: « star.wars.hexalogie.1977-2005... »), il faut donc les normaliser
    // avant de chercher les mots-clés de saga.
    const normalizedFolder = cleanFolder.replace(/[._]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

    const sagaKeywordRe =
      /\b(int[ée]grale|integrale|saga|collection|trilogie|trilogy|quadrilogie|quadrilogy|t[ée]tralogie|tetralogy|pentalogie|pentalogy|hexalogie|hexalogy|heptalogie|heptalogy|octalogie|duologie|duology|boxset|coffret|anthologie|anthology|franchise|filmographie|filmography|univers|universe|pack)\b/i;

    const isSagaFolder =
      sagaKeywordRe.test(normalizedFolder) ||
      /\b(?:films?|movies?)\s*\(\s*(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}\s*\)/i.test(normalizedFolder) ||
      /\((?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}\).*(?:movies|films|series|ovas)/i.test(normalizedFolder) ||
      /\b\d+\s*(?:movies|films)\b/i.test(normalizedFolder);

    if (isSagaFolder) {
      let baseName = normalizedFolder
        .replace(/^collection\s+/i, '')
        .replace(/[\s.-]*(?:int[ée]grale|integrale|saga|collection|trilogie|trilogy|quadrilogie|quadrilogy|t[ée]tralogie|tetralogy|pentalogie|pentalogy|hexalogie|hexalogy|heptalogie|heptalogy|octalogie|duologie|duology|boxset|coffret|anthologie|anthology|franchise|filmographie|filmography|univers|universe|pack)\b.*$/i, '')
        .replace(/[\s.-]*\d+\s*(?:movies|films|ovas|series)\b.*$/i, '')
        .replace(/[\s.-]*\((?:19|20)\d{2}.*$/i, '')
        .replace(/^[0-9]+[a-z]?[\s._–-]+\s*/i, '')
        .replace(/[._]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (baseName.length >= 2) {
        if (baseName === baseName.toLowerCase()) {
          baseName = baseName.replace(/\b\w/g, (c) => c.toUpperCase());
        }
        return `${baseName} - Saga`;
      }
    }
  }

  return null;
}
