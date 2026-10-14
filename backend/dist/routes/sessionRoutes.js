import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { mediaSessions, mediaSessionParticipants, users, mediaNodes } from '../db/schema/index.js';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { requireAuth } from '../middleware/access.js';
import { getActiveMediaCounts } from '../watcher/presenceStore.js';
export const sessionRouter = new Hono();
// Proposer une nouvelle séance
sessionRouter.post('/', requireAuth, async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const { nodeId, topicSlug, title, scheduledAt } = body;
    if (!nodeId || !title) {
        return c.json({ error: 'nodeId et title sont requis' }, 400);
    }
    const [session] = await db
        .insert(mediaSessions)
        .values({
        nodeId,
        topicSlug: topicSlug || nodeId,
        hostUserId: user.id,
        hostDisplayName: user.displayName || 'Hôte',
        title,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        status: 'ACTIVE',
    })
        .returning();
    // Inscrire l'hôte comme participant initial
    await db.insert(mediaSessionParticipants).values({
        sessionId: session.id,
        userId: user.id,
        displayName: user.displayName || 'Hôte',
        isHost: true,
        isMuted: false,
    });
    return c.json({ success: true, session });
});
// Liste des séances actives et compteurs de visionnage par média (accessible publiquement)
sessionRouter.get('/active', async (c) => {
    const sessions = await db.query.mediaSessions.findMany({
        where: (t, { eq }) => eq(t.status, 'ACTIVE'),
        orderBy: [desc(mediaSessions.createdAt)],
        limit: 30,
    });
    const sessionIds = sessions.map((s) => s.id);
    const participants = sessionIds.length > 0
        ? await db
            .select({
            sessionId: mediaSessionParticipants.sessionId,
            userId: mediaSessionParticipants.userId,
            displayName: mediaSessionParticipants.displayName,
            isHost: mediaSessionParticipants.isHost,
            isMuted: mediaSessionParticipants.isMuted,
            isIncognito: users.isIncognito,
        })
            .from(mediaSessionParticipants)
            .leftJoin(users, eq(mediaSessionParticipants.userId, users.id))
            .where(inArray(mediaSessionParticipants.sessionId, sessionIds))
        : [];
    const grouped = sessions.map((s) => {
        // Filtrer les spectateurs discrets pour la visibilité publique
        const parts = participants.filter((p) => p.sessionId === s.id && !p.isIncognito);
        return {
            ...s,
            participants: parts,
            participantCount: parts.length,
        };
    });
    const liveMediaCounts = getActiveMediaCounts();
    return c.json({
        success: true,
        sessions: grouped,
        activeMediaCounts: liveMediaCounts,
    });
});
// Séances actives pour un média particulier (ou ses enfants)
sessionRouter.get('/media/:nodeId', async (c) => {
    const nodeId = c.req.param('nodeId');
    // Chercher les séances sur ce média ou ayant ce média en parent
    const sessions = await db
        .select({ session: mediaSessions })
        .from(mediaSessions)
        .leftJoin(mediaNodes, eq(mediaSessions.nodeId, mediaNodes.id))
        .where(and(eq(mediaSessions.status, 'ACTIVE'), sql `(${mediaSessions.nodeId} = ${nodeId}::uuid OR ${mediaNodes.parentId} = ${nodeId}::uuid)`));
    const flatSessions = sessions.map((r) => r.session);
    const sessionIds = flatSessions.map((s) => s.id);
    let totalViewers = 0;
    if (sessionIds.length > 0) {
        const counts = await db
            .select({ count: sql `count(*)::int` })
            .from(mediaSessionParticipants)
            .leftJoin(users, eq(mediaSessionParticipants.userId, users.id))
            .where(and(inArray(mediaSessionParticipants.sessionId, sessionIds), eq(users.isIncognito, false)));
        totalViewers = Number(counts[0]?.count ?? 0);
    }
    // Agréger aussi les spectateurs solo ou groupe actifs
    const liveMediaCounts = getActiveMediaCounts();
    const liveSoloCount = liveMediaCounts[nodeId]?.count || 0;
    totalViewers = Math.max(totalViewers, liveSoloCount);
    return c.json({
        success: true,
        sessions: flatSessions,
        totalViewers,
        hasActiveSession: flatSessions.length > 0 || totalViewers > 0,
    });
});
// Rejoindre une séance
sessionRouter.post('/:id/join', requireAuth, async (c) => {
    const sessionId = c.req.param('id');
    const user = c.get('user');
    await db
        .insert(mediaSessionParticipants)
        .values({
        sessionId,
        userId: user.id,
        displayName: user.displayName || 'Participant',
        isHost: false,
        isMuted: false,
    })
        .onConflictDoNothing();
    return c.json({ success: true });
});
// Quitter une séance
sessionRouter.post('/:id/leave', requireAuth, async (c) => {
    const sessionId = c.req.param('id');
    const user = c.get('user');
    await db
        .delete(mediaSessionParticipants)
        .where(and(eq(mediaSessionParticipants.sessionId, sessionId), eq(mediaSessionParticipants.userId, user.id)));
    return c.json({ success: true });
});
// Ping / Heartbeat & statut vocal
sessionRouter.post('/:id/ping', requireAuth, async (c) => {
    const sessionId = c.req.param('id');
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const { isMuted, currentPosition } = body;
    const session = await db.query.mediaSessions.findFirst({
        where: (t, { eq }) => eq(t.id, sessionId),
    });
    if (!session)
        return c.json({ error: 'Séance introuvable' }, 404);
    // Mettre à jour le participant
    await db
        .update(mediaSessionParticipants)
        .set({
        lastPingAt: new Date(),
        ...(typeof isMuted === 'boolean' ? { isMuted } : {}),
    })
        .where(and(eq(mediaSessionParticipants.sessionId, sessionId), eq(mediaSessionParticipants.userId, user.id)));
    // Si l'utilisateur est l'hôte et fournit une position, synchroniser
    if (session.hostUserId === user.id && typeof currentPosition === 'number') {
        await db
            .update(mediaSessions)
            .set({ currentPosition, updatedAt: new Date() })
            .where(eq(mediaSessions.id, sessionId));
    }
    const participants = await db
        .select({
        userId: mediaSessionParticipants.userId,
        displayName: mediaSessionParticipants.displayName,
        isHost: mediaSessionParticipants.isHost,
        isMuted: mediaSessionParticipants.isMuted,
        isIncognito: users.isIncognito,
    })
        .from(mediaSessionParticipants)
        .leftJoin(users, eq(mediaSessionParticipants.userId, users.id))
        .where(eq(mediaSessionParticipants.sessionId, sessionId));
    return c.json({
        success: true,
        session: {
            ...session,
            participants: participants.filter((p) => !p.isIncognito),
        },
    });
});
