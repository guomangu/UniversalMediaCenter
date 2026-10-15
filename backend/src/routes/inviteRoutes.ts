import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { users, userInvitations, mediaNodes } from '../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';
import { requireAdmin, type UserSession } from '../middleware/access.js';
import { hashPassword } from '../auth/password.js';
import { createSessionToken } from '../auth/token.js';
import { getSiteParams } from '../config/paramManager.js';

export const inviteRouter = new Hono();

/**
 * Retourne l'URL de base absolue de l'interface web (cool.sweaw.com)
 */
function getInterfaceBaseUrl(c: any): string {
  const params = getSiteParams();
  if (params.server.publicBaseUrl && params.server.publicBaseUrl.startsWith('http')) {
    // Si l'URL contient api.cool.sweaw.com, on bascule vers l'interface utilisateur cool.sweaw.com
    return params.server.publicBaseUrl
      .replace('https://api.cool.sweaw.com', 'https://cool.sweaw.com')
      .replace('http://api.cool.sweaw.com', 'https://cool.sweaw.com')
      .replace(/\/+$/, '');
  }

  const host = c.req.header('host') || '';
  if (host.includes('sweaw.com')) {
    return 'https://cool.sweaw.com';
  }

  const proto = c.req.header('x-forwarded-proto') || 'http';
  return `${proto}://${host || 'localhost:8080'}`;
}

/**
 * Génère un jeton lisible et convivial pour l'invitation (ex: lucas-7x9q)
 */
