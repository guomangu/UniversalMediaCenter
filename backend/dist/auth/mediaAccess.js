import { verifyShareToken } from './shareToken.js';
export function checkMediaAccess(user, mediaId, shareToken, parentId) {
    if (user)
        return true;
    if (!shareToken)
        return false;
    if (verifyShareToken(shareToken, mediaId))
        return true;
    if (parentId && verifyShareToken(shareToken, parentId))
        return true;
    return false;
}
