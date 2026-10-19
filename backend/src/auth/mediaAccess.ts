import { verifyShareToken } from './shareToken.js';
import type { UserSession } from '../middleware/access.js';
import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { sql, eq } from 'drizzle-orm';

/**
 * Normalise un chemin de dossier ou fichier pour comparaison multi-plateforme.
 * Gère les séparateurs, Unicode NFC, et les alias d'OS immuables (/var/home vs /home).
 */
export function normalizePathVariants(p: string): string[] {
  if (!p || typeof p !== 'string') return [];
  const clean = p.trim().normalize('NFC').replace(/\\/g, '/').toLowerCase();
  if (!clean) return [];

  // Supprimer les doubles slashes et slashes finaux superflus
  const deSlashed = clean.replace(/\/+/g, '/').replace(/\/+$/, '') || '/';
  const variants = new Set<string>([deSlashed]);

  // Support transparent des alias de racines Linux (Fedora Atomic / Bazzite / Silverblue)
  if (deSlashed.startsWith('/var/home/')) {
    variants.add(deSlashed.replace(/^\/var\/home\//, '/home/'));
  } else if (deSlashed.startsWith('/home/')) {
    variants.add(`/var${deSlashed}`);
  }

  return Array.from(variants);
}

const SYSTEM_ROOT_PREFIXES = ['/home/', '/var/home/', '/run/media/', '/media/', '/mnt/', './'];

/**
 * Détermine avec précision si un chemin cible (fichier ou dossier de média)
 * appartient à une règle de dossier (dossier autorisé ou interdit).
 */
export function pathMatchesFolderRule(targetPath: string, ruleFolder: string): boolean {
  if (!targetPath || !ruleFolder) return false;
  const targetVariants = normalizePathVariants(targetPath);
  const ruleVariants = normalizePathVariants(ruleFolder);

  if (targetVariants.length === 0 || ruleVariants.length === 0) return false;

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
        if (
          t === cleanRule ||
          t.startsWith(`${cleanRule}/`) ||
          t.endsWith(`/${cleanRule}`) ||
          t.includes(`/${cleanRule}/`)
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

export interface MediaAccessCheckInput {
  title?: string | null;
  videoFilePath?: string | null;
  nfoFilePath?: string | null;
  posterPath?: string | null;
  searchVectorText?: string | null;
  nodeType?: string | null;
  effectivePhysicalPath?: string | null;
  childPaths?: (string | null | undefined)[];
}

export function isMediaAllowedForUser(
  user: UserSession | null | undefined,
  media: MediaAccessCheckInput
): boolean {
  if (!user || user.isAdmin) return true;

  // 0. Traitement spécifique des flux IPTV en direct (LIVE_CHANNEL)
  if (media.nodeType === 'LIVE_CHANNEL') {
    if (user.canWatchIptv === false) return false;

    // Pour les chaînes IPTV en direct, les restrictions de dossiers physiques (fichiers disques)
    // ne s'appliquent pas. Seules les restrictions de tags et de contrôle parental s'appliquent.
    if (user.blockedTags && user.blockedTags.length > 0) {
      const searchVec = (media.searchVectorText || media.title || '').toLowerCase().normalize('NFC');
      for (const tag of user.blockedTags) {
        if (tag && tag.trim()) {
          const cleanTag = tag.trim().toLowerCase().normalize('NFC');
          if (searchVec.includes(cleanTag)) {
            return false;
          }
        }
      }
    }

    if (user.allowedTags && user.allowedTags.length > 0) {
      const searchVec = (media.searchVectorText || media.title || '').toLowerCase().normalize('NFC');
      const hasAllowed = user.allowedTags.some((tag) => {
        if (!tag || !tag.trim()) return false;
        const cleanTag = tag.trim().toLowerCase().normalize('NFC');
        return searchVec.includes(cleanTag);
      });
      if (!hasAllowed) return false;
    }

    return true;
  }

  // Rassemblement exhaustif de tous les chemins physiques connus pour ce média
  const pathsToCheck: string[] = [];
  if (media.videoFilePath) pathsToCheck.push(media.videoFilePath);
  if (media.nfoFilePath) pathsToCheck.push(media.nfoFilePath);
  if (media.effectivePhysicalPath) pathsToCheck.push(media.effectivePhysicalPath);
  if (Array.isArray(media.childPaths)) {
    for (const cp of media.childPaths) {
      if (cp && typeof cp === 'string') pathsToCheck.push(cp);
    }
  }

  // 1. Interdiction stricte de dossiers (Blacklist)
  // Si au moins un chemin du média (ou de ses enfants) appartient à un dossier interdit, accès refusé
  if (user.blockedFolders && user.blockedFolders.length > 0) {
    for (const blockedFolder of user.blockedFolders) {
      if (!blockedFolder || !blockedFolder.trim()) continue;
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

    const hasAnyAllowed = pathsToCheck.some((p) =>
      user.allowedFolders.some((allowedFolder) => pathMatchesFolderRule(p, allowedFolder))
    );

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
      if (!tag || !tag.trim()) return false;
      const cleanTag = tag.trim().toLowerCase().normalize('NFC');
      return searchVec.includes(cleanTag);
    });
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
  mediaData?: MediaAccessCheckInput
): boolean {
  if (nodeType === 'LIVE_CHANNEL') {
    // Une chaîne en direct reste un média : sans session ni jeton de partage
    // valide, elle ne doit pas être diffusée.
    if (!user) {
      if (!shareToken) return false;
      return verifyShareToken(shareToken, mediaId) || Boolean(parentId && verifyShareToken(shareToken, parentId));
    }
    if (user.canWatchIptv === false) return false;
    if (user.isAdmin) return true;
    if (mediaData) return isMediaAllowedForUser(user, { ...mediaData, nodeType });
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

/**
 * Vérifie de manière asynchrone si un utilisateur a le droit d'accéder à un nœud média par son identifiant ID (UUID).
 * Résout le nœud en base et applique les contrôles de sécurité PBAC/ABAC (dossiers autorisés/bloqués, tags, IPTV).
 */
export async function canUserAccessMediaNodeId(
  user: UserSession | null | undefined,
  nodeId: string | null | undefined
): Promise<boolean> {
  if (!nodeId || typeof nodeId !== 'string') return false;
  if (!user) return false;
  if (user.isAdmin) return true;

  try {
    const node = await db.query.mediaNodes.findFirst({
      where: (t, { eq: eqNode }) => eqNode(t.id, nodeId),
    });
    if (!node) return false;

    // Pour les chaînes IPTV en direct
    if (node.nodeType === 'LIVE_CHANNEL') {
      return isMediaAllowedForUser(user, node);
    }

    // Pour les conteneurs (SHOW, COLLECTION, SEASON), récupérer les chemins de leurs enfants
    let containerChildPaths: string[] = [];
    if (node.nodeType === 'SHOW' || node.nodeType === 'COLLECTION' || node.nodeType === 'SEASON') {
      const containerSamples = await db.execute(sql`
        SELECT c.video_file_path, c.nfo_file_path FROM media_nodes c
        WHERE (c.parent_id = ${node.id}::uuid OR c.parent_id IN (SELECT id FROM media_nodes WHERE parent_id = ${node.id}::uuid))
          AND (c.video_file_path IS NOT NULL OR c.nfo_file_path IS NOT NULL)
        LIMIT 30
      `);
      containerChildPaths = Array.from(containerSamples)
        .flatMap((r: any) => [r.video_file_path, r.nfo_file_path])
        .filter((p): p is string => Boolean(p));
    } else if (node.parentId && !node.videoFilePath && !node.nfoFilePath) {
      // Si c'est un nœud enfant sans fichier direct, vérifier aussi l'autorisation du parent
      const parent = await db.query.mediaNodes.findFirst({
        where: (t, { eq: eqParent }) => eqParent(t.id, node.parentId!),
      });
      if (parent && !isMediaAllowedForUser(user, parent)) {
        return false;
      }
    }

    return isMediaAllowedForUser(user, {
      title: node.title,
      videoFilePath: node.videoFilePath,
      nfoFilePath: node.nfoFilePath,
      searchVectorText: node.searchVectorText,
      nodeType: node.nodeType,
      childPaths: containerChildPaths,
    });
  } catch (err) {
    console.error('Error in canUserAccessMediaNodeId:', err);
    return false;
  }
}
