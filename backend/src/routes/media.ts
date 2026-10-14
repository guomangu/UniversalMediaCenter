import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { mediaNodes, watchProgress } from '../db/schema/index.js';
import { sql } from 'drizzle-orm';
import { artworkRouter } from './mediaArtworks.js';
import { streamRouter } from './mediaStream.js';
import { statsRouter } from './mediaStats.js';
import { subtitleRouter } from './mediaSubtitles.js';
import { processNfoFile } from '../watcher/index.js';
import { getRelatedTagsForMedia } from './mediaRelated.js';

export const mediaRouter = new Hono();

mediaRouter.route('/', artworkRouter);
mediaRouter.route('/', streamRouter);
mediaRouter.route('/', statsRouter);
mediaRouter.route('/', subtitleRouter);

mediaRouter.post('/webhook/tmm', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const filePath = body.path || body.filePath;
  if (filePath && typeof filePath === 'string' && filePath.endsWith('.nfo')) {
    await processNfoFile(filePath);
    return c.json({ success: true, reindexed: filePath });
  }
  return c.json({ success: true, message: 'TMM webhook reçu' });
});

mediaRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const media = await db.query.mediaNodes.findFirst({
    where: (t, { or, eq }) => or(eq(t.id, id), eq(t.slug, id)),
  });

  if (!media) return c.json({ error: 'Média introuvable' }, 404);

  const linkedTags = await db.execute(sql`
    SELECT a.code AS attr_code, a.display_name, a.ui_zone, a.color_theme,
           v.value_text, v.value_slug, l.context_role, l.order_index
    FROM node_eav_links l
    JOIN eav_values v ON l.value_id = v.id
    JOIN eav_attributes a ON v.attribute_id = a.id
    WHERE l.node_id = ${media.id}
    ORDER BY a.display_order ASC, l.order_index ASC;
  `);

  const tagsByZone: Record<string, any[]> = { HERO_BADGE: [], PRIMARY_PILL: [], PERSON_CAROUSEL: [], TECHNICAL_DRAWER: [] };
  for (const row of Array.from(linkedTags) as any[]) {
    const zone = row.ui_zone || 'PRIMARY_PILL';
    if (!tagsByZone[zone]) tagsByZone[zone] = [];
    tagsByZone[zone].push(row);
  }

  const childNodes = await db.query.mediaNodes.findMany({
    where: (t, { eq }) => eq(t.parentId, media.id),
    orderBy: (t, { asc }) => [asc(t.orderIndex), asc(t.title)],
    limit: 150,
  });

  const formattedMedia = {
    ...media,
    posterPath: media.posterPath ? `/api/media/${media.id}/poster` : undefined,
    fanartPath: media.fanartPath ? `/api/media/${media.id}/fanart` : undefined,
  };

  const children = childNodes.map((ch) => ({
    ...ch,
    posterPath: ch.posterPath ? `/api/media/${ch.id}/poster` : formattedMedia.posterPath,
  }));

  const relatedTags = await getRelatedTagsForMedia(media.id, media.parentId);

  return c.json({ media: formattedMedia, tags: tagsByZone, children, relatedTags });
});

mediaRouter.post('/:id/progress', async (c) => {
  const nodeId = c.req.param('id');
  const { userId, positionSeconds = 0, durationSeconds = 0, isCompleted = false } = await c.req.json();
  if (!userId) return c.json({ error: 'userId is required' }, 400);

  await db.insert(watchProgress).values({ userId, nodeId, positionSeconds, durationSeconds, isCompleted }
  ).onConflictDoUpdate({
    target: [watchProgress.userId, watchProgress.nodeId],
    set: { positionSeconds, durationSeconds, isCompleted, updatedAt: new Date() },
  });
  return c.json({ success: true });
});
