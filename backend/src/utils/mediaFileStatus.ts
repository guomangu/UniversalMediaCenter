import fsp from 'node:fs/promises';
import path from 'node:path';

export type MediaFileStatusCode = 'OK' | 'FILE_INACCESSIBLE' | 'STORAGE_OFFLINE';

export interface MediaFileStatus {
  ok: boolean;
  code: MediaFileStatusCode;
  diskName?: string;
  reason?: string;
}

// Erreurs typiques d'un volume débranché, en veille, monté en lecture seule
// défaillante ou en cours de défaillance matérielle. `ENOENT` est traité à part :
// il peut signifier « fichier supprimé » sur un disque sain.
const STORAGE_ERROR_CODES = new Set([
  'EIO',
  'ENODEV',
  'ENXIO',
  'ETIMEDOUT',
  'ESTALE',
  'EACCES',
  'EPERM',
]);

/**
 * Détermine le point de montage réel d'un média amovible.
 * Ex: /run/media/tele/gudbug/PARTAGED/... -> /run/media/tele/gudbug
 */
export function getStorageMountPoint(filePath: string): string | null {
  const normalized = path.normalize(filePath).replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);

  if (normalized.startsWith('/run/media/') && parts.length >= 4) {
    return `/${parts.slice(0, 4).join('/')}`;
  }
  if ((normalized.startsWith('/media/') || normalized.startsWith('/mnt/')) && parts.length >= 2) {
    return `/${parts.slice(0, 2).join('/')}`;
  }
  return null;
}

async function isDirectoryReadable(dirPath: string): Promise<boolean> {
  try {
    const handle = await fsp.opendir(dirPath);
    await handle.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Vérifie qu'un fichier média est réellement lisible et distingue un fichier
 * absent d'un support de stockage déconnecté ou en erreur d'E/S.
 *
 * Cette distinction est essentielle : elle évite de présenter une panne de disque
 * comme une erreur générique de transcodage, et elle permet au client d'afficher
 * un message actionnable (« rebranchez le disque gudbug »).
 */
export async function checkMediaFile(filePath?: string | null): Promise<MediaFileStatus> {
  if (!filePath) {
    return {
      ok: false,
      code: 'FILE_INACCESSIBLE',
      reason: 'Aucun fichier vidéo associé à ce média.',
    };
  }

  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) {
      return {
        ok: false,
        code: 'FILE_INACCESSIBLE',
        reason: 'Le chemin associé à ce média ne pointe pas vers un fichier vidéo.',
      };
    }
    return { ok: true, code: 'OK' };
  } catch (err: any) {
    const mountPoint = getStorageMountPoint(filePath);
    const diskName = mountPoint ? path.basename(mountPoint) : undefined;
    const errno = String(err?.code || '');

    if (errno === 'ENOENT') {
      // Sur un disque amovible, `ENOENT` peut masquer un montage devenu illisible.
      if (mountPoint && !(await isDirectoryReadable(mountPoint))) {
        return {
          ok: false,
          code: 'STORAGE_OFFLINE',
          diskName,
          reason: `Le support de stockage${diskName ? ` « ${diskName} »` : ''} n'est plus accessible.`,
        };
      }
      return {
        ok: false,
        code: 'FILE_INACCESSIBLE',
        reason: 'Le fichier vidéo est absent du disque de stockage.',
      };
    }

    if (STORAGE_ERROR_CODES.has(errno)) {
      return {
        ok: false,
        code: 'STORAGE_OFFLINE',
        diskName,
        reason: `Le support de stockage${diskName ? ` « ${diskName} »` : ''} est déconnecté ou en erreur d'E/S (${errno}).`,
      };
    }

    return {
      ok: false,
      code: 'FILE_INACCESSIBLE',
      reason: `Le fichier vidéo est illisible (${errno || 'erreur inconnue'}).`,
    };
  }
}
