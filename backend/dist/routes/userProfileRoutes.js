import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { users } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
export const userProfileRouter = new Hono();
userProfileRouter.get('/profile', async (c) => {
    const sessionUser = c.get('user');
    const user = await db.query.users.findFirst({
        where: (t, { eq }) => eq(t.id, sessionUser.id),
    });
    if (!user)
        return c.json({ error: 'Utilisateur introuvable' }, 404);
    return c.json({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
    });
});
userProfileRouter.put('/profile', async (c) => {
    const sessionUser = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const { displayName, bio, avatarUrl } = body;
    const updates = {};
    if (displayName && typeof displayName === 'string' && displayName.trim()) {
        updates.displayName = displayName.trim();
    }
    if (typeof bio === 'string')
        updates.bio = bio.trim();
    if (typeof avatarUrl === 'string')
        updates.avatarUrl = avatarUrl.trim();
    if (Object.keys(updates).length === 0) {
        return c.json({ error: 'Aucune donnée à mettre à jour' }, 400);
    }
    const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, sessionUser.id))
        .returning();
    return c.json({
        success: true,
        user: {
            id: updated.id,
            email: updated.email,
            displayName: updated.displayName,
            avatarUrl: updated.avatarUrl,
            bio: updated.bio,
            isAdmin: updated.isAdmin,
        },
    });
});
