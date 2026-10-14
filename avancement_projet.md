  - Bouton `⏹ Stop` ajouté juste à côté du bouton d'envoi (`➤`), focusable à la télécommande (`focusable={true}`), permettant de désactiver immédiatement la saisie et de reprendre la navigation sur les messages ou l'en-tête.
- [x] **Téléversement Réel de Fichiers & Pièces Jointes dans les Forums :**
  - Endpoint backend modulaire `POST /api/forum/upload` et `GET /api/forum/attachments/:filename` dans [`forumUpload.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/forumUpload.ts).
  - Remplacement complet des liens factices par un sélecteur natif de l'OS hôte (`<input type="file">` invisible déclenché au clic / télécommande).
  - Prise en charge des Photos / Images réelles, Vidéos, Audios, Documents PDF et GIFs avec téléversement en arrière-plan, barre de progression et aperçu avant envoi.
  - Affichage direct et responsive dans [`ForumMessageBubble.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/ForumMessageBubble.tsx).

---

### 🍿 Enchaînement Automatique Style Netflix (Binge-Watching : Épisodes, Saisons & Sagas)
- [x] **Moteur d'Ordonnancement Intelligent Backend ([`mediaNext.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/mediaNext.ts)) :**
  - **Épisode Suivant dans la Même Saison / Série Directe :** Calcul automatique du rang naturel et de l'étiquette saison/épisode via `parseSeasonEpisode` (ex: `Bleach - S01E99` -> `Bleach - S02E01`).
  - **Passage Automatique de Saison :** Détection de fin de saison et bascule fluide vers l'épisode 1 de la saison suivante (`S02E01`, `S03E01`, etc.) via `findFirstPlayableChild`.
  - **Continuité Inter-Séries dans une Franchise/Saga :** Transition automatique à la fin d'une série vers la série suivante dans le conteneur collection parent.
  - **Continuité Chronologique des Sagas de Films :** Résolution du bug `orderIndex = 0` dans les collections (`The Matrix`, `Resident Evil`) grâce à un score composite (Année de sortie `releaseYear` > Numéro de volet/chiffres romains > Tri alphabétique naturel). Résultat testé et validé : Resident Evil 1 (2002) ➔ Apocalypse (2004) ➔ Extinction (2007) ➔ Afterlife (2010) ➔ Retribution (2012) et Matrix 1 (1999) ➔ Reloaded (2003) ➔ Revolutions (2003).
- [x] **Expérience Utilisateur Lecteur Vidéo Type Netflix ([`[id].tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/player/[id].tsx) & [`VideoPlayerView.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/VideoPlayerView.tsx)) :**
  - Déclenchement de l'overlay de compte à rebours 8s dès qu'il reste 10 secondes de lecture (`onNearEnd`).
  - Libellé contextuel dynamique (`Film suivant dans 8s...` ou `Épisode suivant dans 8s...`) et badge informatif (`S02 • EP 01`, `Suite (2004)`).
  - Boutons interactifs et focusables télécommande : `▶ Regarder maintenant` pour basculer instantanément, ou `✕ Annuler` pour interrompre l'enchaînement et rester sur le générique.
  - Transition fluide et immédiate à la fin de la vidéo (`onEnded`) sans intervention manuelle.

---

