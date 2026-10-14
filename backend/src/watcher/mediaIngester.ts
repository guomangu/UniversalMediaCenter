import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import type { ParsedNfo } from './types.js';
import { generateSlug } from './slugify.js';
import { linkTagToNode } from './tagExtractor.js';
import { detectAdjacentFiles } from './mediaFileDetector.js';
import { eq, and, ne, isNull, like } from 'drizzle-orm';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Résout le parentId (série ou saison parente) en inspectant la hiérarchie de dossiers
 */
async function resolveParentNodeId(nfoPath: string, parsed: ParsedNfo): Promise<string | null> {
  if (parsed.type === 'SHOW' || parsed.type === 'COLLECTION') {
    return null;
  }

  // 1. Recherche ascendante d'un tvshow.nfo ou season.nfo dans les dossiers parents
  let currentDir = path.dirname(nfoPath);
  for (let depth = 0; depth < 4; depth++) {
    const parentDir = path.dirname(currentDir);
    if (!parentDir || parentDir === currentDir) break;

    const candidateTvShow = path.join(parentDir, 'tvshow.nfo');
    try {
      await fs.access(candidateTvShow);
      const parentNode = await db.query.mediaNodes.findFirst({
        where: (t, { eq: eqOp }) => eqOp(t.nfoFilePath, candidateTvShow),
      });
      if (parentNode) return parentNode.id;
    } catch {
      // Pas de tvshow.nfo à ce niveau
    }

    currentDir = parentDir;
  }

  // 2. Recherche par showTitle si présent dans le NFO
  if (parsed.showTitle) {
    const showByTitle = await db.query.mediaNodes.findFirst({
      where: (t, { and: andOp, eq: eqOp, or: orOp }) =>
        andOp(
          eqOp(t.nodeType, 'SHOW'),
          orOp(eqOp(t.title, parsed.showTitle!), eqOp(t.sortTitle, parsed.showTitle!))
        ),
    });
    if (showByTitle) return showByTitle.id;
  }

  return null;
}

