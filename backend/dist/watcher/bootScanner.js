import fs from 'node:fs/promises';
import path from 'node:path';
import { processNfoFile } from './index.js';
import { ingestStandaloneVideoFile } from './mediaIngester.js';
import { repairAllMediaHierarchy } from './hierarchyRepair.js';
import { enrichLibraryMetadata } from './metadataEnricher.js';
import { reconcileAndPruneLibrary } from './mediaReconciler.js';
import { isVideoExtension, isIgnoredDirectoryName, isIgnoredMediaFileName, } from './mediaExtensions.js';
const activeScanStatus = {
    isScanning: false,
    phase: 'IDLE',
    phaseName: 'En attente',
    totalDiscovered: 0,
    processedCount: 0,
    nfoCount: 0,
    standaloneCount: 0,
    enrichedCount: 0,
};
export function getScanStatus() {
    return { ...activeScanStatus };
}
async function inspectDirent(fullPath, entry) {
    if (entry.isDirectory())
        return { isDirectory: true, isFile: false };
    if (entry.isFile())
        return { isDirectory: false, isFile: true };
    if (entry.isSymbolicLink()) {
        try {
            const st = await fs.stat(fullPath);
            return { isDirectory: st.isDirectory(), isFile: st.isFile() };
        }
        catch {
            return { isDirectory: false, isFile: false };
        }
    }
    return { isDirectory: false, isFile: false };
}
/** Sélectionne le fichier vidéo principal d'une structure DVD/Blu-ray sans indexer les fragments. */
async function findMainDiscVideo(discDir, exts) {
    let best = null;
    async function scan(currentDir, depth) {
        if (depth > 3)
            return;
        let entries;
        try {
            entries = await fs.readdir(currentDir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            const info = await inspectDirent(fullPath, entry);
            if (info.isDirectory) {
                await scan(fullPath, depth + 1);
            }
            else if (info.isFile) {
                const ext = path.extname(entry.name).toLowerCase();
                if (!exts.has(ext))
                    continue;
                const stat = await fs.stat(fullPath).catch(() => null);
                if (!stat || stat.size < 50 * 1024 * 1024)
                    continue;
                if (!best || stat.size > best.size)
                    best = { filePath: fullPath, size: stat.size };
            }
        }
    }
    await scan(discDir, 0);
    return best?.filePath || null;
}
export async function findMediaFilesRecursive(dir) {
    const nfoPaths = [];
    const standaloneVideoPaths = [];
    const visitedDirs = new Set();
    async function crawl(currentDir) {
        let realDir = currentDir;
        try {
            realDir = await fs.realpath(currentDir);
        }
        catch { }
        if (visitedDirs.has(realDir))
            return;
        visitedDirs.add(realDir);
        let entries;
        try {
            entries = await fs.readdir(currentDir, { withFileTypes: true });
        }
        catch (err) {
            console.warn(`Could not read directory ${currentDir}:`, err);
            return;
        }
        const fileNames = new Set(entries.map((e) => e.name.toLowerCase()));
        for (const entry of entries) {
            if (entry.name.startsWith('.'))
                continue;
            if (isIgnoredMediaFileName(entry.name))
                continue;
            const fullPath = path.join(currentDir, entry.name);
            const info = await inspectDirent(fullPath, entry);
            if (info.isDirectory) {
                if (isIgnoredDirectoryName(entry.name))
                    continue;
                const lowerName = entry.name.toLowerCase();
                // Un disque DVD/Blu-ray contient des dizaines de fragments (VOB/M2TS) :
                // on n'indexe que le film principal, jamais chaque fragment comme un film distinct.
                if (lowerName === 'bdmv') {
                    const main = await findMainDiscVideo(fullPath, new Set(['.m2ts', '.mts']));
                    if (main)
                        standaloneVideoPaths.push(main);
                    continue;
                }
                if (lowerName === 'video_ts') {
                    const main = await findMainDiscVideo(fullPath, new Set(['.vob']));
                    if (main)
                        standaloneVideoPaths.push(main);
                    continue;
                }
                await crawl(fullPath);
            }
            else if (info.isFile) {
                const ext = path.extname(entry.name).toLowerCase();
                if (ext === '.nfo') {
                    nfoPaths.push(fullPath);
                }
                else if (isVideoExtension(ext)) {
                    // Ignorer les dossiers ou fichiers de trickplay
                    if (fullPath.includes('/.trickplay/'))
                        continue;
                    // Vérifier si un .nfo avec le même nom de base existe (insensible à la casse)
                    const baseName = path.basename(entry.name, ext).toLowerCase();
                    const hasMatchingNfo = fileNames.has(`${baseName}.nfo`);
                    if (!hasMatchingNfo) {
                        standaloneVideoPaths.push(fullPath);
                    }
                }
            }
        }
    }
    await crawl(dir);
    return { nfoPaths, standaloneVideoPaths };
}
/**
 * Lance le pipeline unifié complet des bibliothèques (Pass 0 Purge/Réconciliation + Pass 1 NFO & Standalone + Pass 2 Enrichissement TMDb/Wiki + Pass 3 Hiérarchie & Sagas + Pass 4 EAV)
 */
export const runBootMediaScan = triggerMediaScan;
export async function triggerMediaScan(roots) {
    if (activeScanStatus.isScanning) {
        console.warn('⚠️ A media scan is already in progress. Ignoring trigger request.');
        return;
    }
    activeScanStatus.isScanning = true;
    activeScanStatus.phase = 'RECONCILIATION_PRUNE';
    activeScanStatus.phaseName = 'Passe 0/4 : Réconciliation des Déplacements & Purge des Faux Fichiers';
    activeScanStatus.totalDiscovered = 0;
    activeScanStatus.processedCount = 0;
    activeScanStatus.nfoCount = 0;
    activeScanStatus.standaloneCount = 0;
    activeScanStatus.enrichedCount = 0;
    activeScanStatus.startedAt = new Date().toISOString();
    activeScanStatus.finishedAt = undefined;
    activeScanStatus.error = undefined;
    activeScanStatus.report = undefined;
    try {
        // 0ère passe : Réconciliation des déplacements et purge des faux fichiers
        console.log('🧹 [Pipeline] Running initial reconciliation & ghost files pruning...');
        activeScanStatus.currentFile = 'Vérification de l\'intégrité disque et détection des déplacements...';
        const prePruneReport = await reconcileAndPruneLibrary(roots);
        console.log('🧹 [Pipeline] Pre-scan prune report:', prePruneReport);
        activeScanStatus.phase = 'DISCOVERY_NFO';
        activeScanStatus.phaseName = 'Passe 1/4 : Découverte & Indexation In-Place';
        const allNfos = [];
        const allStandalones = [];
        for (const root of roots) {
            const { nfoPaths, standaloneVideoPaths } = await findMediaFilesRecursive(root);
            allNfos.push(...nfoPaths);
            allStandalones.push(...standaloneVideoPaths);
        }
        activeScanStatus.totalDiscovered = allNfos.length + allStandalones.length;
        console.log(`📁 [Pipeline] Found ${allNfos.length} .nfo and ${allStandalones.length} standalone video(s) across all roots.`);
        // 1ère passe : Fichiers avec NFO
        for (const p of allNfos) {
            activeScanStatus.currentFile = path.basename(p);
            await processNfoFile(p);
            activeScanStatus.nfoCount++;
            activeScanStatus.processedCount++;
        }
        // 2ème passe : Vidéos sans NFO via le pipeline Waterfall Kyoo++
        for (const vp of allStandalones) {
            try {
                activeScanStatus.currentFile = path.basename(vp);
                await ingestStandaloneVideoFile(vp);
                activeScanStatus.standaloneCount++;
                activeScanStatus.processedCount++;
            }
            catch (err) {
                console.warn(`Failed standalone ingestion of ${vp}:`, err);
            }
        }
        // 3ème passe : Moissonnage & Enrichissement Distant Continu (TMDb / TVmaze / Wikipedia)
        activeScanStatus.phase = 'METADATA_ENRICH';
        activeScanStatus.phaseName = 'Passe 2/4 : Moissonnage & Enrichissement Distant';
        activeScanStatus.currentFile = 'Recherche TMDb / TVmaze / Wiki...';
        console.log('🧠 [Pipeline] Running distant metadata enrichment & collection capture...');
        const enrichResult = await enrichLibraryMetadata(150);
        activeScanStatus.enrichedCount = enrichResult.enrichedCount;
        console.log(`✨ [Pipeline] Enrichment complete: ${enrichResult.enrichedCount}/${enrichResult.processedCount} médias enrichis.`);
        // 4ème passe : Réconciliation déterministe de toute la hiérarchie et des sagas
        activeScanStatus.phase = 'HIERARCHY_REPAIR';
        activeScanStatus.phaseName = 'Passe 3/4 : Réconciliation Hiérarchique & Sagas';
        activeScanStatus.currentFile = 'Réconciliation Séries, Épisodes, Sagas & Univers...';
        console.log('🔄 [Pipeline] Running deterministic hierarchy & collection reconciliation...');
        const repairReport = await repairAllMediaHierarchy();
        activeScanStatus.report = repairReport;
        console.log(`✨ [Pipeline] Hierarchy reconciliation finished:`, repairReport);
        // Passe finale : Nettoyage final des résidus orphelins
        await reconcileAndPruneLibrary(roots);
        activeScanStatus.phase = 'DONE';
        activeScanStatus.phaseName = 'Synchronisation Universelle Terminée avec Succès';
        activeScanStatus.finishedAt = new Date().toISOString();
        console.log(`✅ [Pipeline] Universal Pipeline complete: ${activeScanStatus.processedCount} media(s) processed.`);
    }
    catch (err) {
        activeScanStatus.phase = 'ERROR';
        activeScanStatus.phaseName = 'Erreur lors du pipeline';
        activeScanStatus.error = err.message || 'Unknown scan error';
        console.error('❌ Universal Pipeline failed with error:', err);
    }
    finally {
        activeScanStatus.isScanning = false;
        activeScanStatus.currentFile = undefined;
    }
}
