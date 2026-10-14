import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { authRegisterRouter } from './authRegister.js';

export const authRouter = new Hono();

// Montage des fonctionnalités publiques et de création à la volée
authRouter.route('/', authRegisterRouter);

// Liste des profils disponibles pour sélection rapide (Style Netflix / Kyoo)
authRouter.get('/profiles', async (c) => {
  const profileList = await db.query.users.findMany({
    columns: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      isAdmin: true,
      canDownload: true,
      canWatchIptv: true,
      maxCsaAgeLimit: true,
    },
    orderBy: (t, { asc }) => [asc(t.displayName)],
  });
  return c.json({ profiles: profileList });
});

// Connexion d'un profil avec vérification facultative de PIN
authRouter.post('/login', async (c) => {
  const body = await c.req.json();
  const { userId, pin } = body;

  const user = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.id, userId),
  });

  if (!user) {
    return c.json({ error: 'Profil introuvable' }, 404);
  }

  if (user.pinHash && user.pinHash !== pin) {
    return c.json({ error: 'Code PIN incorrect' }, 401);
  }

  return c.json({
    success: true,
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

// Appairage TV Quick-Connect
authRouter.get('/quick-connect/code', (c) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return c.json({
    code,
    expiresInSeconds: 300,
    qrUrl: `/api/auth/quick-connect/qr?code=${code}`,
  });
});
