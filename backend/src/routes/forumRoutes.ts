import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { forumMessages, userFriends, users } from '../db/schema/index.js';
import { eq, asc, desc, count, sql, and, or } from 'drizzle-orm';
import { requireAuth } from '../middleware/access.js';
import { forumUploadRouter } from './forumUpload.js';

export const forumRouter = new Hono();

// Uploads et téléchargements de médias forum
forumRouter.route('/', forumUploadRouter);

forumRouter.use('*', requireAuth);

async function canAccessPrivateForum(userId: string, ownerId: string): Promise<boolean> {
  if (userId === ownerId) return true;
  const friendship = await db.query.userFriends.findFirst({
    where: (t, { or, and, eq }) =>
      and(
        eq(t.status, 'ACCEPTED'),
        or(
          and(eq(t.userId, userId), eq(t.friendId, ownerId)),
          and(eq(t.userId, ownerId), eq(t.friendId, userId))
        )
      ),
  });
  return Boolean(friendship);
}

// Récupère la liste des messages pour un sujet / texte précis
forumRouter.get('/topics/:slug/messages', async (c) => {
  const slug = c.req.param('slug').toLowerCase();
  const user = (c as any).get('user') as any;

  if (slug.startsWith('private-user-')) {
    const ownerId = slug.replace('private-user-', '');
    const allowed = await canAccessPrivateForum(user.id, ownerId);
    if (!allowed) {
      return c.json(
        { error: 'Ce forum privé est strictement réservé aux amis de cet utilisateur' },
        403
      );
    }
  }

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
  const user = (c as any).get('user') as any;

  if (slug.startsWith('private-user-')) {
    const ownerId = slug.replace('private-user-', '');
    const allowed = await canAccessPrivateForum(user.id, ownerId);
    if (!allowed) {
      return c.json(
        { error: 'Ce forum privé est strictement réservé aux amis de cet utilisateur' },
        403
      );
    }
  }

  const body = await c.req.json().catch(() => ({}));
  const {
    topicTitle,
    content,
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

  let finalTitle = topicTitle || slug;
  if (slug.startsWith('private-user-')) {
    const ownerId = slug.replace('private-user-', '');
    const owner = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, ownerId) });
    finalTitle = `🔒 Salon Privé de ${owner?.displayName || 'Membre'}`;
  }

  const [newMessage] = await db
    .insert(forumMessages)
    .values({
      topicSlug: slug,
      topicTitle: finalTitle,
      content: content || '',
      authorName: user?.displayName || body.authorName || 'Utilisateur',
      authorId: user?.id || body.authorId || null,
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

// Sujets les plus actifs (exclut les salons privés)
forumRouter.get('/popular', async (c) => {
  const popular = await db
    .select({
      topicSlug: forumMessages.topicSlug,
      topicTitle: forumMessages.topicTitle,
      msgCount: count(),
      lastActivity: sql`max(${forumMessages.createdAt})`,
    })
    .from(forumMessages)
    .where(sql`not (${forumMessages.topicSlug} like 'private-user-%')`)
    .groupBy(forumMessages.topicSlug, forumMessages.topicTitle)
    .orderBy(desc(count()))
    .limit(10);

  return c.json({ success: true, popular });
});
