import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { mediaNodes, watchProgress } from '../db/schema/index.js';
import { sql } from 'drizzle-orm';
import { artworkRouter } from './mediaArtworks.js';
import { streamRouter } from './mediaStream.js';
import { statsRouter } from './mediaStats.js';
import { processNfoFile } from '../watcher/index.js';

export const mediaRouter = new Hono();

mediaRouter.route('/', artworkRouter);
mediaRouter.route('/', streamRouter);
mediaRouter.route('/', statsRouter);

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
    SELECT a.code AS attr_code, a.display_name, a.ui_zone, a.color_theme, a.icon_name,
           v.value_text, v.value_slug, v.metadata_json, l.context_role, l.order_index
    FROM node_eav_links l
    JOIN eav_values v ON l.value_id = v.id
    JOIN eav_attributes a ON v.attribute_id = a.id
    WHERE l.node_id = ${media.id}
    ORDER BY a.display_order ASC, l.order_index ASC;
  `);

  const tagsByZone: Record<string, any[]> = {
    HERO_BADGE: [],
    PRIMARY_PILL: [],
    PERSON_CAROUSEL: [],
    TECHNICAL_DRAWER: [],
  };

  for (const row of Array.from(linkedTags) as any[]) {
    const zone = row.ui_zone || 'PRIMARY_PILL';
    if (!tagsByZone[zone]) tagsByZone[zone] = [];
    tagsByZone[zone].push(row);
  }

  const formattedMedia = {
    ...media,
    posterPath: media.posterPath ? `/api/media/${media.id}/poster` : undefined,
    fanartPath: media.fanartPath ? `/api/media/${media.id}/fanart` : undefined,
  };

  return c.json({ media: formattedMedia, tags: tagsByZone });
});

mediaRouter.post('/:id/progress', async (c) => {
  const nodeId = c.req.param('id');
  const body = await c.req.json();
  const { userId, positionSeconds, durationSeconds, isCompleted } = body;
  if (!userId) return c.json({ error: 'userId is required' }, 400);

  await db
    .insert(watchProgress)
    .values({
      userId,
      nodeId,
      positionSeconds: positionSeconds || 0,
      durationSeconds: durationSeconds || 0,
      isCompleted: isCompleted || false,
    })
    .onConflictDoUpdate({
      target: [watchProgress.userId, watchProgress.nodeId],
      set: {
        positionSeconds: positionSeconds || 0,
        durationSeconds: durationSeconds || 0,
        isCompleted: isCompleted || false,
        updatedAt: new Date(),
      },
    });

  return c.json({ success: true });
});
