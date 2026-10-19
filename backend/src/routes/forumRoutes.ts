import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { forumMessages, forumMessageVotes, userFriends, users } from '../db/schema/index.js';
import { eq, asc, desc, count, sql, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/access.js';
import { canUserAccessMediaNodeId } from '../auth/mediaAccess.js';
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

/**
 * N'accepte que les pièces jointes internes ou des URLs HTTP(S).
 * Empêche notamment les URL `javascript:` / `data:` d'être stockées puis rendues.
 */
function sanitizeForumMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (!clean) return null;
  if (clean.startsWith('/api/forum/attachments/')) return clean.slice(0, 2048);
  if (/^https?:\/\//i.test(clean)) return clean.slice(0, 2048);
  return null;
}

async function canAccessPrivateForum(userId: string, ownerId: string): Promise<boolean> {
  if (userId === ownerId) return true;
  const friendship = await db.query.userFriends.findFirst({
    where: (t, { and: a, eq: e, or: o }) =>
      a(
        o(
          a(e(t.userId, userId), e(t.friendId, ownerId)),
          a(e(t.userId, ownerId), e(t.friendId, userId))
        ),
        e(t.status, 'ACCEPTED')
      ),
  });
  return Boolean(friendship);
}

// Contrôle d'accès souverain pour les salons privés et discussions directes
async function canAccessPrivateTopic(user: any, slug: string): Promise<{ allowed: boolean; error?: string; topicTitle?: string }> {
  if (!slug) return { allowed: false, error: 'Slug requis' };

  if (slug.startsWith('private-user-') || slug.startsWith('dm-')) {
    if (!user) {
      return { allowed: false, error: 'Connexion requise pour accéder à ce salon privé' };
    }
  }

  if (slug.startsWith('private-user-')) {
    const ownerId = slug.replace('private-user-', '');
    const allowed = await canAccessPrivateForum(user.id, ownerId);
    if (!allowed && !user.isAdmin) {
      return { allowed: false, error: 'Ce forum privé est strictement réservé aux amis de cet utilisateur' };
    }
    const owner = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, ownerId) });
    return { allowed: true, topicTitle: `🔒 Salon Privé de ${owner?.displayName || 'Membre'}` };
  }

  if (slug.startsWith('dm-')) {
    const raw = slug.replace('dm-', '');
    const parts = raw.split('-');
    let u1 = '';
    let u2 = '';
    if (parts.length === 10) {
      u1 = parts.slice(0, 5).join('-');
      u2 = parts.slice(5).join('-');
    } else if (parts.length === 2) {
      u1 = parts[0];
      u2 = parts[1];
    } else {
      return { allowed: false, error: 'Identifiant de salon direct invalide' };
    }

    if (user.id !== u1 && user.id !== u2 && !user.isAdmin) {
      return { allowed: false, error: 'Vous ne participez pas à ce salon privé direct' };
    }

    const otherId = user.id === u1 ? u2 : u1;
    const allowed = await canAccessPrivateForum(user.id, otherId);
    if (!allowed && !user.isAdmin) {
      return { allowed: false, error: 'Vous devez être amis pour échanger dans ce salon privé' };
    }

    const otherUser = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, otherId) });
    return { allowed: true, topicTitle: `💬 Discussion avec ${otherUser?.displayName || 'Ami'}` };
  }

  return { allowed: true };
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
// 2. MESSAGES ET DISCUSSIONS DU FORUM
// -------------------------------------------------------------

