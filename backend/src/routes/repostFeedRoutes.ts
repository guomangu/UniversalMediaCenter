import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { mediaReposts, mediaNodes, users, userFriends } from '../db/schema/index.js';
import { eq, desc, and, or, inArray } from 'drizzle-orm';
import { parseSeasonEpisode } from '../watcher/seasonEpisodeHelper.js';
import { isMediaAllowedForUser } from '../auth/mediaAccess.js';

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

// Récupérer la liste des IDs des amis acceptés pour l'utilisateur
async function getAcceptedFriendIds(userId: string): Promise<string[]> {
  const friendships = await db
    .select({
      userId: userFriends.userId,
      friendId: userFriends.friendId,
    })
    .from(userFriends)
    .where(
      and(
        or(eq(userFriends.userId, userId), eq(userFriends.friendId, userId)),
        eq(userFriends.status, 'ACCEPTED')
      )
    );

  return friendships.map((f) => (f.userId === userId ? f.friendId : f.userId));
}

// 1. Fil d'actualité combiné (Amis + Utilisateur + Communauté)
repostFeedRouter.get('/feed', async (c) => {
  const sessionUser = (c as any).get('user');
  if (!sessionUser) return c.json({ feed: [] });

  const friendIds = await getAcceptedFriendIds(sessionUser.id);
  const friendIdSet = new Set(friendIds);

  const rawItems = await db
    .select({
      id: mediaReposts.id,
      nodeId: mediaReposts.nodeId,
      rating: mediaReposts.rating,
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
    .orderBy(desc(mediaReposts.createdAt))
    .limit(100);

  const allowed = rawItems
    .filter((it) => isMediaAllowedForUser(sessionUser, it.node))
    .map((it) => ({
      id: it.id,
      nodeId: it.nodeId,
      rating: it.rating,
      comment: it.comment,
      createdAt: it.createdAt,
      author: it.user,
      media: formatNode(it.node),
      isMine: it.user.id === sessionUser.id,
      isFriend: friendIdSet.has(it.user.id),
    }))
    .slice(0, 50);

  return c.json({ feed: allowed });
});

// 2. Mes propres avis / reposts
repostFeedRouter.get('/user', async (c) => {
  const sessionUser = (c as any).get('user');
  if (!sessionUser) return c.json({ reposts: [] });

  const items = await db
    .select({
      id: mediaReposts.id,
      nodeId: mediaReposts.nodeId,
      rating: mediaReposts.rating,
      comment: mediaReposts.comment,
      createdAt: mediaReposts.createdAt,
      node: mediaNodes,
    })
    .from(mediaReposts)
    .innerJoin(mediaNodes, eq(mediaReposts.nodeId, mediaNodes.id))
    .where(eq(mediaReposts.userId, sessionUser.id))
    .orderBy(desc(mediaReposts.createdAt))
    .limit(60);

  const allowed = items
    .filter((it) => isMediaAllowedForUser(sessionUser, it.node))
    .slice(0, 40)
    .map((it) => ({
      id: it.id,
      nodeId: it.nodeId,
      rating: it.rating,
      comment: it.comment,
      createdAt: it.createdAt,
      author: {
        id: sessionUser.id,
        displayName: sessionUser.displayName,
        avatarUrl: sessionUser.avatarUrl,
      },
      media: formatNode(it.node),
      node: formatNode(it.node),
      isMine: true,
      isFriend: false,
    }));

  return c.json({ reposts: allowed });
});

// 3. Avis des amis uniquement
repostFeedRouter.get('/friends', async (c) => {
  const sessionUser = (c as any).get('user');
  if (!sessionUser) return c.json({ reposts: [] });

  const friendIds = await getAcceptedFriendIds(sessionUser.id);
  if (friendIds.length === 0) {
    return c.json({ reposts: [] });
  }

  const items = await db
    .select({
      id: mediaReposts.id,
      nodeId: mediaReposts.nodeId,
      rating: mediaReposts.rating,
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

  const allowed = items
    .filter((it) => isMediaAllowedForUser(sessionUser, it.node))
    .slice(0, 40)
    .map((it) => ({
      id: it.id,
      nodeId: it.nodeId,
      rating: it.rating,
      comment: it.comment,
      createdAt: it.createdAt,
      author: it.user,
      media: formatNode(it.node),
      node: formatNode(it.node),
      isMine: false,
      isFriend: true,
    }));

  return c.json({ reposts: allowed });
});

// 4. Repost simple rapide
repostFeedRouter.post('/', async (c) => {
  const sessionUser = (c as any).get('user');
  const body = await c.req.json().catch(() => ({}));
  const { nodeId, comment, rating } = body;

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

  const cleanRating = rating ? Math.max(1, Math.min(5, Number(rating))) : null;
  const cleanComment = comment && typeof comment === 'string' ? comment.trim() : null;

  const existing = await db.query.mediaReposts.findFirst({
    where: (t, { and, eq }) => and(eq(t.userId, sessionUser.id), eq(t.nodeId, media.id)),
  });

  if (existing) {
    const [updated] = await db
      .update(mediaReposts)
      .set({
        rating: cleanRating,
        comment: cleanComment,
        createdAt: new Date(),
      })
      .where(eq(mediaReposts.id, existing.id))
      .returning();
    return c.json(updated);
  }

  const [inserted] = await db
    .insert(mediaReposts)
    .values({
      userId: sessionUser.id,
      nodeId,
      rating: cleanRating,
      comment: cleanComment,
    })
    .returning();

  return c.json(inserted);
});
