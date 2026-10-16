import { verifyShareToken } from './shareToken.js';
/**
 * Normalise un chemin de dossier ou fichier pour comparaison multi-plateforme.
 * Gère les séparateurs, Unicode NFC, et les alias d'OS immuables (/var/home vs /home).
 */
export function normalizePathVariants(p) {
    if (!p || typeof p !== 'string')
        return [];
    const clean = p.trim().normalize('NFC').replace(/\\/g, '/').toLowerCase();
    if (!clean)
        return [];
    // Supprimer les doubles slashes et slashes finaux superflus
    const deSlashed = clean.replace(/\/+/g, '/').replace(/\/+$/, '') || '/';
    const variants = new Set([deSlashed]);
    // Support transparent des alias de racines Linux (Fedora Atomic / Bazzite / Silverblue)
    if (deSlashed.startsWith('/var/home/')) {
        variants.add(deSlashed.replace(/^\/var\/home\//, '/home/'));
    }
    else if (deSlashed.startsWith('/home/')) {
        variants.add(`/var${deSlashed}`);
    }
    return Array.from(variants);
}
const SYSTEM_ROOT_PREFIXES = ['/home/', '/var/home/', '/run/media/', '/media/', '/mnt/', './'];
/**
 * Détermine avec précision si un chemin cible (fichier ou dossier de média)
 * appartient à une règle de dossier (dossier autorisé ou interdit).
 */
export function pathMatchesFolderRule(targetPath, ruleFolder) {
    if (!targetPath || !ruleFolder)
        return false;
    const targetVariants = normalizePathVariants(targetPath);
    const ruleVariants = normalizePathVariants(ruleFolder);
    if (targetVariants.length === 0 || ruleVariants.length === 0)
        return false;
    for (const t of targetVariants) {
        for (const r of ruleVariants) {
            // 1. Si la règle est un chemin absolu de système de fichiers
            const isAbsoluteSystemPath = SYSTEM_ROOT_PREFIXES.some((p) => r.startsWith(p));
            if (isAbsoluteSystemPath) {
                if (t === r || t.startsWith(`${r}/`)) {
                    return true;
                }
            }
            // 2. Traitement universel comme chemin partiel, sous-dossier ou mot-clé relatif
            // (ex: '/Films/Adultes', 'Films/Adultes', 'Horreur')
            const cleanRule = r.replace(/^\/+|\/+$/g, '');
            if (cleanRule.length > 0) {
                if (t === cleanRule ||
                    t.startsWith(`${cleanRule}/`) ||
                    t.endsWith(`/${cleanRule}`) ||
                    t.includes(`/${cleanRule}/`)) {
                    return true;
                }
            }
        }
    }
    return false;
}
export function isMediaAllowedForUser(user, media) {
    if (!user || user.isAdmin)
        return true;
    if (media.nodeType === 'LIVE_CHANNEL' && user.canWatchIptv === false)
        return false;
    // Rassemblement exhaustif de tous les chemins physiques connus pour ce média
    const pathsToCheck = [];
    if (media.videoFilePath)
        pathsToCheck.push(media.videoFilePath);
    if (media.nfoFilePath)
        pathsToCheck.push(media.nfoFilePath);
    if (media.effectivePhysicalPath)
        pathsToCheck.push(media.effectivePhysicalPath);
    if (Array.isArray(media.childPaths)) {
        for (const cp of media.childPaths) {
            if (cp && typeof cp === 'string')
                pathsToCheck.push(cp);
        }
    }
    // 1. Interdiction stricte de dossiers (Blacklist)
    // Si au moins un chemin du média (ou de ses enfants) appartient à un dossier interdit, accès refusé
    if (user.blockedFolders && user.blockedFolders.length > 0) {
        for (const blockedFolder of user.blockedFolders) {
            if (!blockedFolder || !blockedFolder.trim())
                continue;
            for (const p of pathsToCheck) {
                if (pathMatchesFolderRule(p, blockedFolder)) {
                    return false;
                }
            }
        }
    }
    // 2. Autorisation exclusive de dossiers (Whitelist)
    // Si au moins un dossier est configuré en autorisation exclusive,
    // le média DOIT impérativement appartenir à l'un de ces dossiers
    if (user.allowedFolders && user.allowedFolders.length > 0) {
        if (pathsToCheck.length === 0) {
            return false;
        }
        const hasAnyAllowed = pathsToCheck.some((p) => user.allowedFolders.some((allowedFolder) => pathMatchesFolderRule(p, allowedFolder)));
        if (!hasAnyAllowed) {
            return false;
        }
    }
    // 3. Interdiction de tags spécifiques (Blacklist)
    if (user.blockedTags && user.blockedTags.length > 0) {
        const searchVec = (media.searchVectorText || '').toLowerCase().normalize('NFC');
        for (const tag of user.blockedTags) {
            if (tag && tag.trim()) {
                const cleanTag = tag.trim().toLowerCase().normalize('NFC');
                if (searchVec.includes(cleanTag)) {
                    return false;
                }
            }
        }
    }
    // 4. Tags autorisés uniquement (Whitelist)
    if (user.allowedTags && user.allowedTags.length > 0) {
        const searchVec = (media.searchVectorText || '').toLowerCase().normalize('NFC');
        const hasAllowed = user.allowedTags.some((tag) => {
            if (!tag || !tag.trim())
                return false;
            const cleanTag = tag.trim().toLowerCase().normalize('NFC');
            return searchVec.includes(cleanTag);
        });
        if (!hasAllowed)
            return false;
    }
    return true;
}
export function checkMediaAccess(user, mediaId, shareToken, parentId, nodeType, mediaData) {
    if (nodeType === 'LIVE_CHANNEL') {
        if (user && user.canWatchIptv === false)
            return false;
        return true;
    }
    if (!user) {
        if (!shareToken)
            return false;
        if (verifyShareToken(shareToken, mediaId))
            return true;
        if (parentId && verifyShareToken(shareToken, parentId))
            return true;
        return false;
    }
    if (user.isAdmin)
        return true;
    if (mediaData) {
        return isMediaAllowedForUser(user, { ...mediaData, nodeType });
    }
    return true;
}
