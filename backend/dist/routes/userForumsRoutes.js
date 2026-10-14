import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { forumMessages } from '../db/schema/index.js';
import { eq, desc, sql, count } from 'drizzle-orm';
export const userForumsRouter = new Hono();
userForumsRouter.get('/forums', async (c) => {
    const sessionUser = c.get('user');
    const topics = await db
        .select({
        topicSlug: forumMessages.topicSlug,
        topicTitle: forumMessages.topicTitle,
        msgCount: count(),
        lastActivity: sql `max(${forumMessages.createdAt})`,
    })
        .from(forumMessages)
        .where(eq(forumMessages.authorId, sessionUser.id))
        .groupBy(forumMessages.topicSlug, forumMessages.topicTitle)
        .orderBy(desc(sql `max(${forumMessages.createdAt})`))
        .limit(30);
    return c.json({ forums: topics });
});
