import { db } from '../db/connection.js';
import { mediaNodes, nodeEavLinks } from '../db/schema/index.js';
import { eq, sql } from 'drizzle-orm';
import { fetchExternalMetadata, cleanShowTitle } from './externalMetadata.js';
import { linkTagToNode } from './tagExtractor.js';
import { detectAdjacentFiles } from './mediaFileDetector.js';

/**
 * Calcule l'indice de besoin en métadonnées d'un média.
 * Donne une priorité absolue aux Sagas (COLLECTION) et Séries (SHOW) en carence
 * afin d'équilibrer l'exhaustivité culturelle du site.
 */
export function computeMetadataNeedScore(node: any, tagCount = 0): number {
  let score = 0;

  // 1. Priorité structurelle de navigation
  if (node.nodeType === 'COLLECTION') {
    score += 250;
  } else if (node.nodeType === 'SHOW') {
    score += 150;
  } else if (node.nodeType === 'MOVIE') {
    score += 40;
  } else if (node.nodeType === 'SEASON') {
    score += 15;
  } else {
    // EPISODE : priorité minimale
    score += 0;
  }

  // 2. Carence en métadonnées textuelles et visuelles de base
  if (!node.overview || node.overview.trim().length === 0) score += 40;
  if (!node.posterPath) score += 30;
  if (!node.fanartPath) score += 20;
  if (!node.releaseYear) score += 15;
  if (node.communityRating == null) score += 15;
  if (!node.tagline) score += 10;

  // 3. Carence en tags EAV (Genres, Acteurs, Réalisateurs, Studios, Sujets)
  if (tagCount === 0) {
    score += 100;
  } else if (tagCount < 5) {
    score += 60;
  } else if (tagCount < 15) {
    score += 35;
  } else if (tagCount < 30) {
    score += 15;
  }

  return score;
}

