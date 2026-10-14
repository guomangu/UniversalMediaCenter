import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { users } from '../db/schema/index.js';
import { eq, count } from 'drizzle-orm';
import { requireAdmin } from '../middleware/access.js';

export const userAdminRouter = new Hono();
userAdminRouter.use('*', requireAdmin);

userAdminRouter.get('/', async (c) => {
  const allUsers = await db.query.users.findMany({
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  return c.json({ success: true, users: allUsers });
});

userAdminRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const {
    displayName,
    isAdmin,
    canDownload,
    canTranscode,
    canWatchIptv,
    maxCsaAgeLimit,
    pinHash,
  } = body;

  const targetUser = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.id, id),
  });
  if (!targetUser) return c.json({ error: 'Utilisateur introuvable' }, 404);

  // Garde-fou : si on retire les droits admin, s'assurer qu'il reste un autre admin
  if (targetUser.isAdmin && isAdmin === false) {
    const adminCount = await db.select({ val: count() }).from(users).where(eq(users.isAdmin, true));
    if ((adminCount[0]?.val ?? 0) <= 1) {
      return c.json({ error: 'Impossible de retirer le dernier administrateur' }, 400);
    }
  }

  const updated = await db
    .update(users)
    .set({
      ...(displayName !== undefined ? { displayName } : {}),
      ...(isAdmin !== undefined ? { isAdmin } : {}),
      ...(canDownload !== undefined ? { canDownload } : {}),
      ...(canTranscode !== undefined ? { canTranscode } : {}),
      ...(canWatchIptv !== undefined ? { canWatchIptv } : {}),
      ...(maxCsaAgeLimit !== undefined ? { maxCsaAgeLimit } : {}),
      ...(pinHash !== undefined ? { pinHash } : {}),
    })
    .where(eq(users.id, id))
    .returning();

  return c.json({ success: true, user: updated[0] });
});

userAdminRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const targetUser = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.id, id),
  });
  if (!targetUser) return c.json({ error: 'Utilisateur introuvable' }, 404);

  if (targetUser.isAdmin) {
    const adminCount = await db.select({ val: count() }).from(users).where(eq(users.isAdmin, true));
    if ((adminCount[0]?.val ?? 0) <= 1) {
      return c.json({ error: 'Impossible de supprimer le seul administrateur actif' }, 400);
    }
  }

  await db.delete(users).where(eq(users.id, id));
  return c.json({ success: true, message: 'Utilisateur supprimé' });
});