// Récupérer les messages d'un sujet spécifique
forumRouter.get('/topics/:slug/messages', async (c) => {
  const slug = (c.req.param('slug') || '').toLowerCase();
  const user = (c as any).get('user') as any;

  const access = await canAccessPrivateTopic(user, slug);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
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
      if (loc) {
        // Zéro-Fuite : si la position pointe vers un média que l'utilisateur courant n'a pas les droits de voir,
        // on ne renvoie pas la position afin de ne pas afficher de lien invalide ou d'erreur
        const targetMediaId =
          loc.mediaId ||
          (loc.path ? loc.path.match(/\/(?:player|media)\/([0-9a-fA-F-]{36})/)?.[1] : null);
        if (targetMediaId && (!user || !user.isAdmin)) {
          const allowed = await canUserAccessMediaNodeId(user, targetMediaId);
          if (!allowed) return;
        }
        locationsMap.set(aId, loc);
      }
    })
  );

  // Filtrer également les œuvres citées (quotedMediaId) dont l'accès est restreint pour le lecteur
  const sanitizedMessages = await Promise.all(
    messages.map(async (m) => {
      let quotedMediaId = m.quotedMediaId;
      let quotedMediaTitle = m.quotedMediaTitle;
      let quotedMediaPoster = m.quotedMediaPoster;

      if (quotedMediaId && (!user || !user.isAdmin)) {
        const allowed = await canUserAccessMediaNodeId(user, quotedMediaId);
        if (!allowed) {
          quotedMediaId = null;
          quotedMediaTitle = null;
          quotedMediaPoster = null;
        }
      }

      return {
        ...m,
        quotedMediaId,
        quotedMediaTitle,
        quotedMediaPoster,
        hasVoted: votedSet.has(m.id),
        authorLocation: m.authorId ? locationsMap.get(m.authorId) || null : null,
      };
    })
  );

  return c.json({
    messages: sanitizedMessages,
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

  const access = await canAccessPrivateTopic(user, slug);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const finalTitle = access.topicTitle || topicTitle || slug;

  // L'identité de l'auteur ne doit JAMAIS provenir du corps de la requête :
  // sinon n'importe quel visiteur pourrait poster au nom d'un autre membre.
  const authorId = user?.id || null;
  const authorName = user?.displayName || 'Invité';

  const [newMessage] = await db
    .insert(forumMessages)
    .values({
      topicSlug: slug,
      topicTitle: finalTitle,
      content: typeof content === 'string' ? content.slice(0, 10000) : '',
      authorName,
      authorId,
      mediaType,
      mediaUrl: sanitizeForumMediaUrl(mediaUrl),
      fileName: typeof fileName === 'string' ? fileName.slice(0, 255) : null,
      replyToId: replyToId || null,
      replyToText: replyToText || null,
      replyToAuthor: replyToAuthor || null,
      quotedMediaId: quotedMediaId || null,
      quotedMediaTitle: quotedMediaTitle || null,
      quotedMediaPoster: quotedMediaPoster || null,
    })
    .returning();

  let authorLoc = newMessage.authorId ? await getUserLastLocation(newMessage.authorId) : null;
  const authorTargetMediaId =
    authorLoc?.mediaId ||
    (authorLoc?.path ? authorLoc.path.match(/\/(?:player|media)\/([0-9a-fA-F-]{36})/)?.[1] : null);
  if (authorTargetMediaId && (!user || !user.isAdmin)) {
    const allowed = await canUserAccessMediaNodeId(user, authorTargetMediaId);
    if (!allowed) authorLoc = null;
  }

  return c.json({
    success: true,
    message: {
      ...newMessage,
      hasVoted: false,
      authorLocation: authorLoc,
    },
  });
});

// Voter (Like / Réaction) sur un message du forum
forumRouter.post('/messages/:id/vote', requireAuth, async (c) => {
  const messageId = c.req.param('id');
  const user = (c as any).get('user');
  const userId = user.id;

  const existingVote = await (db.query as any).forumMessageVotes.findFirst({
    where: (t: any, { and, eq }: any) => and(eq(t.messageId, messageId), eq(t.userId, userId)),
  });

  let hasVoted = false;
  if (existingVote) {
    await db.delete(forumMessageVotes).where(eq((forumMessageVotes as any).id, existingVote.id));
    await db
      .update(forumMessages)
      .set({ voteCount: sql`GREATEST(0, ${forumMessages.voteCount} - 1)` })
      .where(eq((forumMessages as any).id, messageId));
    hasVoted = false;
  } else {
    await (db as any).insert(forumMessageVotes).values({ messageId, userId });
    await db
      .update(forumMessages)
      .set({ voteCount: sql`${forumMessages.voteCount} + 1` })
      .where(eq((forumMessages as any).id, messageId));
    hasVoted = true;
  }

  const updatedMsg = await (db.query as any).forumMessages.findFirst({
    where: (t: any, { eq }: any) => eq(t.id, messageId),
  });

  return c.json({
    success: true,
    voteCount: updatedMsg?.voteCount ?? 0,
    hasVoted,
  });
});

// --- HELPER RESOLUTION UTILISATEUR POUR APPELS VOCAUX (AUTHENTIFIÉ OU INVITÉ LOCAL) ---
function resolveVoiceUser(c: any) {
  const user = c.get('user');
  if (user) return user;
  // L'en-tête X-User-Id n'est pas authentifié : on ne l'utilise jamais comme
  // identité. Seul l'identifiant d'appareil, préfixé, sert d'identité éphémère.
  const deviceId = c.req.header('x-device-id') || '';
  const anonId = deviceId
    ? `guest:${deviceId}`
    : 'guest-' + Math.random().toString(36).slice(2, 10);
  return {
    id: anonId,
    displayName: 'Spectateur',
    isAdmin: false,
  };
}

