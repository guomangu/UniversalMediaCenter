import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { eq, or, ilike, and, like } from 'drizzle-orm';
import { parseKaiEpisodeInfo, isTaintedArtwork, getKaiShowTitle } from './kaiPaceResolver.js';
import { generateSlug } from './slugify.js';

async function repairOnePieceKai() {
  console.log('🔄 Starting Database Resync & Repair for Kai / One Pace media...');

  // 1. Trouver ou créer la fiche maîtresse SHOW
  const showTitle = 'One Piece Kai';
  let showNode = await db.query.mediaNodes.findFirst({
    where: (t, { and: aOp, eq: eOp, ilike: iOp }) =>
      aOp(eOp(t.nodeType, 'SHOW'), iOp(t.title, showTitle)),
  });

  if (!showNode) {
    const slug = `${generateSlug(showTitle)}-show`;
    const [inserted] = await db
      .insert(mediaNodes)
      .values({
        nodeType: 'SHOW',
        title: showTitle,
        sortTitle: showTitle,
        slug: `${slug}-${Date.now().toString().slice(-4)}`,
        state: 'READY',
        releaseYear: 1999,
        overview: 'Version condensée fidèle au manga sans les scènes de remplissage.',
        posterPath: 'https://image.tmdb.org/t/p/w780/dum1wnm2vI5btf2pGg2rJ2n0gDk.jpg',
        fanartPath: 'https://image.tmdb.org/t/p/original/4Mt7iqhne9OPgEGc07RJtW0GngU.jpg',
      })
      .returning();
    showNode = inserted;
    console.log(`✅ Created parent SHOW node: "${showNode.title}" (${showNode.id})`);
  } else {
    // Nettoyer si le show parent avait hérité d'une affiche corrompue
    if (showNode.posterPath && (await isTaintedArtwork(showNode.posterPath))) {
      await db
        .update(mediaNodes)
        .set({
          posterPath: 'https://image.tmdb.org/t/p/w780/dum1wnm2vI5btf2pGg2rJ2n0gDk.jpg',
          fanartPath: 'https://image.tmdb.org/t/p/original/4Mt7iqhne9OPgEGc07RJtW0GngU.jpg',
        })
        .where(eq(mediaNodes.id, showNode.id));
      console.log(`🧹 Sanitized tainted poster on parent SHOW node`);
    }
  }

  // 2. Récupérer tous les épisodes liés à One Piece Kai / One Pace
  const nodes = await db.query.mediaNodes.findMany({
    where: (t, { or, like, ilike }) =>
      or(
        like(t.videoFilePath, '%one_piece_kai%'),
        like(t.nfoFilePath, '%one_piece_kai%'),
        ilike(t.title, '%guerra e pace%'),
        ilike(t.title, '%one pace%')
      ),
  });

  console.log(`Found ${nodes.length} potential Kai / Pace media nodes in database.`);

  let updatedCount = 0;
  let taintedPostersCleaned = 0;

  for (const node of nodes) {
    if (node.id === showNode.id) continue;

    const pathToCheck = node.videoFilePath || node.nfoFilePath || '';
    const kai = parseKaiEpisodeInfo(pathToCheck);
    if (!kai) continue;

    let cleanPoster = node.posterPath;
    let cleanThumb = node.thumbPath;

    if (cleanPoster && (await isTaintedArtwork(cleanPoster))) {
      cleanPoster = null;
      taintedPostersCleaned++;
    }
    if (cleanThumb && (await isTaintedArtwork(cleanThumb))) {
      cleanThumb = null;
    }

    await db
      .update(mediaNodes)
      .set({
        parentId: showNode.id,
        nodeType: 'EPISODE',
        title: kai.title,
        sortTitle: kai.title,
        orderIndex: kai.orderIndex,
        absoluteOrderIndex: kai.episode,
        posterPath: cleanPoster,
        thumbPath: cleanThumb,
        state: 'READY',
        updatedAt: new Date(),
      })
      .where(eq(mediaNodes.id, node.id));

    updatedCount++;
  }

  console.log(`🎉 Resync completed!`);
  console.log(`   - Episodes re-indexed & unified: ${updatedCount}`);
  console.log(`   - Tainted "Guerra e pace" posters cleaned: ${taintedPostersCleaned}`);
  process.exit(0);
}

repairOnePieceKai().catch((err) => {
  console.error('Error during repair:', err);
  process.exit(1);
});
