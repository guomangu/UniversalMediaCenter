import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { uiRails, mediaNodes, eavAttributes } from '../db/schema/index.js';
import { eq, desc, asc } from 'drizzle-orm';

export const uiRouter = new Hono();

// Configuration complète du layout d'accueil Server-Driven UI
uiRouter.get('/layout', async (c) => {
  const pageTarget = c.req.query('page') || 'HOME';
  const rails = await db.query.uiRails.findMany({
    where: (t, { and, eq }) => and(eq(t.pageTarget, pageTarget), eq(t.isActive, true)),
    orderBy: [asc(uiRails.sortOrder)],
  });

  const hydratedRails = await Promise.all(
    rails.map(async (rail) => {
      let items: any[] = [];
      const limit = rail.queryConfigJson?.limit || 15;

      if (rail.railType === 'HERO_SPOTLIGHT') {
        items = await db.query.mediaNodes.findMany({
          where: (t, { inArray }) => inArray(t.nodeType, ['MOVIE', 'SHOW']),
          orderBy: [desc(mediaNodes.createdAt)],
          limit: 5,
        });
      } else if (rail.railType === 'RECENTLY_ADDED') {
        items = await db.query.mediaNodes.findMany({
          where: (t, { inArray }) => inArray(t.nodeType, ['MOVIE', 'SHOW']),
          orderBy: [desc(mediaNodes.createdAt)],
          limit,
        });
      } else if (rail.railType === 'LIVE_TV_GRID') {
        items = await db.query.mediaNodes.findMany({
          where: (t, { eq }) => eq(t.nodeType, 'LIVE_CHANNEL'),
          limit,
        });
      } else if (rail.railType === 'COLLECTIONS_ROW') {
        items = await db.query.mediaNodes.findMany({
          where: (t, { eq }) => eq(t.nodeType, 'COLLECTION'),
          limit,
        });
      } else {
        items = await db.query.mediaNodes.findMany({
          where: (t, { eq }) => eq(t.nodeType, 'MOVIE'),
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
        items,
      };
    })
  );

  return c.json({ rails: hydratedRails });
});

// Hiérarchie visuelle et taxonomie des tags
uiRouter.get('/tags', async (c) => {
  const attributes = await db.query.eavAttributes.findMany({
    orderBy: [asc(eavAttributes.displayOrder)],
  });
  return c.json({ attributes });
});
