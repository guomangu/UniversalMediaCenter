import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { users } from '../db/schema/index.js';
import { eq, count } from 'drizzle-orm';
import { requireAdmin } from '../middleware/access.js';
import { hashPassword } from '../auth/password.js';

export const userAdminRouter = new Hono();
userAdminRouter.use('*', requireAdmin);

userAdminRouter.get('/', async (c) => {
  const allUsers = await db.query.users.findMany({
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  const formatted = allUsers.map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    isAdmin: u.isAdmin,
    canDownload: u.canDownload,
    canTranscode: u.canTranscode,
    canWatchIptv: u.canWatchIptv,
    maxCsaAgeLimit: u.maxCsaAgeLimit,
    hasPassword: !!(u.passwordHash && u.passwordHash.length > 0),
    createdAt: u.createdAt,
  }));

  return c.json({ success: true, users: formatted });
});

userAdminRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const {
    displayName,
    email,
    password,
    isAdmin = false,
    canDownload = true,
    canTranscode = true,
    canWatchIptv = true,
    maxCsaAgeLimit = null,
  } = body;

  if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
    return c.json({ error: 'Le nom d’affichage est obligatoire' }, 400);
  }

  const cleanName = displayName.trim();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const userEmail = email && typeof email === 'string' && email.includes('@')
    ? email.trim().toLowerCase()
    : `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${randomSuffix}@ums.local`;

  // Vérifier unicité email
  const existing = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.email, userEmail),
  });
  if (existing) {
    return c.json({ error: 'Cette adresse email est déjà utilisée' }, 400);
  }

  const passwordHash = password && typeof password === 'string' && password.length >= 4
    ? hashPassword(password)
    : hashPassword('ums2026'); // Mot de passe initial par défaut si omis

  const [newUser] = await db
    .insert(users)
    .values({
      email: userEmail,
      displayName: cleanName,
      passwordHash,
      isAdmin: Boolean(isAdmin),
      canDownload: Boolean(canDownload),
      canTranscode: Boolean(canTranscode),
      canWatchIptv: Boolean(canWatchIptv),
      maxCsaAgeLimit: maxCsaAgeLimit !== null && maxCsaAgeLimit !== undefined && maxCsaAgeLimit !== '' ? Number(maxCsaAgeLimit) : null,
    })
    .returning();

  return c.json({
    success: true,
    user: {
      id: newUser.id,
      email: newUser.email,
      displayName: newUser.displayName,
      avatarUrl: newUser.avatarUrl,
      isAdmin: newUser.isAdmin,
      canDownload: newUser.canDownload,
      canTranscode: newUser.canTranscode,
      canWatchIptv: newUser.canWatchIptv,
      maxCsaAgeLimit: newUser.maxCsaAgeLimit,
      hasPassword: true,
      createdAt: newUser.createdAt,
    },
  });
});

userAdminRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const {
    displayName,
    email,
    password,
    isAdmin,
    canDownload,
    canTranscode,
    canWatchIptv,
    maxCsaAgeLimit,
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

  const updatePayload: Record<string, any> = {};
  if (displayName !== undefined) updatePayload.displayName = displayName;
  if (email !== undefined) updatePayload.email = email.trim().toLowerCase();
  if (password && typeof password === 'string' && password.length >= 4) {
    updatePayload.passwordHash = hashPassword(password);
  }
  if (isAdmin !== undefined) updatePayload.isAdmin = Boolean(isAdmin);
  if (canDownload !== undefined) updatePayload.canDownload = Boolean(canDownload);
  if (canTranscode !== undefined) updatePayload.canTranscode = Boolean(canTranscode);
  if (canWatchIptv !== undefined) updatePayload.canWatchIptv = Boolean(canWatchIptv);
  if (maxCsaAgeLimit !== undefined) {
    updatePayload.maxCsaAgeLimit = maxCsaAgeLimit === '' || maxCsaAgeLimit === null ? null : Number(maxCsaAgeLimit);
  }

  const updated = await db
    .update(users)
    .set(updatePayload)
    .where(eq(users.id, id))
    .returning();

  const u = updated[0];
  return c.json({
    success: true,
    user: {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      isAdmin: u.isAdmin,
      canDownload: u.canDownload,
      canTranscode: u.canTranscode,
      canWatchIptv: u.canWatchIptv,
      maxCsaAgeLimit: u.maxCsaAgeLimit,
      hasPassword: !!(u.passwordHash && u.passwordHash.length > 0),
      createdAt: u.createdAt,
    },
  });
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
      return c.json({ error: 'Impossible de supprimer le dernier administrateur' }, 400);
    }
  }

  await db.delete(users).where(eq(users.id, id));
  return c.json({ success: true, message: 'Utilisateur supprimé' });
});
