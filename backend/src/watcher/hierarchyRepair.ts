import path from 'node:path';
import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { eq, and, ne, isNull, sql } from 'drizzle-orm';
import { resolveParentShowNodeId, resolveSeriesRoot } from './hierarchyResolver.js';
import { analyzeFolderGrouping } from './folderGrouper.js';
import { parseSeasonEpisode } from './seasonEpisodeHelper.js';

export interface RepairHierarchyReport {
  inspected: number;
  reparented: number;
  fixedOrders: number;
  cleanedExtras: number;
  cleanedOrphans: number;
}

/**
 * Réconcilie et répare de façon déterministe toute la hiérarchie des séries, saisons et épisodes
 */
export async function repairAllMediaHierarchy(): Promise<RepairHierarchyReport> {
  const report: RepairHierarchyReport = {
    inspected: 0,
    reparented: 0,
    fixedOrders: 0,
    cleanedExtras: 0,
    cleanedOrphans: 0,
  };

  // 1. Nettoyer les noeuds de type SEASON (qui proviennent de season.nfo et ne sont pas des médias jouables)
  // et retirer tout videoFilePath erroné sur les SHOWs
  await db.execute(sql`
    DELETE FROM media_nodes WHERE node_type = 'SEASON';
    UPDATE media_nodes SET video_file_path = NULL WHERE node_type = 'SHOW' AND video_file_path IS NOT NULL;
  `);

  // 2. Récupérer tous les noeuds médias locaux non-LIVE
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

    // Résolution du vrai SHOW parent
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

      if (grouping.isMovie && node.nodeType !== 'MOVIE') {
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

  // 3. Nettoyage des SHOWs orphelins vides (sans aucun enfant et sans fichiers)
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
