import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { mediaReposts, mediaNodes, users } from '../db/schema/index.js';
import { eq, desc, and } from 'drizzle-orm';
import { isMediaAllowedForUser } from '../auth/mediaAccess.js';
export const repostMediaRouter = new Hono();
// Reposter un média avec note et commentaire (upsert automatique si déjà noté)
repostMediaRouter.post('/media/:id', async (c) => {
    const sessionUser = c.get('user');
    const nodeId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { rating, comment } = body;
    const media = await db.query.mediaNodes.findFirst({
        where: (t, { eq: e }) => e(t.id, nodeId),
    });
    if (!media)
        return c.json({ error: 'Média introuvable' }, 404);
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
        return c.json({
            success: true,
            repost: {
                ...updated,
                author: {
                    id: sessionUser.id,
                    displayName: sessionUser.displayName,
                    avatarUrl: sessionUser.avatarUrl,
                },
            },
            updated: true,
        });
    }
    const [newRepost] = await db
        .insert(mediaReposts)
        .values({
        userId: sessionUser.id,
        nodeId: media.id,
        rating: cleanRating,
        comment: cleanComment,
    })
        .returning();
    return c.json({
        success: true,
        repost: {
            ...newRepost,
            author: {
                id: sessionUser.id,
                displayName: sessionUser.displayName,
                avatarUrl: sessionUser.avatarUrl,
            },
        },
        created: true,
    });
});
// Récupérer les avis / reposts pour un média donné avec calcul de la note moyenne
repostMediaRouter.get('/media/:id', async (c) => {
    const sessionUser = c.get('user');
    const nodeId = c.req.param('id');
    const media = await db.query.mediaNodes.findFirst({
        where: (t, { eq: e }) => e(t.id, nodeId),
    });
    if (!media)
        return c.json({ error: 'Média introuvable' }, 404);
    if (!isMediaAllowedForUser(sessionUser, media)) {
        return c.json({ error: 'Accès refusé', code: 'FORBIDDEN' }, 403);
    }
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
        .limit(50);
    const formattedReposts = rows.map((r) => ({
        ...r.repost,
        author: r.author,
        isMine: sessionUser ? r.author.id === sessionUser.id : false,
    }));
    // Note moyenne de la communauté
    const ratings = formattedReposts
        .map((r) => r.rating)
        .filter((rate) => typeof rate === 'number' && rate > 0);
    const averageRating = ratings.length > 0
        ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
        : null;
    return c.json({
        reposts: formattedReposts,
        averageRating,
        totalCount: formattedReposts.length,
    });
});
// Supprimer son propre avis / repost
repostMediaRouter.delete('/:id', async (c) => {
    const sessionUser = c.get('user');
    const repostId = c.req.param('id');
    if (!sessionUser)
        return c.json({ error: 'Non authentifié' }, 401);
    const target = await db.query.mediaReposts.findFirst({
        where: (t, { eq }) => eq(t.id, repostId),
    });
    if (!target) {
        return c.json({ error: 'Avis introuvable' }, 404);
    }
    if (target.userId !== sessionUser.id && !sessionUser.isAdmin) {
        return c.json({ error: 'Action non autorisée sur cet avis' }, 403);
    }
    await db.delete(mediaReposts).where(eq(mediaReposts.id, repostId));
    return c.json({ success: true, message: 'Avis supprimé' });
});
