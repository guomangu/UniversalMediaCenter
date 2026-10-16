import { sql, type SQL } from 'drizzle-orm';
import type { UserSession } from '../middleware/access.js';
import { normalizePathVariants } from './mediaAccess.js';

const SYSTEM_ROOT_PREFIXES = ['/home/', '/var/home/', '/run/media/', '/media/', '/mnt/', './'];

/**
 * Construit les fragments SQL PostgreSQL garantissant le respect strict
 * des permissions RBAC et ABAC (dossiers autorisés, dossiers bloqués, tags et IPTV)
 * directement au niveau de la requête SQL de sélection des nœuds médias.
 */
export function buildMediaAccessConditions(
  user: UserSession | null | undefined,
  tableAlias = 'n'
): SQL[] {
  if (!user || user.isAdmin) return [];

  const conditions: SQL[] = [];

  // 1. Restriction IPTV
  if (user.canWatchIptv === false) {
    conditions.push(sql`${sql.raw(tableAlias)}.node_type != 'LIVE_CHANNEL'`);
  }

  // Expression SQL résolvant le chemin physique représentatif du média
  const physicalPathExpr = sql`COALESCE(
    ${sql.raw(tableAlias)}.video_file_path,
    ${sql.raw(tableAlias)}.nfo_file_path,
    (SELECT c.video_file_path FROM media_nodes c WHERE (c.parent_id = ${sql.raw(tableAlias)}.id OR c.parent_id IN (SELECT id FROM media_nodes WHERE parent_id = ${sql.raw(tableAlias)}.id)) AND c.video_file_path IS NOT NULL LIMIT 1)
  )`;

  // 2. Exclusion de dossiers (Blacklist)
  if (user.blockedFolders && user.blockedFolders.length > 0) {
    for (const folder of user.blockedFolders) {
      if (!folder || !folder.trim()) continue;
      const variants = normalizePathVariants(folder);

      for (const v of variants) {
        const isSystemRoot = SYSTEM_ROOT_PREFIXES.some((p) => v.startsWith(p));
        if (isSystemRoot) {
          conditions.push(sql`NOT (
            ${physicalPathExpr} ILIKE ${v + '/%'}
            OR ${physicalPathExpr} ILIKE ${v}
          )`);
        }

        const clean = v.replace(/^\/+|\/+$/g, '');
        if (clean.length > 0) {
          conditions.push(sql`NOT (
            ${physicalPathExpr} ILIKE ${'%/' + clean + '/%'}
            OR ${physicalPathExpr} ILIKE ${'%/' + clean}
            OR ${physicalPathExpr} ILIKE ${clean + '/%'}
          )`);
        }
      }
    }
  }

  // 3. Autorisation exclusive de dossiers (Whitelist)
  if (user.allowedFolders && user.allowedFolders.length > 0) {
    const allowOrClauses: SQL[] = [];

    for (const folder of user.allowedFolders) {
      if (!folder || !folder.trim()) continue;
      const variants = normalizePathVariants(folder);

      for (const v of variants) {
        const isSystemRoot = SYSTEM_ROOT_PREFIXES.some((p) => v.startsWith(p));
        if (isSystemRoot) {
          allowOrClauses.push(sql`${physicalPathExpr} ILIKE ${v + '/%'}`);
          allowOrClauses.push(sql`${physicalPathExpr} ILIKE ${v}`);
        }

        const clean = v.replace(/^\/+|\/+$/g, '');
        if (clean.length > 0) {
          allowOrClauses.push(sql`${physicalPathExpr} ILIKE ${'%/' + clean + '/%'}`);
          allowOrClauses.push(sql`${physicalPathExpr} ILIKE ${'%/' + clean}`);
          allowOrClauses.push(sql`${physicalPathExpr} ILIKE ${clean + '/%'}`);
        }
      }
    }

    if (allowOrClauses.length > 0) {
      conditions.push(sql`(${sql.join(allowOrClauses, sql` OR `)})`);
    } else {
      conditions.push(sql`1=0`);
    }
  }

  // 4. Exclusion de tags spécifiques (Blacklist)
  if (user.blockedTags && user.blockedTags.length > 0) {
    for (const tag of user.blockedTags) {
      if (tag && tag.trim()) {
        const cleanTag = tag.trim().toLowerCase();
        conditions.push(sql`NOT (${sql.raw(tableAlias)}.search_vector_text ILIKE ${'%' + cleanTag + '%'})`);
      }
    }
  }

  // 5. Inclusions de tags spécifiques uniquement (Whitelist)
  if (user.allowedTags && user.allowedTags.length > 0) {
    const tagOrClauses: SQL[] = [];
    for (const tag of user.allowedTags) {
      if (tag && tag.trim()) {
        const cleanTag = tag.trim().toLowerCase();
        tagOrClauses.push(sql`${sql.raw(tableAlias)}.search_vector_text ILIKE ${'%' + cleanTag + '%'}`);
      }
    }
    if (tagOrClauses.length > 0) {
      conditions.push(sql`(${sql.join(tagOrClauses, sql` OR `)})`);
    }
  }

  return conditions;
}