export async function ingestMediaNode(
  nfoPath: string,
  parsed: ParsedNfo,
  sha256: string
): Promise<string> {
  const slug = `${generateSlug(parsed.title)}-${parsed.year || 'media'}`;
  const sortTitle = parsed.sortTitle || parsed.title;
  const adjacent = await detectAdjacentFiles(nfoPath);

  const existing = await db.query.mediaNodes.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.nfoFilePath, nfoPath),
  });

  const parentId = await resolveParentNodeId(nfoPath, parsed);

  // Détermination de l'index d'ordre précis et non-dupliqué
  let orderIndex = 0;
  let absoluteOrderIndex: number | null = null;

  if (parsed.type === 'MOVIE') {
    orderIndex = parsed.episodeNumber ?? 0;
    absoluteOrderIndex = null;
  } else if (parsed.absoluteEpisodeNumber != null && parsed.absoluteEpisodeNumber > 0) {
    orderIndex = parsed.absoluteEpisodeNumber;
    absoluteOrderIndex = parsed.absoluteEpisodeNumber;
  } else if (parsed.episodeNumber != null && parsed.episodeNumber > 0) {
    if (parsed.seasonNumber && parsed.seasonNumber > 1) {
      orderIndex = parsed.seasonNumber * 1000 + parsed.episodeNumber;
      absoluteOrderIndex = parsed.seasonNumber * 1000 + parsed.episodeNumber;
    } else {
      orderIndex = parsed.episodeNumber;
      absoluteOrderIndex = parsed.episodeNumber;
    }
  } else if (parsed.seasonNumber != null && parsed.seasonNumber > 0) {
    orderIndex = parsed.seasonNumber;
  }

  let durationSeconds: number | undefined;
  if (parsed.streamDetails.durationSeconds) {
    durationSeconds = parsed.streamDetails.durationSeconds;
  } else if (parsed.runtime) {
    durationSeconds = parsed.runtime * 60;
  }

  let premieredDate: Date | undefined;
  if (parsed.premiered) {
    const d = new Date(parsed.premiered);
    if (!isNaN(d.getTime())) premieredDate = d;
  }

  let nodeId: string;
  const payload = {
    parentId: parentId || (existing?.parentId ?? undefined),
    nodeType: parsed.type,
    title: parsed.title,
    originalTitle: parsed.originalTitle,
    sortTitle,
    orderIndex,
    absoluteOrderIndex,
    tagline: parsed.tagline,
    overview: parsed.plot || parsed.outline,
    releaseYear: parsed.year,
    premieredDate,
    runtimeSeconds: durationSeconds,
    communityRating: parsed.rating,
    chaptersJson: parsed.chapters,
    nfoSha256: sha256,
    videoFilePath: adjacent.videoFilePath,
    posterPath: adjacent.posterPath,
    fanartPath: adjacent.fanartPath,
    clearlogoPath: adjacent.clearlogoPath,
    thumbPath: adjacent.thumbPath,
    state: 'READY' as const,
    updatedAt: new Date(),
  };

  if (existing) {
    nodeId = existing.id;
    await db.update(mediaNodes).set(payload).where(eq(mediaNodes.id, nodeId));
  } else {
    const [inserted] = await db
      .insert(mediaNodes)
      .values({
        slug: `${slug}-${Date.now().toString().slice(-4)}`,
        nfoFilePath: nfoPath,
        ...payload,
      })
      .returning();
    nodeId = inserted.id;
  }

  // Si c'est une série (SHOW), rattacher immédiatement tous les enfants orphelins sous son répertoire
  if (parsed.type === 'SHOW') {
    const showDir = path.dirname(nfoPath);
    await db
      .update(mediaNodes)
      .set({ parentId: nodeId })
      .where(
        and(
          isNull(mediaNodes.parentId),
          ne(mediaNodes.id, nodeId),
          like(mediaNodes.nfoFilePath, `${showDir}/%`)
        )
      );
  }

  // 1. Tags thématiques et descriptifs
  for (const g of parsed.genres) await linkTagToNode(nodeId, 'genre', g);
  for (const s of parsed.tags) await linkTagToNode(nodeId, 'subject', s);
  for (const st of parsed.studios) await linkTagToNode(nodeId, 'studio', st);
  for (const c of parsed.countries) await linkTagToNode(nodeId, 'country', c);
  if (parsed.certification) await linkTagToNode(nodeId, 'certification', parsed.certification);
  if (parsed.folderTitle) await linkTagToNode(nodeId, 'arc', parsed.folderTitle);

  // 2. Équipes humaines et artistiques (Réalisateurs, Scénaristes, Compositeurs, Producteurs, Acteurs)
  for (const d of parsed.directors) await linkTagToNode(nodeId, 'director', d);
  for (const w of parsed.writers) await linkTagToNode(nodeId, 'writer', w);
  if (parsed.producers) {
    for (const p of parsed.producers) await linkTagToNode(nodeId, 'producer', p);
  }
  if (parsed.composers) {
    for (const comp of parsed.composers) await linkTagToNode(nodeId, 'composer', comp);
  }
  for (const a of parsed.actors) {
    await linkTagToNode(nodeId, 'actor', a.name, a.role, a.thumb ? { thumbUrl: a.thumb } : {});
  }

  // 3. Spécifications techniques & flux (Codecs, résolutions, canaux, sous-titres)
  const sd = parsed.streamDetails;
  if (sd.videoQuality) await linkTagToNode(nodeId, 'video_quality', sd.videoQuality);
  if (sd.videoCodec) await linkTagToNode(nodeId, 'video_codec', sd.videoCodec.toUpperCase());
  if (sd.aspectRatio) await linkTagToNode(nodeId, 'aspect_ratio', sd.aspectRatio);

  for (const audio of sd.audioTracks) {
    if (audio.language) await linkTagToNode(nodeId, 'audio_language', audio.language.toUpperCase());
    if (audio.codec) await linkTagToNode(nodeId, 'audio_codec', audio.codec.toUpperCase());
    if (audio.channels) {
      const chLabel = audio.channels >= 6 ? (audio.channels === 8 ? '7.1' : '5.1') : `${audio.channels}.0`;
      await linkTagToNode(nodeId, 'audio_channels', chLabel);
    }
  }

  for (const sub of sd.subtitleTracks) {
    if (sub.language) await linkTagToNode(nodeId, 'subtitle_language', sub.language.toUpperCase());
    if (sub.codec) await linkTagToNode(nodeId, 'subtitle_codec', sub.codec.toUpperCase());
  }

  // 4. Champs personnalisés EAV
  for (const [key, val] of Object.entries(parsed.customFields)) {
    await linkTagToNode(nodeId, `custom_${key.toLowerCase()}`, val);
  }

  // 5. Moteur de recherche plein texte unifié (pg_trgm)
  const searchComponents = [
    parsed.title,
    parsed.originalTitle || '',
    parsed.folderTitle || '',
    ...parsed.genres,
    ...parsed.tags,
    ...parsed.directors,
    ...parsed.writers,
    ...(parsed.composers || []),
    ...parsed.actors.map((a) => `${a.name} ${a.role || ''}`),
    sd.videoQuality || '',
    sd.videoCodec || '',
    ...sd.audioTracks.map((a) => a.language || ''),
    ...sd.subtitleTracks.map((s) => s.language || ''),
  ];

  await db
    .update(mediaNodes)
    .set({ searchVectorText: searchComponents.filter(Boolean).join(' ') })
    .where(eq(mediaNodes.id, nodeId));

  return nodeId;
}
