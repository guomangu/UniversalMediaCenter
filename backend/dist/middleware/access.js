import { db } from '../db/connection.js';
import { verifySessionToken } from '../auth/token.js';
export async function authMiddleware(c, next) {
    const authHeader = c.req.header('authorization');
    let userId = null;
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
export async function requireAuth(c, next) {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Connexion requise pour accéder à cette ressource', code: 'UNAUTHORIZED' }, 401);
    }
    return await next();
}
export async function requireAdmin(c, next) {
    const user = c.get('user');
    if (!user || !user.isAdmin) {
        return c.json({ error: 'Accès réservé aux administrateurs', code: 'FORBIDDEN' }, 403);
    }
    return await next();
}
