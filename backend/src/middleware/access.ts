import type { Context, Next } from 'hono';
import { db } from '../db/connection.js';
import { users } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

export interface UserSession {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  canDownload: boolean;
  canTranscode: boolean;
  canWatchIptv: boolean;
  maxCsaAgeLimit: number | null;
  allowedValueIds: string[];
  blockedValueIds: string[];
}

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const userId = c.req.header('x-user-id');
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

  // Fallback: utilisateur par défaut (premier utilisateur trouvé ou invité)
  const [defaultUser] = await db.select().from(users).limit(1);
  if (defaultUser) {
    c.set('user', {
      ...defaultUser,
      allowedValueIds: defaultUser.allowedValueIds || [],
      blockedValueIds: defaultUser.blockedValueIds || [],
    });
  }
  return await next();
}

export async function requireAdmin(c: Context, next: Next): Promise<Response | void> {
  const user = c.get('user') as UserSession | undefined;
  if (!user || !user.isAdmin) {
    return c.json({ error: 'Accès réservé aux administrateurs' }, 403);
  }
  return await next();
}
