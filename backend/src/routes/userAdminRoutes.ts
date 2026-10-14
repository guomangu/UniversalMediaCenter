import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { users } from '../db/schema/index.js';
import { eq, count } from 'drizzle-orm';
import { requireAdmin, type UserSession } from '../middleware/access.js';
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
    profileRole: u.profileRole || 'STANDARD',
    canDownload: u.canDownload,
    canTranscode: u.canTranscode,
    canWatchIptv: u.canWatchIptv,
    maxCsaAgeLimit: u.maxCsaAgeLimit,
    allowedTags: u.allowedTags || [],
    blockedTags: u.blockedTags || [],
    blockedFolders: u.blockedFolders || [],
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
    profileRole = 'STANDARD',
    canDownload = true,
    canTranscode = true,
    canWatchIptv = true,
    maxCsaAgeLimit = null,
    allowedTags = [],
    blockedTags = [],
    blockedFolders = [],
  } = body;

  if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
    return c.json({ error: 'Le nom d’affichage est obligatoire' }, 400);
  }

  const cleanName = displayName.trim();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const userEmail = email && typeof email === 'string' && email.includes('@')
    ? email.trim().toLowerCase()
    : `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${randomSuffix}@ums.local`;

  const existing = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.email, userEmail),
  });
  if (existing) {
    return c.json({ error: 'Cette adresse email est déjà utilisée' }, 400);
  }

  const passwordHash = password && typeof password === 'string' && password.length >= 4
    ? hashPassword(password)
    : hashPassword('ums2026');

  const isRoleAdmin = String(profileRole).toUpperCase() === 'ADMINISTRATEUR';

  const [newUser] = await db
    .insert(users)
    .values({
      email: userEmail,
      displayName: cleanName,
      passwordHash,
      isAdmin: isRoleAdmin ? true : Boolean(isAdmin),
      profileRole: String(profileRole),
      canDownload: isRoleAdmin ? true : Boolean(canDownload),
      canTranscode: isRoleAdmin ? true : Boolean(canTranscode),
      canWatchIptv: isRoleAdmin ? true : Boolean(canWatchIptv),
      maxCsaAgeLimit: isRoleAdmin ? null : (maxCsaAgeLimit !== null && maxCsaAgeLimit !== undefined && maxCsaAgeLimit !== '' ? Number(maxCsaAgeLimit) : null),
      allowedTags: isRoleAdmin ? [] : (Array.isArray(allowedTags) ? allowedTags : []),
      blockedTags: isRoleAdmin ? [] : (Array.isArray(blockedTags) ? blockedTags : []),
      blockedFolders: isRoleAdmin ? [] : (Array.isArray(blockedFolders) ? blockedFolders : []),
    })
    .returning();

  return c.json({
    success: true,
    user: {
      ...newUser,
      hasPassword: true,
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
    profileRole,
    canDownload,
    canTranscode,
    canWatchIptv,
    maxCsaAgeLimit,
    allowedTags,
    blockedTags,
    blockedFolders,
  } = body;

  const targetUser = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.id, id),
  });
  if (!targetUser) return c.json({ error: 'Utilisateur introuvable' }, 404);

  const targetRoleUpper = (profileRole !== undefined ? String(profileRole) : (targetUser.profileRole || '')).toUpperCase();
  const willBeAdminRole = targetRoleUpper === 'ADMINISTRATEUR';

  // Protection stricte : interdiction absolue de retirer le statut admin au type ADMINISTRATEUR
  if (targetRoleUpper === 'ADMINISTRATEUR' && isAdmin === false) {
    return c.json({
      error: 'Le statut administrateur ne peut pas être retiré au type de compte Administrateur (tout autorisé obligatoirement).',
    }, 400);
  }

  // Protection du dernier administrateur
  const willBeAdmin = willBeAdminRole || (isAdmin !== undefined ? Boolean(isAdmin) : targetUser.isAdmin);
  if (targetUser.isAdmin && !willBeAdmin) {
    const adminCount = await db.select({ val: count() }).from(users).where(eq(users.isAdmin, true));
    if ((adminCount[0]?.val ?? 0) <= 1) {
      return c.json({ error: 'Impossible de retirer le dernier administrateur de la plateforme' }, 400);
    }
  }

  const updatePayload: Record<string, any> = {};
  if (displayName !== undefined) updatePayload.displayName = displayName;
  if (email !== undefined) updatePayload.email = email.trim().toLowerCase();
  if (password && typeof password === 'string' && password.length >= 4) {
    updatePayload.passwordHash = hashPassword(password);
  }

  if (profileRole !== undefined) {
    updatePayload.profileRole = String(profileRole);
  }

  if (willBeAdminRole) {
    // Le type Administrateur as tout autorisé obligatoirement
    updatePayload.isAdmin = true;
    updatePayload.canDownload = true;
    updatePayload.canTranscode = true;
    updatePayload.canWatchIptv = true;
    updatePayload.maxCsaAgeLimit = null;
    updatePayload.allowedTags = [];
    updatePayload.blockedTags = [];
    updatePayload.blockedFolders = [];
  } else {
    if (isAdmin !== undefined) updatePayload.isAdmin = Boolean(isAdmin);
    if (canDownload !== undefined) updatePayload.canDownload = Boolean(canDownload);
    if (canTranscode !== undefined) updatePayload.canTranscode = Boolean(canTranscode);
    if (canWatchIptv !== undefined) updatePayload.canWatchIptv = Boolean(canWatchIptv);
    if (maxCsaAgeLimit !== undefined) {
      updatePayload.maxCsaAgeLimit = maxCsaAgeLimit === '' || maxCsaAgeLimit === null ? null : Number(maxCsaAgeLimit);
    }
    if (allowedTags !== undefined) updatePayload.allowedTags = Array.isArray(allowedTags) ? allowedTags : [];
    if (blockedTags !== undefined) updatePayload.blockedTags = Array.isArray(blockedTags) ? blockedTags : [];
    if (blockedFolders !== undefined) updatePayload.blockedFolders = Array.isArray(blockedFolders) ? blockedFolders : [];
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
      profileRole: u.profileRole || 'STANDARD',
      canDownload: u.canDownload,
      canTranscode: u.canTranscode,
      canWatchIptv: u.canWatchIptv,
      maxCsaAgeLimit: u.maxCsaAgeLimit,
      allowedTags: u.allowedTags || [],
      blockedTags: u.blockedTags || [],
      blockedFolders: u.blockedFolders || [],
      hasPassword: !!(u.passwordHash && u.passwordHash.length > 0),
      createdAt: u.createdAt,
    },
  });
});

userAdminRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const currentUser = (c as any).get('user') as UserSession | null;

  if (currentUser && currentUser.id === id) {
    return c.json({ error: 'Vous ne pouvez pas supprimer votre propre compte administrateur actif' }, 400);
  }

  const targetUser = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.id, id),
  });
  if (!targetUser) return c.json({ error: 'Utilisateur introuvable' }, 404);

  if (targetUser.isAdmin) {
    const adminCount = await db.select({ val: count() }).from(users).where(eq(users.isAdmin, true));
    if ((adminCount[0]?.val ?? 0) <= 1) {
      return c.json({ error: 'Impossible de supprimer le dernier administrateur de la plateforme' }, 400);
    }
  }

  await db.delete(users).where(eq(users.id, id));
  return c.json({ success: true, message: `Utilisateur ${targetUser.displayName} supprimé` });
});
