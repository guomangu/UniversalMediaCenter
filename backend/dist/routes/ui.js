import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { uiRails, mediaNodes, eavAttributes } from '../db/schema/index.js';
import { desc, asc } from 'drizzle-orm';
import { taxonomyRouter } from './taxonomyRoutes.js';
import { requireAuth } from '../middleware/access.js';
export const uiRouter = new Hono();
// Toutes les requêtes UI (listes, rails, tags, taxonomie) exigent d'être authentifié
uiRouter.use('*', requireAuth);
// Taxonomie hiérarchique Catégories < Tags < Médias
uiRouter.route('/taxonomy', taxonomyRouter);
function formatMediaItem(item) {
    return {
        ...item,
        posterPath: item.posterPath ? `/api/media/${item.id}/poster` : undefined,
        fanartPath: item.fanartPath ? `/api/media/${item.id}/fanart` : undefined,
    };
}
uiRouter.get('/layout', async (c) => {
    const pageTarget = c.req.query('page') || 'HOME';
    const rails = await db.query.uiRails.findMany({
        where: (t, { and, eq }) => and(eq(t.pageTarget, pageTarget), eq(t.isActive, true)),
        orderBy: [asc(uiRails.sortOrder)],
    });
    const hydratedRails = await Promise.all(rails.map(async (rail) => {
        let items = [];
        const limit = rail.queryConfigJson?.limit || 15;
        if (rail.railType === 'HERO_SPOTLIGHT') {
            items = await db.query.mediaNodes.findMany({
                where: (t, { inArray }) => inArray(t.nodeType, ['MOVIE', 'SHOW', 'EPISODE']),
                orderBy: [desc(mediaNodes.createdAt)],
                limit: 5,
            });
        }
        else if (rail.railType === 'RECENTLY_ADDED') {
            items = await db.query.mediaNodes.findMany({
                where: (t, { inArray }) => inArray(t.nodeType, ['MOVIE', 'SHOW', 'EPISODE']),
                orderBy: [desc(mediaNodes.createdAt)],
                limit,
            });
        }
        else if (rail.railType === 'LIVE_TV_GRID') {
            items = await db.query.mediaNodes.findMany({
                where: (t, { eq }) => eq(t.nodeType, 'LIVE_CHANNEL'),
                limit,
            });
        }
        else if (rail.railType === 'COLLECTIONS_ROW') {
            items = await db.query.mediaNodes.findMany({
                where: (t, { inArray }) => inArray(t.nodeType, ['COLLECTION', 'SHOW']),
                limit,
            });
        }
        else {
            items = await db.query.mediaNodes.findMany({
                where: (t, { inArray }) => inArray(t.nodeType, ['MOVIE', 'SHOW', 'EPISODE']),
                orderBy: [desc(mediaNodes.communityRating)],
                limit,
            });
        }
        return {
            id: rail.id,
            title: rail.title,
            railType: rail.railType,
            cardStyle: rail.cardStyle,
            sortOrder: rail.sortOrder,
            items: items.map(formatMediaItem),
        };
    }));
    return c.json({ rails: hydratedRails });
});
uiRouter.get('/tags', async (c) => {
    const attributes = await db.query.eavAttributes.findMany({
        orderBy: [asc(eavAttributes.displayOrder)],
    });
    return c.json({ attributes });
});
