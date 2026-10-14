### 🍿 Moteur de Séances Ciné, Co-Visionnage, Forums Enrichis, Audio & Mode Discret
- [x] **Déduplication Stricte dans l'Accueil par Catégorie de Tags :**
  - Ajout du paramètre `excludeIds` dans l'API backend [`taxonomyRoutes.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/taxonomyRoutes.ts) filtrant directement les identifiants déjà distribués.
  - Coordination dynamique dans [`CategorySection.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/CategorySection.tsx) et [`TagCard.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/TagCard.tsx) garantissant qu'aucun média n'est dupliqué à travers les différents tags d'une même catégorie (ex: Genres, Années, Thèmes).
- [x] **Casting Cliquable & Passerelle Forums ([`media/[id].tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/media/[id].tsx)) :**
  - Cartes d'acteurs transformées en composants interactifs focusables avec badge tag et navigation directe vers l'espace forum et œuvres de l'acteur (`/forum/[topic]?category=actor`).
- [x] **Rail de 10 Médias Uniques au-dessus du Forum ([`ForumTopMediasRail.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/ForumTopMediasRail.tsx)) :**
  - Affichage horizontal de 10 œuvres uniques associées au tag/sujet sans doublons.
  - Actions immédiates : navigation vers la fiche média, bouton de citation pour séance et badge de séance active.
- [x] **Module Forum Enrichi & Salle d'Attente de Visionnage en Groupe ([`MediaForumSection.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/MediaForumSection.tsx)) :**
  - Intégration sur la page [`/media/[id]`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/media/[id].tsx) directement sous la section Casting, et sur les pages [`/forum/[topic]`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/forum/[topic].tsx).
  - Possibilité de citer des éléments enfants de la page (épisodes, saisons) ou des médias suggérés.
  - Système de vote (upvote) avec persistance en base dans la table `forum_message_votes`.
  - Propositions de séances avec modale progressive [`ProposeSessionModal.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/ProposeSessionModal.tsx) et inscription des spectateurs.
  - Système d'évaluation et de notation des utilisateurs et du gérant de séance (étoiles 1 à 5 + commentaires) via [`UserRatingModal.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/UserRatingModal.tsx) et [`ratingRoutes.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/ratingRoutes.ts).
  - Rafraîchissement asynchrone intelligent toutes les 3 secondes dès que l'utilisateur est à proximité (IntersectionObserver).
- [x] **Conversation Vocale Différée & Appel en Direct ([`LiveVoiceRoomBar.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/LiveVoiceRoomBar.tsx)) :**
  - Enregistreur vocal intégré dans [`ForumInputBar.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/ForumInputBar.tsx) pour envoyer des messages vocaux différés.
  - Salon d'appel audio en direct avec suivi des participants connectés, ping de présence et bascule Mode Silence / Entendre la discussion.
- [x] **Badges de Séances Actives & Lecteur Vidéo Collaboratif ([`MediaTile.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/MediaTile.tsx), [`MediaCard.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/MediaCard.tsx), [`player/[id].tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/player/[id].tsx)) :**
  - Badge rouge `🍿 SÉANCE` et bandeau inférieur `🍿 X en séance` sur les affiches des médias.
  - Résolution dynamique du vrai titre du média dans le lecteur au lieu du libellé générique `Média #id`.
  - Contrôle d'appel direct et bascule Mode Silence / Entendre la discussion directement dans la barre supérieure du lecteur dès que 2 spectateurs ou plus regardent le contenu.
- [x] **Mode Discret / Incognito activable depuis son Compte ([`AccountModal.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/AccountModal.tsx), [`UserProfileCard.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/user/UserProfileCard.tsx)) :**
  - Interrupteur un clic permettant de masquer sa présence dans le lecteur sans apparaître dans les compteurs publics ni sur la page /media.

---

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
- [x] **Échappatoire Universelle des Formulaires Textuels (`Escape` / `Retour` / `Gamepad`) :**
  - Interception en phase de capture (`{ capture: true }`) dans [`useTvNavigation.ts`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/hooks/useTvNavigation.ts) des touches `Escape`, `Backspace` (quand le champ est vide ou avec modificateur), des touches retour télécommandes (Samsung 10009, WebOS 461, Android 4) et du bouton B/Cercle sur manette gamepad.
  - Transfert intelligent du focus vers l'élément interactif adjacent le plus proche (`exitInputFocus`), restaurant la navigation spatiale sans souris.
  - Préservation du déplacement de curseur textuel au sein du champ via `ArrowLeft` / `ArrowRight`.

---

### 🎮 Sélection Télécommande des Modales/Popups & Navigation Admin / Mon Espace
- [x] **Élimination Définitive de l'Erreur de Text Node React Native Web :**
  - Détection et suppression des sauts de ligne échappés accidentels `\n` insérés entre balises JSX dans [`AdminProfileTypesTab.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/AdminProfileTypesTab.tsx) et [`AccountModal.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/AccountModal.tsx).
  - Suppression totale de l'erreur `Unexpected text node: \n . A text node cannot be a child of a <View>` qui se produisait en double à l'entrée dans l'interface admin.
- [x] **Confinement de Focus & Navigation Télécommande dans les Popups / Modales :**
  - Confinement de la navigation spatiale (`getActiveModal`) à l'intérieur du conteneur de modale actif (`[data-modal-container="true"]`).
  - Exclusion stricte des fonds d'arrière-plan (`[data-modal-backdrop="true"]`, `focusable={false}`) pour empêcher la télécommande de cibler le backdrop au lieu des boutons d'action.
  - Auto-focus automatique du premier bouton ou champ lors de l'ouverture d'une modale (`ConfirmModal`, `AccountModal`, `AdminCreateUserModal`, `MediaRepostModal`, `ProfileEditModal`, `PlayerAudioModal`, `PlayerSubtitleModal`, `PlayerQualityModal`, `PlayerShareModal`).
  - Touche Retour télécommande / Échap mappée sur la fermeture de modale (`[data-modal-close="true"]`) sans déclencher de navigation d'historique web intempestive.
- [x] **Navigabilité Complète au Clavier / Télécommande sur `/admin` et `/user` :**
  - Attributs `focusable={true}` ajoutés sur tous les onglets du panneau d'administration (`AdminProfileTypesTab`, `AdminUsersTab`, `AdminConfigTab`, `AdminIptvTab`, scan médiathèque) et sur les chips de configuration (codes d'invitation, dossiers exclus).
  - Attributs `focusable={true}` ajoutés sur tous les onglets de l'espace personnel ([`user.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/user.tsx) : `Reprendre`, `Favoris`, `Amis`, `Mes Salons`, `Fil d'avis`), les lignes d'historique, les cartes de salons de discussion ([`UserForumsTab.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/user/UserForumsTab.tsx)), les publications du fil social ([`UserFeedTab.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/user/UserFeedTab.tsx)) et la gestion d'amis ([`UserFriendsTab.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/user/UserFriendsTab.tsx)).
