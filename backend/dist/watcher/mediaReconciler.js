import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/connection.js';
import { mediaNodes, watchProgress, userFavorites, mediaReposts } from '../db/schema/index.js';
import { eq, inArray, sql, and, ne, isNull, isNotNull, or } from 'drizzle-orm';
import { parseMediaChaosRoots } from './rootConfig.js';
/**
 * Vérifie si le volume physique hébergeant un fichier est accessible.
 * Évite de supprimer des fichiers si un disque dur externe est débranché.
 */
export function isDiskAccessibleForPath(filePath, configuredRoots) {
    if (!filePath)
        return false;
    const roots = configuredRoots && configuredRoots.length > 0 ? configuredRoots : parseMediaChaosRoots();
    // 1. Vérification par rapport aux racines déclarées
    for (const root of roots) {
        const normRoot = path.normalize(root).replace(/\\/g, '/');
        const normFile = path.normalize(filePath).replace(/\\/g, '/');
        if (normFile.startsWith(normRoot)) {
            // Si la racine elle-même existe sur le disque, le volume est monté et accessible
            return fs.existsSync(normRoot);
        }
    }
    // 2. Détection dynamique pour les disques /run/media/... ou /home/...
    if (filePath.startsWith('/run/media/')) {
        const parts = filePath.split('/');
        if (parts.length >= 5) {
            // /run/media/user/DiskName
            const mountPoint = parts.slice(0, 5).join('/');
            return fs.existsSync(mountPoint);
        }
    }
    // 3. Dossiers locaux standard (/home/..., /var/..., ./media/...)
    let currentDir = path.dirname(filePath);
    while (currentDir && currentDir !== '/' && currentDir !== '.') {
        if (fs.existsSync(currentDir)) {
            return true;
        }
        const parent = path.dirname(currentDir);
        if (parent === currentDir)
            break;
        currentDir = parent;
    }
    return false;
}
/**
 * Réconcilie les médias déplacés (fusionne les doublons, met à jour les chemins)
 * et purge définitivement les faux fichiers supprimés du disque.
 */
