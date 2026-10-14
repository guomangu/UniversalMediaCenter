import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { users } from '../db/schema/index.js';
import { and, ne, or, like, sql } from 'drizzle-orm';

export const friendSearchRouter = new Hono();

// Rechercher des utilisateurs sur la plateforme
friendSearchRouter.get('/search', async (c) => {
  const sessionUser = (c as any).get('user');
  const q = String(c.req.query('q') || '').trim().toLowerCase();

  if (!q || q.length < 2) {
    return c.json({ results: [] });
  }

  const matches = await db.query.users.findMany({
    where: (t, { and, ne, or, like }) =>
      and(
        ne(t.id, sessionUser.id),
        or(
          like(sql`lower(${t.displayName})`, `%${q}%`),
          like(sql`lower(${t.email})`, `%${q}%`)
        )
      ),
    limit: 10,
  });

  return c.json({
    results: matches.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      email: m.email,
      avatarUrl: m.avatarUrl,
      bio: m.bio,
    })),
  });
});
