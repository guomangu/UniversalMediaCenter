import crypto from 'node:crypto';
const SECRET = process.env.AUTH_SECRET || 'ums_super_secret_session_key_2026';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours
const WEAK_SECRETS = new Set([
    'ums_super_secret_session_key_2026',
    'super_secret_session_key_ums',
    'changeme',
    'secret',
]);
if (!process.env.AUTH_SECRET || WEAK_SECRETS.has(process.env.AUTH_SECRET)) {
    console.warn('[SÉCURITÉ] AUTH_SECRET est absent ou utilise une valeur par défaut publique. ' +
        'Définissez une clé aléatoire longue (ex: openssl rand -hex 32) dans l’environnement.');
}
/**
 * Crée un jeton de session HMAC-SHA256 signé pour un utilisateur.
 *
 * Format v2 (recommandé) : v2.<userId>.<deviceId_base64url>.<timestamp>.<signature>
 * Format v1 (legacy)      : <userId>.<timestamp>.<signature>
 *
 * L'identifiant d'appareil est signé dans le jeton : la révocation à distance
 * reste donc effective même si le client omet l'en-tête X-Device-Id.
 */
export function createSessionToken(userId, deviceId) {
    const timestamp = Date.now().toString();
    if (deviceId && deviceId.trim()) {
        const encodedDevice = Buffer.from(deviceId.trim(), 'utf8').toString('base64url');
        const payload = `v2:${userId}:${encodedDevice}:${timestamp}`;
        const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
        return `v2.${userId}.${encodedDevice}.${timestamp}.${sig}`;
    }
    const payload = `${userId}:${timestamp}`;
    const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
    return `${userId}.${timestamp}.${sig}`;
}
/**
 * Vérifie l'intégrité et l'expiration d'un jeton de session.
 * Retourne l'utilisateur (et l'appareil éventuellement signé) si valide.
 */
export function verifySessionTokenDetails(token) {
    if (!token || typeof token !== 'string')
        return null;
    const parts = token.split('.');
    // --- Format v2 : v2.userId.deviceB64.timestamp.sig ---
    if (parts[0] === 'v2') {
        if (parts.length !== 5)
            return null;
        const [, userId, encodedDevice, timestampStr, sig] = parts;
        const timestamp = parseInt(timestampStr, 10);
        if (isNaN(timestamp) || Date.now() - timestamp > TOKEN_TTL_MS)
            return null;
        const payload = `v2:${userId}:${encodedDevice}:${timestampStr}`;
        const expectedSig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
        if (!safeEqual(sig, expectedSig))
            return null;
        let deviceId;
        try {
            deviceId = Buffer.from(encodedDevice, 'base64url').toString('utf8');
        }
        catch {
            return null;
        }
        return { userId, deviceId };
    }
    // --- Format v1 (legacy) : userId.timestamp.sig ---
    if (parts.length !== 3)
        return null;
    const [userId, timestampStr, sig] = parts;
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp) || Date.now() - timestamp > TOKEN_TTL_MS)
        return null;
    const payload = `${userId}:${timestampStr}`;
    const expectedSig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
    if (!safeEqual(sig, expectedSig))
        return null;
    return { userId };
}
/**
 * Compatibilité : retourne uniquement l'userId.
 */
export function verifySessionToken(token) {
    return verifySessionTokenDetails(token)?.userId ?? null;
}
function safeEqual(a, b) {
    try {
        const aBuf = Buffer.from(a, 'utf8');
        const bBuf = Buffer.from(b, 'utf8');
        if (aBuf.length !== bBuf.length)
            return false;
        return crypto.timingSafeEqual(aBuf, bBuf);
    }
    catch {
        return false;
    }
}
