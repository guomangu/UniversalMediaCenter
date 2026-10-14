import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { mediaReposts, mediaNodes, users } from '../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';

export const repostMediaRouter = new Hono();

// Reposter un média avec note et commentaire
repostMediaRouter.post('/media/:id', async (c) => {
  const sessionUser = (c as any).get('user');
  const nodeId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { rating, comment } = body;

  const media = await db.query.mediaNodes.findFirst({
    where: (t, { eq }) => eq(t.id, nodeId),
  });
  if (!media) return c.json({ error: 'Média introuvable' }, 404);

  const cleanRating = rating ? Math.max(1, Math.min(5, Number(rating))) : null;
  const cleanComment = comment && typeof comment === 'string' ? comment.trim() : null;

  const [newRepost] = await db
    .insert(mediaReposts)
    .values({
      userId: sessionUser.id,
      nodeId: media.id,
      rating: cleanRating,
      comment: cleanComment,
    })
    .returning();

  return c.json({ success: true, repost: newRepost });
});

// Récupérer les reposts pour un média donné
repostMediaRouter.get('/media/:id', async (c) => {
  const nodeId = c.req.param('id');
  const rows = await db
    .select({
      repost: mediaReposts,
      author: {
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(mediaReposts)
    .innerJoin(users, eq(mediaReposts.userId, users.id))
    .where(eq(mediaReposts.nodeId, nodeId))
    .orderBy(desc(mediaReposts.createdAt))
    .limit(20);

  return c.json({
    reposts: rows.map((r) => ({
      ...r.repost,
      author: r.author,
    })),
  });
});
