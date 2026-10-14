import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { forumMessages } from '../db/schema/index.js';
import { eq, asc, desc, count, sql } from 'drizzle-orm';

export const forumRouter = new Hono();

// Récupère la liste des messages pour un sujet / texte précis
forumRouter.get('/topics/:slug/messages', async (c) => {
  const slug = c.req.param('slug').toLowerCase();
  const messages = await db.query.forumMessages.findMany({
    where: (t, { eq }) => eq(t.topicSlug, slug),
    orderBy: [asc(forumMessages.createdAt)],
    limit: 100,
  });
  return c.json({ success: true, messages });
});

// Publie un message (texte, image, vidéo, vocal, document, gif, citation)
forumRouter.post('/topics/:slug/messages', async (c) => {
  const slug = c.req.param('slug').toLowerCase();
  const body = await c.req.json().catch(() => ({}));
  const {
    topicTitle,
    content,
    authorName,
    authorId,
    mediaType = 'TEXT',
    mediaUrl,
    fileName,
    replyToId,
    replyToText,
    replyToAuthor,
  } = body;

  if (!content && !mediaUrl) {
    return c.json({ error: 'Le message ou un élément média est requis' }, 400);
  }

  const [newMessage] = await db
    .insert(forumMessages)
    .values({
      topicSlug: slug,
      topicTitle: topicTitle || slug,
      content: content || '',
      authorName: authorName || 'Visiteur',
      authorId: authorId || null,
      mediaType,
      mediaUrl: mediaUrl || null,
      fileName: fileName || null,
      replyToId: replyToId || null,
      replyToText: replyToText || null,
      replyToAuthor: replyToAuthor || null,
    })
    .returning();

  return c.json({ success: true, message: newMessage });
});

// Sujets les plus actifs
forumRouter.get('/popular', async (c) => {
  const popular = await db
    .select({
      topicSlug: forumMessages.topicSlug,
      topicTitle: forumMessages.topicTitle,
      msgCount: count(),
      lastActivity: sql`max(${forumMessages.createdAt})`,
    })
    .from(forumMessages)
    .groupBy(forumMessages.topicSlug, forumMessages.topicTitle)
    .orderBy(desc(count()))
    .limit(10);

  return c.json({ success: true, popular });
});
