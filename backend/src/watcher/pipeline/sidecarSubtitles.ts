import fs from 'node:fs/promises';
import path from 'node:path';

export interface SidecarSubtitle {
  filePath: string;
  language: string;
  codec: string;
  forced: boolean;
  sdh: boolean;
}

const SUB_EXTS = new Set(['.srt', '.ass', '.vtt', '.sub']);

/**
 * Détecte les sous-titres externes sidecar dans le même dossier
 */
export async function detectSidecarSubtitles(videoPath: string): Promise<SidecarSubtitle[]> {
  const dir = path.dirname(videoPath);
  const baseName = path.basename(videoPath, path.extname(videoPath)).toLowerCase();
  const results: SidecarSubtitle[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!SUB_EXTS.has(ext)) continue;

      const subBase = path.basename(entry.name, ext).toLowerCase();
      if (subBase.startsWith(baseName)) {
        const remaining = subBase.slice(baseName.length).replace(/^[._-]/, '');
        const parts = remaining.split(/[._-]/);

        let language = 'und';
        let forced = false;
        let sdh = false;

        for (const p of parts) {
          if (p === 'forced') forced = true;
          else if (p === 'sdh') sdh = true;
          else if (p.length === 2 || p.length === 3) language = p;
        }

        results.push({
          filePath: path.join(dir, entry.name),
          language: language.toUpperCase(),
          codec: ext.replace('.', '').toUpperCase(),
          forced,
          sdh,
        });
      }
    }
  } catch {
    // Dossier inaccessible
  }

  return results;
}
