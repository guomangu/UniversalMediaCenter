import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { forumMessages, forumMessageVotes, userFriends, users } from '../db/schema/index.js';
import { eq, asc, desc, count, sql, and } from 'drizzle-orm';
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

// Récupère la liste des messages pour un sujet / slug précis
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
    limit: 150,
  });

  // Récupérer les votes de l'utilisateur courant pour ce salon
  const myVotes = user?.id
    ? await db
        .select({ messageId: forumMessageVotes.messageId })
        .from(forumMessageVotes)
        .where(eq(forumMessageVotes.userId, user.id))
    : [];
  const votedSet = new Set(myVotes.map((v) => v.messageId));

  const enriched = messages.map((m) => ({
    ...m,
    hasVoted: votedSet.has(m.id),
  }));

  return c.json({ success: true, messages: enriched });
});

// Publie un message (texte, image, vidéo, vocal, document, gif, citation d'un média)
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
    quotedMediaId,
    quotedMediaTitle,
    quotedMediaPoster,
  } = body;

  if (!content && !mediaUrl && !quotedMediaId) {
    return c.json({ error: 'Le message, un élément média ou une citation est requis' }, 400);
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
      quotedMediaId: quotedMediaId || null,
      quotedMediaTitle: quotedMediaTitle || null,
      quotedMediaPoster: quotedMediaPoster || null,
    })
    .returning();

  return c.json({ success: true, message: { ...newMessage, hasVoted: false } });
});

// Voter pour un message (Upvote toggle)
forumRouter.post('/messages/:id/vote', async (c) => {
  const messageId = c.req.param('id');
  const user = (c as any).get('user') as any;
  if (!user?.id) return c.json({ error: 'Non autorisé' }, 401);

  const existingVote = await db.query.forumMessageVotes.findFirst({
    where: (t, { and, eq }) => and(eq(t.messageId, messageId), eq(t.userId, user.id)),
  });

  let hasVoted = false;
  if (existingVote) {
    await db.delete(forumMessageVotes).where(eq(forumMessageVotes.id, existingVote.id));
    await db
      .update(forumMessages)
      .set({ voteCount: sql`GREATEST(0, ${forumMessages.voteCount} - 1)` })
      .where(eq(forumMessages.id, messageId));
    hasVoted = false;
  } else {
    await db.insert(forumMessageVotes).values({ messageId, userId: user.id });
    await db
      .update(forumMessages)
      .set({ voteCount: sql`${forumMessages.voteCount} + 1` })
      .where(eq(forumMessages.id, messageId));
    hasVoted = true;
  }

  const updatedMsg = await db.query.forumMessages.findFirst({
    where: (t, { eq }) => eq(t.id, messageId),
  });

  return c.json({
    success: true,
    voteCount: updatedMsg?.voteCount ?? 0,
    hasVoted,
  });
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