export async function enrichLibraryMetadata(batchLimit = 50): Promise<{
  processedCount: number;
  enrichedCount: number;
}> {
  // 1. Recenser le nombre de tags par média pour détecter les sagas et séries orphelines
  const tagCountsRaw = await db
    .select({
      nodeId: nodeEavLinks.nodeId,
      count: sql<number>`count(*)::int`,
    })
    .from(nodeEavLinks)
    .groupBy(nodeEavLinks.nodeId);

  const tagCountMap = new Map<string, number>();
  for (const row of tagCountsRaw) {
    if (row.nodeId) tagCountMap.set(row.nodeId, row.count);
  }

  // 2. Récupérer et classer tous les médias par priorité algorithmique
  const allNodes = await db.query.mediaNodes.findMany();
  const scoredNodes = allNodes
    .map((node) => ({
      node,
      score: computeMetadataNeedScore(node, tagCountMap.get(node.id) || 0),
    }))
    .sort((a, b) => b.score - a.score);

  const targetBatch = scoredNodes.slice(0, batchLimit);
  let enrichedCount = 0;

  for (const { node } of targetBatch) {
    try {
      let hasUpdate = false;
      const updates: Record<string, any> = { updatedAt: new Date() };

      // Détection de visuels adjacents locaux (.nfo, posters)
      if ((!node.posterPath || !node.fanartPath) && node.nfoFilePath) {
        const adjacent = await detectAdjacentFiles(node.nfoFilePath);
        if (!node.posterPath && adjacent.posterPath) {
          updates.posterPath = adjacent.posterPath;
          hasUpdate = true;
        }
        if (!node.fanartPath && adjacent.fanartPath) {
          updates.fanartPath = adjacent.fanartPath;
          hasUpdate = true;
        }
        if (!node.thumbPath && adjacent.thumbPath) {
          updates.thumbPath = adjacent.thumbPath;
          hasUpdate = true;
        }
      }

      let rawSearch = node.originalTitle || node.title;
      const parentId = node.parentId;
      if ((node.nodeType === 'EPISODE' || node.nodeType === 'SEASON') && parentId) {
        const parent = await db.query.mediaNodes.findFirst({
          where: (t, { eq: eqOp }) => eqOp(t.id, parentId as string),
        });
        if (parent?.title) rawSearch = parent.title;
      }

      const searchTitle = cleanShowTitle(rawSearch);
      const external = await fetchExternalMetadata(searchTitle, node.nodeType);

      if (external) {
        if ((!node.overview || node.overview.trim().length === 0) && external.overview) {
          updates.overview = external.overview;
          hasUpdate = true;
        }
        if (!node.tagline && external.tagline) {
          updates.tagline = external.tagline;
          hasUpdate = true;
        }
        if (!node.releaseYear && external.releaseYear) {
          updates.releaseYear = external.releaseYear;
          hasUpdate = true;
        }
        if (node.communityRating == null && external.communityRating) {
          updates.communityRating = external.communityRating;
          hasUpdate = true;
        }
        if (!node.posterPath && external.posterUrl) {
          updates.posterPath = external.posterUrl;
          hasUpdate = true;
        }
        if (!node.fanartPath && external.fanartUrl) {
          updates.fanartPath = external.fanartUrl;
          hasUpdate = true;
        }

        // Tags thématiques & descriptifs
        for (const g of external.genres) {
          await linkTagToNode(node.id, 'genre', g).catch(() => null);
        }
        for (const s of external.tags) {
          await linkTagToNode(node.id, 'subject', s).catch(() => null);
        }
        for (const st of external.studios) {
          await linkTagToNode(node.id, 'studio', st).catch(() => null);
        }
        for (const c of external.countries) {
          await linkTagToNode(node.id, 'country', c).catch(() => null);
        }
        if (external.certification) {
          await linkTagToNode(node.id, 'certification', external.certification).catch(() => null);
        }

        // Équipes artistiques et humaines
        for (const d of external.directors) {
          await linkTagToNode(node.id, 'director', d).catch(() => null);
        }
        for (const w of external.writers) {
          await linkTagToNode(node.id, 'writer', w).catch(() => null);
        }
        for (const p of external.producers) {
          await linkTagToNode(node.id, 'producer', p).catch(() => null);
        }
        for (const comp of external.composers) {
          await linkTagToNode(node.id, 'composer', comp).catch(() => null);
        }
        for (const a of external.actors) {
          await linkTagToNode(node.id, 'actor', a.name, a.role, a.thumb ? { thumbUrl: a.thumb } : {}).catch(
            () => null
          );
        }
      }

      // Traitement spécial et agressif pour les Sagas (COLLECTION) : enrichir également ses films enfants
      if (node.nodeType === 'COLLECTION') {
        const childMovies = await db.query.mediaNodes.findMany({
          where: (t, { eq: eqOp }) => eqOp(t.parentId, node.id),
        });

        for (const child of childMovies) {
          const childTagCount = tagCountMap.get(child.id) || 0;
          // Si le film enfant manque de données fondamentales ou de tags, on l'enrichit immédiatement
          if (!child.overview || childTagCount < 10) {
            const cleanChild = cleanShowTitle(child.originalTitle || child.title);
            const childExt = await fetchExternalMetadata(cleanChild, 'MOVIE');
            if (childExt) {
              const childUpdates: Record<string, any> = { updatedAt: new Date() };
              if (!child.overview && childExt.overview) childUpdates.overview = childExt.overview;
              if (!child.tagline && childExt.tagline) childUpdates.tagline = childExt.tagline;
              if (!child.releaseYear && childExt.releaseYear) childUpdates.releaseYear = childExt.releaseYear;
              if (child.communityRating == null && childExt.communityRating) {
                childUpdates.communityRating = childExt.communityRating;
              }
              if (!child.posterPath && childExt.posterUrl) childUpdates.posterPath = childExt.posterUrl;
              if (!child.fanartPath && childExt.fanartUrl) childUpdates.fanartPath = childExt.fanartUrl;

              if (Object.keys(childUpdates).length > 1) {
                await db.update(mediaNodes).set(childUpdates).where(eq(mediaNodes.id, child.id));
              }

              // Lier les tags complets au film enfant (qui remonteront dans la saga)
              for (const g of childExt.genres) await linkTagToNode(child.id, 'genre', g).catch(() => null);
              for (const s of childExt.tags) await linkTagToNode(child.id, 'subject', s).catch(() => null);
              for (const st of childExt.studios) await linkTagToNode(child.id, 'studio', st).catch(() => null);
              for (const c of childExt.countries) await linkTagToNode(child.id, 'country', c).catch(() => null);
              if (childExt.certification) {
                await linkTagToNode(child.id, 'certification', childExt.certification).catch(() => null);
              }
              for (const d of childExt.directors) await linkTagToNode(child.id, 'director', d).catch(() => null);
              for (const w of childExt.writers) await linkTagToNode(child.id, 'writer', w).catch(() => null);
              for (const p of childExt.producers) await linkTagToNode(child.id, 'producer', p).catch(() => null);
              for (const comp of childExt.composers) await linkTagToNode(child.id, 'composer', comp).catch(() => null);
              for (const a of childExt.actors) {
                await linkTagToNode(child.id, 'actor', a.name, a.role, a.thumb ? { thumbUrl: a.thumb } : {}).catch(
                  () => null
                );
              }
            }
            await new Promise((resolve) => setTimeout(resolve, 150));
          }
        }
      }

      if (hasUpdate) {
        await db.update(mediaNodes).set(updates).where(eq(mediaNodes.id, node.id));
        enrichedCount++;
      }

      // Pause de 200ms pour éviter tout blocage 429 Too Many Requests
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (nodeErr) {
      console.warn(`Enrichment skipped for media ${node.id}:`, nodeErr);
    }
  }

  return { processedCount: targetBatch.length, enrichedCount };
}
