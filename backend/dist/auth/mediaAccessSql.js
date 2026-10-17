import { sql } from 'drizzle-orm';
import { normalizePathVariants } from './mediaAccess.js';
const SYSTEM_ROOT_PREFIXES = ['/home/', '/var/home/', '/run/media/', '/media/', '/mnt/', './'];
/**
 * Construit les fragments SQL PostgreSQL garantissant le respect strict
 * des permissions RBAC et ABAC (dossiers autorisés, dossiers bloqués, tags et IPTV)
 * directement au niveau de la requête SQL de sélection des nœuds médias.
 */
export function buildMediaAccessConditions(user, tableAlias = 'n') {
    if (!user || user.isAdmin)
        return [];
    const conditions = [];
    // 1. Restriction IPTV
    if (user.canWatchIptv === false) {
        conditions.push(sql `${sql.raw(tableAlias)}.node_type != 'LIVE_CHANNEL'`);
    }
    // Expression SQL résolvant le chemin physique représentatif du média
    // Ordre optimisé : videoFilePath direct -> nfoFilePath direct -> chemin du premier enfant (SHOW / COLLECTION)
    const physicalPathExpr = sql `COALESCE(
    ${sql.raw(tableAlias)}.video_file_path,
    ${sql.raw(tableAlias)}.nfo_file_path,
    (SELECT c.video_file_path FROM media_nodes c WHERE c.parent_id = ${sql.raw(tableAlias)}.id AND c.video_file_path IS NOT NULL LIMIT 1)
  )`;
    // 2. Exclusion de dossiers (Blacklist)
    if (user.blockedFolders && user.blockedFolders.length > 0) {
        for (const folder of user.blockedFolders) {
            if (!folder || !folder.trim())
                continue;
            const variants = normalizePathVariants(folder);
            for (const v of variants) {
                const isSystemRoot = SYSTEM_ROOT_PREFIXES.some((p) => v.startsWith(p));
                if (isSystemRoot) {
                    conditions.push(sql `NOT (
            ${physicalPathExpr} ILIKE ${v + '/%'}
            OR ${physicalPathExpr} ILIKE ${v}
          )`);
                }
                else {
                    const clean = v.replace(/^\/+|\/+$/g, '');
                    if (clean.length > 0) {
                        conditions.push(sql `NOT (
              ${physicalPathExpr} ILIKE ${'%/' + clean + '/%'}
              OR ${physicalPathExpr} ILIKE ${'%/' + clean}
              OR ${physicalPathExpr} ILIKE ${clean + '/%'}
            )`);
                    }
                }
            }
        }
    }
    // 3. Autorisation exclusive de dossiers (Whitelist)
    if (user.allowedFolders && user.allowedFolders.length > 0) {
        const allowOrClauses = [];
        // Les chaînes IPTV virtuelles ne résident pas sur disque physique
        if (user.canWatchIptv !== false) {
            allowOrClauses.push(sql `${sql.raw(tableAlias)}.node_type = 'LIVE_CHANNEL'`);
        }
        for (const folder of user.allowedFolders) {
            if (!folder || !folder.trim())
                continue;
            const variants = normalizePathVariants(folder);
            for (const v of variants) {
                const isSystemRoot = SYSTEM_ROOT_PREFIXES.some((p) => v.startsWith(p));
                if (isSystemRoot) {
                    allowOrClauses.push(sql `${physicalPathExpr} ILIKE ${v + '/%'}`);
                    allowOrClauses.push(sql `${physicalPathExpr} ILIKE ${v}`);
                }
                else {
                    const clean = v.replace(/^\/+|\/+$/g, '');
                    if (clean.length > 0) {
                        allowOrClauses.push(sql `${physicalPathExpr} ILIKE ${'%/' + clean + '/%'}`);
                        allowOrClauses.push(sql `${physicalPathExpr} ILIKE ${'%/' + clean}`);
                        allowOrClauses.push(sql `${physicalPathExpr} ILIKE ${clean + '/%'}`);
                    }
                }
            }
        }
        if (allowOrClauses.length > 0) {
            conditions.push(sql `(${sql.join(allowOrClauses, sql ` OR `)})`);
        }
        else {
            conditions.push(sql `1=0`);
        }
    }
    // 4. Exclusion de tags spécifiques (Blacklist)
    if (user.blockedTags && user.blockedTags.length > 0) {
        for (const tag of user.blockedTags) {
            if (tag && tag.trim()) {
                const cleanTag = tag.trim().toLowerCase();
                conditions.push(sql `NOT (${sql.raw(tableAlias)}.search_vector_text ILIKE ${'%' + cleanTag + '%'})`);
            }
        }
    }
    // 5. Inclusions de tags spécifiques uniquement (Whitelist)
    if (user.allowedTags && user.allowedTags.length > 0) {
        const tagOrClauses = [];
        for (const tag of user.allowedTags) {
            if (tag && tag.trim()) {
                const cleanTag = tag.trim().toLowerCase();
                tagOrClauses.push(sql `${sql.raw(tableAlias)}.search_vector_text ILIKE ${'%' + cleanTag + '%'}`);
            }
        }
        if (tagOrClauses.length > 0) {
            conditions.push(sql `(${sql.join(tagOrClauses, sql ` OR `)})`);
        }
    }
    // 6. Plafond d'âge CSA (Contrôle Parental)
    if (user.maxCsaAgeLimit !== undefined && user.maxCsaAgeLimit !== null && user.maxCsaAgeLimit >= 0) {
        if (user.maxCsaAgeLimit < 18) {
            conditions.push(sql `NOT (${sql.raw(tableAlias)}.search_vector_text ~* '(?i)\\y(csa\\s*:\\s*-18|-18|nc-17|18\\+)\\y')`);
        }
        if (user.maxCsaAgeLimit < 16) {
            conditions.push(sql `NOT (${sql.raw(tableAlias)}.search_vector_text ~* '(?i)\\y(csa\\s*:\\s*-16|-16|tv-ma|16\\+)\\y')`);
        }
        if (user.maxCsaAgeLimit < 12) {
            conditions.push(sql `NOT (${sql.raw(tableAlias)}.search_vector_text ~* '(?i)\\y(csa\\s*:\\s*-12|-12|pg-13|12\\+)\\y')`);
        }
        if (user.maxCsaAgeLimit < 10) {
            conditions.push(sql `NOT (${sql.raw(tableAlias)}.search_vector_text ~* '(?i)\\y(csa\\s*:\\s*-10|-10|10\\+)\\y')`);
        }
    }
    return conditions;
}
