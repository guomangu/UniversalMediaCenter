import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { mediaNodes, watchProgress } from '../db/schema/index.js';
import { sql, eq } from 'drizzle-orm';
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
    return c.json({ success: true, message: 'TMM webhook reçu' });
});
// Enregistrement de progression de lecture & présence active de séance
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
mediaRouter.delete('/:id/playback', async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const userId = user?.id || body.userId;
    if (userId) {
        const media = await findMediaByIdOrSlug(id);
        if (media) {
            removeActivePlayback(media.id, userId);
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
        HERO: [],
        PILLS: [],
        ACCORDION: [],
        BADGES: [],
    };
    for (const row of linkedTags.rows || []) {
        const zone = row.ui_zone || 'PILLS';
        if (!tagsByZone[zone])
            tagsByZone[zone] = [];
        tagsByZone[zone].push({
            attributeCode: row.attr_code,
            displayName: row.display_name,
            value: row.value_text,
            slug: row.value_slug,
            iconName: row.icon_name,
            colorTheme: row.color_theme,
            contextRole: row.context_role,
            metadata: row.metadata_json,
        });
    }
    const childNodes = await db.query.mediaNodes.findMany({
        where: (t, { eq, and }) => and(eq(t.parentId, media.id), eq(t.isExtra, false)),
    });
    const extraNodes = await db.query.mediaNodes.findMany({
        where: (t, { eq, and }) => and(eq(t.parentId, media.id), eq(t.isExtra, true)),
    });
    const info = parseSeasonEpisode(media.title, media.orderIndex);
    const formattedMedia = {
        ...media,
        posterPath: media.posterPath ? `/api/media/${media.id}/poster` : undefined,
        fanartPath: media.fanartPath ? `/api/media/${media.id}/fanart` : undefined,
        clearlogoPath: media.clearlogoPath ? `/api/media/${media.id}/clearlogo` : undefined,
        thumbPath: media.thumbPath ? `/api/media/${media.id}/thumb` : undefined,
        seasonEpisodeTag: info?.seasonEpisodeTag ?? null,
        displayBadge: info?.displayBadge ?? null,
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
        return {
            ...ch,
            posterPath: ch.posterPath ? `/api/media/${ch.id}/poster` : formattedMedia.posterPath,
            thumbPath: ch.thumbPath ? `/api/media/${ch.id}/thumb` : (ch.posterPath ? `/api/media/${ch.id}/poster` : undefined),
            seasonEpisodeTag,
            displayBadge,
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