function generateTokenSlug(name: string, custom?: string): string {
  if (custom && custom.trim().length >= 3) {
    return custom
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');
  }
  const cleanName = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${cleanName || 'membre'}-${randomSuffix}`;
}

/**
 * ============================================================================
 * 1. ADMINISTRATION : Création d'un lien personnalisé avec identifiants
 * ============================================================================
 */
inviteRouter.post('/api/admin/invitations', requireAdmin, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const {
      displayName,
      email,
      password,
      profileRole = 'MEMBRE',
      customToken,
    } = body;

    if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
      return c.json({ success: false, error: 'Le nom du futur utilisateur est obligatoire' }, 400);
    }

    const cleanName = displayName.trim();
    const cleanRole = String(profileRole).trim() || 'MEMBRE';
    const params = getSiteParams();

    // 1. Détermination de l'identifiant (email)
    let userEmail = email && typeof email === 'string' && email.trim().length > 0
      ? email.trim().toLowerCase()
      : '';

    if (!userEmail) {
      const slugName = cleanName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
      const randomDigits = Math.floor(100 + Math.random() * 900);
      userEmail = `${slugName || 'invite'}${randomDigits}@ums.local`;
    }

    // 2. Détermination du mot de passe
    const rawPassword = password && typeof password === 'string' && password.trim().length >= 4
      ? password.trim()
      : `pass${Math.floor(1000 + Math.random() * 9000)}`;

    const passwordHash = hashPassword(rawPassword);

    // 3. Recherche ou création du compte utilisateur
    let targetUser = await db.query.users.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.email, userEmail),
    });

    const isRoleAdmin = cleanRole.toUpperCase() === 'ADMINISTRATEUR';

    if (!targetUser) {
      const [newUser] = await db
        .insert(users)
        .values({
          email: userEmail,
          displayName: cleanName,
          passwordHash,
          isAdmin: isRoleAdmin,
          profileRole: cleanRole,
          canDownload: isRoleAdmin ? true : (params.profiles?.defaultCanDownload ?? true),
          canTranscode: isRoleAdmin ? true : (params.profiles?.defaultCanTranscode ?? true),
          canWatchIptv: isRoleAdmin ? true : (params.profiles?.defaultCanWatchIptv ?? true),
          maxCsaAgeLimit: isRoleAdmin ? null : (cleanRole === 'ENFANT' ? 10 : null),
          allowedTags: [],
          blockedTags: [],
          blockedFolders: [],
        })
        .returning();
      targetUser = newUser;
    } else {
      // Met à jour le mot de passe et le nom pour correspondre à l'invitation personnalisée
      await db
        .update(users)
        .set({
          displayName: cleanName,
          passwordHash,
          profileRole: cleanRole,
          isAdmin: isRoleAdmin ? true : targetUser.isAdmin,
        })
        .where(eq(users.id, targetUser.id));
    }

    // 4. Génération du token unique
    let token = generateTokenSlug(cleanName, customToken);
    const existingInvite = await db.query.userInvitations.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.token, token),
    });
    if (existingInvite) {
      token = `${token}-${Math.random().toString(36).substring(2, 5)}`;
    }

    // 5. Enregistrement de l'invitation en base
    const [invitation] = await db
      .insert(userInvitations)
      .values({
        token,
        userId: targetUser.id,
        displayName: cleanName,
        email: userEmail,
        rawPassword,
        profileRole: cleanRole,
        clicksCount: 0,
      })
      .returning();

    // 6. Construction des URLs et du message vers l'interface cool.sweaw.com
    const interfaceUrl = getInterfaceBaseUrl(c);
    const inviteUrl = `${interfaceUrl}/invite/${token}`;
    const siteName = params.server.siteName || 'Universal Media Stack';

    const messageText = `🎬 Bienvenue sur ${siteName} !

Bonjour ${cleanName} ! Voici tes accès personnels :
👤 Identifiant : ${userEmail}
🔑 Mot de passe : ${rawPassword}

👉 Clique ici pour te connecter directement en 1 clic :
${inviteUrl}`;

    return c.json({
      success: true,
      invitation: {
        id: invitation.id,
        token: invitation.token,
        inviteUrl,
        messageText,
        displayName: cleanName,
        email: userEmail,
        password: rawPassword,
        profileRole: cleanRole,
        createdAt: invitation.createdAt,
      },
    });
  } catch (err: any) {
    console.error('Erreur création invitation personnalisée:', err);
    return c.json({ success: false, error: err.message || 'Erreur serveur' }, 500);
  }
});

/**
 * Liste des invitations créées (Administration)
 */
inviteRouter.get('/api/admin/invitations', requireAdmin, async (c) => {
  try {
    const invites = await db.query.userInvitations.findMany({
      orderBy: (t, { desc: descOp }) => [descOp(t.createdAt)],
      limit: 100,
    });

    const interfaceUrl = getInterfaceBaseUrl(c);
    const params = getSiteParams();
    const siteName = params.server.siteName || 'Universal Media Stack';

    const formatted = invites.map((inv) => {
      const inviteUrl = `${interfaceUrl}/invite/${inv.token}`;
      const messageText = `🎬 Bienvenue sur ${siteName} !

Bonjour ${inv.displayName} ! Voici tes accès personnels :
👤 Identifiant : ${inv.email}
🔑 Mot de passe : ${inv.rawPassword}

👉 Clique ici pour te connecter directement en 1 clic :
${inviteUrl}`;

      return {
        id: inv.id,
        token: inv.token,
        inviteUrl,
        messageText,
        displayName: inv.displayName,
        email: inv.email,
        password: inv.rawPassword,
        profileRole: inv.profileRole,
        clicksCount: inv.clicksCount,
        lastUsedAt: inv.lastUsedAt,
        createdAt: inv.createdAt,
      };
    });

    return c.json({ success: true, invitations: formatted });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * Suppression d'une invitation (Administration)
 */
inviteRouter.delete('/api/admin/invitations/:id', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    await db.delete(userInvitations).where(eq(userInvitations.id as any, id));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * ============================================================================
 * 2. API JSON : Récupération des données d'invitation (pour clients React Native / SPA)
 * ============================================================================
 */
inviteRouter.get('/api/invite/:token/data', async (c) => {
  const token = c.req.param('token');
  const invite = await db.query.userInvitations.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.token, token),
  });

  if (!invite) {
    return c.json({ success: false, error: 'Invitation introuvable ou expirée' }, 404);
  }

  const user = await db.query.users.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.id, invite.userId),
  });

  if (!user) {
    return c.json({ success: false, error: 'Compte utilisateur associé introuvable' }, 404);
  }

  const sessionToken = createSessionToken(user.id);
  const interfaceUrl = getInterfaceBaseUrl(c);

  return c.json({
    success: true,
    token: sessionToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin,
      profileRole: user.profileRole,
      canDownload: user.canDownload,
      canTranscode: user.canTranscode,
      canWatchIptv: user.canWatchIptv,
      maxCsaAgeLimit: user.maxCsaAgeLimit,
    },
    invitation: {
      displayName: invite.displayName,
      email: invite.email,
      inviteUrl: `${interfaceUrl}/invite/${invite.token}`,
    },
  });
});

/**
 * ============================================================================
 * 3. PAGE D'ACCÈS DIRECT & APERÇU SOCIAL (Open Graph pour WhatsApp / Instagram / Messages)
 * Redirige automatiquement sur https://cool.sweaw.com (l'interface)
 * GET /invite/:token
 * ============================================================================
 */
inviteRouter.get('/invite/:token', async (c) => {
  const token = c.req.param('token');
  const interfaceUrl = getInterfaceBaseUrl(c);
  const params = getSiteParams();
  const siteName = params.server.siteName || 'Universal Media Stack';

  const invite = await db.query.userInvitations.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.token, token),
  });

  if (!invite) {
    return c.html(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Lien d'invitation expiré - ${siteName}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: #0b0f19; color: #f8fafc; font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: rgba(30, 41, 59, 0.85); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 20px; padding: 32px; max-width: 420px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
    h1 { font-size: 20px; color: #f87171; margin-bottom: 12px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
    a { display: inline-block; margin-top: 20px; background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size: 40px; margin-bottom: 10px;">⚠️</div>
    <h1>Lien d'invitation introuvable</h1>
    <p>Ce lien d'accès personnalisé n'existe plus ou a été révoqué par l'administrateur.</p>
    <a href="${interfaceUrl}/login">Accéder à la page de connexion</a>
  </div>
</body>
</html>`, 404);
  }

  // Incrémente le compteur de clics
  await db
    .update(userInvitations)
    .set({
      clicksCount: invite.clicksCount + 1,
      lastUsedAt: new Date(),
    })
    .where(eq(userInvitations.id, invite.id));

  // Récupère l'utilisateur
  const user = await db.query.users.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.id, invite.userId),
  });

  if (!user) {
    return c.html(`<h1>Utilisateur non trouvé</h1>`, 404);
  }

  // Génère un jeton de session immédiat pour cet utilisateur
  const sessionToken = createSessionToken(user.id);
  const sessionUser = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
    profileRole: user.profileRole,
    canDownload: user.canDownload,
    canTranscode: user.canTranscode,
    canWatchIptv: user.canWatchIptv,
    maxCsaAgeLimit: user.maxCsaAgeLimit,
  };

  // Image d'accroche pour la vignette WhatsApp / Instagram (recherche un fanart récent)
  const sampleArtwork = await db.query.mediaNodes.findFirst({
    where: (t, { isNotNull }) => isNotNull(t.fanartPath),
    orderBy: (t, { desc: descOp }) => [descOp(t.createdAt)],
  });

  const ogImageUrl = sampleArtwork?.id
    ? `${interfaceUrl}/api/media/${sampleArtwork.id}/fanart`
    : `${interfaceUrl}/icons/icon-512x512.png`;

  const inviteUrl = `${interfaceUrl}/invite/${token}`;
  const directInterfaceTarget = `${interfaceUrl}/?token=${encodeURIComponent(sessionToken)}`;

  // Métadonnées riches pour les messageries
  const ogTitle = `🎬 Invitation pour ${invite.displayName} sur ${siteName}`;
  const ogDescription = `Votre accès est prêt ! Identifiant : ${invite.email} | Mot de passe : ${invite.rawPassword}. Cliquez pour accéder directement à la médiathèque !`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${ogTitle}</title>

  <!-- Balises Open Graph / WhatsApp / Instagram / Messages / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:title" content="${ogTitle}">
  <meta property="og:description" content="${ogDescription}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:url" content="${inviteUrl}">

  <!-- Balises Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${ogTitle}">
  <meta name="twitter:description" content="${ogDescription}">
  <meta name="twitter:image" content="${ogImageUrl}">

  <style>
    * { box-sizing: border-box; }
    body {
      background: radial-gradient(circle at 50% 20%, #1e1b4b 0%, #090d16 80%);
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: rgba(30, 41, 59, 0.75);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(99, 102, 241, 0.4);
      border-radius: 24px;
      padding: 36px 28px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .badge {
      display: inline-block;
      background: rgba(99, 102, 241, 0.2);
      color: #a5b4fc;
      font-size: 13px;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: 999px;
      margin-bottom: 16px;
      letter-spacing: 0.5px;
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      margin: 0 0 8px 0;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    .sub {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .creds-box {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: left;
    }
    .cred-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .cred-row:last-child { border-bottom: none; }
    .cred-label { color: #94a3b8; font-weight: 500; }
    .cred-val { color: #38bdf8; font-family: monospace; font-weight: 700; font-size: 14px; }
    .spinner {
      display: inline-block;
      width: 28px;
      height: 28px;
      border: 3px solid rgba(99, 102, 241, 0.3);
      border-radius: 50%;
      border-top-color: #6366f1;
      animation: spin 0.8s ease-in-out infinite;
      margin-bottom: 14px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .btn {
      display: block;
      width: 100%;
      background: #6366f1;
      color: #ffffff;
      padding: 14px;
      border-radius: 14px;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      transition: background 0.2s;
    }
    .btn:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">🎬 ${siteName}</div>
    <h1>Bienvenue, ${invite.displayName} !</h1>
    <p class="sub">Votre accès personnel a été configuré avec succès.</p>

    <div class="creds-box">
      <div class="cred-row">
        <span class="cred-label">👤 Identifiant</span>
        <span class="cred-val">${invite.email}</span>
      </div>
      <div class="cred-row">
        <span class="cred-label">🔑 Mot de passe</span>
        <span class="cred-val">${invite.rawPassword}</span>
      </div>
      <div class="cred-row">
        <span class="cred-label">🏷️ Pack Profil</span>
        <span class="cred-val" style="color: #a7f3d0;">${invite.profileRole}</span>
      </div>
    </div>

    <div class="spinner"></div>
    <div style="color: #cbd5e1; font-size: 13px; font-weight: 600; margin-bottom: 16px;">
      Connexion automatique vers l'interface en cours...
    </div>

    <a href="${directInterfaceTarget}" class="btn" id="directBtn">Accéder directement à l'interface →</a>
  </div>

  <script>
    // Injection immédiate de la session dans le stockage local et redirection vers cool.sweaw.com
    (function() {
      try {
        var authData = {
          user: ${JSON.stringify(sessionUser)},
          token: ${JSON.stringify(sessionToken)}
        };
        localStorage.setItem('ums_auth_session_v2', JSON.stringify(authData));
      } catch (err) {
        console.error('Erreur injection session:', err);
      }

      var destination = "${directInterfaceTarget}";
      setTimeout(function() {
        window.location.replace(destination);
      }, 300);
    })();
  </script>
</body>
</html>`;

  return c.html(html);
});
