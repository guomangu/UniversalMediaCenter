import crypto from 'node:crypto';

const SECRET = process.env.AUTH_SECRET || 'ums_super_secret_session_key_2026';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

/**
 * Crée un jeton de session HMAC-SHA256 signé pour un utilisateur.
 * Format : <userId>.<timestamp>.<signature_base64url>
 */
export function createSessionToken(userId: string): string {
  const timestamp = Date.now().toString();
  const payload = `${userId}:${timestamp}`;
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${userId}.${timestamp}.${sig}`;
}

/**
 * Vérifie l'intégrité et l'expiration d'un jeton de session.
 * Retourne le userId si valide, sinon null.
 */
export function verifySessionToken(token: string): string | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [userId, timestampStr, sig] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || Date.now() - timestamp > TOKEN_TTL_MS) {
    return null; // Jeton expiré
  }

  const payload = `${userId}:${timestampStr}`;
  const expectedSig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');

  try {
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    return userId;
  } catch {
    return null;
  }
}
