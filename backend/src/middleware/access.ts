import type { Context, Next } from 'hono';
import { db } from '../db/connection.js';
import { verifySessionToken } from '../auth/token.js';

export interface UserSession {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  canDownload: boolean;
  canTranscode: boolean;
  canWatchIptv: boolean;
  maxCsaAgeLimit: number | null;
  allowedValueIds: string[];
  blockedValueIds: string[];
}

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('authorization');
  let userId: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    userId = verifySessionToken(authHeader.slice(7).trim());
  }

  if (!userId) {
    userId = c.req.header('x-user-id') || null;
  }

  if (userId) {
    const user = await db.query.users.findFirst({
      where: (t, { eq }) => eq(t.id, userId),
    });
    if (user) {
      c.set('user', {
        ...user,
        allowedValueIds: user.allowedValueIds || [],
        blockedValueIds: user.blockedValueIds || [],
      });
      return await next();
    }
  }

  // Utilisateur anonyme / invité : aucun privilège par défaut
  c.set('user', null);
  return await next();
}

export async function requireAuth(c: Context, next: Next): Promise<Response | void> {
  const user = c.get('user') as UserSession | null | undefined;
  if (!user) {
    return c.json({ error: 'Connexion requise pour accéder à cette ressource', code: 'UNAUTHORIZED' }, 401);
  }
  return await next();
}

export async function requireAdmin(c: Context, next: Next): Promise<Response | void> {
  const user = c.get('user') as UserSession | null | undefined;
  if (!user || !user.isAdmin) {
    return c.json({ error: 'Accès réservé aux administrateurs', code: 'FORBIDDEN' }, 403);
  }
  return await next();
}
