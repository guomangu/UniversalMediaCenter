import { verifyShareToken } from './shareToken.js';
import type { UserSession } from '../middleware/access.js';

export function isMediaAllowedForUser(
  user: UserSession | null | undefined,
  media: {
    videoFilePath?: string | null;
    nfoFilePath?: string | null;
    posterPath?: string | null;
    searchVectorText?: string | null;
    nodeType?: string | null;
  }
): boolean {
  if (!user || user.isAdmin) return true;
  if (media.nodeType === 'LIVE_CHANNEL' && user.canWatchIptv === false) return false;

  const paths = `${media.videoFilePath || ''} ${media.nfoFilePath || ''} ${media.posterPath || ''}`.replace(/\\/g, '/').toLowerCase();

  // 1. Autorisation exclusive de dossiers (Whitelist)
  // Si au moins un dossier est configuré en autorisation exclusive, le média DOIT impérativement appartenir à l'un de ces dossiers
  if (user.allowedFolders && user.allowedFolders.length > 0) {
    const isAllowed = user.allowedFolders.some((folder) => {
      const clean = (folder || '').trim().replace(/\\/g, '/').toLowerCase();
      return clean.length > 0 && paths.includes(clean);
    });
    if (!isAllowed) {
      return false;
    }
  }

  // 2. Exclusion / interdiction de dossiers pour le profil (Blacklist)
  if (user.blockedFolders && user.blockedFolders.length > 0) {
    for (const folder of user.blockedFolders) {
      const clean = (folder || '').trim().replace(/\\/g, '/').toLowerCase();
      if (clean.length > 0 && paths.includes(clean)) {
        return false;
      }
    }
  }

  // 3. Interdiction de tags spécifiques (Blacklist)
  if (user.blockedTags && user.blockedTags.length > 0) {
    const searchVec = (media.searchVectorText || '').toLowerCase();
    for (const tag of user.blockedTags) {
      if (tag && tag.trim() && searchVec.includes(tag.trim().toLowerCase())) {
        return false;
      }
    }
  }

  // 4. Tags autorisés uniquement (Whitelist)
  if (user.allowedTags && user.allowedTags.length > 0) {
    const searchVec = (media.searchVectorText || '').toLowerCase();
    const hasAllowed = user.allowedTags.some(
      (tag) => tag && tag.trim() && searchVec.includes(tag.trim().toLowerCase())
    );
    if (!hasAllowed) return false;
  }

  return true;
}

export function checkMediaAccess(
  user: UserSession | null | undefined,
  mediaId: string,
  shareToken?: string | null,
  parentId?: string | null,
  nodeType?: string | null,
  mediaData?: {
    videoFilePath?: string | null;
    nfoFilePath?: string | null;
    posterPath?: string | null;
    searchVectorText?: string | null;
  }
): boolean {
  if (nodeType === 'LIVE_CHANNEL') {
    if (user && user.canWatchIptv === false) return false;
    return true;
  }
  if (!user) {
    if (!shareToken) return false;
    if (verifyShareToken(shareToken, mediaId)) return true;
    if (parentId && verifyShareToken(shareToken, parentId)) return true;
    return false;
  }
  if (user.isAdmin) return true;

  if (mediaData) {
    return isMediaAllowedForUser(user, { ...mediaData, nodeType });
  }

  return true;
}
