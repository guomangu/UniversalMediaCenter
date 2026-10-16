import fs from 'node:fs/promises';
import path from 'node:path';

const VIDEO_EXTENSIONS = new Set([
  '.mkv', '.mp4', '.avi', '.mov', '.m4v', '.webm', '.ts', '.wmv', '.flv',
]);

export interface AdjacentMediaFiles {
  videoFilePath?: string;
  posterPath?: string;
  fanartPath?: string;
  clearlogoPath?: string;
  thumbPath?: string;
}

export async function detectAdjacentFiles(nfoPath: string): Promise<AdjacentMediaFiles> {
  const dir = path.dirname(nfoPath);
  const nfoBase = path.basename(nfoPath, path.extname(nfoPath)).toLowerCase();
  const result: AdjacentMediaFiles = {};

  // Les NFOs de série (tvshow.nfo) et de saison (season.nfo) ne sont JAMAIS des vidéos jouables
  const isShowOrSeasonNfo = nfoBase === 'tvshow' || nfoBase === 'season';

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    // Compter les vidéos du dossier pour savoir si c'est un dossier multi-films à plat
    let videoCount = 0;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (VIDEO_EXTENSIONS.has(ext)) {
        videoCount++;
        const base = path.basename(entry.name, ext).toLowerCase();
        if (!isShowOrSeasonNfo && base === nfoBase) {
          result.videoFilePath = path.join(dir, entry.name);
        }
      }
    }

    // 1. Détection du fichier vidéo principal adjacent (sans déplacement)
    if (!isShowOrSeasonNfo && !result.videoFilePath && videoCount === 1) {
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (VIDEO_EXTENSIONS.has(ext)) {
          result.videoFilePath = path.join(dir, entry.name);
          break;
        }
      }
    }

    // 2. Détection des artworks locaux avec priorité absolue aux fichiers spécifiques au média
    const isSingleMediaFolder = videoCount <= 1 || isShowOrSeasonNfo;

    let specificPoster: string | undefined;
    let genericPoster: string | undefined;
    let specificFanart: string | undefined;
    let genericFanart: string | undefined;
    let specificLogo: string | undefined;
    let genericLogo: string | undefined;
    let specificThumb: string | undefined;
    let genericThumb: string | undefined;

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;

      const base = path.basename(entry.name, ext).toLowerCase();
      const fullPath = path.join(dir, entry.name);

      // Artworks spécifiques au fichier (ex: antigang-poster.jpg, antigang-backdrop.jpg, antigang.jpg)
      if (base === `${nfoBase}-poster` || base === `${nfoBase}.poster` || base === `${nfoBase}-cover`) {
        specificPoster = fullPath;
      } else if (base === `${nfoBase}-fanart` || base === `${nfoBase}-backdrop` || base === `${nfoBase}.fanart`) {
        specificFanart = fullPath;
      } else if (base === `${nfoBase}-logo` || base === `${nfoBase}-clearlogo` || base === `${nfoBase}.clearlogo`) {
        specificLogo = fullPath;
      } else if (base === `${nfoBase}-thumb` || base === `${nfoBase}-landscape` || base === `${nfoBase}.thumb`) {
        specificThumb = fullPath;
      } else if (base === nfoBase) {
        // Ex: antigang.jpg
        if (!specificPoster) specificPoster = fullPath;
      }

      // Artworks génériques de dossier (uniquement si dossier dédié à une oeuvre unique ou série)
      if (isSingleMediaFolder) {
        if (base === 'poster' || base === 'cover') {
          if (!genericPoster) genericPoster = fullPath;
        } else if (base === 'folder') {
          if (!genericPoster) genericPoster = fullPath;
        } else if (base === 'fanart' || base === 'backdrop') {
          if (!genericFanart) genericFanart = fullPath;
        } else if (base === 'clearlogo' || base === 'logo') {
          if (!genericLogo) genericLogo = fullPath;
        } else if (base === 'thumb' || base === 'landscape') {
          if (!genericThumb) genericThumb = fullPath;
        }
      }
    }

    result.posterPath = specificPoster || genericPoster;
    result.fanartPath = specificFanart || genericFanart;
    result.clearlogoPath = specificLogo || genericLogo;
    result.thumbPath = specificThumb || genericThumb;
  } catch (err) {
    console.warn(`Could not inspect adjacent files in ${dir}:`, err);
  }

  return result;
}
