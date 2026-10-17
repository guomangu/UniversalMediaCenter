import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { users, userFriends } from '../db/schema/index.js';
import { and, ne, or, like, sql, eq } from 'drizzle-orm';
export const friendSearchRouter = new Hono();
// Rechercher des utilisateurs sur la plateforme avec détection de relation
friendSearchRouter.get('/search', async (c) => {
    const sessionUser = c.get('user');
    const q = String(c.req.query('q') || '').trim().toLowerCase();
    if (!q || q.length < 2) {
        return c.json({ results: [] });
    }
    const matches = await db.query.users.findMany({
        where: (t, { and, ne, or, like }) => and(ne(t.id, sessionUser.id), or(like(sql `lower(${t.displayName})`, `%${q}%`), like(sql `lower(${t.email})`, `%${q}%`))),
        limit: 15,
    });
    const results = await Promise.all(matches.map(async (m) => {
        const relation = await db.query.userFriends.findFirst({
            where: (t, { or, and, eq }) => or(and(eq(t.userId, sessionUser.id), eq(t.friendId, m.id)), and(eq(t.userId, m.id), eq(t.friendId, sessionUser.id))),
        });
        let status = 'NONE';
        let friendshipId = null;
        if (relation) {
            friendshipId = relation.id;
            if (relation.status === 'ACCEPTED') {
                status = 'FRIEND';
            }
            else if (relation.userId === sessionUser.id) {
                status = 'PENDING_SENT';
            }
            else {
                status = 'PENDING_RECEIVED';
            }
        }
        return {
            id: m.id,
            displayName: m.displayName,
            email: m.email,
            avatarUrl: m.avatarUrl,
            bio: m.bio,
            relationshipStatus: status,
            friendshipId,
        };
    }));
    return c.json({ results });
});
