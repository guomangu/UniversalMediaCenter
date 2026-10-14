import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { users } from '../db/schema/index.js';
import { count } from 'drizzle-orm';
import { getSiteParams, validateInvitationCode } from '../config/paramManager.js';
import { createSessionToken } from '../auth/token.js';
export const authRegisterRouter = new Hono();
// Récupère la configuration publique du site (nom, tagline, mode invitation)
authRegisterRouter.get('/config', (c) => {
    const params = getSiteParams();
    return c.json({
        siteName: params.server.siteName,
        siteTagline: params.server.siteTagline,
        invitationOnly: params.security.invitationOnly,
        allowOnTheFlyCreation: params.security.allowOnTheFlyCreation,
        defaultPinRequired: params.security.defaultPinRequired,
        defaultMaxCsaAge: params.security.defaultMaxCsaAge,
    });
});
// Création de compte à la volée
authRegisterRouter.post('/register-on-the-fly', async (c) => {
    const params = getSiteParams();
    if (!params.security.allowOnTheFlyCreation) {
        return c.json({ error: 'La création de compte à la volée est désactivée' }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    const { displayName, email, pin, invitationCode } = body;
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
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const userEmail = email && email.includes('@')
        ? email.trim().toLowerCase()
        : `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${randomSuffix}@ums.local`;
    const [newUser] = await db
        .insert(users)
        .values({
        email: userEmail,
        displayName: cleanName,
        isAdmin: isFirstUser,
        pinHash: pin ? String(pin).trim() : null,
        maxCsaAgeLimit: params.security.defaultMaxCsaAge,
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
            hasPin: !!(newUser.pinHash && newUser.pinHash.trim().length > 0),
        },
        message: isFirstUser
            ? 'Premier profil créé avec succès : vous êtes l’Administrateur du site !'
            : 'Profil créé à la volée avec succès.',
    });
});
