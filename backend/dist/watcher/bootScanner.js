import fs from 'node:fs/promises';
import path from 'node:path';
import { processNfoFile } from './index.js';
import { ingestStandaloneVideoFile } from './mediaIngester.js';
import { repairAllMediaHierarchy } from './hierarchyRepair.js';
import { enrichLibraryMetadata } from './metadataEnricher.js';
const VIDEO_EXTENSIONS = new Set([
    '.mkv', '.mp4', '.avi', '.mov', '.m4v', '.webm', '.ts', '.wmv', '.flv',
]);
const EXCLUDED_FOLDERS = new Set([
    '@eadir', '#recycle', '.git', 'lost+found', 'node_modules', '.cache',
]);
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
/**
 * Crawler récursif in-place découvrant :
 * 1. Tous les fichiers .nfo
 * 2. Toutes les vidéos isolées (standalone) sans .nfo associé
 */
export async function findMediaFilesRecursive(dir) {
    const nfoPaths = [];
    const standaloneVideoPaths = [];
    async function crawl(currentDir) {
        let entries;
        try {
            entries = await fs.readdir(currentDir, { withFileTypes: true });
        }
        catch (err) {
            console.warn(`Could not read directory ${currentDir}:`, err);
            return;
        }
        const fileNames = new Set(entries.filter((e) => e.isFile()).map((e) => e.name));
        for (const entry of entries) {
            if (entry.name.startsWith('.') && entry.name !== '.nfo')
                continue;
            if (EXCLUDED_FOLDERS.has(entry.name.toLowerCase()))
                continue;
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await crawl(fullPath);
            }
            else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (ext === '.nfo') {
                    nfoPaths.push(fullPath);
                }
                else if (VIDEO_EXTENSIONS.has(ext)) {
                    // Ignorer les dossiers ou fichiers de trickplay
                    if (fullPath.includes('/.trickplay/'))
                        continue;
                    // Vérifier si un .nfo avec le même nom de base existe
                    const baseName = path.basename(entry.name, ext);
                    const hasMatchingNfo = fileNames.has(`${baseName}.nfo`) || fileNames.has(`${baseName}.NFO`);
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
 * Lance le pipeline unifié complet des bibliothèques (Pass 1 NFO & Standalone + Pass 2 Enrichissement TMDb/Wiki + Pass 3 Hiérarchie & Sagas + Pass 4 EAV)
 */
export const runBootMediaScan = triggerMediaScan;
export async function triggerMediaScan(roots) {
    if (activeScanStatus.isScanning) {
        console.warn('⚠️ A media scan is already in progress. Ignoring trigger request.');
        return;
    }
    activeScanStatus.isScanning = true;
    activeScanStatus.phase = 'DISCOVERY_NFO';
    activeScanStatus.phaseName = 'Passe 1/4 : Découverte & Indexation In-Place';
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
