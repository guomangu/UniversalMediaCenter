import crypto from 'node:crypto';
/**
 * Hache un mot de passe en utilisant scrypt avec un sel aléatoire de 16 octets.
 * Format retourné : salt:hash (hexadécimal)
 */
export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return `${salt}:${derivedKey.toString('hex')}`;
}
/**
 * Vérifie si un mot de passe correspond au hash scrypt stocké.
 */
export function verifyPassword(password, storedHash) {
    if (!password || !storedHash)
        return false;
    const parts = storedHash.split(':');
    if (parts.length !== 2)
        return false;
    const [salt, originalHash] = parts;
    try {
        const derivedKey = crypto.scryptSync(password, salt, 64);
        const keyBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
        const originalBuffer = Buffer.from(originalHash, 'hex');
        if (keyBuffer.length !== originalBuffer.length)
            return false;
        return crypto.timingSafeEqual(keyBuffer, originalBuffer);
    }
    catch {
        return false;
    }
}
/**
 * Vérifie un code PIN.
 *
 * Les nouvelles installations stockent le PIN avec le même format scrypt que
 * les mots de passe. Les anciennes installations pouvaient stocker le PIN en
 * clair : on continue à les accepter en comparaison à temps constant, mais
 * tout nouveau PIN est haché.
 */
export function verifyPin(pin, storedPin) {
    if (!pin || !storedPin)
        return false;
    const normalizedPin = String(pin).trim();
    if (!normalizedPin)
        return false;
    if (storedPin.includes(':')) {
        return verifyPassword(normalizedPin, storedPin);
    }
    // Compatibilité ascendante : ancien PIN stocké en clair.
    const provided = Buffer.from(normalizedPin, 'utf8');
    const stored = Buffer.from(storedPin, 'utf8');
    if (provided.length !== stored.length)
        return false;
    return crypto.timingSafeEqual(provided, stored);
}
