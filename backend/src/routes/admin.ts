import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { uiRails, eavAttributes, users } from '../db/schema/index.js';
import { eq, asc } from 'drizzle-orm';
import { requireAdmin } from '../middleware/access.js';

export const adminRouter = new Hono();
adminRouter.use('*', requireAdmin);

// Gestion des Rails d'accueil (Drag & Drop)
adminRouter.get('/rails', async (c) => {
  const rails = await db.query.uiRails.findMany({
    orderBy: [asc(uiRails.sortOrder)],
  });
  return c.json({ rails });
});

adminRouter.post('/rails/reorder', async (c) => {
  const { railOrders } = await c.req.json(); // Array of { id, sortOrder }
  for (const item of railOrders || []) {
    await db
      .update(uiRails)
      .set({ sortOrder: item.sortOrder })
      .where(eq(uiRails.id, item.id));
  }
  return c.json({ success: true });
});

// Gestion des Groupes de Tags
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

// Gestion des Utilisateurs & Contrôle Parental
adminRouter.get('/users', async (c) => {
  const userList = await db.query.users.findMany();
  return c.json({ users: userList });
});
