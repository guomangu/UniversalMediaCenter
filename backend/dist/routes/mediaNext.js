import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { parseSeasonEpisode } from '../watcher/seasonEpisodeHelper.js';
import { eq, and, asc, ilike } from 'drizzle-orm';
import path from 'node:path';
import { isMediaAllowedForUser } from '../auth/mediaAccess.js';
export const mediaNextRouter = new Hono();
function extractYear(str) {
    if (!str)
        return 0;
    const m = str.match(/\b(19\d{2}|20\d{2})\b/);
    return m ? parseInt(m[1], 10) : 0;
}
function extractPartNumber(title) {
    if (!title)
        return 0;
    const numMatch = title.match(/(?:part|partie|vol|volume|épisode|episode|saga|\b)\s*0*(\d+)/i);
    if (numMatch)
        return parseInt(numMatch[1], 10);
    const romanMap = {
        'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10,
    };
    const romanMatch = title.match(/\b([ivx]+)\b/i);
    if (romanMatch && romanMap[romanMatch[1].toLowerCase()]) {
        return romanMap[romanMatch[1].toLowerCase()];
    }
    return 0;
}
function extractSeasonNumber(title, orderIndex) {
    if (orderIndex && orderIndex > 0)
        return orderIndex;
    if (!title)
        return 1;
    const m = title.match(/S(?:aison|eason)?\s*0*(\d+)/i);
    return m ? parseInt(m[1], 10) : 1;
}
async function findFirstPlayableChild(parentId, user) {
    const children = await db.query.mediaNodes.findMany({
        where: (t, { eq }) => eq(t.parentId, parentId),
    });
    if (children.length === 0)
        return null;
    // Filtrer les enfants autorisés selon le profil utilisateur
    const allowed = children.filter((c) => isMediaAllowedForUser(user, c));
    if (allowed.length === 0)
        return null;
    // Si enfants directs sont des épisodes ou des films
    const playable = allowed.filter((c) => c.nodeType === 'EPISODE' || c.nodeType === 'MOVIE');
    if (playable.length > 0) {
        playable.sort((a, b) => {
            const aRank = parseSeasonEpisode(a.title, a.orderIndex)?.sortRank ?? a.orderIndex;
            const bRank = parseSeasonEpisode(b.title, b.orderIndex)?.sortRank ?? b.orderIndex;
            if (aRank !== bRank)
                return aRank - bRank;
            return a.title.localeCompare(b.title, undefined, { numeric: true });
        });
        return playable[0];
    }
    // Si enfants sont des saisons, chercher le premier épisode de la première saison
    const seasons = allowed.filter((c) => c.nodeType === 'SEASON');
    if (seasons.length > 0) {
        seasons.sort((a, b) => {
            const aNum = extractSeasonNumber(a.title, a.orderIndex);
            const bNum = extractSeasonNumber(b.title, b.orderIndex);
            return aNum - bNum;
        });
        return await findFirstPlayableChild(seasons[0].id, user);
    }
    return null;
}
mediaNextRouter.get('/:id/next', async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const current = await db.query.mediaNodes.findFirst({
        where: (t, { eq }) => eq(t.id, id),
    });
    if (!current) {
        return c.json({ error: 'Média introuvable' }, 404);
    }
    if (!isMediaAllowedForUser(user, current)) {
        return c.json({ error: 'Accès non autorisé', code: 'FORBIDDEN' }, 403);
    }
    // 1. Cas d'un épisode de série / anime
    if (current.nodeType === 'EPISODE' && current.parentId) {
        const rawSiblings = await db.query.mediaNodes.findMany({
            where: (t, { eq }) => eq(t.parentId, current.parentId),
        });
        const siblings = rawSiblings.filter((s) => isMediaAllowedForUser(user, s));
        const currentParsed = parseSeasonEpisode(current.title, current.orderIndex);
        const currentRank = currentParsed?.sortRank ?? (current.orderIndex > 0 ? current.orderIndex : 0);
        // 1A. Épisode suivant dans le même conteneur (même saison ou série directe)
        const futureSiblings = siblings
            .filter((s) => s.id !== current.id)
            .map((s) => ({
            node: s,
            rank: parseSeasonEpisode(s.title, s.orderIndex)?.sortRank ?? (s.orderIndex > 0 ? s.orderIndex : 0),
            info: parseSeasonEpisode(s.title, s.orderIndex),
        }))
            .filter((item) => {
            if (item.rank > currentRank)
                return true;
            if (item.rank === currentRank && currentRank === 0) {
                return item.node.title.localeCompare(current.title, undefined, { numeric: true }) > 0;
            }
            return false;
        })
            .sort((a, b) => {
            if (a.rank !== b.rank)
                return a.rank - b.rank;
            return a.node.title.localeCompare(b.node.title, undefined, { numeric: true });
        });
        if (futureSiblings.length > 0) {
            const next = futureSiblings[0].node;
            const info = futureSiblings[0].info;
            return c.json({
                nextNode: {
                    id: next.id,
                    title: next.title,
                    nodeType: next.nodeType,
                    orderIndex: next.orderIndex,
                    posterPath: next.posterPath ? `/api/media/${next.id}/poster` : `/api/media/${current.id}/poster`,
                    runtimeSeconds: next.runtimeSeconds,
                    seasonEpisodeTag: info?.seasonEpisodeTag ?? `EP ${next.orderIndex || 1}`,
                    displayBadge: info?.displayBadge ?? `EP ${next.orderIndex || 1}`,
                },
            });
        }
        // 1B. Fin de saison : passage automatique à la saison suivante de la série
        const parentNode = await db.query.mediaNodes.findFirst({
            where: (t, { eq }) => eq(t.id, current.parentId),
        });
        if (parentNode?.nodeType === 'SEASON' && parentNode.parentId) {
            const currentSeasonNum = extractSeasonNumber(parentNode.title, parentNode.orderIndex);
            const allSeasons = await db.query.mediaNodes.findMany({
                where: (t, { eq, and }) => and(eq(t.parentId, parentNode.parentId), eq(t.nodeType, 'SEASON')),
            });
            const nextSeasons = allSeasons
                .map((s) => ({ node: s, num: extractSeasonNumber(s.title, s.orderIndex) }))
                .filter((item) => item.num > currentSeasonNum)
                .sort((a, b) => a.num - b.num);
            for (const item of nextSeasons) {
                const nextSeason = item.node;
                const firstEp = await findFirstPlayableChild(nextSeason.id, user);
                if (firstEp) {
                    const info = parseSeasonEpisode(firstEp.title, firstEp.orderIndex);
                    return c.json({
                        nextNode: {
                            id: firstEp.id,
                            title: firstEp.title,
                            nodeType: firstEp.nodeType,
                            orderIndex: firstEp.orderIndex,
                            posterPath: firstEp.posterPath ? `/api/media/${firstEp.id}/poster` : `/api/media/${current.id}/poster`,
                            runtimeSeconds: firstEp.runtimeSeconds,
                            seasonEpisodeTag: info?.seasonEpisodeTag ?? `S${item.num}EP01`,
                            displayBadge: info?.displayBadge ?? `S${String(item.num).padStart(2, '0')} • EP 01`,
                        },
                    });
                }
            }
        }
        // 1C. Fin de série complète : enchaînement sur la série ou saison suivante dans la saga
        const showNode = parentNode?.nodeType === 'SHOW'
            ? parentNode
            : (parentNode?.parentId ? await db.query.mediaNodes.findFirst({ where: (t, { eq }) => eq(t.id, parentNode.parentId) }) : null);
        if (showNode?.parentId) {
            const siblingShows = await db.query.mediaNodes.findMany({
                where: (t, { eq, and }) => and(eq(t.parentId, showNode.parentId), eq(t.nodeType, 'SHOW')),
            });
            siblingShows.sort((a, b) => {
                if (a.orderIndex !== b.orderIndex)
                    return a.orderIndex - b.orderIndex;
                const aYear = a.releaseYear || extractYear(a.title);
                const bYear = b.releaseYear || extractYear(b.title);
                if (aYear !== bYear)
                    return aYear - bYear;
                return a.title.localeCompare(b.title, undefined, { numeric: true });
            });
            const curShowIdx = siblingShows.findIndex((s) => s.id === showNode.id);
            if (curShowIdx !== -1) {
                for (let idx = curShowIdx + 1; idx < siblingShows.length; idx++) {
                    const nextShow = siblingShows[idx];
                    const firstEp = await findFirstPlayableChild(nextShow.id, user);
                    if (firstEp) {
                        const info = parseSeasonEpisode(firstEp.title, firstEp.orderIndex);
                        return c.json({
                            nextNode: {
                                id: firstEp.id,
                                title: `${nextShow.title} - ${firstEp.title}`,
                                nodeType: firstEp.nodeType,
                                orderIndex: firstEp.orderIndex,
                                posterPath: firstEp.posterPath ? `/api/media/${firstEp.id}/poster` : `/api/media/${nextShow.id}/poster`,
                                runtimeSeconds: firstEp.runtimeSeconds,
                                seasonEpisodeTag: info?.seasonEpisodeTag ?? 'Saga EP 1',
                                displayBadge: `Saga: ${nextShow.title}`,
                            },
                        });
                    }
                }
            }
        }
    }
    // 2. Cas d'un film dans une collection / franchise / saga
    if (current.nodeType === 'MOVIE') {
        let rawCollectionMovies = [];
        if (current.parentId) {
            rawCollectionMovies = await db.query.mediaNodes.findMany({
                where: (t, { eq, and }) => and(eq(t.parentId, current.parentId), eq(t.nodeType, 'MOVIE')),
            });
        }
        else if (current.videoFilePath) {
            const parentDir = path.dirname(current.videoFilePath);
            rawCollectionMovies = await db.query.mediaNodes.findMany({
                where: (t, { eq, and, ilike }) => and(eq(t.nodeType, 'MOVIE'), ilike(t.videoFilePath, `${parentDir}/%`)),
            });
        }
        const collectionMovies = rawCollectionMovies.filter((m) => isMediaAllowedForUser(user, m));
        if (collectionMovies.length > 1) {
            const getMovieScore = (m) => {
                if (m.orderIndex && m.orderIndex > 0)
                    return m.orderIndex * 100000;
                const y = m.releaseYear || extractYear(m.videoFilePath) || extractYear(m.title);
                const p = extractPartNumber(m.title) || extractPartNumber(m.videoFilePath);
                return (y ? y * 100 : 0) + p;
            };
            collectionMovies.sort((a, b) => {
                const scoreA = getMovieScore(a);
                const scoreB = getMovieScore(b);
                if (scoreA !== scoreB)
                    return scoreA - scoreB;
                return a.title.localeCompare(b.title, undefined, { numeric: true });
            });
            const currentIdx = collectionMovies.findIndex((m) => m.id === current.id);
            if (currentIdx !== -1 && currentIdx + 1 < collectionMovies.length) {
                const nextMovie = collectionMovies[currentIdx + 1];
                const nextYear = nextMovie.releaseYear || extractYear(nextMovie.videoFilePath) || extractYear(nextMovie.title);
                return c.json({
                    nextNode: {
                        id: nextMovie.id,
                        title: nextMovie.title,
                        nodeType: nextMovie.nodeType,
                        orderIndex: nextMovie.orderIndex,
                        posterPath: nextMovie.posterPath ? `/api/media/${nextMovie.id}/poster` : undefined,
                        runtimeSeconds: nextMovie.runtimeSeconds,
                        seasonEpisodeTag: null,
                        displayBadge: nextYear ? `Suite (${nextYear})` : 'Film suivant',
                    },
                });
            }
        }
    }
    return c.json({ nextNode: null });
});
