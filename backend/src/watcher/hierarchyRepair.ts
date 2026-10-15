import path from 'node:path';
import fs from 'node:fs/promises';
import { db } from '../db/connection.js';
import { mediaNodes, nodeEavLinks } from '../db/schema/index.js';
import { eq, and, ne, isNull, sql, inArray } from 'drizzle-orm';
import { resolveParentShowNodeId, resolveSeriesRoot, findOrCreateCollectionNode, cleanShowFolderName, detectSagaNameFromFolder } from './hierarchyResolver.js';
import { analyzeFolderGrouping, isExtraMediaFile } from './folderGrouper.js';
import { parseSeasonEpisode } from './seasonEpisodeHelper.js';
import { sanitizeReleaseTags, extractYearFromText, extractCanonicalShowTitle, normalizePhoneticSpelling } from './titleCleaner.js';
import { fetchExternalMetadata } from './externalMetadata.js';
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
  requalifiedEpisodes: number;
  consolidatedShows: number;
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
    requalifiedEpisodes: 0,
    consolidatedShows: 0,
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

  // 3. Requalification des faux films (MOVIE) portant des codes formels d'épisodes (SxxExx, Saison X)
  const misclassifiedMovies = await db.query.mediaNodes.findMany({
    where: (t, { eq: eOp }) => eOp(t.nodeType, 'MOVIE'),
  });

  for (const movieNode of misclassifiedMovies) {
    const filePath = movieNode.videoFilePath || movieNode.nfoFilePath || '';
    const fileName = path.basename(filePath);
    const hasEpCode =
      /S\d+[\s._-]*E\d+|\b\d+x\d+\b/i.test(movieNode.title) ||
      /S\d+[\s._-]*E\d+|\b\d+x\d+\b/i.test(fileName) ||
      /(?:^|\/|[ _-])(?:saison|season)\s*\d+/i.test(filePath);

    if (hasEpCode) {
      // Extraction saison et épisode
      const seMatch =
        movieNode.title.match(/S(\d+)[\s._-]*E(\d+)/i) ||
        fileName.match(/S(\d+)[\s._-]*E(\d+)/i) ||
        filePath.match(/S(\d+)[\s._-]*E(\d+)/i);

      let effSeason: number | undefined = seMatch ? parseInt(seMatch[1], 10) : undefined;
      let effEpisode: number | undefined = seMatch ? parseInt(seMatch[2], 10) : undefined;

      if (effSeason === undefined || effEpisode === undefined) {
        const xMatch = movieNode.title.match(/\b(\d{1,2})x(\d{1,3})\b/i) || fileName.match(/\b(\d{1,2})x(\d{1,3})\b/i);
        if (xMatch) {
          effSeason = parseInt(xMatch[1], 10);
          effEpisode = parseInt(xMatch[2], 10);
        }
      }

      if (effSeason === undefined) {
        const sFolderMatch = filePath.match(/(?:saison|season)\s*0*(\d{1,2})/i);
        if (sFolderMatch) effSeason = parseInt(sFolderMatch[1], 10);
      }

      effSeason = effSeason || 1;
      effEpisode = effEpisode || 1;

      const orderIndex = effSeason > 1 ? effSeason * 1000 + effEpisode : effEpisode;
      const targetParentId = await resolveParentShowNodeId(filePath);

      await db
        .update(mediaNodes)
        .set({
          nodeType: 'EPISODE',
          parentId: targetParentId,
          orderIndex,
          absoluteOrderIndex: effEpisode,
          title: sanitizeReleaseTags(movieNode.title),
          sortTitle: sanitizeReleaseTags(movieNode.title),
          updatedAt: new Date(),
        })
        .where(eq(mediaNodes.id, movieNode.id));

      movieNode.nodeType = 'EPISODE';
      movieNode.parentId = targetParentId;
      movieNode.orderIndex = orderIndex;
      report.requalifiedEpisodes++;
      report.reparented++;
    }
  }

  // 4. Déduplication et consolidation canonique des SHOWs fragmentés ("Peaky Blinders - Saison 1 360p", etc.)
  const allShows = await db.query.mediaNodes.findMany({
    where: (t, { eq: eOp }) => eOp(t.nodeType, 'SHOW'),
  });

  const showGroups = new Map<string, typeof allShows>();
  for (const show of allShows) {
    const canonical = extractCanonicalShowTitle(show.title);
    const phoneticKey = normalizePhoneticSpelling(canonical).toLowerCase().trim() || canonical.toLowerCase().trim();
    if (!showGroups.has(phoneticKey)) showGroups.set(phoneticKey, []);
    showGroups.get(phoneticKey)!.push(show);
  }

  for (const [key, group] of showGroups.entries()) {
    if (group.length === 0) continue;
    const canonicalTitle = extractCanonicalShowTitle(group[0].title) || group[0].title;

    // Déterminer ou promouvoir le Master SHOW (priorité au show avec poster TMDb officiel ou titre canonique propre)
    let masterShow = group.find((s) => s.posterPath && s.communityRating);
    if (!masterShow) {
      masterShow = group.find((s) => s.title.toLowerCase().trim() === canonicalTitle.toLowerCase().trim());
    }
    if (!masterShow) {
      masterShow = group[0];
      await db
        .update(mediaNodes)
        .set({
          title: canonicalTitle,
          sortTitle: canonicalTitle,
          updatedAt: new Date(),
        })
        .where(eq(mediaNodes.id, masterShow.id));
      masterShow.title = canonicalTitle;
      masterShow.sortTitle = canonicalTitle;
    }

    // Reparenter tous les enfants des faux SHOWs secondaires vers le master
    for (const otherShow of group) {
      if (otherShow.id === masterShow.id) continue;

      // Déplacer les épisodes
      await db
        .update(mediaNodes)
        .set({ parentId: masterShow.id, updatedAt: new Date() })
        .where(eq(mediaNodes.parentId, otherShow.id));

      // Migrer les liens EAV sans violer la contrainte unique
      await db.execute(sql`
        UPDATE node_eav_links SET node_id = ${masterShow.id}::uuid
        WHERE node_id = ${otherShow.id}::uuid
        AND value_id NOT IN (
          SELECT value_id FROM node_eav_links WHERE node_id = ${masterShow.id}::uuid
        )
      `);
      await db.execute(sql`
        DELETE FROM node_eav_links WHERE node_id = ${otherShow.id}::uuid
      `);

      // Supprimer le pseudo-show devenu redondant
      await db.delete(mediaNodes).where(eq(mediaNodes.id, otherShow.id));
      report.consolidatedShows++;
    }

    // Enrichir le master SHOW avec TMDb s'il manque de métadonnées visuelles ou narratives
    if (!masterShow.posterPath || !masterShow.overview) {
      try {
        const ext = await fetchExternalMetadata(canonicalTitle, 'SHOW');
        if (ext) {
          const updates: Record<string, any> = { updatedAt: new Date() };
          if (!masterShow.posterPath && ext.posterUrl) updates.posterPath = ext.posterUrl;
          if (!masterShow.fanartPath && ext.fanartUrl) updates.fanartPath = ext.fanartUrl;
          if (!masterShow.overview && ext.overview) updates.overview = ext.overview;
          if (!masterShow.tagline && ext.tagline) updates.tagline = ext.tagline;
          if (!masterShow.releaseYear && ext.releaseYear) updates.releaseYear = ext.releaseYear;
          if (masterShow.communityRating == null && ext.communityRating) updates.communityRating = ext.communityRating;

          await db.update(mediaNodes).set(updates).where(eq(mediaNodes.id, masterShow.id));

          for (const a of ext.actors || []) {
            await linkTagToNode(masterShow.id, 'actor', a.name, a.role, a.thumb ? { thumbUrl: a.thumb } : {}).catch(() => null);
          }
          for (const d of ext.directors || []) {
            await linkTagToNode(masterShow.id, 'director', d).catch(() => null);
          }
          for (const g of ext.genres || []) {
            await linkTagToNode(masterShow.id, 'genre', g).catch(() => null);
          }
        }
      } catch {}
    }
  }

  // 5. Récupérer tous les noeuds médias locaux non-LIVE
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

    // Requalification des bonus / coulisses / samples en EXTRA
    if (isExtraMediaFile(filePath) && (node.nodeType !== 'EXTRA' || !node.isExtra)) {
      await db
        .update(mediaNodes)
        .set({
          nodeType: 'EXTRA',
          isExtra: true,
          updatedAt: new Date(),
        })
        .where(eq(mediaNodes.id, node.id));
      node.nodeType = 'EXTRA';
      node.isExtra = true;
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
            const cleanTitle = sanitizeReleaseTags(rawTitle);
            if (cleanTitle && cleanTitle !== node.title && !/1080p|720p|x264|bluray/i.test(cleanTitle)) {
              movieUpdates.title = cleanTitle;
              movieUpdates.sortTitle = cleanTitle.replace(/^(le|la|les|the|l')\s+/i, '').trim() || cleanTitle;
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

      // Rattachement par dossier si aucune balise <set> n'était présente
      if (!node.parentId) {
        const folderSaga = detectSagaNameFromFolder(filePath);
        if (folderSaga) {
          const colNode = await findOrCreateCollectionNode(folderSaga);
          if (colNode) {
            const movieYear = node.releaseYear || (node.premieredDate ? new Date(node.premieredDate).getFullYear() : 0);
            movieUpdates.parentId = colNode.id;
            movieUpdates.orderIndex = movieYear || node.orderIndex;
            report.moviesLinkedToSagas++;
            node.parentId = colNode.id;
          }
        }
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

  // 6. Rattachement des Méta-Franchises & Univers Partagés (Terre du Milieu, Rockyverse...)
  const allCollections = await db.query.mediaNodes.findMany({
    where: (t, { eq: eqOp }) => eqOp(t.nodeType, 'COLLECTION'),
  });

  // LOTR + Hobbit => Univers Terre du Milieu (Middle-Earth)
  const lotrHobbitRegex = /(seigneur des anneaux|lord of the rings|hobbit|terre du milieu)/i;
  const middleEarthCols = allCollections.filter((c) => lotrHobbitRegex.test(c.title));

  if (middleEarthCols.length > 0) {
    const universeTitle = 'Univers Terre du Milieu - Saga';
    let universeNode = allCollections.find((c) => c.title.toLowerCase() === universeTitle.toLowerCase());

    if (!universeNode) {
      const uSlug = `univers-terre-du-milieu-collection-${Date.now().toString().slice(-4)}`;
      const [createdUni] = await db
        .insert(mediaNodes)
        .values({
          nodeType: 'COLLECTION',
          title: universeTitle,
          sortTitle: 'Terre du Milieu',
          slug: uSlug,
          state: 'READY',
          confidenceScore: 1.0,
          overview: "L'univers étendu complet de la Terre du Milieu imaginé par J.R.R. Tolkien, comprenant la trilogie du Seigneur des Anneaux et la trilogie du Hobbit.",
          updatedAt: new Date(),
        })
        .returning();
      universeNode = createdUni;
    }

    if (universeNode) {
      // Rattacher tous les films LOTR et Hobbit à cet univers
      const allMovies = await db.query.mediaNodes.findMany({
        where: (t, { eq: eqOp }) => eqOp(t.nodeType, 'MOVIE'),
      });
      for (const m of allMovies) {
        if (lotrHobbitRegex.test(m.title) || lotrHobbitRegex.test(m.originalTitle || '')) {
          if (m.parentId !== universeNode.id) {
            await db
              .update(mediaNodes)
              .set({ parentId: universeNode.id, updatedAt: new Date() })
              .where(eq(mediaNodes.id, m.id));
            report.moviesLinkedToSagas++;
          }
        }
      }
    }
  }

  return report;
}
