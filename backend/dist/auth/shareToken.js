import crypto from 'node:crypto';
const SECRET = process.env.AUTH_SECRET || 'ums_super_secret_session_key_2026';
/**
 * Génère un jeton signé pour partager l'accès à un média spécifique.
 * Format : <mediaId>.<expiresAt>.<sig_base64url>
 */
export function createShareToken(mediaId, durationDays = 7) {
    const expiresAt = (Date.now() + durationDays * 24 * 60 * 60 * 1000).toString();
    const payload = `share:${mediaId}:${expiresAt}`;
    const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
    return `${mediaId}.${expiresAt}.${sig}`;
}
/**
 * Valide si un jeton de partage est authentique, non expiré et correspond au média demandé.
 */
export function verifyShareToken(token, expectedMediaId) {
    if (!token || typeof token !== 'string')
        return false;
    const parts = token.split('.');
    if (parts.length !== 3)
        return false;
    const [mediaId, expiresAtStr, sig] = parts;
    if (mediaId !== expectedMediaId)
        return false;
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt)
        return false;
    const payload = `share:${mediaId}:${expiresAtStr}`;
    const expectedSig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
    try {
        const sigBuf = Buffer.from(sig);
        const expBuf = Buffer.from(expectedSig);
        if (sigBuf.length !== expBuf.length)
            return false;
        return crypto.timingSafeEqual(sigBuf, expBuf);
    }
    catch {
        return false;
    }
}
