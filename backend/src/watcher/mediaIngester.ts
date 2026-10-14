import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import type { ParsedNfo } from './types.js';
import { generateSlug } from './slugify.js';
import { linkTagToNode } from './tagExtractor.js';
import { detectAdjacentFiles } from './mediaFileDetector.js';
import { eq } from 'drizzle-orm';

export async function ingestMediaNode(
  nfoPath: string,
  parsed: ParsedNfo,
  sha256: string
): Promise<string> {
  const slug = `${generateSlug(parsed.title)}-${parsed.year || 'media'}`;
  const sortTitle = parsed.sortTitle || parsed.title;
  const adjacent = await detectAdjacentFiles(nfoPath);

  const existing = await db.query.mediaNodes.findFirst({
    where: (t, { eq }) => eq(t.nfoFilePath, nfoPath),
  });

  let nodeId: string;
  const payload = {
    nodeType: parsed.type,
    title: parsed.title,
    originalTitle: parsed.originalTitle,
    sortTitle,
    orderIndex: parsed.episodeNumber ?? parsed.seasonNumber ?? 0,
    tagline: parsed.tagline,
    overview: parsed.plot,
    releaseYear: parsed.year,
    runtimeSeconds: parsed.runtime ? parsed.runtime * 60 : undefined,
    communityRating: parsed.rating,
    chaptersJson: parsed.chapters,
    nfoSha256: sha256,
    videoFilePath: adjacent.videoFilePath,
    posterPath: adjacent.posterPath,
    fanartPath: adjacent.fanartPath,
    clearlogoPath: adjacent.clearlogoPath,
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

  for (const g of parsed.genres) await linkTagToNode(nodeId, 'genre', g);
  for (const s of parsed.tags) await linkTagToNode(nodeId, 'subject', s);
  for (const st of parsed.studios) await linkTagToNode(nodeId, 'studio', st);
  for (const c of parsed.countries) await linkTagToNode(nodeId, 'country', c);
  for (const d of parsed.directors) await linkTagToNode(nodeId, 'director', d);
  for (const w of parsed.writers) await linkTagToNode(nodeId, 'writer', w);
  for (const a of parsed.actors) {
    await linkTagToNode(nodeId, 'actor', a.name, a.role, a.thumb ? { thumbUrl: a.thumb } : {});
  }
  for (const [key, val] of Object.entries(parsed.customFields)) {
    await linkTagToNode(nodeId, `custom_${key.toLowerCase()}`, val);
  }

  const searchComponents = [
    parsed.title,
    parsed.originalTitle || '',
    ...parsed.genres,
    ...parsed.tags,
    ...parsed.directors,
    ...parsed.actors.map((a) => `${a.name} ${a.role || ''}`),
  ];
  await db
    .update(mediaNodes)
    .set({ searchVectorText: searchComponents.filter(Boolean).join(' ') })
    .where(eq(mediaNodes.id, nodeId));

  return nodeId;
}
