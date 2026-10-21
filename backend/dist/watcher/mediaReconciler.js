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
function isDirectoryReadable(dirPath) {
    try {
        const handle = fs.opendirSync(dirPath);
        handle.closeSync();
        return true;
    }
    catch {
        // EIO / EACCES / ENODEV : le volume est monté mais illisible. Il ne faut
        // surtout pas interpréter cela comme « fichiers supprimés ».
        return false;
    }
}
/**
 * Distingue un fichier réellement absent (ENOENT) d'un fichier inaccessible
 * pour cause d'erreur d'E/S (EIO, ENODEV, ETIMEDOUT...). `existsSync` masque
 * cette distinction et transforme une panne de disque en suppression massive.
 */
function getPathState(filePath) {
    try {
        const stat = fs.statSync(filePath);
        return stat.isFile() || stat.isDirectory() ? 'exists' : 'inaccessible';
    }
    catch (err) {
        if (err?.code === 'ENOENT')
            return 'missing';
        return 'inaccessible';
    }
}
export function isDiskAccessibleForPath(filePath, configuredRoots) {
    if (!filePath)
        return false;
    const roots = configuredRoots && configuredRoots.length > 0 ? configuredRoots : parseMediaChaosRoots();
    const normFile = path.normalize(filePath).replace(/\\/g, '/');
    // 1. Les volumes amovibles doivent être vérifiés au niveau de leur point de montage
    //    réel (/run/media/<user>/<disque>). Sinon, une racine configurée plus haute
    //    (/run/media/tele) existe toujours même quand le disque est débranché, et le
    //    réconciliateur supprime à tort toute la bibliothèque du disque absent.
    if (normFile.startsWith('/run/media/')) {
        const parts = normFile.split('/');
        if (parts.length >= 5) {
            const mountPoint = parts.slice(0, 5).join('/');
            return fs.existsSync(mountPoint) && isDirectoryReadable(mountPoint);
        }
    }
    // 2. Vérification par rapport aux racines déclarées
    for (const root of roots) {
        const normRoot = path.normalize(root).replace(/\\/g, '/');
        if (normFile.startsWith(normRoot)) {
            // La racine doit être lisible, pas seulement exister : un disque en EIO
            // rendrait tous ses fichiers « absents » et déclencherait leur purge.
            return fs.existsSync(normRoot) && isDirectoryReadable(normRoot);
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
        if (node.nodeType === 'SHOW' || node.nodeType === 'COLLECTION' || node.nodeType === 'SEASON') {
            continue;
        }
        const hasVideo = !!node.videoFilePath;
        const hasNfo = !!node.nfoFilePath;
        const videoState = hasVideo ? getPathState(node.videoFilePath) : 'missing';
        const nfoState = hasNfo ? getPathState(node.nfoFilePath) : 'missing';
        if (hasVideo && videoState === 'exists') {
            validNodes.push(node);
        }
        else if (videoState === 'inaccessible' || nfoState === 'inaccessible') {
            // Erreur d'E/S : on gèle la purge pour ce nœud, le volume est en panne.
            continue;
        }
        else {
            // Pour MOVIE, EPISODE, EXTRA, l'absence de fichier vidéo physique valide en fait un média orphelin/fantôme
            const fileToCheck = node.videoFilePath || node.nfoFilePath;
            if (fileToCheck && isDiskAccessibleForPath(fileToCheck, effectiveRoots)) {
                missingNodes.push(node);
            }
            else if (!hasVideo) {
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
        // C. Match par nom de fichier NFO ou par titre identique (cas des NFO orphelins sans vidéo)
        if (!matchedValidNode && missing.nfoFilePath) {
            const nfoBase = path.basename(missing.nfoFilePath, '.nfo').toLowerCase();
            const candidates = validByBasename.get(nfoBase) || [];
            if (candidates.length > 0) {
                matchedValidNode = candidates[0];
            }
        }
        if (!matchedValidNode && missing.title) {
            const cleanMissing = missing.title.trim().toLowerCase();
            matchedValidNode = validNodes.find((v) => v.title.trim().toLowerCase() === cleanMissing && v.nodeType === missing.nodeType);
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
    // Garde-fou : on ne supprime que les coquilles totalement vides. Une saga
    // enrichie (synopsis/affiche/fanart) est conservée même sans enfant : la
    // supprimer provoquerait un `ON DELETE SET NULL` sur ses films, qui
    // perdraient définitivement leur rattachement et disparaîtraient de l'accueil.
    const sagas = await db.query.mediaNodes.findMany({
        where: (t, { eq: eqOp }) => eqOp(t.nodeType, 'COLLECTION'),
        columns: { id: true, title: true, overview: true, posterPath: true, fanartPath: true },
    });
    for (const saga of sagas) {
        const childMedia = await db.query.mediaNodes.findFirst({
            where: (t, { eq: eqOp }) => eqOp(t.parentId, saga.id),
            columns: { id: true },
        });
        const hasMetadata = Boolean((saga.overview && saga.overview.trim()) || saga.posterPath || saga.fanartPath);
        if (!childMedia && !hasMetadata) {
            await db.delete(mediaNodes).where(eq(mediaNodes.id, saga.id));
            report.sagasCleaned++;
            console.log(`🍿 [Reconciler] Coquille de saga vide supprimée : "${saga.title}" (0 média rattaché)`);
        }
    }
    console.log(`✅ [Reconciler] Réconciliation terminée avec succès :`, report);
    return report;
}
