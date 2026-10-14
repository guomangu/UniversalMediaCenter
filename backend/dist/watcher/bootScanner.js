import fs from 'node:fs/promises';
import path from 'node:path';
import { processNfoFile } from './index.js';
export async function findNfoFilesRecursive(dirPath) {
    const results = [];
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                const sub = await findNfoFilesRecursive(fullPath);
                results.push(...sub);
            }
            else if (entry.isFile() && entry.name.toLowerCase().endsWith('.nfo')) {
                results.push(fullPath);
            }
        }
    }
    catch (err) {
        console.warn(`Could not read directory ${dirPath}:`, err);
    }
    return results;
}
export async function runBootMediaScan(roots) {
    console.log(`🚀 Starting in-place recursive boot scan on ${roots.length} root(s)...`);
    let count = 0;
    for (const root of roots) {
        const nfoPaths = await findNfoFilesRecursive(root);
        console.log(`📂 Found ${nfoPaths.length} .nfo file(s) in: ${root}`);
        for (const p of nfoPaths) {
            await processNfoFile(p);
            count++;
        }
    }
    console.log(`✅ Boot media scan complete: ${count} media file(s) processed in-place.`);
}
