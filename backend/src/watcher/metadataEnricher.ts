import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { fetchExternalMetadata, cleanShowTitle } from './externalMetadata.js';
import { linkTagToNode } from './tagExtractor.js';
import { detectAdjacentFiles } from './mediaFileDetector.js';

export function computeMetadataNeedScore(node: any): number {
  let score = 0;
  if (!node.overview || node.overview.trim().length === 0) score += 10;
  if (!node.posterPath) score += 8;
  if (!node.releaseYear) score += 6;
  if (node.communityRating == null) score += 4;
  if (!node.tagline) score += 2;
  return score;
}

export async function enrichLibraryMetadata(batchLimit = 30): Promise<{
  processedCount: number;
  enrichedCount: number;
}> {
  const allNodes = await db.query.mediaNodes.findMany();
  const scoredNodes = allNodes
    .map((node) => ({ node, score: computeMetadataNeedScore(node) }))
    .sort((a, b) => b.score - a.score);

  const targetBatch = scoredNodes.slice(0, batchLimit);
  let enrichedCount = 0;

  for (const { node } of targetBatch) {
    try {
      let hasUpdate = false;
      const updates: Record<string, any> = { updatedAt: new Date() };

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
        if (!node.overview && external.overview) { updates.overview = external.overview; hasUpdate = true; }
        if (!node.tagline && external.tagline) { updates.tagline = external.tagline; hasUpdate = true; }
        if (!node.releaseYear && external.releaseYear) { updates.releaseYear = external.releaseYear; hasUpdate = true; }
        if (node.communityRating == null && external.communityRating) { updates.communityRating = external.communityRating; hasUpdate = true; }
        if (!node.posterPath && external.posterUrl) {
          updates.posterPath = external.posterUrl;
          hasUpdate = true;
        }
        for (const g of external.genres) {
          await linkTagToNode(node.id, 'genre', g).catch(() => null);
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
