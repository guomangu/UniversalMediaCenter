import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { users } from '../db/schema/index.js';
import { sql, count } from 'drizzle-orm';
import { createSessionToken } from '../auth/token.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { getSiteParams, validateInvitationCode } from '../config/paramManager.js';
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
    if (!displayName || !String(displayName).trim()) {
        return c.json({ error: 'Le nom d’affichage ou pseudo est requis' }, 400);
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await db.query.users.findFirst({
        where: (t, { eq }) => eq(sql `lower(${t.email})`, cleanEmail),
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
        isAdmin: isFirstUser,
        isIncognito: false,
        profileRole: isFirstUser ? 'ADMIN' : (params.profiles?.defaultRole || 'STANDARD'),
        canDownload: params.profiles?.defaultCanDownload ?? true,
        canTranscode: params.profiles?.defaultCanTranscode ?? true,
        canWatchIptv: params.profiles?.defaultCanWatchIptv ?? true,
        maxCsaAgeLimit: isFirstUser ? null : (params.profiles?.defaultMaxCsaAge ?? params.security.defaultMaxCsaAge ?? null),
        allowedTags: params.profiles?.defaultAllowedTags ?? [],
        blockedTags: params.profiles?.defaultBlockedTags ?? [],
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
            blockedFolders: newUser.blockedFolders,
        },
        message: isFirstUser
            ? 'Félicitations ! Vous êtes le premier utilisateur et Administrateur de cette instance.'
            : 'Compte créé avec succès.',
    });
});
