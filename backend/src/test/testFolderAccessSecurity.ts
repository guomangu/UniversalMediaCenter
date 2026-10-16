import assert from 'node:assert';
import {
  normalizePathVariants,
  pathMatchesFolderRule,
  isMediaAllowedForUser,
} from '../auth/mediaAccess.js';
import type { UserSession } from '../middleware/access.js';

console.log('🧪 Testing Folder Access & Security Engine...');

// 1. Normalisation des chemins et gestion multi-plateformes /var/home vs /home
const variantsHome = normalizePathVariants('/home/tele/Vidéos/drive/Films');
assert.ok(variantsHome.includes('/home/tele/vidéos/drive/films'));
assert.ok(variantsHome.includes('/var/home/tele/vidéos/drive/films'));

const variantsVarHome = normalizePathVariants('/var/home/tele/Vidéos/drive/Animes');
assert.ok(variantsVarHome.includes('/var/home/tele/vidéos/drive/animes'));
assert.ok(variantsVarHome.includes('/home/tele/vidéos/drive/animes'));

console.log('  ✅ normalizePathVariants passed');

// 2. Correspondance de dossiers absolus (y compris avec symlinks Fedora/Bazzite)
assert.strictEqual(
  pathMatchesFolderRule(
    '/home/tele/Vidéos/drive/Films/Matrix (1999)/matrix.mkv',
    '/home/tele/Vidéos/drive/Films'
  ),
  true
);

// Fichier avec /var/home alors que la règle spécifie /home
assert.strictEqual(
  pathMatchesFolderRule(
    '/var/home/tele/Vidéos/drive/Films/Matrix (1999)/matrix.mkv',
    '/home/tele/Vidéos/drive/Films'
  ),
  true
);

// Fichier avec /home alors que la règle spécifie /var/home
assert.strictEqual(
  pathMatchesFolderRule(
    '/home/tele/Vidéos/drive/Films/Matrix (1999)/matrix.mkv',
    '/var/home/tele/Vidéos/drive/Films'
  ),
  true
);

// Dossier externe non correspondant
assert.strictEqual(
  pathMatchesFolderRule(
    '/home/tele/Vidéos/drive/libre/Musique/track.mp3',
    '/home/tele/Vidéos/drive/Films'
  ),
  false
);

// Règle partielle ou relative (ex: 'Films/Adultes', 'Horreur')
assert.strictEqual(
  pathMatchesFolderRule(
    '/run/media/tele/gudbug/PARTAGED/Films/Adultes/video.mp4',
    'Films/Adultes'
  ),
  true
);

assert.strictEqual(
  pathMatchesFolderRule(
    '/run/media/tele/gudbug/PARTAGED/Films/Adultes/video.mp4',
    '/Films/Adultes'
  ),
  true
);

assert.strictEqual(
  pathMatchesFolderRule(
    '/home/tele/Vidéos/drive/Films/Horreur/Conjuring.mkv',
    'Horreur'
  ),
  true
);

console.log('  ✅ pathMatchesFolderRule passed');

// 3. Profils et sessions utilisateur
const adminUser: UserSession = {
  id: 'admin-1',
  email: 'admin@ums.local',
  displayName: 'Admin',
  avatarUrl: null,
  isAdmin: true,
  isIncognito: false,
  profileRole: 'ADMINISTRATEUR',
  canDownload: true,
  canTranscode: true,
  canWatchIptv: true,
  maxCsaAgeLimit: null,
  allowedValueIds: [],
  blockedValueIds: [],
  allowedTags: [],
  blockedTags: [],
  allowedFolders: [],
  blockedFolders: [],
};

const restrictedUser: UserSession = {
  id: 'user-1',
  email: 'membre@ums.local',
  displayName: 'Membre Restreint',
  avatarUrl: null,
  isAdmin: false,
  isIncognito: false,
  profileRole: 'MEMBRE',
  canDownload: true,
  canTranscode: true,
  canWatchIptv: true,
  maxCsaAgeLimit: null,
  allowedValueIds: [],
  blockedValueIds: [],
  allowedTags: [],
  blockedTags: [],
  allowedFolders: ['/home/tele/Vidéos/drive/libre'],
  blockedFolders: [
    '/home/tele/Vidéos/drive/Animes',
    '/home/tele/Vidéos/drive/Films',
    '/home/tele/Vidéos/drive/Series',
    '/run/media/tele/gudbug/PARTAGED/SERIES',
  ],
};

