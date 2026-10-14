import { verifyShareToken } from './shareToken.js';
export function isMediaAllowedForUser(user, media) {
    if (!user || user.isAdmin)
        return true;
    if (media.nodeType === 'LIVE_CHANNEL' && user.canWatchIptv === false)
        return false;
    // Exclusion de dossiers pour le profil
    if (user.blockedFolders && user.blockedFolders.length > 0) {
        const paths = `${media.videoFilePath || ''} ${media.nfoFilePath || ''}`.toLowerCase();
        for (const folder of user.blockedFolders) {
            if (folder && folder.trim() && paths.includes(folder.trim().toLowerCase())) {
                return false;
            }
        }
    }
    // Interdiction de tags spécifiques (Blacklist)
    if (user.blockedTags && user.blockedTags.length > 0) {
        const searchVec = (media.searchVectorText || '').toLowerCase();
        for (const tag of user.blockedTags) {
            if (tag && tag.trim() && searchVec.includes(tag.trim().toLowerCase())) {
                return false;
            }
        }
    }
    // Tags autorisés uniquement (Whitelist)
    if (user.allowedTags && user.allowedTags.length > 0) {
        const searchVec = (media.searchVectorText || '').toLowerCase();
        const hasAllowed = user.allowedTags.some((tag) => tag && tag.trim() && searchVec.includes(tag.trim().toLowerCase()));
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
