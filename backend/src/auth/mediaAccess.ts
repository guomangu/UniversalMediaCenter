import { verifyShareToken } from './shareToken.js';
import type { UserSession } from '../middleware/access.js';

export function checkMediaAccess(
  user: UserSession | null | undefined,
  mediaId: string,
  shareToken?: string | null,
  parentId?: string | null
): boolean {
  if (user) return true;
  if (!shareToken) return false;

  if (verifyShareToken(shareToken, mediaId)) return true;
  if (parentId && verifyShareToken(shareToken, parentId)) return true;

  return false;
}
