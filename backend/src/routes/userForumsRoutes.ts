import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { forumMessages } from '../db/schema/index.js';
import { eq, desc, sql, count, or, like } from 'drizzle-orm';

export const userForumsRouter = new Hono();

userForumsRouter.get('/forums', async (c) => {
  const sessionUser = (c as any).get('user');
  if (!sessionUser) return c.json({ forums: [] });

  const topics = await db
    .select({
      topicSlug: forumMessages.topicSlug,
      topicTitle: forumMessages.topicTitle,
      msgCount: count(),
      lastActivity: sql`max(${forumMessages.createdAt})`,
    })
    .from(forumMessages)
    .where(
      or(
        eq(forumMessages.authorId, sessionUser.id),
        like(forumMessages.topicSlug, `%${sessionUser.id}%`)
      )
    )
    .groupBy(forumMessages.topicSlug, forumMessages.topicTitle)
    .orderBy(desc(sql`max(${forumMessages.createdAt})`))
    .limit(40);

  return c.json({ forums: topics });
});
