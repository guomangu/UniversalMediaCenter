import path from 'node:path';
import fs from 'node:fs/promises';
import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { eq, and, ne, isNull, sql } from 'drizzle-orm';
import { resolveParentShowNodeId, resolveSeriesRoot, findOrCreateCollectionNode, cleanShowFolderName } from './hierarchyResolver.js';
import { analyzeFolderGrouping } from './folderGrouper.js';
import { parseSeasonEpisode } from './seasonEpisodeHelper.js';
import { sanitizeReleaseTags, extractYearFromText } from './titleCleaner.js';
import { generateSlug } from './slugify.js';
import { linkTagToNode } from './tagExtractor.js';

export interface RepairHierarchyReport {
  inspected: number;
  reparented: number;
  fixedOrders: number;
  cleanedExtras: number;
  cleanedOrphans: number;
  healedShows: number;
  moviesLinkedToSagas: number;
}

/**
 * Réconcilie et répare de façon déterministe toute la hiérarchie des séries, saisons, épisodes ET sagas
 */
export async function repairAllMediaHierarchy(): Promise<RepairHierarchyReport> {
  const report: RepairHierarchyReport = {
    inspected: 0,
    reparented: 0,
    fixedOrders: 0,
    cleanedExtras: 0,
    cleanedOrphans: 0,
    healedShows: 0,
    moviesLinkedToSagas: 0,
  };

  // 1. Nettoyer les noeuds de type SEASON (qui proviennent de season.nfo et ne sont pas des médias jouables)
  // et retirer tout videoFilePath erroné sur les SHOWs
  await db.execute(sql`
    DELETE FROM media_nodes WHERE node_type = 'SEASON';
    UPDATE media_nodes SET video_file_path = NULL WHERE node_type = 'SHOW' AND video_file_path IS NOT NULL;
  `);

  // 2. Guérison des SHOWs corrompus avec le titre erroné "Épisode -1"
  const corruptedShows = await db.query.mediaNodes.findMany({
    where: (t, { and: aOp, eq: eOp }) => aOp(eOp(t.nodeType, 'SHOW'), eOp(t.title, 'Épisode -1')),
  });

  for (const show of corruptedShows) {
    let recoveredTitle: string | undefined;

    if (show.nfoFilePath) {
      try {
        const content = await fs.readFile(show.nfoFilePath, 'utf-8');
        const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          recoveredTitle = titleMatch[1].trim();
        }
      } catch {}

      if (!recoveredTitle) {
        recoveredTitle = cleanShowFolderName(path.basename(path.dirname(show.nfoFilePath)));
      }
    }

    if (recoveredTitle && recoveredTitle !== 'Épisode -1') {
      const cleanSort = recoveredTitle.replace(/^(le|la|les|the|l')\s+/i, '').trim() || recoveredTitle;
      const baseSlug = generateSlug(recoveredTitle) || 'show';
      await db
        .update(mediaNodes)
        .set({
          title: recoveredTitle,
          sortTitle: cleanSort,
          slug: `${baseSlug}-show-${Date.now().toString().slice(-4)}`,
          updatedAt: new Date(),
        })
        .where(eq(mediaNodes.id, show.id));
      report.healedShows++;
    }
  }

  // 3. Récupérer tous les noeuds médias locaux non-LIVE
  const allNodes = await db.query.mediaNodes.findMany({
    where: (t, { ne: neOp }) => neOp(t.nodeType, 'LIVE_CHANNEL'),
  });

  for (const node of allNodes) {
    if (node.nodeType === 'SHOW' || node.nodeType === 'COLLECTION') {
      continue;
    }

    const filePath = node.nfoFilePath || node.videoFilePath;
    if (!filePath || filePath.startsWith('http://') || filePath.startsWith('https://')) {
      continue;
    }

    // Ignorer les fichiers de trickplay résiduels
    if (filePath.includes('/.trickplay/') || filePath.endsWith('.bif')) {
      await db.delete(mediaNodes).where(eq(mediaNodes.id, node.id));
      report.cleanedOrphans++;
      continue;
    }

    report.inspected++;

    // A. Si c'est un film (MOVIE), vérifier s'il doit être rattaché à une COLLECTION (Saga) et restaurer le titre localisé
    if (node.nodeType === 'MOVIE') {
      const movieUpdates: Record<string, any> = {};
      if (node.nfoFilePath) {
        try {
          const content = await fs.readFile(node.nfoFilePath, 'utf-8');
          const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            const rawTitle = titleMatch[1].trim();
            if (rawTitle && rawTitle !== node.title && !/1080p|720p|x264|bluray/i.test(rawTitle)) {
              movieUpdates.title = rawTitle;
              movieUpdates.sortTitle = rawTitle.replace(/^(le|la|les|the|l')\s+/i, '').trim() || rawTitle;
            }
          }

          if (!node.parentId) {
            const setMatch = content.match(/<set[^>]*>[\s\S]*?<name>([^<]+)<\/name>/i) || content.match(/<set[^>]*>([^<]+)<\/set>/i);
            const colName = setMatch ? setMatch[1]?.trim() : undefined;
            if (colName) {
              const colNode = await findOrCreateCollectionNode(colName);
              if (colNode) {
                const movieYear = node.releaseYear || (node.premieredDate ? new Date(node.premieredDate).getFullYear() : 0);
                movieUpdates.parentId = colNode.id;
                movieUpdates.orderIndex = movieYear || node.orderIndex;
                report.moviesLinkedToSagas++;
                node.parentId = colNode.id;
              }
            }
          }
        } catch {}
      }

      if (Object.keys(movieUpdates).length > 0) {
        movieUpdates.updatedAt = new Date();
        await db.update(mediaNodes).set(movieUpdates).where(eq(mediaNodes.id, node.id));
      }
      continue;
    }

    // B. Pour les épisodes : résolution du vrai SHOW parent
    const legitimateParentId = await resolveParentShowNodeId(filePath);
    const seriesCtx = await resolveSeriesRoot(filePath);

    let needsUpdate = false;
    const updates: Record<string, any> = { updatedAt: new Date() };

    if (legitimateParentId && legitimateParentId !== node.parentId) {
      updates.parentId = legitimateParentId;
      needsUpdate = true;
      report.reparented++;
    }

    if (seriesCtx) {
      const grouping = analyzeFolderGrouping(filePath, seriesCtx.showDir);

      // Correction des faux extras
      if (grouping.isExtra) {
        if (!node.isExtra) {
          updates.isExtra = true;
          updates.extraType = grouping.extraType || 'featurette';
          needsUpdate = true;
        }
      } else if (node.isExtra) {
        updates.isExtra = false;
        updates.extraType = null;
        needsUpdate = true;
        report.cleanedExtras++;
      }

      if (grouping.isMovie && (node.nodeType as string) !== 'MOVIE') {
        updates.nodeType = 'MOVIE';
        needsUpdate = true;
      }

      // Vérification et recalcul de l'index d'ordre et de l'index absolu pour éviter toute collision
      const seInfo = parseSeasonEpisode(node.title, node.orderIndex);
      const effSeason = grouping.seasonNumber ?? seInfo?.season ?? (node.orderIndex >= 1000 ? Math.floor(node.orderIndex / 1000) : 1);
      const effEpisode = seInfo?.episode ?? (node.orderIndex >= 1000 ? node.orderIndex % 1000 : (node.absoluteOrderIndex ?? node.orderIndex));

      let targetOrder = node.orderIndex;
      let targetAbsolute = node.absoluteOrderIndex;

      if (effSeason > 1 && effSeason < 990 && effEpisode > 0) {
        targetOrder = effSeason * 1000 + effEpisode;
        targetAbsolute = effEpisode; // L'épisode 2 de la saison 2 est l'épisode 2, jamais 2002 !
      } else if (effSeason === 1 && effEpisode > 0) {
        targetOrder = effEpisode;
        targetAbsolute = effEpisode;
      } else if (effSeason === 998 && effEpisode > 0) {
        targetOrder = 998000 + effEpisode;
        targetAbsolute = effEpisode;
      }

      if (targetOrder !== node.orderIndex) {
        updates.orderIndex = targetOrder;
        needsUpdate = true;
        report.fixedOrders++;
      }

      if (targetAbsolute !== node.absoluteOrderIndex) {
        updates.absoluteOrderIndex = targetAbsolute;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await db.update(mediaNodes).set(updates).where(eq(mediaNodes.id, node.id));
    }
  }

  // 4. Rattachement des Méta-Franchises & Univers Partagés (Terre du Milieu, Rockyverse...)
  const allCollections = await db.query.mediaNodes.findMany({
    where: (t, { eq: eqOp }) => eqOp(t.nodeType, 'COLLECTION'),
  });

  for (const col of allCollections) {
    const t = col.title.toLowerCase();
    if (t.includes('seigneur des anneaux') || t.includes('hobbit') || t.includes('rings') || t.includes('middle-earth')) {
      await linkTagToNode(col.id, 'universe', 'Terre du Milieu').catch(() => null);
      await linkTagToNode(col.id, 'franchise', 'Terre du Milieu').catch(() => null);
    } else if (t.includes('rocky') || t.includes('creed')) {
      await linkTagToNode(col.id, 'universe', 'Rocky Universe').catch(() => null);
      await linkTagToNode(col.id, 'franchise', 'Rocky Universe').catch(() => null);
    } else if (t.includes('banlieue 13')) {
      await linkTagToNode(col.id, 'universe', 'Banlieue 13 Saga').catch(() => null);
    } else if (t.includes('equalizer')) {
      await linkTagToNode(col.id, 'universe', 'The Equalizer').catch(() => null);
    }
  }

  // 5. Nettoyage des SHOWs orphelins vides (sans aucun enfant et sans fichiers)
  const emptyShows = await db.execute(sql`
    SELECT s.id, s.title
    FROM media_nodes s
    LEFT JOIN media_nodes c ON c.parent_id = s.id
    WHERE s.node_type = 'SHOW'
      AND s.video_file_path IS NULL
      AND s.nfo_file_path IS NULL
      AND c.id IS NULL
  `);

  for (const row of Array.from(emptyShows) as any[]) {
    await db.delete(mediaNodes).where(eq(mediaNodes.id, row.id));
    report.cleanedOrphans++;
  }

  return report;
}
