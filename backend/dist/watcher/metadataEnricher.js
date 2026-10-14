import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { fetchExternalMetadata } from './externalMetadata.js';
import { linkTagToNode } from './tagExtractor.js';
import { detectAdjacentFiles } from './mediaFileDetector.js';
export function computeMetadataNeedScore(node) {
    let score = 0;
    if (!node.overview || node.overview.trim().length === 0)
        score += 10;
    if (!node.posterPath)
        score += 8;
    if (!node.releaseYear)
        score += 6;
    if (node.communityRating == null)
        score += 4;
    if (!node.tagline)
        score += 2;
    return score;
}
export async function enrichLibraryMetadata(batchLimit = 30) {
    const allNodes = await db.query.mediaNodes.findMany();
    const scoredNodes = allNodes
        .map((node) => ({ node, score: computeMetadataNeedScore(node) }))
        .sort((a, b) => b.score - a.score);
    const targetBatch = scoredNodes.slice(0, batchLimit);
    let enrichedCount = 0;
    for (const { node } of targetBatch) {
        let hasUpdate = false;
        const updates = { updatedAt: new Date() };
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
        const rawSearch = node.originalTitle || node.title;
        const searchTitle = rawSearch.split(' - S')[0].replace(/\s*-\s*iNTEGRALE.*/i, '').trim();
        const external = await fetchExternalMetadata(searchTitle, node.nodeType);
        if (external) {
            if (external.overview) {
                updates.overview = external.overview;
                hasUpdate = true;
            }
            if (external.tagline) {
                updates.tagline = external.tagline;
                hasUpdate = true;
            }
            if (external.releaseYear) {
                updates.releaseYear = external.releaseYear;
                hasUpdate = true;
            }
            if (external.communityRating) {
                updates.communityRating = external.communityRating;
                hasUpdate = true;
            }
            if (!node.posterPath && external.posterUrl) {
                updates.posterPath = external.posterUrl;
                hasUpdate = true;
            }
            for (const g of external.genres) {
                await linkTagToNode(node.id, 'genre', g);
            }
        }
        if (hasUpdate) {
            await db.update(mediaNodes).set(updates).where(eq(mediaNodes.id, node.id));
            enrichedCount++;
        }
    }
    return { processedCount: targetBatch.length, enrichedCount };
}
