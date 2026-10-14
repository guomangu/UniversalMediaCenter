import { verifyShareToken } from './shareToken.js';
import type { UserSession } from '../middleware/access.js';

export function checkMediaAccess(
  user: UserSession | null | undefined,
  mediaId: string,
  shareToken?: string | null,
  parentId?: string | null,
  nodeType?: string | null
): boolean {
  // Les flux TV en direct (IPTV) sont accessibles librement sans blocage 401
  if (nodeType === 'LIVE_CHANNEL') return true;
  if (user) return true;
  if (!shareToken) return false;

  if (verifyShareToken(shareToken, mediaId)) return true;
  if (parentId && verifyShareToken(shareToken, parentId)) return true;

  return false;
}
