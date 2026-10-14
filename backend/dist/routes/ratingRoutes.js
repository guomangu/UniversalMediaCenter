import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { userRatings, users } from '../db/schema/index.js';
import { eq, sql, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/access.js';
export const ratingRouter = new Hono();
ratingRouter.use('*', requireAuth);
// Noter un utilisateur (ou gérant de séance)
ratingRouter.post('/:targetUserId', async (c) => {
    const targetUserId = c.req.param('targetUserId');
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const ratingVal = Math.min(Math.max(parseInt(body.rating || '5', 10), 1), 5);
    const comment = body.comment ? String(body.comment).slice(0, 500) : null;
    if (targetUserId === user.id) {
        return c.json({ error: 'Vous ne pouvez pas vous noter vous-même' }, 400);
    }
    const [saved] = await db
        .insert(userRatings)
        .values({
        targetUserId,
        ratedByUserId: user.id,
        rating: ratingVal,
        comment,
    })
        .onConflictDoUpdate({
        target: [userRatings.targetUserId, userRatings.ratedByUserId],
        set: {
            rating: ratingVal,
            comment,
            createdAt: new Date(),
        },
    })
        .returning();
    return c.json({ success: true, rating: saved });
});
// Récupérer la note moyenne et les avis pour un utilisateur
ratingRouter.get('/:targetUserId', async (c) => {
    const targetUserId = c.req.param('targetUserId');
    const stats = await db
        .select({
        avgRating: sql `coalesce(round(avg(${userRatings.rating})::numeric, 1), 0)::float`,
        totalRatings: sql `count(*)::int`,
    })
        .from(userRatings)
        .where(eq(userRatings.targetUserId, targetUserId));
    const recentReviews = await db
        .select({
        id: userRatings.id,
        rating: userRatings.rating,
        comment: userRatings.comment,
        createdAt: userRatings.createdAt,
        authorName: users.displayName,
        authorAvatar: users.avatarUrl,
    })
        .from(userRatings)
        .leftJoin(users, eq(userRatings.ratedByUserId, users.id))
        .where(eq(userRatings.targetUserId, targetUserId))
        .orderBy(desc(userRatings.createdAt))
        .limit(10);
    return c.json({
        success: true,
        average: stats[0]?.avgRating ?? 0,
        total: stats[0]?.totalRatings ?? 0,
        reviews: recentReviews,
    });
});
