import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { users } from '../db/schema/index.js';
import { count, eq, sql } from 'drizzle-orm';
import { createSessionToken } from '../auth/token.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { getSiteParams, validateInvitationCode } from '../config/paramManager.js';
import type { UserSession } from '../middleware/access.js';

export const authRouter = new Hono();

// Statut d'initialisation du serveur (y a-t-il déjà des utilisateurs ?)
authRouter.get('/status', async (c) => {
  const userCountResult = await db.select({ val: count() }).from(users);
  const userCount = userCountResult[0]?.val ?? 0;
  const params = getSiteParams();
  return c.json({
    hasUsers: userCount > 0,
    siteName: params.server.siteName,
    invitationOnly: params.security.invitationOnly,
  });
});

// Récupération de la session courante (/me)
authRouter.get('/me', async (c) => {
  const user = (c.get as any)('user') as UserSession | null;
  if (!user) return c.json({ authenticated: false, user: null });

  return c.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin,
      canDownload: user.canDownload,
      canTranscode: user.canTranscode,
      canWatchIptv: user.canWatchIptv,
      maxCsaAgeLimit: user.maxCsaAgeLimit,
    },
  });
});

// Connexion standard (Email + Mot de passe)
authRouter.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { email, password, userId, pin } = body;

  const cleanEmail = email ? String(email).trim().toLowerCase() : '';
  const cleanPass = password ? String(password) : '';

  let user = cleanEmail
    ? await db.query.users.findFirst({
        where: (t, { eq }) => eq(sql`lower(${t.email})`, cleanEmail),
      })
    : null;

  if (!user && userId) {
    user = await db.query.users.findFirst({
      where: (t, { eq }) => eq(t.id, userId),
    });
  }

  if (!user) {
    return c.json({ error: 'Adresse e-mail ou mot de passe incorrect' }, 401);
  }

  // Vérification mot de passe
  if (user.passwordHash) {
    if (!verifyPassword(cleanPass, user.passwordHash)) {
      return c.json({ error: 'Adresse e-mail ou mot de passe incorrect' }, 401);
    }
  } else if (user.pinHash && pin) {
    if (user.pinHash !== String(pin).trim()) {
      return c.json({ error: 'Code PIN incorrect' }, 401);
    }
  }

  const token = createSessionToken(user.id);
  return c.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin,
      canDownload: user.canDownload,
      canTranscode: user.canTranscode,
      canWatchIptv: user.canWatchIptv,
      maxCsaAgeLimit: user.maxCsaAgeLimit,
    },
  });
});

// Inscription (Le premier utilisateur devient l'Administrateur)
authRouter.post('/register', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { email, password, displayName, invitationCode } = body;

  if (!email || !String(email).includes('@')) {
    return c.json({ error: 'Adresse e-mail valide requise' }, 400);
  }
  if (!password || String(password).length < 6) {
    return c.json({ error: 'Le mot de passe doit comporter au moins 6 caractères' }, 400);
  }
  if (!displayName || !String(displayName).trim()) {
    return c.json({ error: 'Le nom d’affichage ou pseudo est requis' }, 400);
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const existing = await db.query.users.findFirst({
    where: (t, { eq }) => eq(sql`lower(${t.email})`, cleanEmail),
  });
  if (existing) {
    return c.json({ error: 'Un compte avec cette adresse e-mail existe déjà' }, 409);
  }

  const userCountResult = await db.select({ val: count() }).from(users);
  const isFirstUser = (userCountResult[0]?.val ?? 0) === 0;

  const params = getSiteParams();
  if (!isFirstUser && params.security.invitationOnly && !validateInvitationCode(invitationCode)) {
    return c.json({ error: 'Code d’invitation invalide ou manquant' }, 403);
  }

  const passwordHash = hashPassword(String(password));
  const [newUser] = await db
    .insert(users)
    .values({
      email: cleanEmail,
      displayName: String(displayName).trim(),
      passwordHash,
      isAdmin: isFirstUser, // ✅ Le premier compte créé devient automatiquement l'Administrateur !
      canDownload: true,
      canTranscode: true,
      canWatchIptv: true,
    })
    .returning();

  const token = createSessionToken(newUser.id);
  return c.json({
    success: true,
    token,
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
    },
    message: isFirstUser
      ? 'Félicitations ! Vous êtes le premier utilisateur et Administrateur de cette instance.'
      : 'Compte créé avec succès.',
  });
});