// --- ROUTES POUR L'APPEL VOCAL DIRECT & VOCAUX CONTINUS ---

// Rejoindre l'appel vocal direct du sujet
forumRouter.post('/topics/:slug/call/join', async (c) => {
  const slug = (c.req.param('slug') || '').toLowerCase();
  const user = resolveVoiceUser(c);
  const body = await c.req.json().catch(() => ({}));
  const isMuted = Boolean(body.isMuted);

  const access = await canAccessPrivateTopic(user, slug);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  joinVoiceCall(slug, user.id, user.displayName || 'Participant', isMuted);
  const participants = getVoiceCallParticipants(slug);
  return c.json({ success: true, participants });
});

// Quitter l'appel vocal
forumRouter.post('/topics/:slug/call/leave', async (c) => {
  const slug = (c.req.param('slug') || '').toLowerCase();
  const user = resolveVoiceUser(c);

  leaveVoiceCall(slug, user.id);
  const participants = getVoiceCallParticipants(slug);
  return c.json({ success: true, participants });
});

// Ping de statut micro / présence dans l'appel
forumRouter.post('/topics/:slug/call/ping', async (c) => {
  const slug = (c.req.param('slug') || '').toLowerCase();
  const user = resolveVoiceUser(c);
  const body = await c.req.json().catch(() => ({}));

  const access = await canAccessPrivateTopic(user, slug);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const participants = pingVoiceCall(slug, user.id, body.isMuted);
  return c.json({ success: true, participants });
});

// Obtenir le statut de l'appel (réservé aux participants autorisés du salon)
forumRouter.get('/topics/:slug/call/status', async (c) => {
  const slug = (c.req.param('slug') || '').toLowerCase();
  const user = resolveVoiceUser(c);
  const access = await canAccessPrivateTopic(user, slug);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }
  const participants = getVoiceCallParticipants(slug);
  return c.json({ success: true, participants });
});

// Handler commun pour la soumission de fragments audio
async function handleVoiceChunkPost(c: any) {
  const slug = (c.req.param('slug') || '').toLowerCase();
  const user = resolveVoiceUser(c);
  const body = await c.req.json().catch(() => ({}));
  const { audioBase64, mimeType = 'audio/webm' } = body;

  if (typeof audioBase64 !== 'string' || !audioBase64) {
    return c.json({ error: 'Données audio manquantes' }, 400);
  }
  // Un fragment vocal est éphémère : borner sa taille évite de saturer la RAM.
  // 512 Ko laisse largement la place à plusieurs secondes d'Opus/WebM.
  if (audioBase64.length > 512 * 1024) {
    return c.json({ error: 'Fragment audio trop volumineux' }, 413);
  }

  const access = await canAccessPrivateTopic(user, slug);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const chunk = pushVoiceAudioChunk(
    slug,
    user.id,
    user.displayName || 'Participant',
    audioBase64,
    typeof mimeType === 'string' && mimeType.startsWith('audio/') ? mimeType : 'audio/webm'
  );

  return c.json({ success: true, chunkId: chunk.id });
}

// Handler commun pour la récupération des fragments audio
async function handleVoiceChunksGet(c: any) {
  const slug = (c.req.param('slug') || '').toLowerCase();
  const since = Math.max(0, Number(c.req.query('since') || 0) || 0);
  const user = resolveVoiceUser(c);

  // Les fragments audio d'un salon privé ne doivent pas être lisibles par un
  // visiteur qui ne participe pas à la conversation.
  const access = await canAccessPrivateTopic(user, slug);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const chunks = getVoiceAudioChunks(slug, since, user?.id);
  return c.json({ success: true, chunks });
}

// Routes supportant indifféremment /call/chunk et /voice/chunk
forumRouter.post('/topics/:slug/call/chunk', handleVoiceChunkPost);
forumRouter.post('/topics/:slug/voice/chunk', handleVoiceChunkPost);

// Routes supportant indifféremment /call/chunks et /voice/chunks
forumRouter.get('/topics/:slug/call/chunks', handleVoiceChunksGet);
forumRouter.get('/topics/:slug/voice/chunks', handleVoiceChunksGet);
