import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { userFriends, users } from '../db/schema/index.js';
import { eq, or, sql } from 'drizzle-orm';
import { getUserLastLocation } from '../watcher/presenceStore.js';
import { canUserAccessMediaNodeId } from '../auth/mediaAccess.js';

export const friendActionRouter = new Hono();

// Liste des amis, demandes reçues et demandes envoyées avec statut temps réel
friendActionRouter.get('/', async (c) => {
  const sessionUser = (c as any).get('user');
  const allFriendships = await db
    .select({
      id: userFriends.id,
      userId: userFriends.userId,
      friendId: userFriends.friendId,
      status: userFriends.status,
      createdAt: userFriends.createdAt,
    })
    .from(userFriends)
    .where(or(eq(userFriends.userId, sessionUser.id), eq(userFriends.friendId, sessionUser.id)));

  const acceptedList: any[] = [];
  const pendingReceived: any[] = [];
  const pendingSent: any[] = [];

  const now = Date.now();

  for (const f of allFriendships) {
    const isRequester = f.userId === sessionUser.id;
    const otherUserId = isRequester ? f.friendId : f.userId;
    const otherUser = await db.query.users.findFirst({
      where: (t, { eq }) => eq(t.id, otherUserId),
    });
    if (!otherUser) continue;

    const loc = await getUserLastLocation(otherUser.id);
    const isOnline = Boolean(loc && now - loc.updatedAt < 60000);
    let currentActivity =
      loc && isOnline && loc.isLive
        ? {
            isWatching: true,
            title: loc.title,
            mediaId: loc.mediaId,
            path: loc.path,
          }
        : null;

    // Zéro-Fuite : si l'ami regarde un média auquel l'utilisateur courant n'a pas accès (PBAC / ABAC),
    // on masque totalement l'activité (ne pas afficher de lien de position ou de bouton "Rejoindre ▶")
    const actMediaId =
      currentActivity?.mediaId ||
      (currentActivity?.path ? currentActivity.path.match(/\/(?:player|media)\/([0-9a-fA-F-]{36})/)?.[1] : null);
    if (currentActivity && actMediaId && (!sessionUser || !sessionUser.isAdmin)) {
      const allowed = await canUserAccessMediaNodeId(sessionUser, actMediaId);
      if (!allowed) {
        currentActivity = null;
      }
    }

    const dmTopicSlug = `dm-${[sessionUser.id, otherUser.id].sort().join('-')}`;

    const friendInfo = {
      friendshipId: f.id,
      userId: otherUser.id,
      displayName: otherUser.displayName,
      email: otherUser.email,
      avatarUrl: otherUser.avatarUrl,
      bio: otherUser.bio,
      dmTopicSlug,
      privateTopicSlug: `private-user-${otherUser.id}`,
      isOnline,
      currentActivity,
      createdAt: f.createdAt,
    };

    if (f.status === 'ACCEPTED') acceptedList.push(friendInfo);
    else if (f.status === 'PENDING') {
      if (isRequester) pendingSent.push(friendInfo);
      else pendingReceived.push(friendInfo);
    }
  }

  return c.json({ friends: acceptedList, pendingReceived, pendingSent });
});

// Envoyer une demande d'ami
friendActionRouter.post('/request', async (c) => {
  const sessionUser = (c as any).get('user');
  const body = await c.req.json().catch(() => ({}));
  const { targetEmail, targetUserId } = body;

  let targetUser = null;
  if (targetUserId) {
    targetUser = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, targetUserId) });
  } else if (targetEmail) {
    const cleanEmail = String(targetEmail).trim().toLowerCase();
    targetUser = await db.query.users.findFirst({ where: (t, { eq }) => eq(sql`lower(${t.email})`, cleanEmail) });
  }

  if (!targetUser) return c.json({ error: 'Utilisateur cible introuvable' }, 404);
  if (targetUser.id === sessionUser.id) return c.json({ error: 'Action impossible sur soi-même' }, 400);

  const existing = await db.query.userFriends.findFirst({
    where: (t, { or, and, eq }) =>
      or(
        and(eq(t.userId, sessionUser.id), eq(t.friendId, targetUser!.id)),
        and(eq(t.userId, targetUser!.id), eq(t.friendId, sessionUser.id))
      ),
  });

  if (existing) {
    if (existing.status === 'ACCEPTED') return c.json({ error: 'Vous êtes déjà amis' }, 400);
    if (existing.userId === sessionUser.id) return c.json({ error: 'Demande déjà en attente' }, 400);
    await db.update(userFriends).set({ status: 'ACCEPTED', updatedAt: new Date() }).where(eq(userFriends.id, existing.id));
    return c.json({ success: true, message: 'Demande mutuelle acceptée !', status: 'ACCEPTED' });
  }

  await db.insert(userFriends).values({ userId: sessionUser.id, friendId: targetUser.id, status: 'PENDING' });
  return c.json({ success: true, message: 'Demande envoyée avec succès' });
});

// Accepter une demande
friendActionRouter.post('/accept/:id', async (c) => {
  const sessionUser = (c as any).get('user');
  const friendshipId = c.req.param('id');
  const friendship = await db.query.userFriends.findFirst({ where: (t, { eq }) => eq(t.id, friendshipId) });
  if (!friendship || friendship.friendId !== sessionUser.id) {
    return c.json({ error: 'Demande introuvable ou non autorisée' }, 404);
  }
  await db.update(userFriends).set({ status: 'ACCEPTED', updatedAt: new Date() }).where(eq(userFriends.id, friendshipId));
  return c.json({ success: true, message: 'Demande acceptée !' });
});

// Refuser, annuler une demande ou retirer un ami
friendActionRouter.post('/reject/:id', async (c) => {
  const sessionUser = (c as any).get('user');
  const friendshipId = c.req.param('id');
  const friendship = await db.query.userFriends.findFirst({ where: (t, { eq }) => eq(t.id, friendshipId) });
  if (!friendship || (friendship.userId !== sessionUser.id && friendship.friendId !== sessionUser.id)) {
    return c.json({ error: 'Relation introuvable ou non autorisée' }, 404);
  }
  await db.delete(userFriends).where(eq(userFriends.id, friendshipId));
  return c.json({ success: true, message: 'Relation supprimée' });
});
