import path from 'node:path';
import { db } from '../../db/connection.js';
import { mediaNodes } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { resolveSeriesRoot, resolveParentShowNodeId } from '../hierarchyResolver.js';
import { analyzeFolderGrouping } from '../folderGrouper.js';

export interface SiblingContext {
  parentShowNodeId?: string;
  parentShowTitle?: string;
  seasonNumber?: number;
  groupTitle?: string;
  isExtra?: boolean;
}

/**
 * Infère le contexte parent (Série, Saison, Collection) par voisinage physique déterministe
 */
export async function inferSiblingContext(filePath: string): Promise<SiblingContext> {
  const res: SiblingContext = {};

  const seriesCtx = await resolveSeriesRoot(filePath);
  if (seriesCtx) {
    const parentId = await resolveParentShowNodeId(filePath);
    if (parentId) {
      res.parentShowNodeId = parentId;
      const showNode = await db.query.mediaNodes.findFirst({
        where: (t, { eq: eOp }) => eOp(t.id, parentId),
      });
      if (showNode) {
        res.parentShowTitle = showNode.title;
      }
    } else {
      res.parentShowTitle = seriesCtx.showTitleCandidate;
    }

    const grouping = analyzeFolderGrouping(filePath, seriesCtx.showDir);
    if (grouping.seasonNumber !== undefined) res.seasonNumber = grouping.seasonNumber;
    if (grouping.groupTitle) res.groupTitle = grouping.groupTitle;
    if (grouping.isExtra) res.isExtra = true;
  }

  return res;
}
