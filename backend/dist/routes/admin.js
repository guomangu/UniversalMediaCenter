import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { uiRails, eavAttributes } from '../db/schema/index.js';
import { eq, asc } from 'drizzle-orm';
import { requireAdmin } from '../middleware/access.js';
import { enrichLibraryMetadata } from '../watcher/metadataEnricher.js';
import { configRouter } from './configRoutes.js';
import { userAdminRouter } from './userAdminRoutes.js';
export const adminRouter = new Hono();
adminRouter.use('*', requireAdmin);
// Sous-routeurs modulaires pour la configuration param.yaml et la gestion des utilisateurs
adminRouter.route('/config', configRouter);
adminRouter.route('/users', userAdminRouter);
adminRouter.post('/library/refresh', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const limit = Math.min(parseInt(body.limit || '50', 10), 100);
    const result = await enrichLibraryMetadata(limit);
    return c.json({
        success: true,
        message: `Enrichissement terminé : ${result.enrichedCount}/${result.processedCount} médias enrichis`,
        ...result,
    });
});
adminRouter.get('/rails', async (c) => {
    const rails = await db.query.uiRails.findMany({
        orderBy: [asc(uiRails.sortOrder)],
    });
    return c.json({ rails });
});
adminRouter.post('/rails/reorder', async (c) => {
    const { railOrders } = await c.req.json();
    for (const item of railOrders || []) {
        await db
            .update(uiRails)
            .set({ sortOrder: item.sortOrder })
            .where(eq(uiRails.id, item.id));
    }
    return c.json({ success: true });
});
adminRouter.get('/tags', async (c) => {
    const tags = await db.query.eavAttributes.findMany({
        orderBy: [asc(eavAttributes.displayOrder)],
    });
    return c.json({ tags });
});
adminRouter.patch('/tags/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { uiZone, displayOrder, colorTheme, displayName } = body;
    await db
        .update(eavAttributes)
        .set({ uiZone, displayOrder, colorTheme, displayName })
        .where(eq(eavAttributes.id, id));
    return c.json({ success: true });
});