export async function reconcileAndPruneLibrary(roots) {
    const effectiveRoots = roots && roots.length > 0 ? roots : parseMediaChaosRoots();
    const report = {
        inspected: 0,
        movedReconciled: 0,
        duplicatesPruned: 0,
        phantomsDeleted: 0,
        showsCleaned: 0,
        sagasCleaned: 0,
    };
    console.log('🧹 [Reconciler] Démarrage de la réconciliation et purge des faux fichiers...');
    // 1. Récupérer tous les nœuds médias physiques (hors chaînes IPTV en direct)
    const allNodes = await db.query.mediaNodes.findMany({
        where: (t, { ne: neOp }) => neOp(t.nodeType, 'LIVE_CHANNEL'),
    });
    report.inspected = allNodes.length;
    // Séparer les nœuds valides existants sur disque et les nœuds manquants
    const validNodes = [];
    const missingNodes = [];
    for (const node of allNodes) {
        if (node.nodeType === 'SHOW' || node.nodeType === 'COLLECTION') {
            continue;
        }
        const hasVideo = !!node.videoFilePath;
        const hasNfo = !!node.nfoFilePath;
        const videoExists = hasVideo ? fs.existsSync(node.videoFilePath) : false;
        const nfoExists = hasNfo ? fs.existsSync(node.nfoFilePath) : false;
        if (hasVideo && videoExists) {
            validNodes.push(node);
        }
        else if (!hasVideo && hasNfo && nfoExists) {
            validNodes.push(node);
        }
        else {
            // Le fichier n'existe plus à l'emplacement renseigné
            const fileToCheck = node.videoFilePath || node.nfoFilePath;
            if (fileToCheck && isDiskAccessibleForPath(fileToCheck, effectiveRoots)) {
                missingNodes.push(node);
            }
        }
    }
    console.log(`🔍 [Reconciler] Inspecté ${report.inspected} nœuds: ${validNodes.length} valides sur disque, ${missingNodes.length} manquants.`);
    // Indexation des nœuds valides pour recherche rapide de correspondances (déplacements)
    const validByOshash = new Map();
    const validByCrc32 = new Map();
    const validByBasename = new Map();
    for (const node of validNodes) {
        if (node.oshash)
            validByOshash.set(node.oshash.toLowerCase(), node);
        if (node.crc32)
            validByCrc32.set(node.crc32.toLowerCase(), node);
        if (node.videoFilePath) {
            const base = path.basename(node.videoFilePath).toLowerCase();
            if (!validByBasename.has(base))
                validByBasename.set(base, []);
            validByBasename.get(base).push(node);
        }
    }
    const nodesToDelete = new Set();
    // 2. Traitement des nœuds manquants : Déplacement / Dédoublonnage
    for (const missing of missingNodes) {
        let matchedValidNode;
        // A. Match par hash binaire OSHash ou CRC32
        if (missing.oshash && validByOshash.has(missing.oshash.toLowerCase())) {
            matchedValidNode = validByOshash.get(missing.oshash.toLowerCase());
        }
        else if (missing.crc32 && validByCrc32.has(missing.crc32.toLowerCase())) {
            matchedValidNode = validByCrc32.get(missing.crc32.toLowerCase());
        }
        // B. Match par nom de fichier vidéo exact (path.basename)
        if (!matchedValidNode && missing.videoFilePath) {
            const base = path.basename(missing.videoFilePath).toLowerCase();
            const candidates = validByBasename.get(base);
            if (candidates && candidates.length > 0) {
                if (candidates.length === 1) {
                    matchedValidNode = candidates[0];
                }
                else {
                    // Filtrer par similarité de titre ou index d'ordre
                    matchedValidNode = candidates.find((c) => c.orderIndex === missing.orderIndex ||
                        c.nodeType === missing.nodeType ||
                        c.title.toLowerCase() === missing.title.toLowerCase());
                }
            }
        }
        if (matchedValidNode && matchedValidNode.id !== missing.id) {
            // Déplacement confirmé avec doublon déjà ingéré sous le nouveau chemin !
            // Transférer la progression et les favoris de l'ancien nœud vers le nouveau
            try {
                await db.execute(sql `
          UPDATE watch_progress 
          SET node_id = ${matchedValidNode.id}
          WHERE node_id = ${missing.id}
          AND user_id NOT IN (
            SELECT user_id FROM watch_progress WHERE node_id = ${matchedValidNode.id}
          );
        `);
                await db.execute(sql `
          UPDATE user_favorites 
          SET node_id = ${matchedValidNode.id}
          WHERE node_id = ${missing.id}
          AND user_id NOT IN (
            SELECT user_id FROM user_favorites WHERE node_id = ${matchedValidNode.id}
          );
        `);
                await db.execute(sql `
          UPDATE media_reposts 
          SET node_id = ${matchedValidNode.id}
          WHERE node_id = ${missing.id}
          AND user_id NOT IN (
            SELECT user_id FROM media_reposts WHERE node_id = ${matchedValidNode.id}
          );
        `);
            }
            catch (err) {
                console.warn(`[Reconciler] Erreur transfert métadonnées utilisateur de ${missing.id} vers ${matchedValidNode.id}:`, err);
            }
            nodesToDelete.add(missing.id);
            report.duplicatesPruned++;
            console.log(`🔁 [Reconciler] Doublon résolu pour média déplacé : "${missing.title}" (Ancien: ${path.basename(missing.videoFilePath || '')} -> Nouveau: ${matchedValidNode.videoFilePath})`);
        }
        else {
            // Pas de doublon trouvé, le fichier physique a été purement et simplement supprimé !
            nodesToDelete.add(missing.id);
            report.phantomsDeleted++;
            console.log(`🗑️ [Reconciler] Faux fichier supprimé détecté : "${missing.title}" (${missing.videoFilePath || missing.nfoFilePath})`);
        }
    }
    // 3. Suppression atomique de tous les nœuds fantômes et doublons
    if (nodesToDelete.size > 0) {
        const ids = Array.from(nodesToDelete);
        console.log(`⚡ [Reconciler] Suppression de ${ids.length} faux fichiers / nœuds orphelins...`);
        // Découpage en lots de 200 pour éviter de dépasser les limites de paramètres SQL
        for (let i = 0; i < ids.length; i += 200) {
            const batch = ids.slice(i, i + 200);
            await db.delete(mediaNodes).where(inArray(mediaNodes.id, batch));
        }
    }
    // 4. Nettoyage des SHOWs orphelins (Séries dont tous les épisodes ont disparu)
    const shows = await db.query.mediaNodes.findMany({
        where: (t, { eq: eqOp }) => eqOp(t.nodeType, 'SHOW'),
        columns: { id: true, title: true, nfoFilePath: true },
    });
    for (const show of shows) {
        const episodeCount = await db.query.mediaNodes.findFirst({
            where: (t, { and: aOp, eq: eOp }) => aOp(eOp(t.parentId, show.id), eOp(t.nodeType, 'EPISODE')),
            columns: { id: true },
        });
        if (!episodeCount) {
            // Vérifier si un dossier physique existe encore sur le disque
            const showDirExists = show.nfoFilePath ? fs.existsSync(path.dirname(show.nfoFilePath)) : false;
            if (!showDirExists) {
                await db.delete(mediaNodes).where(eq(mediaNodes.id, show.id));
                report.showsCleaned++;
                console.log(`📺 [Reconciler] Série vide supprimée : "${show.title}" (0 épisode restant)`);
            }
        }
    }
    // 5. Nettoyage des COLLECTIONS orphelines (Sagas dont tous les films ont disparu)
    const sagas = await db.query.mediaNodes.findMany({
        where: (t, { eq: eqOp }) => eqOp(t.nodeType, 'COLLECTION'),
        columns: { id: true, title: true },
    });
    for (const saga of sagas) {
        const childMedia = await db.query.mediaNodes.findFirst({
            where: (t, { eq: eqOp }) => eqOp(t.parentId, saga.id),
            columns: { id: true },
        });
        if (!childMedia) {
            await db.delete(mediaNodes).where(eq(mediaNodes.id, saga.id));
            report.sagasCleaned++;
            console.log(`🍿 [Reconciler] Saga vide supprimée : "${saga.title}" (0 média rattaché)`);
        }
    }
    console.log(`✅ [Reconciler] Réconciliation terminée avec succès :`, report);
    return report;
}
