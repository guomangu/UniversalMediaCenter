import { Hono } from 'hono';
import crypto from 'node:crypto';
import { db } from '../db/connection.js';
import { users } from '../db/schema/index.js';
import { count } from 'drizzle-orm';
import { getSiteParams, validateInvitationCode } from '../config/paramManager.js';
import { createSessionToken } from '../auth/token.js';
import { hashPassword } from '../auth/password.js';
export const authRegisterRouter = new Hono();
// Récupère la configuration publique du site (nom, tagline, mode invitation, paramètres par défaut)
authRegisterRouter.get('/config', (c) => {
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
// Création de compte à la volée
authRegisterRouter.post('/register-on-the-fly', async (c) => {
    const params = getSiteParams();
    if (!params.security.allowOnTheFlyCreation) {
        return c.json({ error: 'La création de compte à la volée est désactivée' }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    const { displayName, email, password, pin, invitationCode } = body;
    if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
        return c.json({ error: 'Le pseudo / nom d’affichage est obligatoire' }, 400);
    }
    // Vérification stricte du code d'invitation si le site est en mode invitation
    if (params.security.invitationOnly && !validateInvitationCode(invitationCode)) {
        return c.json({ error: 'Code d’invitation invalide ou manquant' }, 403);
    }
    // Vérifie si c'est le tout premier compte créé sur le site -> Devient Administrateur
    const userCountResult = await db.select({ val: count() }).from(users);
    const isFirstUser = (userCountResult[0]?.val ?? 0) === 0;
    const cleanName = displayName.trim();
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const userEmail = email && email.includes('@')
        ? email.trim().toLowerCase()
        : `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${randomSuffix}@ums.local`;
    // Refuser explicitement les doublons plutôt que de laisser la contrainte SQL
    // remonter une erreur 500 opaque.
    const existingUser = await db.query.users.findFirst({
        where: (t, { eq }) => eq(t.email, userEmail),
    });
    if (existingUser) {
        return c.json({ error: 'Cette adresse e-mail est déjà utilisée' }, 409);
    }
    const rawSecret = (password && typeof password === 'string' && password.length >= 4)
        ? password
        : (pin ? String(pin) : null);
    // Un compte sans secret serait inconsultable après expiration de la session.
    if (!rawSecret) {
        return c.json({ error: 'Un mot de passe ou un code PIN est requis pour créer un profil.' }, 400);
    }
    const passwordHash = hashPassword(rawSecret);
    // Le PIN est désormais haché (scrypt), plus jamais stocké en clair.
    const pinHash = rawSecret ? hashPassword(String(rawSecret).trim()) : null;
    const [newUser] = await db
        .insert(users)
        .values({
        email: userEmail,
        displayName: cleanName,
        passwordHash,
        pinHash,
        isAdmin: isFirstUser,
        profileRole: isFirstUser ? 'ADMIN' : (params.profiles?.defaultRole || 'STANDARD'),
        canDownload: params.profiles?.defaultCanDownload ?? true,
        canTranscode: params.profiles?.defaultCanTranscode ?? true,
        canWatchIptv: params.profiles?.defaultCanWatchIptv ?? true,
        maxCsaAgeLimit: isFirstUser ? null : (params.profiles?.defaultMaxCsaAge ?? params.security.defaultMaxCsaAge ?? null),
        allowedTags: params.profiles?.defaultAllowedTags ?? [],
        blockedTags: params.profiles?.defaultBlockedTags ?? [],
        allowedFolders: params.profiles?.defaultAllowedFolders ?? [],
        blockedFolders: params.profiles?.defaultBlockedFolders ?? [],
    })
        .returning();
    const token = createSessionToken(newUser.id, c.req.header('x-device-id') || undefined);
    return c.json({
        success: true,
        token,
        user: {
            id: newUser.id,
            email: newUser.email,
            displayName: newUser.displayName,
            avatarUrl: newUser.avatarUrl,
            isAdmin: newUser.isAdmin,
            profileRole: newUser.profileRole,
            canDownload: newUser.canDownload,
            canTranscode: newUser.canTranscode,
            canWatchIptv: newUser.canWatchIptv,
            maxCsaAgeLimit: newUser.maxCsaAgeLimit,
            allowedTags: newUser.allowedTags,
            blockedTags: newUser.blockedTags,
            blockedFolders: newUser.blockedFolders,
            hasPassword: !!newUser.passwordHash,
        },
        message: isFirstUser
            ? 'Premier profil créé avec succès : vous êtes l’Administrateur du site !'
            : 'Profil créé avec succès.',
    });
});