const childUser: UserSession = {
  id: 'child-1',
  email: 'child@ums.local',
  displayName: 'Enfant',
  avatarUrl: null,
  isAdmin: false,
  isIncognito: false,
  profileRole: 'ENFANT',
  canDownload: false,
  canTranscode: true,
  canWatchIptv: false,
  maxCsaAgeLimit: 10,
  allowedValueIds: [],
  blockedValueIds: [],
  allowedTags: ['Animation', 'Famille'],
  blockedTags: ['Horreur', '+18', 'Gore'],
  allowedFolders: [],
  blockedFolders: ['/Films/Horreur', '/Films/Adultes', 'Horreur'],
};

// 4. Test d'inviolabilité Administrateur
assert.strictEqual(
  isMediaAllowedForUser(adminUser, {
    videoFilePath: '/home/tele/Vidéos/drive/Films/interdit.mkv',
    searchVectorText: 'Horreur Gore',
  }),
  true
);
console.log('  ✅ Admin unrestricted access passed');

// 5. Test Blacklist (Dossier interdit)
assert.strictEqual(
  isMediaAllowedForUser(restrictedUser, {
    videoFilePath: '/home/tele/Vidéos/drive/Films/Inception.mkv',
  }),
  false
);

// Fichier dans dossier autorisé (whitelist)
assert.strictEqual(
  isMediaAllowedForUser(restrictedUser, {
    videoFilePath: '/home/tele/Vidéos/drive/libre/MonFilmLibre.mp4',
  }),
  true
);

// Fichier hors whitelist
assert.strictEqual(
  isMediaAllowedForUser(restrictedUser, {
    videoFilePath: '/run/media/tele/My Passport/film/autre.mkv',
  }),
  false
);
console.log('  ✅ Whitelist and Blacklist file access passed');

// 6. Test d'héritage pour les séries (SHOW) et sagas (COLLECTION) sans videoFilePath direct
const blockedShowMedia = {
  nodeType: 'SHOW',
  title: 'Narcos',
  videoFilePath: null,
  nfoFilePath: null,
  effectivePhysicalPath: '/run/media/tele/gudbug/PARTAGED/SERIES/Narcos - Saison 3/Narcos.S03E01.avi',
  childPaths: [
    '/run/media/tele/gudbug/PARTAGED/SERIES/Narcos - Saison 3/Narcos.S03E01.avi',
    '/run/media/tele/gudbug/PARTAGED/SERIES/Narcos - Saison 3/Narcos.S03E02.avi',
  ],
};

assert.strictEqual(
  isMediaAllowedForUser(restrictedUser, blockedShowMedia),
  false
);

const allowedShowMedia = {
  nodeType: 'SHOW',
  title: 'Dessin Anime Libre',
  videoFilePath: null,
  nfoFilePath: null,
  effectivePhysicalPath: '/home/tele/Vidéos/drive/libre/Series/Ep01.mp4',
  childPaths: ['/home/tele/Vidéos/drive/libre/Series/Ep01.mp4'],
};

assert.strictEqual(
  isMediaAllowedForUser(restrictedUser, allowedShowMedia),
  true
);
console.log('  ✅ SHOW container child path inheritance passed');

// 7. Test Enfant (Tags + Dossiers + IPTV)
assert.strictEqual(
  isMediaAllowedForUser(childUser, {
    nodeType: 'LIVE_CHANNEL',
    title: 'France 2',
  }),
  false
);

assert.strictEqual(
  isMediaAllowedForUser(childUser, {
    nodeType: 'MOVIE',
    title: 'Film Horreur',
    videoFilePath: '/run/media/tele/My Passport/Films/Horreur/Scary.mkv',
    searchVectorText: 'Horreur Gore',
  }),
  false
);

assert.strictEqual(
  isMediaAllowedForUser(childUser, {
    nodeType: 'MOVIE',
    title: 'Le Roi Lion',
    videoFilePath: '/run/media/tele/My Passport/Films/Jeunesse/RoiLion.mkv',
    searchVectorText: 'Animation Famille Disney',
  }),
  true
);
console.log('  ✅ Child user tags, IPTV and folders passed');

console.log('🎉 All folder restriction & security tests passed with 100% success!');
