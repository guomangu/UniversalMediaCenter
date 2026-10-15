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
import { localizeMediaNode, extractRequestLanguage } from '../watcher/pipeline/localizationHelper.js';
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
    const userLang = extractRequestLanguage(c);
    const mediaRaw = await findMediaByIdOrSlug(id);
    if (!mediaRaw)
        return c.json({ error: 'Média introuvable' }, 404);
    const media = localizeMediaNode(mediaRaw, userLang);
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
    // 1. Récupération des enfants (films d'une collection/saga ou épisodes d'une série)
    const childNodes = await db.query.mediaNodes.findMany({
        where: (t, { eq, and }) => and(eq(t.parentId, media.id), eq(t.isExtra, false)),
    });
    const extraNodes = await db.query.mediaNodes.findMany({
        where: (t, { eq, and }) => and(eq(t.parentId, media.id), eq(t.isExtra, true)),
    });
    // 2. Fusion et héritage des métadonnées culturelles et techniques pour les sagas/collections
    // Si le média possède des films ou épisodes enfants, on fusionne les tags de tous ses enfants
    // ordonnés par fréquence d'apparition dans la saga (acteurs récurrents, réalisateurs, compositeurs, studios...)
    const linkedTags = childNodes.length > 0
        ? await db.execute(sql `
        SELECT a.code AS attr_code, a.display_name, a.ui_zone, a.color_theme, a.icon_name,
               v.value_text, v.value_slug, v.metadata_json,
               MAX(l.context_role) as context_role,
               MIN(l.order_index) as order_index,
               COUNT(DISTINCT l.node_id) as movie_occurrence_count
        FROM node_eav_links l
        JOIN eav_values v ON l.value_id = v.id
        JOIN eav_attributes a ON v.attribute_id = a.id
        WHERE l.node_id = ${media.id}::uuid
           OR l.node_id IN (SELECT id FROM media_nodes WHERE parent_id = ${media.id}::uuid AND is_extra = false)
        GROUP BY a.code, a.display_name, a.ui_zone, a.color_theme, a.icon_name,
                 v.value_text, v.value_slug, v.metadata_json, a.display_order
        ORDER BY a.display_order ASC, movie_occurrence_count DESC, MIN(l.order_index) ASC
      `)
        : await db.execute(sql `
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
    // 3. Calcul ou héritage des métriques globales (Note spectateurs moyenne et plage d'années)
    let effectiveCommunityRating = media.communityRating;
    if ((!effectiveCommunityRating || Number(effectiveCommunityRating) === 0) && childNodes.length > 0) {
        const validRatings = childNodes
            .map((c) => Number(c.communityRating))
            .filter((r) => !isNaN(r) && r > 0);
        if (validRatings.length > 0) {
            const avg = validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length;
            effectiveCommunityRating = Math.round(avg * 10) / 10;
        }
    }
    let effectiveReleaseYear = media.releaseYear ? media.releaseYear : undefined;
    if (childNodes.length > 0) {
        const years = childNodes
            .map((c) => Number(c.releaseYear))
            .filter((y) => !isNaN(y) && y > 1800 && y < 2100);
        if (years.length > 0) {
            const minYear = Math.min(...years);
            const maxYear = Math.max(...years);
            effectiveReleaseYear = minYear === maxYear ? minYear : `${minYear} - ${maxYear}`;
        }
    }
    const effectiveOverview = media.overview || (media.nodeType === 'COLLECTION' && childNodes.length > 0
        ? `Saga cinématographique regroupant ${childNodes.length} films et œuvres associées.`
        : undefined);
    const isEpOrSeason = media.nodeType === "EPISODE" || media.nodeType === "SEASON";
    const info = isEpOrSeason ? parseSeasonEpisode(media.title, media.orderIndex, media.nodeType) : null;
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
        communityRating: effectiveCommunityRating,
        releaseYear: effectiveReleaseYear ?? media.releaseYear,
        overview: effectiveOverview,
    };
    const children = childNodes.map((chRaw) => {
        const ch = localizeMediaNode(chRaw, userLang);
        const isChEpOrSeason = ch.nodeType === 'EPISODE' || ch.nodeType === 'SEASON';
        const chInfo = isChEpOrSeason ? parseSeasonEpisode(ch.title, ch.orderIndex, ch.nodeType) : null;
        let displayBadge = ch.title;
        let seasonEpisodeTag = null;
        if (ch.nodeType === 'MOVIE') {
            const isYear = ch.orderIndex >= 1880 && ch.orderIndex <= 2100;
            const filmNum = (!isYear && ch.orderIndex > 0) ? ch.orderIndex : null;
            displayBadge = filmNum ? `FILM ${filmNum}` : 'FILM';
            seasonEpisodeTag = filmNum ? `FILM${filmNum}` : 'FILM';
        }
        else if (chInfo?.displayBadge) {
            displayBadge = chInfo.displayBadge;
            seasonEpisodeTag = chInfo.seasonEpisodeTag;
        }
        else if (isChEpOrSeason && ch.orderIndex >= 1000 && (ch.orderIndex < 1880 || ch.orderIndex > 2100)) {
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
        else if (isChEpOrSeason && ch.orderIndex > 0 && (ch.orderIndex < 1880 || ch.orderIndex > 2100)) {
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
    // 4. Saga parente et films de la saga (si le média actuel est un film appartenant à une saga)
    let parentSaga = null;
    let targetParentId = media.parentId;
    if (!targetParentId && media.nodeType === 'MOVIE') {
        const setRows = await db.execute(sql `
      SELECT v.value_text FROM node_eav_links l
      JOIN eav_values v ON l.value_id = v.id
      JOIN eav_attributes a ON v.attribute_id = a.id
      WHERE l.node_id = ${media.id}::uuid AND a.code IN ('set', 'collection')
      LIMIT 1;
    `);
        const sRows = Array.isArray(setRows) ? setRows : setRows.rows || [];
        if (sRows.length > 0 && sRows[0].value_text) {
            const setName = String(sRows[0].value_text).trim();
            const colNode = await db.query.mediaNodes.findFirst({
                where: (t, { and, eq, or, ilike }) => and(eq(t.nodeType, 'COLLECTION'), or(eq(t.title, setName), ilike(t.title, `%${setName.replace(/\s*-\s*saga$/i, '').replace(/\s*collection$/i, '').trim()}%`))),
            });
            if (colNode) {
                targetParentId = colNode.id;
            }
        }
    }
    if (targetParentId) {
        const pNode = await db.query.mediaNodes.findFirst({
            where: (t, { eq }) => eq(t.id, targetParentId),
        });
        if (pNode) {
            const sagaSiblings = await db.query.mediaNodes.findMany({
                where: (t, { eq, and }) => and(eq(t.parentId, targetParentId), eq(t.isExtra, false)),
                orderBy: (t, { asc }) => [asc(t.orderIndex), asc(t.releaseYear), asc(t.title)],
            });
            parentSaga = {
                id: pNode.id,
                title: pNode.title,
                nodeType: pNode.nodeType,
                overview: pNode.overview,
                posterPath: pNode.posterPath ? `/api/media/${pNode.id}/poster` : undefined,
                fanartPath: pNode.fanartPath ? `/api/media/${pNode.id}/fanart` : undefined,
                movies: sagaSiblings.map((s) => ({
                    id: s.id,
                    title: s.title,
                    releaseYear: s.releaseYear,
                    nodeType: s.nodeType,
                    orderIndex: s.orderIndex,
                    communityRating: s.communityRating,
                    posterPath: s.posterPath ? `/api/media/${s.id}/poster` : (pNode.posterPath ? `/api/media/${pNode.id}/poster` : undefined),
                })),
            };
        }
    }
    // 5. Studios de production et films dépendants/associés
    const targetNodeId = media.id;
    const parentNodeId = targetParentId || '00000000-0000-0000-0000-000000000000';
    const studioFilmsRows = await db.execute(sql `
    SELECT DISTINCT v.value_text AS studio_name,
           m.id, m.title, m.release_year, m.poster_path, m.community_rating, m.node_type
    FROM node_eav_links l
    JOIN eav_values v ON l.value_id = v.id
    JOIN eav_attributes a ON v.attribute_id = a.id
    JOIN node_eav_links l2 ON l2.value_id = v.id
    JOIN media_nodes m ON l2.node_id = m.id
    WHERE a.code = 'studio'
      AND (l.node_id = ${targetNodeId}::uuid OR l.node_id = ${parentNodeId}::uuid)
      AND m.id != ${media.id}::uuid
      AND m.is_extra = false
      AND (m.node_type IN ('SHOW', 'COLLECTION') OR (m.node_type = 'MOVIE' AND (m.parent_id IS NULL OR m.parent_id != ${parentNodeId}::uuid)))
    ORDER BY v.value_text, m.community_rating DESC NULLS LAST, m.release_year DESC NULLS LAST
    LIMIT 60;
  `);
    const studioMap = new Map();
    const mediaStudios = await db.execute(sql `
    SELECT DISTINCT v.value_text AS studio_name
    FROM node_eav_links l
    JOIN eav_values v ON l.value_id = v.id
    JOIN eav_attributes a ON v.attribute_id = a.id
    WHERE a.code = 'studio'
      AND (l.node_id = ${targetNodeId}::uuid OR l.node_id = ${parentNodeId}::uuid);
  `);
    const rawStudioNames = Array.isArray(mediaStudios) ? mediaStudios : mediaStudios.rows || [];
    for (const sRow of rawStudioNames) {
        if (sRow.studio_name) {
            studioMap.set(sRow.studio_name, []);
        }
    }
    const rawStudioList = Array.isArray(studioFilmsRows) ? studioFilmsRows : studioFilmsRows.rows || [];
    for (const row of rawStudioList) {
        const sName = row.studio_name;
        if (!studioMap.has(sName))
            studioMap.set(sName, []);
        if (studioMap.get(sName).length < 15) {
            studioMap.get(sName).push({
                id: row.id,
                title: row.title,
                releaseYear: row.release_year,
                nodeType: row.node_type,
                communityRating: row.community_rating,
                posterPath: row.poster_path ? `/api/media/${row.id}/poster` : undefined,
            });
        }
    }
    const studioMedias = Array.from(studioMap.entries()).map(([studioName, medias]) => ({
        studioName,
        medias,
    }));
    const relatedTags = await getRelatedTagsForMedia(media.id, media.parentId);
    return c.json({
        media: formattedMedia,
        tags: tagsByZone,
        children,
        extras,
        parentSaga,
        studioMedias,
        relatedTags,
    });
});
export async function processSingleNfo(filePath) {
    return await processNfoFile(filePath);
}
