import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { forumMessages, forumMessageVotes, userFriends, users } from '../db/schema/index.js';
import { eq, asc, desc, count, sql, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/access.js';
import { forumUploadRouter } from './forumUpload.js';
import { fetchForumExploreData, fetchTopicContextData } from './forumAssociations.js';
import {
  getUserLastLocation,
  joinVoiceCall,
  leaveVoiceCall,
  pingVoiceCall,
  getVoiceCallParticipants,
  pushVoiceAudioChunk,
  getVoiceAudioChunks,
} from '../watcher/presenceStore.js';

export const forumRouter = new Hono();

// Uploads et téléchargements de médias forum
forumRouter.route('/', forumUploadRouter);

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

// -------------------------------------------------------------
// 1. ESPACES D'EXPLORATION & CONTEXTE DU FORUM (ACCÈS PUBLIC AVEC FILTRAGE DES DROITS)
// -------------------------------------------------------------

// Exploration globale de l'ensemble des salons et des 4 modules d'association
forumRouter.get('/explore', async (c) => {
  const user = (c as any).get('user') as any;
  const data = await fetchForumExploreData(user);
  return c.json(data);
});

// Contexte d'un sujet (bannière spotlight, médias directs, et les 4 modules d'association)
forumRouter.get('/topics/:slug/context', async (c) => {
  const slug = c.req.param('slug') || '';
  const title = c.req.query('title');
  const category = c.req.query('category');
  const user = (c as any).get('user') as any;
  const data = await fetchTopicContextData(slug, title, category, user);
  return c.json(data);
});

// -------------------------------------------------------------
// 2. MESSAGES DU FORUM (LECTURE PUBLIQUE / ÉCRITURE SÉCURISÉE)
// -------------------------------------------------------------

// Récupère la liste des messages pour un sujet / slug précis
forumRouter.get('/topics/:slug/messages', async (c) => {
  const slug = (c.req.param('slug') || '').toLowerCase();
  const user = (c as any).get('user') as any;

  if (slug.startsWith('private-user-')) {
    if (!user?.id) {
      return c.json({ error: 'Connexion requise pour accéder à un salon privé' }, 401);
    }
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

  // Récupérer la dernière position / média connu pour chaque auteur
  const authorIds = Array.from(new Set(messages.map((m) => m.authorId).filter(Boolean))) as string[];
  const locationsMap = new Map<string, any>();
  await Promise.all(
    authorIds.map(async (aId) => {
      const loc = await getUserLastLocation(aId);
      if (loc) locationsMap.set(aId, loc);
    })
  );

  return c.json({
    messages: messages.map((m) => ({
      ...m,
      hasVoted: votedSet.has(m.id),
      authorLocation: m.authorId ? locationsMap.get(m.authorId) || null : null,
    })),
  });
});

// Envoyer un nouveau message dans le forum
forumRouter.post('/topics/:slug/messages', async (c) => {
  const slug = (c.req.param('slug') || '').toLowerCase();
  const user = (c as any).get('user') as any;
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

  if (slug.startsWith('private-user-')) {
    if (!user?.id) {
      return c.json({ error: 'Connexion requise pour poster dans un salon privé' }, 401);
    }
    const ownerId = slug.replace('private-user-', '');
    const allowed = await canAccessPrivateForum(user.id, ownerId);
    if (!allowed) {
      return c.json(
        { error: 'Ce forum privé est strictement réservé aux amis de cet utilisateur' },
        403
      );
    }
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

  const authorLoc = newMessage.authorId ? await getUserLastLocation(newMessage.authorId) : null;

  return c.json({
    success: true,
    message: {
      ...newMessage,
      hasVoted: false,
      authorLocation: authorLoc,
    },
  });
});

// Voter pour un message (Upvote toggle)
forumRouter.post('/messages/:id/vote', requireAuth, async (c) => {
  const messageId = c.req.param('id');
  if (!messageId) return c.json({ error: 'ID de message requis' }, 400);

  const user = (c as any).get('user') as any;
  if (!user?.id) return c.json({ error: 'Non autorisé' }, 401);

  const userId = user.id as string;

  const existingVote = await db.query.forumMessageVotes.findFirst({
    where: (t, { and, eq }) => and(eq(t.messageId, messageId), eq(t.userId, userId)),
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
    await db.insert(forumMessageVotes).values({ messageId, userId });
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

// --- ROUTES POUR L'APPEL VOCAL DIRECT & VOCAUX CONTINUS ---

// Rejoindre l'appel vocal direct du sujet
forumRouter.post('/topics/:slug/call/join', requireAuth, async (c) => {
  const slug = (c.req.param('slug') || '').toLowerCase();
  const user = (c as any).get('user') as any;
  const body = await c.req.json().catch(() => ({}));
  const isMuted = Boolean(body.isMuted);

  joinVoiceCall(slug, user.id, user.displayName || 'Participant', isMuted);
  const participants = getVoiceCallParticipants(slug);
  return c.json({ success: true, participants });
});

// Quitter l'appel vocal
forumRouter.post('/topics/:slug/call/leave', requireAuth, async (c) => {
  const slug = (c.req.param('slug') || '').toLowerCase();
  const user = (c as any).get('user') as any;

  leaveVoiceCall(slug, user.id);
  const participants = getVoiceCallParticipants(slug);
  return c.json({ success: true, participants });
});

// Ping de statut micro / présence dans l'appel
forumRouter.post('/topics/:slug/call/ping', requireAuth, async (c) => {
  const slug = (c.req.param('slug') || '').toLowerCase();
  const user = (c as any).get('user') as any;
  const body = await c.req.json().catch(() => ({}));

  const participants = pingVoiceCall(slug, user.id, body.isMuted);
  return c.json({ success: true, participants });
});

// Obtenir le statut de l'appel (Accessible publiquement)
forumRouter.get('/topics/:slug/call/status', async (c) => {
  const slug = (c.req.param('slug') || '').toLowerCase();
  const participants = getVoiceCallParticipants(slug);
  return c.json({ success: true, activeCount: participants.length, participants });
});

// Envoyer un fragment audio continu (vocal continu pour discuter en direct)
forumRouter.post('/topics/:slug/call/chunk', requireAuth, async (c) => {
  const slug = (c.req.param('slug') || '').toLowerCase();
  const user = (c as any).get('user') as any;
  const body = await c.req.json().catch(() => ({}));
  const { audioBase64, mimeType } = body;

  if (!audioBase64) return c.json({ error: 'Données audio requises' }, 400);

  const chunk = pushVoiceAudioChunk(slug, user.id, user.displayName || 'Participant', audioBase64, mimeType);
  return c.json({ success: true, chunkId: chunk.id });
});

// Récupérer les fragments audio récents des autres participants
forumRouter.get('/topics/:slug/call/chunks', async (c) => {
  const slug = (c.req.param('slug') || '').toLowerCase();
  const user = (c as any).get('user') as any;
  const since = Number(c.req.query('since') || 0);

  const chunks = getVoiceAudioChunks(slug, since, user?.id);
  return c.json({ success: true, chunks });
});
