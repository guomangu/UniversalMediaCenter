/**
 * Source de vérité unique pour la reconnaissance des fichiers médias.
 * Évite qu'un fichier soit ignoré par le scanner mais accepté par le watcher
 * (ou inversement), ce qui créait des bibliothèques incomplètes.
 */
export const VIDEO_EXTENSIONS = new Set([
  '.mkv', '.mp4', '.avi', '.mov', '.m4v', '.webm', '.ts', '.wmv', '.flv',
  '.m2ts', '.mts', '.mpg', '.mpeg', '.vob', '.ogv', '.ogm', '.3gp', '.3g2',
  '.divx', '.rmvb', '.rm', '.asf', '.f4v', '.m2v',
]);

/** Dossiers techniques à ne jamais parcourir. */
export const IGNORED_DIR_NAMES = new Set([
  '@eadir', '@recycle', '#recycle', '.git', '.svn', 'lost+found', 'node_modules',
  '.cache', '$recycle.bin', 'system volume information', '.trashes', '.spotlight-v100',
  '.fseventsd', '.trickplay', '.db', 'thumbnails',
]);

/** Fichiers techniques ou incomplets qui ne doivent jamais être indexés. */
const IGNORED_FILE_RE =
  /(^\._)|(^\.ds_store$)|(^thumbs\.db$)|(^desktop\.ini$)|(^\.directory$)|\.(part|partial|tmp|temp|crdownload|aria2|!qb|!ut|downloading)$/i;

export function isVideoExtension(ext: string): boolean {
  return VIDEO_EXTENSIONS.has(ext.toLowerCase());
}

export function isIgnoredDirectoryName(name: string): boolean {
  return IGNORED_DIR_NAMES.has(name.toLowerCase());
}

export function isIgnoredMediaFileName(name: string): boolean {
  return IGNORED_FILE_RE.test(name);
}
