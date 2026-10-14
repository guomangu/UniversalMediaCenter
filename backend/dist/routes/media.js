import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { mediaNodes, watchProgress } from '../db/schema/index.js';
import { sql, eq, and, desc, inArray } from 'drizzle-orm';
import { artworkRouter } from './mediaArtworks.js';
import { streamRouter } from './mediaStream.js';
import { statsRouter } from './mediaStats.js';
import { subtitleRouter } from './mediaSubtitles.js';
import { tracksRouter } from './mediaTracks.js';
import { mediaNextRouter } from './mediaNext.js';
import { processNfoFile } from '../watcher/index.js';
import { getRelatedTagsForMedia } from './mediaRelated.js';
import { parseSeasonEpisode } from '../watcher/seasonEpisodeHelper.js';
import { fetchExternalMetadata, cleanShowTitle } from '../watcher/externalMetadata.js';
import { linkTagToNode } from '../watcher/tagExtractor.js';
import { createShareToken } from '../auth/shareToken.js';
import { checkMediaAccess } from '../auth/mediaAccess.js';
import { requireAuth } from '../middleware/access.js';
import { recordActivePlayback, removeActivePlayback } from '../watcher/presenceStore.js';
import { removeUserFromMediaSessions } from './sessionRoutes.js';
export const mediaRouter = new Hono();
mediaRouter.route('/', artworkRouter);
mediaRouter.route('/', streamRouter);
mediaRouter.route('/', statsRouter);
mediaRouter.route('/', subtitleRouter);
mediaRouter.route('/', tracksRouter);
mediaRouter.route('/', mediaNextRouter);
const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
async function findMediaByIdOrSlug(idOrSlug) {
    if (!idOrSlug)
        return null;
    if (isUuid(idOrSlug)) {
        return await db.query.mediaNodes.findFirst({
            where: (t, { eq }) => eq(t.id, idOrSlug),
        });
    }
    return await db.query.mediaNodes.findFirst({
        where: (t, { eq }) => eq(t.slug, idOrSlug),
    });
}
mediaRouter.post('/webhook/tmm', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const filePath = body.path || body.filePath;
    if (filePath && typeof filePath === 'string' && filePath.endsWith('.nfo')) {
        await processNfoFile(filePath);
        return c.json({ success: true, reindexed: filePath });
    }
    return c.json({ error: 'Chemin de fichier .nfo invalide' }, 400);
});
mediaRouter.post('/:id/reindex', requireAuth, async (c) => {
    const id = c.req.param('id');
    const media = await findMediaByIdOrSlug(id);
    if (!media || !media.nfoFilePath) {
        return c.json({ error: 'Fichier NFO introuvable pour ce média' }, 404);
    }
    const updatedNode = await processNfoFile(media.nfoFilePath);
    return c.json({ success: true, node: updatedNode });
});
mediaRouter.post('/:id/progress', async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const userId = user?.id || body.userId;
    const positionSeconds = Number(body.positionSeconds || 0);
    const durationSeconds = Number(body.durationSeconds || 0);
    const isPlaying = body.isPlaying !== false;
    if (!userId)
        return c.json({ error: 'User ID requis' }, 400);
    const media = await findMediaByIdOrSlug(id);
    if (!media)
        return c.json({ error: 'Média introuvable' }, 404);
    const isCompleted = durationSeconds > 0 && positionSeconds / durationSeconds > 0.9;
    // Persister dans la table PostgreSQL watch_progress
    await db
        .insert(watchProgress)
        .values({
        userId,
        nodeId: media.id,
        positionSeconds,
        durationSeconds,
        isCompleted,
        updatedAt: new Date(),
    })
        .onConflictDoUpdate({
        target: [watchProgress.userId, watchProgress.nodeId],
        set: {
            positionSeconds,
            durationSeconds,
            isCompleted,
            updatedAt: new Date(),
        },
    });
    // Enregistrer le spectateur actif dans le registre de présence (solo ou groupe)
    recordActivePlayback(media.id, media.parentId, userId, user?.displayName || 'Spectateur', media.title, isPlaying);
    return c.json({ success: true });
});
mediaRouter.get('/:id/progress', requireAuth, async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const media = await findMediaByIdOrSlug(id);
    if (!media)
        return c.json({ error: 'Média introuvable' }, 404);
    const prog = await db.query.watchProgress.findFirst({
        where: (t, { and, eq }) => and(eq(t.userId, user.id), eq(t.nodeId, media.id)),
    });
    const pos = prog?.positionSeconds ?? 0;
    const dur = prog?.durationSeconds || media.runtimeSeconds || 0;
    const progressPercent = dur > 0 ? Math.round((pos / dur) * 100) : (prog?.isCompleted ? 100 : 0);
    return c.json({
        positionSeconds: pos,
        durationSeconds: dur,
        isCompleted: prog?.isCompleted ?? false,
        progressPercent,
    });
});
mediaRouter.delete('/:id/playback', async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const userId = user?.id || body.userId;
    if (userId) {
        const media = await findMediaByIdOrSlug(id);
        if (media) {
            removeActivePlayback(media.id, userId);
            await removeUserFromMediaSessions(media.id, userId);
        }
    }
    return c.json({ success: true });
});
mediaRouter.post('/:id/share-token', requireAuth, async (c) => {
    const id = c.req.param('id');
    const media = await findMediaByIdOrSlug(id);
    if (!media)
        return c.json({ error: 'Média introuvable' }, 404);
    const token = createShareToken(media.id, 7);
    return c.json({
        success: true,
        mediaId: media.id,
        shareToken: token,
        expiresInDays: 7,
    });
});
mediaRouter.get('/:id/extras', async (c) => {
    const id = c.req.param('id');
    const media = await findMediaByIdOrSlug(id);
    if (!media)
        return c.json({ error: 'Média introuvable' }, 404);
    const extras = await db.query.mediaNodes.findMany({
        where: (t, { eq, and }) => and(eq(t.parentId, media.id), eq(t.isExtra, true)),
    });
    return c.json(extras.map((ex) => ({
        ...ex,
        posterPath: ex.posterPath ? `/api/media/${ex.id}/poster` : (media.posterPath ? `/api/media/${media.id}/poster` : undefined),
        thumbPath: ex.thumbPath ? `/api/media/${ex.id}/thumb` : undefined,
    })));
});
mediaRouter.post('/:id/match', requireAuth, async (c) => {
    const id = c.req.param('id');
    const media = await findMediaByIdOrSlug(id);
    if (!media)
        return c.json({ error: 'Média introuvable' }, 404);
    const body = await c.req.json().catch(() => ({}));
    const targetTitle = body.title || cleanShowTitle(media.title);
    const external = await fetchExternalMetadata(targetTitle, media.nodeType);
    if (!external) {
        return c.json({ error: 'Aucune correspondance trouvée sur les bases externes' }, 404);
    }
    const updates = {
        overview: external.overview || media.overview,
        releaseYear: external.releaseYear || media.releaseYear,
        communityRating: external.communityRating || media.communityRating,
        confidenceScore: 1.0,
        updatedAt: new Date(),
    };
    if (external.posterUrl && !media.posterPath)
        updates.posterPath = external.posterUrl;
    if (external.fanartUrl && !media.fanartPath)
        updates.fanartPath = external.fanartUrl;
    await db.update(mediaNodes).set(updates).where(eq(mediaNodes.id, media.id));
    for (const g of external.genres || []) {
        await linkTagToNode(media.id, 'genre', g);
    }
    return c.json({
        success: true,
        matchedTitle: external.title,
        externalSource: "TVmaze/Wikipedia",
    });
});
mediaRouter.get('/:id', async (c) => {
    const id = c.req.param('id');
    const shareToken = c.req.query('share_token');
    const user = c.get('user');
    const media = await findMediaByIdOrSlug(id);
    if (!media)
        return c.json({ error: 'Média introuvable' }, 404);
    const isAuthorized = checkMediaAccess(user, media.id, shareToken, media.parentId, media.nodeType, {
        videoFilePath: media.videoFilePath,
        nfoFilePath: media.nfoFilePath,
        searchVectorText: media.searchVectorText,
    });
    if (!isAuthorized) {
        return c.json({
            error: 'Connexion requise pour accéder à ce contenu ou lien de partage expiré',
            code: 'UNAUTHORIZED',
        }, 401);
    }
    const linkedTags = await db.execute(sql `
    SELECT a.code AS attr_code, a.display_name, a.ui_zone, a.color_theme, a.icon_name,
           v.value_text, v.value_slug, v.metadata_json, l.context_role, l.order_index
    FROM node_eav_links l
    JOIN eav_values v ON l.value_id = v.id
    JOIN eav_attributes a ON v.attribute_id = a.id
    WHERE l.node_id = ${media.id}::uuid
    ORDER BY a.display_order ASC, l.order_index ASC
  `);
    const tagsByZone = {
        HERO_BADGE: [],
        PRIMARY_PILL: [],
        PERSON_CAROUSEL: [],
        TECHNICAL_DRAWER: [],
        HIDDEN_SEARCHABLE: [],
        // Short aliases for cross-compatibility
        HERO: [],
        PILLS: [],
        ACCORDION: [],
        BADGES: [],
    };
    const rows = (Array.isArray(linkedTags) ? linkedTags : linkedTags.rows || []);
    for (const row of rows) {
        const zone = row.ui_zone || 'PRIMARY_PILL';
        if (!tagsByZone[zone])
            tagsByZone[zone] = [];
        const item = {
            attr_code: row.attr_code,
            attributeCode: row.attr_code,
            display_name: row.display_name,
            displayName: row.display_name,
            ui_zone: row.ui_zone,
            uiZone: row.ui_zone,
            color_theme: row.color_theme,
            colorTheme: row.color_theme,
            icon_name: row.icon_name,
            iconName: row.icon_name,
            value_text: row.value_text,
            value: row.value_text,
            value_slug: row.value_slug,
            slug: row.value_slug,
            context_role: row.context_role,
            contextRole: row.context_role,
            metadata_json: row.metadata_json || {},
            metadata: row.metadata_json || {},
            order_index: row.order_index,
            orderIndex: row.order_index,
        };
        tagsByZone[zone].push(item);
        if (zone === 'HERO_BADGE')
            tagsByZone.HERO.push(item);
        if (zone === 'PRIMARY_PILL')
            tagsByZone.PILLS.push(item);
        if (zone === 'TECHNICAL_DRAWER')
            tagsByZone.ACCORDION.push(item);
    }
    const childNodes = await db.query.mediaNodes.findMany({
        where: (t, { eq, and }) => and(eq(t.parentId, media.id), eq(t.isExtra, false)),
    });
    const extraNodes = await db.query.mediaNodes.findMany({
        where: (t, { eq, and }) => and(eq(t.parentId, media.id), eq(t.isExtra, true)),
    });
    const info = parseSeasonEpisode(media.title, media.orderIndex);
    // Récupération de la progression de lecture (watchProgress) pour l'utilisateur
    const progressMap = new Map();
    if (user?.id) {
        const allIds = [media.id, ...childNodes.map((c) => c.id)];
        const progresses = await db.query.watchProgress.findMany({
            where: (t, { and, eq, inArray }) => and(eq(t.userId, user.id), inArray(t.nodeId, allIds)),
        });
        for (const p of progresses) {
            const dur = p.durationSeconds || 0;
            const pos = p.positionSeconds || 0;
            const progressPercent = dur > 0 ? Math.round((pos / dur) * 100) : (p.isCompleted ? 100 : 0);
            progressMap.set(p.nodeId, {
                positionSeconds: pos,
                durationSeconds: dur,
                isCompleted: p.isCompleted,
                progressPercent,
            });
        }
    }
    // Détection du point de reprise intelligent pour les séries/saisons
    let resumeEpisodeId = null;
    let resumeTitle = null;
    let resumePositionSeconds = 0;
    if (childNodes.length > 0) {
        // 1. Chercher un épisode en cours de lecture non terminé
        const inProgressEpisode = childNodes.find((ch) => {
            const p = progressMap.get(ch.id);
            return p && p.progressPercent > 0 && !p.isCompleted;
        });
        if (inProgressEpisode) {
            const p = progressMap.get(inProgressEpisode.id);
            resumeEpisodeId = inProgressEpisode.id;
            resumeTitle = inProgressEpisode.title;
            resumePositionSeconds = p.positionSeconds;
        }
        else {
            // 2. Chercher le premier épisode non terminé
            const nextUnfinished = childNodes.find((ch) => {
                const p = progressMap.get(ch.id);
                return !p || !p.isCompleted;
            });
            if (nextUnfinished) {
                resumeEpisodeId = nextUnfinished.id;
                resumeTitle = nextUnfinished.title;
                resumePositionSeconds = 0;
            }
        }
    }
    const mediaProgress = progressMap.get(media.id);
    const formattedMedia = {
        ...media,
        posterPath: media.posterPath ? `/api/media/${media.id}/poster` : undefined,
        fanartPath: media.fanartPath ? `/api/media/${media.id}/fanart` : undefined,
        clearlogoPath: media.clearlogoPath ? `/api/media/${media.id}/clearlogo` : undefined,
        thumbPath: media.thumbPath ? `/api/media/${media.id}/thumb` : undefined,
        seasonEpisodeTag: info?.seasonEpisodeTag ?? null,
        displayBadge: info?.displayBadge ?? null,
        positionSeconds: mediaProgress?.positionSeconds ?? 0,
        durationSeconds: mediaProgress?.durationSeconds ?? (media.runtimeSeconds || 0),
        progressPercent: mediaProgress?.progressPercent ?? 0,
        isCompleted: mediaProgress?.isCompleted ?? false,
        resumeEpisodeId: resumeEpisodeId || (childNodes.length > 0 ? childNodes[0].id : null),
        resumeTitle,
        resumePositionSeconds,
    };
    const children = childNodes.map((ch) => {
        const chInfo = parseSeasonEpisode(ch.title, ch.orderIndex);
        let displayBadge = ch.title;
        let seasonEpisodeTag = null;
        if (ch.nodeType === 'MOVIE') {
            displayBadge = ch.orderIndex > 0 ? `FILM ${ch.orderIndex}` : 'FILM';
            seasonEpisodeTag = ch.orderIndex > 0 ? `FILM${ch.orderIndex}` : 'FILM';
        }
        else if (chInfo?.displayBadge) {
            displayBadge = chInfo.displayBadge;
            seasonEpisodeTag = chInfo.seasonEpisodeTag;
        }
        else if (ch.orderIndex >= 1000) {
            const s = Math.floor(ch.orderIndex / 1000);
            const e = ch.orderIndex % 1000;
            const sStr = String(s).padStart(2, '0');
            const eStr = String(e).padStart(2, '0');
            displayBadge = `S${sStr} • EP ${eStr}`;
            seasonEpisodeTag = `S${sStr}E${eStr}`;
        }
        else if (ch.absoluteOrderIndex && ch.absoluteOrderIndex > 0 && ch.absoluteOrderIndex < 1000) {
            displayBadge = `EP ${String(ch.absoluteOrderIndex).padStart(2, '0')}`;
            seasonEpisodeTag = `E${String(ch.absoluteOrderIndex).padStart(2, '0')}`;
        }
        else if (ch.orderIndex > 0) {
            displayBadge = `EP ${String(ch.orderIndex).padStart(2, '0')}`;
            seasonEpisodeTag = `E${String(ch.orderIndex).padStart(2, '0')}`;
        }
        const chProg = progressMap.get(ch.id);
        return {
            ...ch,
            posterPath: ch.posterPath ? `/api/media/${ch.id}/poster` : formattedMedia.posterPath,
            thumbPath: ch.thumbPath ? `/api/media/${ch.id}/thumb` : (ch.posterPath ? `/api/media/${ch.id}/poster` : undefined),
            seasonEpisodeTag,
            displayBadge,
            positionSeconds: chProg?.positionSeconds ?? 0,
            durationSeconds: chProg?.durationSeconds ?? (ch.runtimeSeconds || 0),
            progressPercent: chProg?.progressPercent ?? 0,
            isCompleted: chProg?.isCompleted ?? false,
        };
    });
    const extras = extraNodes.map((ex) => ({
        ...ex,
        posterPath: ex.posterPath ? `/api/media/${ex.id}/poster` : formattedMedia.posterPath,
        thumbPath: ex.thumbPath ? `/api/media/${ex.id}/thumb` : undefined,
    }));
    const relatedTags = await getRelatedTagsForMedia(media.id, media.parentId);
    return c.json({
        media: formattedMedia,
        tags: tagsByZone,
        children,
        extras,
        relatedTags,
    });
});
export async function processSingleNfo(filePath) {
    return await processNfoFile(filePath);
}
