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
    WHERE l.node_id = ${media.id}
    ORDER BY a.display_order ASC, l.order_index ASC;
  `);
    const tagsByZone = {
        HERO_BADGE: [],
        PRIMARY_PILL: [],
        PERSON_CAROUSEL: [],
        TECHNICAL_DRAWER: [],
    };
    for (const row of Array.from(linkedTags)) {
        const zone = row.ui_zone || 'PRIMARY_PILL';
        if (!tagsByZone[zone])
            tagsByZone[zone] = [];
        tagsByZone[zone].push(row);
    }
    const childNodes = await db.query.mediaNodes.findMany({
        where: (t, { eq }) => eq(t.parentId, media.id),
        orderBy: (t, { asc }) => [asc(t.orderIndex), asc(t.sortTitle)],
        limit: 2000,
    });
    const parsedInfo = parseSeasonEpisode(media.title, media.absoluteOrderIndex ?? media.orderIndex);
    const formattedMedia = {
        ...media,
        posterPath: media.posterPath ? `/api/media/${media.id}/poster` : undefined,
        fanartPath: media.fanartPath ? `/api/media/${media.id}/fanart` : undefined,
        clearlogoPath: media.clearlogoPath ? `/api/media/${media.id}/clearlogo` : undefined,
        thumbPath: media.thumbPath ? `/api/media/${media.id}/thumb` : undefined,
        seasonEpisodeTag: parsedInfo?.seasonEpisodeTag ?? null,
        displayBadge: parsedInfo?.displayBadge ?? null,
        edition: media.edition || null,
        confidenceScore: media.confidenceScore ?? 1.0,
        isExtra: media.isExtra,
        extraType: media.extraType,
        chaptersJson: media.chaptersJson || [],
    };
    const regularChildren = childNodes.filter((ch) => !ch.isExtra);
    const extraNodes = childNodes.filter((ch) => ch.isExtra);
    const children = regularChildren.map((ch) => {
        const chInfo = parseSeasonEpisode(ch.title, ch.orderIndex);
        let displayBadge = null;
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