### 🏷️ Types de Profils (Packs) Paramétrables, Fusion Bouton Unique & Inviolabilité Administrateur (`/admin`, `AdminProfileTypesTab.tsx`, `AdminUserRow.tsx`)
- [x] **Fusion Complète du Bouton Membre/Admin et Pack en un Bouton Unique ([`AdminUserRow.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/AdminUserRow.tsx)) :**
  - Remplacement des deux boutons séparés ("Admin / Membre" et "Pack: [Nom]") par **un bouton d'action unique unifié**.
  - Cycle instantané des types de profils au clic : affiche dynamiquement `👑 Administrateur` (badge doré), `👤 Membre Standard` (badge bleu), `👶 Enfant` (badge émeraude), `🛡️ Safezone` (badge cyan), `🦸 Marvel` (badge rouge).
  - L'assignation du pack Administrateur active obligatoirement le rôle administrateur (`isAdmin: true`), l'illimité sur les téléchargements et la TV, sans aucune restriction possible.
- [x] **Inviolabilité Stricte du Type de Compte Administrateur (Tout Autorisé Obligatoirement) :**
  - **Backend (`profileTypesRoutes.ts`, `userAdminRoutes.ts`, `access.ts`) :**
    - Interdiction absolue de retirer le statut admin au type `ADMINISTRATEUR` (rejet HTTP 400).
    - Tout est obligatoirement et intégralement débloqué : `canDownload: true`, `canTranscode: true`, `canWatchIptv: true`, `maxCsaAgeLimit: null`, `blockedTags: []`, `blockedFolders: []`.
    - Aucune règle ABAC ni limite parentale ne peut brider un administrateur.
    - Protection de non-suppression du profil `ADMINISTRATEUR` de base.
  - **Frontend (`AdminProfileTypesTab.tsx`) :**
    - Interrupteurs verrouillés sur On et désactivés lors de l'édition du pack `ADMINISTRATEUR`.
    - Champ limite d'âge CSA grisé ("Illimité / Tout autorisé").
    - Remplacement du gestionnaire de tags par un avertisseur d'inviolabilité totale.
    - Badges de statut `📥 DL: Illimité` et `📺 TV: Illimité` verrouillés dans la liste des comptes.

---

### 📺 Résilience des Chaînes TV Live, Proxy HLS & Gestion des Erreurs Diffuseur (403 / 502)
- [x] **Live Proxy HLS Backend & Isolation des Erreurs Diffuseur (`liveProxyService.ts`, `mediaStream.ts`, `iptv.ts`) :**
  - Service proxy HLS dédié dans [`liveProxyService.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/iptv/liveProxyService.ts) avec User-Agent compatible VLC et timeout défensif.
  - Élimination des redirections 302 aveugles vers des IPs externes non sécurisées ou obsolètes (comme `145.239.5.177`).
  - Réécriture dynamique des manifestes `.m3u8` pour convertir les segments relatifs en URLs absolues et injection des en-têtes CORS universels (`*`).
  - Interception des erreurs de serveurs sources (ex: 403 `deny_backend` de Flussonic) avec réponse HTTP 502 contrôlée, empêchant la fuite de requêtes HTTP non chiffrées dans la console du navigateur.
- [x] **Élimination de l'erreur `ERR_CONNECTION_RESET` sur les Logos Oqee/Freebox (`TvChannelCard.tsx`) :**
  - Détection préventive du CDN privé `img1.dc2.oqee.net` qui rejette les connexions des clients web tiers.
  - Bascule instantanée vers un badge logo vectoriel propre avec initiales de la chaîne sans lever d'erreur réseau console.
  - Gestionnaire d'erreur `onError={() => setImgError(true)}` garantissant l'absence de logo brisé sur l'ensemble des chaînes.
- [x] **Gestion Élégante des Flux 403/502 et Diffuseurs Hors Ligne (`VideoPlayerView.tsx`) :**
  - Dissociation propre entre HLS.js et la balise native `<video>` (`isHlsMode ? undefined : streamUrl`) éliminant les doubles requêtes et erreurs DOM parasites.
  - Interception des erreurs réseau fatales HLS (`Hls.Events.ERROR` avec code HTTP 403, 404, 502, 504).
  - Remplacement de l'écran noir muet par un overlay informatif invitant l'utilisateur à choisir une autre chaîne via un bouton interactif (`← Choisir une autre chaîne`).

---

### 📡 Écosystème Cast, Contrôle Télécommande & Résilience Réseau (`castService.ts`, `CastControlBar.tsx`, `useCastReceiver.ts`)
- [x] **Restauration et Typage Strict du Service Cast :**
  - Fonctions exportées et typées : `fetchCastDevices`, `fetchDeviceStatus`, `sendCastCommand`, `registerAsReceiver`, `sendCastHeartbeat`, `pollDeviceCommands`, `getLocalDeviceId`, `getLocalDeviceName`, `setLocalDeviceName`, `triggerNativeCast`.
  - Prise en charge native de Google Cast SDK, HTML5 Remote Playback API et W3C Presentation API.
  - Sécurisation des valeurs temporelles `positionSeconds` et `durationSeconds` (fallback par défaut `0`) dans [`CastControlBar.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/CastControlBar.tsx).
- [x] **Optimisation du Polling et Résilience CORS / 521 :**
  - Espacement de la cadence de polling à 4000ms dans `useCastReceiver.ts`.
  - Encapsulation des requêtes de synchronisation dans des blocs défensifs (`.catch(() => null)`).
  - En-têtes CORS explicites `Access-Control-Allow-Origin: *` sur toutes les routes `/api/cast/*`.

---

### ♿ Accessibilité WAI-ARIA & Robustesse de Rendu Web (`useTvNavigation.ts`, `mauvaise_pratique.md`)
- [x] **Résolution du Conflit `Blocked aria-hidden on focused element` :**
  - Analyse et formalisation dans [`mauvaise_pratique.md`](file:///var/home/tele/Documents/theuniversalmediastack/mauvaise_pratique.md) de la rétention de focus lors de la mise en sommeil d'écrans par React Navigation / Expo Router.
  - Défocalisation explicite et transfert de focus vers le lecteur vidéo actif lors des transitions.
