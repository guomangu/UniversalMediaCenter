import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { mediaReposts, mediaNodes, users, userFriends } from '../db/schema/index.js';
import { eq, desc, and, or, inArray } from 'drizzle-orm';
import { parseSeasonEpisode } from '../watcher/seasonEpisodeHelper.js';
import { isMediaAllowedForUser, checkMediaAccess } from '../auth/mediaAccess.js';

export const repostFeedRouter = new Hono();

function formatNode(node: any) {
  const nodeType = node.nodeType || node.node_type;
  const isEpOrSeason = nodeType === 'EPISODE' || nodeType === 'SEASON';
  const info = isEpOrSeason ? parseSeasonEpisode(node.title, node.orderIndex, nodeType) : null;
  return {
    ...node,
    posterPath: node.posterPath ? `/api/media/${node.id}/poster` : undefined,
    fanartPath: node.fanartPath ? `/api/media/${node.id}/fanart` : undefined,
    seasonEpisodeTag: info?.seasonEpisodeTag ?? null,
    displayBadge: info?.displayBadge ?? null,
  };
}

repostFeedRouter.get('/user', async (c) => {
  const sessionUser = (c as any).get('user');
  const items = await db
    .select({
      id: mediaReposts.id,
      nodeId: mediaReposts.nodeId,
      comment: mediaReposts.comment,
      createdAt: mediaReposts.createdAt,
      node: mediaNodes,
    })
    .from(mediaReposts)
    .innerJoin(mediaNodes, eq(mediaReposts.nodeId, mediaNodes.id))
    .where(eq(mediaReposts.userId, sessionUser.id))
    .orderBy(desc(mediaReposts.createdAt))
    .limit(60);

  const allowed = items.filter((it) => isMediaAllowedForUser(sessionUser, it.node)).slice(0, 30);

  return c.json(
    allowed.map((it) => ({
      ...it,
      node: formatNode(it.node),
    }))
  );
});

repostFeedRouter.get('/friends', async (c) => {
  const sessionUser = (c as any).get('user');

  const friends = await db
    .select({ friendId: userFriends.friendId })
    .from(userFriends)
    .where(and(eq(userFriends.userId, sessionUser.id), eq(userFriends.status, 'ACCEPTED')));

  const friendIds = friends.map((f) => f.friendId);
  if (friendIds.length === 0) {
    return c.json([]);
  }

  const items = await db
    .select({
      id: mediaReposts.id,
      nodeId: mediaReposts.nodeId,
      comment: mediaReposts.comment,
      createdAt: mediaReposts.createdAt,
      node: mediaNodes,
      user: {
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(mediaReposts)
    .innerJoin(mediaNodes, eq(mediaReposts.nodeId, mediaNodes.id))
    .innerJoin(users, eq(mediaReposts.userId, users.id))
    .where(inArray(mediaReposts.userId, friendIds))
    .orderBy(desc(mediaReposts.createdAt))
    .limit(60);

  const allowed = items.filter((it) => isMediaAllowedForUser(sessionUser, it.node)).slice(0, 30);

  return c.json(
    allowed.map((it) => ({
      ...it,
      node: formatNode(it.node),
    }))
  );
});

repostFeedRouter.post('/', async (c) => {
  const sessionUser = (c as any).get('user');
  const body = await c.req.json();
  const { nodeId, comment } = body;

  if (!nodeId) {
    return c.json({ error: 'nodeId manquant' }, 400);
  }

  const media = await db.query.mediaNodes.findFirst({
    where: (t, { eq: e }) => e(t.id, nodeId),
  });
  if (!media) return c.json({ error: 'Média introuvable' }, 404);

  if (!isMediaAllowedForUser(sessionUser, media)) {
    return c.json({ error: 'Accès refusé à ce média', code: 'FORBIDDEN' }, 403);
  }

  const [inserted] = await db
    .insert(mediaReposts)
    .values({
      userId: sessionUser.id,
      nodeId,
      comment: comment || null,
    })
    .returning();

  return c.json(inserted);
});
