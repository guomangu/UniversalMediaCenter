import { db } from '../db/connection.js';
import { verifySessionToken } from '../auth/token.js';
import { getSiteParams } from '../config/paramManager.js';
export async function authMiddleware(c, next) {
    const authHeader = c.req.header('authorization');
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        userId = verifySessionToken(authHeader.slice(7).trim());
    }
    // Support des balises vidéo HTML5 (<video src="...">) qui ne peuvent pas envoyer d'en-tête Authorization
    if (!userId) {
        const queryToken = c.req.query('token') || c.req.query('auth');
        if (queryToken) {
            userId = verifySessionToken(queryToken.trim());
        }
    }
    if (!userId) {
        userId = c.req.header('x-user-id') || null;
    }
    if (userId) {
        const user = await db.query.users.findFirst({
            where: (t, { eq }) => eq(t.id, userId),
        });
        if (user) {
            const siteParams = getSiteParams();
            const currentRole = (user.profileRole || (user.isAdmin ? 'ADMINISTRATEUR' : 'MEMBRE')).toUpperCase();
            const matchedProfile = (siteParams.profileTypes || []).find((p) => p.id.toUpperCase() === currentRole || p.label.toUpperCase() === currentRole);
            const isEffectiveAdmin = Boolean(user.isAdmin || matchedProfile?.isAdmin || currentRole === 'ADMINISTRATEUR');
            // Le type de compte Administrateur as obligatoirement tout d'autorisé sans aucune restriction
            if (isEffectiveAdmin) {
                c.set('user', {
                    ...user,
                    isAdmin: true,
                    canDownload: true,
                    canTranscode: true,
                    canWatchIptv: true,
                    maxCsaAgeLimit: null,
                    allowedValueIds: [],
                    blockedValueIds: [],
                    allowedTags: [],
                    blockedTags: [],
                    blockedFolders: [],
                    profileRole: 'ADMINISTRATEUR',
                });
                return await next();
            }
            const effectiveAllowedTags = (user.allowedTags && user.allowedTags.length > 0)
                ? user.allowedTags
                : (matchedProfile?.allowedTags || []);
            const effectiveBlockedTags = Array.from(new Set([
                ...(user.blockedTags || []),
                ...(matchedProfile?.blockedTags || []),
            ]));
            const effectiveBlockedFolders = Array.from(new Set([
                ...(user.blockedFolders || []),
                ...(matchedProfile?.blockedFolders || []),
            ]));
            const effectiveCsa = user.maxCsaAgeLimit !== null && user.maxCsaAgeLimit !== undefined
                ? user.maxCsaAgeLimit
                : (matchedProfile?.maxCsaAgeLimit ?? null);
            c.set('user', {
                ...user,
                isAdmin: false,
                canDownload: matchedProfile?.canDownload !== undefined ? (user.canDownload && matchedProfile.canDownload) : user.canDownload,
                canTranscode: matchedProfile?.canTranscode !== undefined ? (user.canTranscode && matchedProfile.canTranscode) : user.canTranscode,
                canWatchIptv: matchedProfile?.canWatchIptv !== undefined ? (user.canWatchIptv && matchedProfile.canWatchIptv) : user.canWatchIptv,
                maxCsaAgeLimit: effectiveCsa,
                allowedValueIds: user.allowedValueIds || [],
                blockedValueIds: user.blockedValueIds || [],
                allowedTags: effectiveAllowedTags,
                blockedTags: effectiveBlockedTags,
                blockedFolders: effectiveBlockedFolders,
                profileRole: user.profileRole || 'MEMBRE',
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
