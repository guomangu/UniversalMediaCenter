import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { users } from '../db/schema/index.js';
import { sql, count, eq } from 'drizzle-orm';
import { createSessionToken } from '../auth/token.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { getSiteParams, validateInvitationCode } from '../config/paramManager.js';
import { userDeviceRegistry } from '../devices/userDeviceRegistry.js';
export const authRouter = new Hono();
// Configuration publique accessible pour le frontend (/api/auth/config)
authRouter.get('/config', (c) => {
    const params = getSiteParams();
    return c.json({
        siteName: params.server.siteName,
        siteTagline: params.server.siteTagline,
        invitationOnly: params.security.invitationOnly,
        allowOnTheFlyCreation: params.security.allowOnTheFlyCreation,
        defaultPasswordRequired: params.security.defaultPasswordRequired ?? params.security.defaultPinRequired ?? false,
        defaultMaxCsaAge: params.security.defaultMaxCsaAge,
        defaultProfileRole: params.profiles?.defaultRole ?? 'STANDARD',
    });
});
// Statut d'authentification du serveur (/api/auth/status)
// Indique si le premier administrateur a déjà été créé et si les inscriptions sont ouvertes
authRouter.get('/status', async (c) => {
    try {
        const userCountResult = await db.select({ val: count() }).from(users);
        const totalUsers = userCountResult[0]?.val ?? 0;
        const adminCountResult = await db.select({ val: count() }).from(users).where(eq(users.isAdmin, true));
        const totalAdmins = adminCountResult[0]?.val ?? 0;
        const params = getSiteParams();
        return c.json({
            hasUsers: totalUsers > 0,
            hasAdmin: totalAdmins > 0,
            userCount: totalUsers,
            adminCount: totalAdmins,
            siteName: params.server.siteName || 'Universal Media Stack',
            registrationOpen: !params.security.invitationOnly || Boolean(params.security.allowOnTheFlyCreation),
            invitationOnly: Boolean(params.security.invitationOnly),
        });
    }
    catch (err) {
        console.error('Erreur /api/auth/status:', err);
        // En cas d'erreur transitoire sur la BD, ne jamais forcer la création d'admin
        return c.json({
            hasUsers: true,
            hasAdmin: true,
            userCount: 0,
            adminCount: 0,
            siteName: 'Universal Media Stack',
            registrationOpen: false,
            invitationOnly: false,
        }, 500);
    }
});
// Récupération de la session courante (/me)
authRouter.get('/me', async (c) => {
    const user = c.get('user');
    if (!user)
        return c.json({ authenticated: false, user: null });
    return c.json({
        authenticated: true,
        user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            isAdmin: user.isAdmin,
            isIncognito: user.isIncognito ?? false,
            profileRole: user.profileRole || 'STANDARD',
            canDownload: user.canDownload,
            canTranscode: user.canTranscode,
            canWatchIptv: user.canWatchIptv,
            maxCsaAgeLimit: user.maxCsaAgeLimit,
            allowedTags: user.allowedTags || [],
            blockedTags: user.blockedTags || [],
            allowedFolders: user.allowedFolders || [],
            blockedFolders: user.blockedFolders || [],
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
            where: (t, { eq }) => eq(sql `lower(${t.email})`, cleanEmail),
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
    }
    else if (user.pinHash && pin) {
        if (user.pinHash !== String(pin).trim()) {
            return c.json({ error: 'Mot de passe ou code incorrect' }, 401);
        }
    }
    const reqDeviceId = c.req.header('x-device-id') || '';
    userDeviceRegistry.unrevokeDevice(user.id, reqDeviceId);
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
            isIncognito: user.isIncognito ?? false,
            profileRole: user.profileRole || 'STANDARD',
            canDownload: user.canDownload,
            canTranscode: user.canTranscode,
            canWatchIptv: user.canWatchIptv,
            maxCsaAgeLimit: user.maxCsaAgeLimit,
            allowedTags: user.allowedTags || [],
            blockedTags: user.blockedTags || [],
            allowedFolders: user.allowedFolders || [],
            blockedFolders: user.blockedFolders || [],
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
    const cleanEmail = String(email).trim().toLowerCase();
    // Vérification de doublon
    const existing = await db.query.users.findFirst({
        where: (t, { eq }) => eq(sql `lower(${t.email})`, cleanEmail),
    });
    if (existing) {
        return c.json({ error: 'Cette adresse e-mail est déjà utilisée' }, 400);
    }
    // Vérifier s'il s'agit du premier utilisateur (Devient automatiquement Super Administrateur)
    const userCountResult = await db.select({ val: count() }).from(users);
    const isFirstUser = (userCountResult[0]?.val ?? 0) === 0;
    const params = getSiteParams();
    // Si ce n'est pas le premier utilisateur, vérifier les règles d'invitation
    if (!isFirstUser && params.security.invitationOnly) {
        if (!invitationCode) {
            return c.json({ error: 'Un code d\'invitation valide est requis pour créer un compte' }, 403);
        }
        const valid = validateInvitationCode(invitationCode);
        if (!valid) {
            return c.json({ error: 'Code d\'invitation invalide ou expiré' }, 403);
        }
    }
    const passwordHash = await hashPassword(password);
    const makeAdmin = isFirstUser;
    const [newUser] = await db
        .insert(users)
        .values({
        email: cleanEmail,
        displayName: displayName ? String(displayName).trim() : cleanEmail.split('@')[0],
        passwordHash,
        isAdmin: makeAdmin,
        isIncognito: false,
        profileRole: makeAdmin ? 'ADMIN' : (params.profiles?.defaultRole || 'STANDARD'),
        canDownload: params.profiles?.defaultCanDownload ?? true,
        canTranscode: params.profiles?.defaultCanTranscode ?? true,
        canWatchIptv: params.profiles?.defaultCanWatchIptv ?? true,
        maxCsaAgeLimit: makeAdmin ? null : (params.profiles?.defaultMaxCsaAge ?? params.security.defaultMaxCsaAge ?? null),
        allowedTags: params.profiles?.defaultAllowedTags ?? [],
        blockedTags: params.profiles?.defaultBlockedTags ?? [],
        allowedFolders: params.profiles?.defaultAllowedFolders ?? [],
        blockedFolders: params.profiles?.defaultBlockedFolders ?? [],
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
            isIncognito: false,
            profileRole: newUser.profileRole,
            canDownload: newUser.canDownload,
            canTranscode: newUser.canTranscode,
            canWatchIptv: newUser.canWatchIptv,
            maxCsaAgeLimit: newUser.maxCsaAgeLimit,
            allowedTags: newUser.allowedTags,
            blockedTags: newUser.blockedTags,
            allowedFolders: newUser.allowedFolders || [],
            blockedFolders: newUser.blockedFolders,
        },
        message: makeAdmin
            ? 'Félicitations ! Vous êtes le premier utilisateur et Administrateur de cette instance.'
            : 'Compte créé avec succès.',
    });
});
