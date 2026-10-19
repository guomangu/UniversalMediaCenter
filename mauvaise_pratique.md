## 🛑 135. Échec OCR Silencieux des Sous-Titres PGS de *Coco* : `pgsrip` Normalise le Code Langue du Fichier de Sortie (`fra` → `fr`, `eng` → `en`) et le Code Cherchait un Nom Impossible (`mediaSubtitles.ts`)

* **Problème / Symptôme :**
  Les sous-titres PGS de *Coco* (Pixar) ne s'affichaient jamais, tandis que ceux de *James Bond / Spectre* fonctionnaient. L'endpoint répondait `HTTP 200` avec un corps vide `WEBVTT\n\n` après 85-120 secondes.

* **Causes Racines :**
  - **Nom de Sortie `pgsrip` Non Déterministe** : avec un fichier d'entrée `pgs_xxx.fra.sup` et `-l fra`, `pgsrip` produit `pgs_xxx.fr.srt` (code ISO 639-1), pas `pgs_xxx.fra.srt` (code ISO 639-2). Le code testait `fs.existsSync('/tmp/pgs_xxx.fra.srt')`, toujours faux.
  - **Faux Sentiment de Fonctionnement sur James Bond** : le résultat de *Spectre* provenait d'un cache disque L2 déjà rempli, masquant le bug de nommage.
  - **Absence de Garde sur le Contenu** : `srtToVtt('')` produit `WEBVTT\n\n`, qui passait le test `includes('WEBVTT')` et pouvait être mis en cache comme un succès.

* **Bonnes Pratiques de Remédiation :**
  - **Découverte Dynamique du Fichier Produit** : ne jamais présupposer le nom exact d'un artefact généré par un outil externe. Utiliser un préfixe temporaire unique et scanner le répertoire de travail (`fsp.readdir('/tmp')` + `startsWith(tempId)` + `.endsWith('.srt')`).
  - **Validation du Contenu** : exiger un SRT non vide et contenant au moins un séparateur `-->` avant conversion et mise en cache.
  - **Nettoyage par Préfixe** : supprimer tous les fichiers commençant par `tempId` (SUP, SRT, intermédiaires), et pas seulement deux chemins supposés.
  - **Tests sur Plusieurs Médias** : valider l'OCR sur au moins un média dont le cache est vide (neuf), afin de ne pas confondre succès du cache et succès de l'extraction.

## 🛑 134. Sous-Titres Sélectionnés Invisibles (Insertion Dynamique `<track>` Non Fiable, Cache de Réponse Vide, Piste Perdue au Cast), Overlay Vidéo Focusable Générant une Ligne Blanche & Boutons de Lecteur Sous-Dimensionnés (`FloatingBottomPlayer.tsx`, `FloatingBottomPlayer.styles.ts`, `global.css`, `CastModal.tsx`, `castService.ts`, `player/[id].tsx`, `_layout.tsx`, `mediaSubtitles.ts`)

* **Problème / Symptôme :**
  1. La sélection d'une piste de sous-titres dans le lecteur ne produisait aucun texte à l'écran, alors que l'endpoint backend retournait un WebVTT valide.
  2. Les sous-titres sélectionnés n'étaient pas repris lors d'un Cast vers un autre écran (Chromecast ou autre navigateur UMS).
  3. Au clic sur l'image du média en lecture, une ligne blanche entourait le haut et le bas de l'image.
  4. Les boutons du lecteur (mini-lecteur et mode déplié) étaient trop petits et peu confortables au toucher.

* **Causes Racines :**
  - **Insertion/Rechargement Dynamique de `<track>` Non Fiable** : la balise `<track>` était ajoutée ou modifiée après le chargement de la ressource vidéo. Selon les moteurs (notamment Chromium), le chargement de la piste n'était pas garanti et le cache HTTP pouvait resservir une ancienne réponse vide (`WEBVTT\n\n`, `max-age=86400`).
  - **Piste Absente du Payload Cast** : `currentMedia` transmis à `CastModal` ne contenait ni `activeSubtitle` ni `activeAudio` ; les commandes `LOAD`/`LOAD_MEDIA` et les actions « Suivre » ne propageaient donc jamais la sélection.
  - **Écrasement à la Navigation** : `PlayerScreen` réouvrait le média avec `tracks.defaultSubtitle || 'off'` après une commande Cast distante, écrasant la piste reçue.
  - **Focus de l'Overlay Vidéo** : l'overlay tactile transparent portait `role="button"` et devenait focusable au clic, héritant de l'anneau global `outline: 2px solid rgba(148,163,184,0.75)`.
  - **Cibles Tactiles Insuffisantes** : paddings de 5-8px et polices de 11px sur les contrôles principaux.

* **Bonnes Pratiques de Remédiation :**
  - **Injection Directe de Cues Natives** : récupérer le WebVTT via `fetch` (`no-store`) puis alimenter une `TextTrack` créée par `video.addTextTrack('subtitles', ...)` avec des `VTTCue`, en forçant `mode = 'showing'`. Désactiver toutes les autres pistes in-band pour éviter les doublons. Cette méthode fonctionne en fenêtré et en plein écran natif.
  - **Payload Cast Complet** : toujours transmettre `activeSubtitle`/`activeAudio` dans `CastMediaPayload`, les commandes `LOAD`/`LOAD_MEDIA` et les actions « Suivre » ; côté récepteur, honorer `SET_SUBTITLE`/`SET_AUDIO` et ne jamais écraser une piste déjà ouverte par les valeurs par défaut.
  - **URL de Sous-Titres sur la Même Origine que le Flux** : pour Google Cast, construire le `trackContentId` depuis `getApiBaseUrl()` (domaine public HTTPS ou IP LAN) et activer `activeTrackIds`.
  - **Neutralisation du Focus de Surface** : rendre les overlays vidéo non focusables (`focusable={false}`, `tabIndex={-1}`) et supprimer `outline`/`box-shadow`/`border` sur la vidéo, ses conteneurs et leurs enfants directs, sans affecter les anneaux de focus des vrais boutons.
  - **Cibles Tactiles Conformes** : viser au moins 40-46px de hauteur pour les contrôles principaux, tout en réduisant les marges horizontales sur mobile pour éviter tout débordement.

## 🛑 133. Échec de Conversion Directe FFmpeg des Sous-Titres Bitmap Blu-ray (`hdmv_pgs_subtitle` / `dvd_subtitle`), Rejet HTTP 404 du Tag `<track>` & Absence de Pipeline OCR (`mediaSubtitles.ts`, `Dockerfile`)

* **Problème / Symptôme :**
  Lors de la sélection d'une piste de sous-titres intégrée à un rip Blu-ray (*Spectre*, James Bond, films haute définition récents), aucun texte ne s'affichait et le navigateur rejetait la requête avec l'erreur :
  `GET https://api.cool.sweaw.com/api/media/.../subtitles?token=...&trackIndex=4 404 (Not Found)`.

* **Causes Racines :**
  - **Incompatibilité Fondamentale Bitmap vs WebVTT** : Les flux Blu-ray PGS (`hdmv_pgs_subtitle`) et DVD (`dvd_subtitle`) ne sont pas des données textuelles mais des séquences d'images bitmap transparentes (PNG-like).
  - **Rejet d'Encodage FFmpeg Sans OCR** : La commande `ffmpeg -c:s webvtt` échoue nativement sur ces flux avec l'erreur explicite : `Error initializing output stream 0:0 -- Subtitle encoding currently only possible from text to text or bitmap to bitmap`.
  - **Code Retour 404 Destructeur** : Lorsque FFmpeg levait une exception, le backend Hono renvoyait un code HTTP 404. La balise HTML5 `<track>` considérait la ressource comme inexistante et bloquait tout affichage tout en polluant la console du navigateur.

* **Bonnes Pratiques de Remédiation :**
  - **Pipeline Hybride Texte Direct + OCR Dédié** :
    1. Si le flux est textuel (`subrip`, `ass`, `mov_text`, `webvtt`), conversion instantanée via FFmpeg.
    2. Si le flux est graphique bitmap (`hdmv_pgs_subtitle`, `dvd_subtitle`), extraction ultra-rapide du conteneur `.sup` (>150x de vitesse) puis transcription OCR par `pgsrip` et le moteur natif `Tesseract` (`tesseract-ocr`, `tesseract-ocr-fra`, `tesseract-ocr-eng`).
  - **Mise en Cache Persistante L1/L2** : Sauvegarder immédiatement le résultat transcrit dans `/tmp/ums_subtitles_cache/` afin de garantir un temps d'accès de 0 ms dès le second appel.
  - **Neutralisation Inconditionnelle des Codes 404 pour `<track>`** : En cas de défaillance ou d'attente d'une piste, toujours retourner un corps WebVTT minimaliste (`WEBVTT\n\n`) avec le statut HTTP 200 OK. La balise `<track>` reste saine et stable.

## 🛑 132. Ingestion Aveugle de NFOs Orphelins (Doublons Sans Jaquette), Timeout Prématuré des Sous-Titres WebVTT sur Supports Externes, Clic Intempestif sur l'Écran Vidéo & Pollution des Réalisateurs par les Postes d'Assistants (`FloatingBottomPlayer.tsx`, `mediaSubtitles.ts`, `mediaIngester.ts`, `externalMetadata.ts`, `titleCleaner.ts`)

* **Problème / Symptôme :**
  1. Affichage de doublons de médias sur l'interface (ex: *Scary Movie 3* affiché deux fois : un exemplaire valide avec jaquette et vidéo, et un faux exemplaire fantôme sans jaquette et sans vidéo).
  2. Échec d'affichage des sous-titres sélectionnés dans le lecteur : l'écran restait sans texte car l'endpoint backend subissait un timeout de 20s lors de l'extraction FFmpeg sur disque dur USB externe, et rejetait les requêtes HEAD avec un code 404.
  3. En mode déplié, cliquer ou toucher l'écran vidéo pour faire apparaître ou masquer l'overlay de contrôles déclenchait intempestivement la mise en pause ou la lecture, entrant en conflit avec le bouton Play/Pause central.
  4. Manque du bouton plein écran direct dans le mini-lecteur replié en bas de page.
  5. Absence de réalisateur ou association d'assistants réalisateurs/scripteurs (ex: Carlos Fidel, Martin Kitrosser) au lieu de Quentin Tarantino sur les films du dossier `TARANTINO`, ainsi que pollution des titres par des crochets résiduels (`Inglourious Basterds [`, `Django Unchained [`).
  6. Crash React Web `Rendered more hooks than during the previous render` au déclenchement de la lecture dans `FloatingBottomPlayer.tsx`.

* **Causes Racines :**
  - **Ingestion Indiscriminée des Fichiers `.nfo` Orphelins** : Le watcher de fichiers ingérait tout `.nfo` découvert comme un nœud `MOVIE` complet même lorsqu'aucun fichier vidéo associé n'existait dans le répertoire (ex: dossiers d'archives NFO sur disques externes).
  - **Timeout Excessif et Manque de Cache Persistant des Sous-Titres** : L'extraction de sous-titres d'un fichier MKV de plus de 2 heures depuis un disque USB externe via FFmpeg nécessite environ 60 secondes pour parcourir le conteneur. Un timeout de 20s coupait le processus prématurément. De plus, Hono ne répondait pas aux requêtes HEAD, et le résultat n'était conservé qu'en mémoire vive éphémère.
  - **Écouteur Pressable Redondant sur l'Écran Vidéo** : Le composant `FloatingBottomPlayer` superposait un conteneur tactile avec `handleTogglePlay` au centre de la vidéo, provoquant des bascules de lecture involontaires lors des interactions de l'utilisateur.
  - **Filtrage Trop Large des Métadonnées d'Équipe TMDb** : Le filtre `department === 'Directing'` capturait l'ensemble de l'équipe de mise en scène (assistants réalisateurs, script supervisors, second unit directors) et retenait le premier membre rencontré avant le réalisateur principal (`job === 'director'`).
  - **Violation des Règles des Hooks React (Hooks Conditionnels)** : Les hooks `useMemo` (génération de l'URL WebVTT) et `useEffect` (synchronisation des pistes de sous-titres) étaient placés après les retours hâtifs (`if (!currentUser...) return null`, `if (!activeMedia...) return null`). Lorsque `activeMedia` s'activait, React exécutait plus de hooks que lors du rendu initial sans média.

* **Bonnes Pratiques de Remédiation :**
  - **Garde Stricte sur l'Ingestion NFO** : Interdire formellement la création de nœuds de type `MOVIE`, `EPISODE` ou `EXTRA` à partir d'un fichier `.nfo` orphelin sans vidéo adjacente valide sur le disque.
  - **Moteur de Sous-Titres Haute Résilience avec Cache L1/L2** : Étendre le timeout d'extraction FFmpeg à 180s, autoriser les méthodes `GET` et `HEAD`, et persister immédiatement chaque flux WebVTT extrait sur disque (`/tmp/ums_subtitles_cache/`) pour garantir un temps de réponse de 0 ms aux requêtes ultérieures.
  - **Délégation Exclusive des Contrôles de Lecture aux Boutons Dédiés** : Supprimer l'action Play/Pause au toucher de l'écran vidéo en mode déplié et la remplacer par un simple réveil d'activité (`resetMouseActivity`).
  - **Bouton Plein Écran Universel dans le Lecteur Replié** : Proposer le bouton `⛶` directement dans la barre repliée pour un passage instantané en plein écran sans dépliement préalable.
  - **Filtrage Précis du Rôle Réalisateur** : Exiger strictement `job === 'director'` ou `job === 'co-director'` lors de la désérialisation des équipes techniques.
  - **Sanctuarisation de l'Ordre des Hooks React** : Positionner inconditionnellement tous les hooks (`useState`, `useRef`, `useCallback`, `useMemo`, `useEffect`) au sommet du composant fonctionnel, avant tout bloc conditionnel ou retour anticipé.

## 🛑 131. Blocage Systématique de la Lecture Vidéo à 5 Secondes de Lecture (DTS Out-of-Order HLS, PTS Discontinuity, Muxdelay FFMPEG & Découpage Non-Continu) (`mediaStream.ts`, `userPlaybackSync.ts`, `playerStore.ts`, `FloatingBottomPlayer.tsx`)

* **Problème / Symptôme :**
  1. Lors du lancement de tout média nécessitant un flux HLS (fichiers `.mkv`, `.avi`, pistes audio multicanales ou codecs non-natifs), la lecture démarrait correctement puis se figeait systématiquement et définitivement à 5 secondes de lecture (entre 5.0s et 6.0s), sans jamais pouvoir dépasser ce seuil.
  2. La mise en mémoire tampon restait bloquée indéfiniment à la fin du premier segment vidéo.
  3. Le lecteur web affichait un état de chargement sans fin ou s'arrêtait silencieusement sans message d'erreur clair pour l'utilisateur.

* **Conséquences :**
  - Impossibilité totale de visionner des films ou des séries encodés en formats modernes (`.mkv`, audio AC3/DTS, H.264 High 10) sur le navigateur.
  - Frustration extrême de l'utilisateur confronté à un arrêt brutal à 5 secondes sur l'ensemble du catalogue vidéo.

* **Causes Racines :**
  - **Absence de Calibrage des Timestamps MPEG-TS (`-output_ts_offset`)** : Chaque segment HLS VOD découpé à la volée par FFmpeg (`segment_1.ts`, `segment_2.ts`, etc.) voyait ses horodatages de présentation (PTS) réinitialisés à 0s. Lorsque le navigateur (Chrome, Firefox, Safari) terminait le segment 0 (couvrant 0s à 6s) et recevait le segment 1 avec un PTS commençant à 0s (soit un saut arrière de 6 secondes dans le passé), le `SourceBuffer` de l'API MediaSource (MSE) rejetait catégoriquement les données (`DTS out of order`, `bufferStalledError`).
  - **Muxdelay par Défaut de FFmpeg (+1,4s)** : Le multiplexeur MPEG-TS de FFmpeg appliquait par défaut un décalage `muxdelay` de 1,4 seconde sans `-muxpreload 0 -muxdelay 0`, décalant arbitrairement l'alignement des flux audio et vidéo.
  - **Manque de Balise `#EXT-X-DISCONTINUITY` dans le Manifeste `master.m3u8`** : Sans la balise de discontinuité conforme au RFC 8216 entre chaque segment, le démultiplexeur Hls.js supposait une continuité stricte et bloquait immédiatement lors de la transition.
  - **Découpage Imprécis avec Dépassement Artificiel (`-t 6.05`)** : Ajouter un surplus artificiel de 0,05s produisait des paquets audio/vidéo se chevauchant d'un segment à l'autre, générant des collisions de paquets au démultiplexage.
  - **Absence d'Interception des Erreurs Hls.js dans le Lecteur Global (`FloatingBottomPlayer.tsx`)** : Le lecteur persistant n'écoutait pas `Hls.Events.ERROR` et n'exécutait aucun `hls.recoverMediaError()` ni relance sur `bufferStalledError`.
  - **Écrasement d'État lors du Battement Passif à 5s (`userPlaybackSync.ts`)** : À t = 5s, le `playerStore` envoyait sa première notification réseau de progression (`Math.abs(newSec - lastProgressBroadcastPos) >= 5`). Côté serveur, un leader autoritaire actif se voyait réassigner l'ancien `isPlaying` mémorisé dans le groupe au lieu de préserver son état de lecture réel.

* **Bonnes Pratiques de Remédiation :**
  - **Calibrage Strict PTS/DTS (`-output_ts_offset String(startTime)`, `-muxpreload 0`, `-muxdelay 0`)** : Configurer systématiquement FFmpeg pour que chaque segment démarre exactement au temps global du manifeste HLS (`index * segmentDuration`), garantissant une chronologie strictement continue et ascendante.
  - **Recherche Précise en Deux Étapes** : Combiner un pré-seek rapide (`-ss ${Math.max(0, startTime - 5)}` avant `-i`) et un ajustement fin (`-ss ${startTime > 5 ? 5 : startTime}` après `-i`) avec une durée exacte (`-t String(segDur)`), bannissant tout paquet orphelin ou chevauchant.
  - **Balise `#EXT-X-DISCONTINUITY` Systématique** : Précéder chaque segment (`i > 0`) de la balise `#EXT-X-DISCONTINUITY` dans `master.m3u8`, permettant au moteur Hls.js de recalculer son `timestampOffset` sans aucune rupture de lecture.
  - **Préchauffage Anticipé en Arrière-Plan (0 ms Latency)** : Lors de la requête du segment `index`, déclencher en parallèle la génération asynchrone du segment `index + 1`. Le segment suivant est ainsi déjà prêt sur disque avant que le lecteur ne l'atteigne.
  - **Auto-Réparation Active dans `FloatingBottomPlayer.tsx`** : Intercepter `Hls.Events.ERROR` avec récupération automatique (`recoverMediaError`, `startLoad`) et relance immédiate sur `bufferStalledError`.

## 🛑 130. Réinitialisation Sauvage du Scrubber à 0s en Mode Synchronisé, Écrasement par Pseudo-Ordre Décalé & Blocage Mutuel du Flux Vidéo en Mode Multi-Room (`FloatingBottomPlayer.tsx`, `CastModal.tsx`, `accountSyncService.ts`, `userPlaybackSync.ts`, `userDeviceRegistry.ts`, `userDeviceService.ts`)

* **Problème / Symptôme :**
  1. En mode synchronisé (`syncGroupId = 'default'`), impossible de déplacer la progression dans la barre de lecture du player : le curseur/scrubber se remettait systématiquement et violemment à 0 seconde dès qu'il n'y avait aucun autre appareil disponible ou lors de l'écoute du serveur.
  2. Le mode Cast ne reprenait pas la lecture là où le casteur en était, forçant le média à repartir du début (0s) sur l'écran cible.
  3. Les modes 'Cast' et 'Synchroniser' bloquaient la lecture : la vidéo ne se lançait pas (écran figé, HLS détruit ou balise masquée), alors que les contrôles de l'interface semblaient pourtant bien synchronisés (boutons Play/Pause actifs), contrastant avec le mode 'indépendant' qui fonctionnait parfaitement.
  4. Manque flagrant de réactivité lors des commandes de lecture, de progression ou de cast (latence de synchronisation pouvant atteindre 10 secondes).

* **Conséquences :**
  - Impossibilité pour l'utilisateur de reprendre ou d'avancer dans un film en mode synchronisé.
  - Échec complet de la diffusion vers d'autres écrans ou de la lecture multi-room.
  - Perte de la position temporelle en cours lors du transfert vers un téléviseur ou un navigateur distant.

* **Causes Racines :**
  - **Collision d'Identité Onglet vs Appareil (`_tab_xxx`) dans la Souveraineté de Lecture** : `userPlaybackSync.ts` comparait strictement `deviceId === leaderDeviceId`. L'onglet actif émettait `ums_dev_xxx_tab_yyy` alors que le registre stockait `ums_dev_xxx`. Le serveur refusait la progression passive du terminal en le rétrogradant en 'suiveur', et renvoyait un état obsolète à 0s.
  - **Écrasement Auto-Destructeur Côté Client** : Dans `accountSyncService.ts`, `applyRemoteOrder` et `checkRemoteChanges` vérifiaient `orderOrigin !== myDeviceId`. En raison du suffixe d'onglet, l'appareil croyait recevoir un ordre d'un terminal tiers et appelait `playerStore.seekTo(0)`.
  - **Confusion Fondamentale entre Multi-Room Sync et Télécommande Cast** : Dans `CastModal.tsx`, cliquer sur 'Synchroniser' assignait `setActiveCastTarget`, ce qui basculait `isCasting = true` sur le terminal local, détruisait son instance HLS et retirait sa balise `<video>` du DOM pour afficher un écran d'attente, au lieu de continuer à diffuser le flux en parallèle.
  - **Absence d'Extraction Temps Réel du Curseur Caster** : `CastModal` transmettait une valeur statique ou désynchronisée `currentMedia.positionSeconds` plutôt que de lire `v.currentTime` à l'instant exact du clic.
  - **Blocage par la Politique Autoplay Navigateur (`NotAllowedError`)** : Lorsque l'ordre distant arrivait sans geste utilisateur direct sur l'écran récepteur, `v.play()` échouait sans basculer en sourdine (`v.muted = true`), bloquant le flux alors que le store déclarait `isPlaying = true`.

* **Bonnes Pratiques de Remédiation :**
  - **Normalisation Inconditionnelle des Identifiants Matériels (`isMatchingDevice`)** : Comparer systématiquement les racines d'appareils via `split('_tab_')[0]` sur le back-end et le front-end. Le terminal local actif est reconnu comme leader souverain de son groupe et ne peut jamais s'écraser lui-même.
  - **Fenêtre d'Immunité Utilisateur (`isWithinUserGracePeriod(4000)`)** : Pendant 4 000 ms après tout glisser-déplacer ou saut temporel manuel, interdire formellement à tout paquet réseau entrant de modifier la position du scrubber.
  - **Capture Temps Réel Immédiate (`getLivePosition`)** : Lors du lancement d'un Cast ou d'une Synchronisation, interroger `localVideoRef.current.currentTime || playerStore.getState().activeMedia.positionSeconds` pour transmettre la seconde exacte au récepteur.
  - **Découplage Strict Synchroniser vs Caster** : En mode Synchroniser, préserver la balise vidéo et HLS sur tous les terminaux (aucun passage à `activeCastTarget`). En mode Caster, router les commandes vers le récepteur distant.
  - **Gestion Résiliente de l'Autoplay Muted** : Capturer tout `NotAllowedError` dans Hook 3 et dans `executeRemoteCommand` pour muter le son et lancer la lecture immédiatement avec la bannière interactive de réactivation sonore.
  - **Cycle Haute-Fréquence (2s)** : Abaisser la boucle de détection distante à 2 000 ms et propager immédiatement les actions via `BroadcastChannel` (0 ms local) et `sendDeviceCommand`.

## 🛑 129. Accès au Lecteur Vidéo en Mode Déconnecté, Persistance de Connexion Fantôme en Arrière-Plan, Révocation Permanente Auto-Destructive & Curseur Souris Inopérant dans le Menu Cast (`FloatingBottomPlayer.tsx`, `playerStore.ts`, `app/player/[id].tsx`, `userDeviceRegistry.ts`, `access.ts`, `auth.ts`, `CastModal.tsx`, `CastModal.styles.ts`)

* **Problème / Symptôme :**
  1. Un utilisateur déconnecté pouvait encore accéder au lecteur vidéo ou déclencher la lecture :
     - En accédant directement à `/player/[id]`, le composant montait et commençait à initialiser le flux avant que la redirection asynchrone ne s'exécute.
     - La barre de reprise de lecture du mini-lecteur (`FloatingBottomPlayer`) persistait au bas de l'écran et permettait de cliquer sur *"Reprendre"* même sans compte connecté.
     - Le lecteur continuait à tourner en tâche de fond dans l'application racine et maintenait ouverte la connexion avec les anciens jetons de la session précédente.
  2. Lors de la tentative de reconnexion, l'utilisateur était bloqué ou pris au piège d'une déconnexion permanente :
     - Après avoir cliqué sur *"Déconnecter tous les autres appareils"*, le terminal appelant était lui-même révoqué en raison d'une comparaison brute de chaînes entre `deviceId` de base et identifiant d'instance d'onglet (`_tab_xxx`).
     - L'identifiant restait inscrit à vie dans `revokedDevices` sans jamais être consommé ni levé lors d'un nouveau `/api/auth/login`.
     - Le lecteur persistant resté actif continuait d'envoyer des battements de cœur ou de synchronisation avec l'ancien jeton, provoquant des conflits d'authentification immédiats.
  3. Dans le menu Cast, les boutons d'action étaient impossibles à cliquer à la souris avec un curseur figé en style `default`, et il manquait les 5 actions fonctionnelles réclamées par l'ergonomie multi-écrans (*Déconnecter*, *Synchroniser*, *Caster*, *Suivre*, *Connecter*).

* **Conséquences :**
  - Faille d'étanchéité : lecture de médias non autorisés ou fuite de métadonnées pour des profils déconnectés.
  - Impossibilité absolue pour l'utilisateur de se reconnecter après une déconnexion d'appareils (boucle infinie 401 `DEVICE_REVOKED`).
  - Blocage total des interactions dans la modale Cast (curseur bloqué, boutons insensibles).

* **Causes Racines :**
  - **Absence de Garde Synchrone d'Authentification sur le Lecteur** : `FloatingBottomPlayer` et `player/[id].tsx` n'évaluaient pas `currentUser` avant de lancer les effets de bord et de monter les balises `<video>` HTML5.
  - **Non-Déchargement des Balises DOM `<video>` au Logout** : `authStore.logout()` n'émettait aucun ordre direct de vidage des balises DOM, laissant les flux VOD/HLS actifs sous le capot.
  - **Révocation Non-Consommable et Perte d'Identité Racine** : `revokeAllOtherDevices` comparait `devId !== currentDeviceId` de façon stricte sans normaliser les suffixes d'onglets, et le middleware `access.ts` ne consommait pas la révocation lors du renvoi du code 401.
  - **Superposition Conflictuelle d'Overlay & Curseur CSS** : La modale Cast superposait un `Pressable` frère invisible sur toute la surface de l'écran avec `cursor: 'default'`, interceptant les clics souris destinés aux boutons d'action.

* **Bonnes Pratiques de Remédiation :**
  - **Sanctuarisation de l'Accès au Lecteur (`useCurrentUser`)** :
    - Bloquer immédiatement le rendu (`return null`) sur `/player/[id]` et dans `FloatingBottomPlayer` si `!currentUser && !share`.
    - Décharger, vider (`removeAttribute('src')`, `.load()`) et détruire toutes les balises `<video>` et instances `Hls` lors de la déconnexion (`ums_logout`).
    - Purger `lastPlayback` (`dismissLastPlayback()`) et couper toute session Cast active (`disconnectCastTotally(false)`).
  - **Révocation à Usage Unique & Dé-bannissement à la Reconnexion (`consumeRevocation`, `unrevokeDevice`)** :
    - Consommer l'expulsion dès le premier code 401 `DEVICE_REVOKED` (`consumeRevocation`).
    - Lever explicitement la révocation de l'appareil lors d'un login valide (`unrevokeDevice(user.id, deviceId)`).
    - Protéger l'appareil émetteur lors d'une déconnexion globale via comparaison de la racine matérielle (`isMatchingDevice`).
  - **Ergonomie des 5 Boutons d'Action & Curseur Souris Natif (`pointer`)** :
    - Fournir sur chaque appareil les 5 actions clairement distinctes : `🔴 Déconnecter`, `🔄 Synchroniser`, `📡 Caster`, `👀 Suivre`, `🎮 Connecter`.
    - Structurer la modale avec détection sur l'overlay (`e.target === e.currentTarget && onClose()`), assigner `cursor: 'pointer'`, `userSelect: 'none'` et `pointerEvents="none"` sur les textes pour une sensation tactile et souris irréprochable.

## 🛑 128. Recherche d'Élément Scrollable via querySelectorAll('*') en SPA, Debounce Agressif et Lenteur du Défilement Natif Bloquant les Raccourcis d'Ancre de l'Accueil (`index.tsx`, `SiteHeader.tsx`)

* **Problème / Symptôme :**
  1. Les boutons raccourcis de l'accueil (puces de catégories : *"Sagas"*, *"Films récents"*, *"Séries"*, *"Genres"*, etc.) ne fonctionnaient pas toujours : ils ne fonctionnaient souvent qu'après avoir rechargé la page d'accueil avec F5. Après avoir navigué vers une autre page (ex. `/tv`, `/user`, `/media/[id]`) et être revenu sur l'accueil, les clics sur les raccourcis ne déclenchaient plus aucun défilement.
  2. Le défilement natif via `Element.prototype.scrollTo({ behavior: "smooth" })` était trop lent (~1,5 seconde de glissement mou), créant une sensation de latence et de blocage.

* **Conséquences :**
  - Frustration utilisateur : les boutons de navigation rapide de l'en-tête semblaient inertes ou cassés dès que l'utilisateur naviguait dans l'application.
  - Impossibilité d'accéder directement aux sections thématiques de l'accueil sans rechargement complet du navigateur.

* **Causes Racines :**
  - **Recherche Aveugle de Conteneur dans le DOM Global** : `getScrollContainer()` parcourait `document.querySelectorAll("*")` à la recherche du premier élément ayant `overflowY === "auto" || "scroll"`. Dans une SPA avec React Navigation / Expo Router, les écrans précédents restent souvent montés ou présents dans le DOM. `getScrollContainer()` résolvait ainsi un conteneur hors-champ ou inactif et y appliquait le `scrollTop`, sans aucun impact sur la `ScrollView` d'accueil affichée.
  - **Debounce Inadapté sur les Raccourcis d'Ancre** : `handleDebouncedAction` (250 ms) appliqué à la sélection de catégorie avalait les clics utilisateur rapides entre deux catégories différentes.
  - **Lenteur et Conflits du Smooth Scroll Natif** : L'animation native du navigateur prenait plus de 1000 ms, entrant en conflit avec la détection de section active (`isJumpingRef`) et avec les recalculs de taille (`handleContentSizeChange`).

* **Bonnes Pratiques de Remédiation :**
  - **Résolution Déterministe du Nœud de Défilement (`getHomeScrollNode`)** :
    - Récupérer directement le nœud DOM via `scrollRef.current?.getScrollableNode?.()` ou par son identifiant explicite dédié `nativeID="ums_home_scroll"` / `id="ums_home_scroll"`, sans jamais utiliser `querySelectorAll("*")`.
  - **Animation d'Ancre Fluide et Rapide (`fastSmoothScroll`, 200 ms)** :
    - Remplacer le smooth scroll natif par une interpolation fluide ultra-réactive de 200 ms en `ease-out cubic` (`1 - (1 - p)^3`), garantissant un saut d'ancre instantané et précis au pixel près.
    - Annuler immédiatement l'animation en cours si l'utilisateur touche l'écran ou utilise la molette de la souris.
  - **Élimination du Debounce Artificiel & Déduplication Instantanée** :
    - Supprimer tout délai bloquant sur `onSelectCategory` et ne filtrer que les doublons d'événements synthétiques survenus dans les 100 ms pour un *même* identifiant de catégorie.
  - **Fiabilisation des Sélecteurs de Puces** :
    - Assigner `nativeID` et `id` explicite (`cat-chip-cat.id`) sur les puces et munir le `ScrollView` horizontal de `keyboardShouldPersistTaps="always"`.

## 🛑 126. Confusion Visuelle des Écrans en Synchronisation vs Hors Ligne, Bouton Déconnecter Absent sur les Terminaux et Dispersion du Bouton 'Caster sur ma Télévision' (`CastModal.tsx`, `deviceIdentity.ts`, `userDeviceRegistry.ts`)

* **Problème / Symptôme :**
  1. Dans le menu "Diffuser & Télécommande" (`CastModal`), tous les écrans du compte étaient listés de manière indifférenciée sous un unique en-tête "Mes écrans connectés", sans distinction visuelle entre les écrans activement en synchronisation et ceux fonctionnant en mode indépendant (`syncGroupId = 'standalone'`) ou hors ligne.
  2. Aucun bouton direct de déconnexion n'était présent sur les terminaux synchronisés : pour isoler un écran ou couper la synchronisation de lecture, l'utilisateur devait quitter la modale et se rendre dans l'espace administration `/user?tab=DEVICES`.
  3. Un bouton statique proéminent "Caster sur ma Télévision" coexistait en dehors de la liste des appareils, créant une redondance avec les cibles Chromecast et téléviseurs déjà détectés sur le réseau local.
  4. Les noms des appareils affichés dans la modale étaient souvent des chaînes génériques sans valeur informative (*"Navigateur Web"*, *"Linux"*, *"Appareil Connecté"*), empêchant l'utilisateur de distinguer quel écran correspondait à son téléphone, sa TV ou son PC de travail.

* **Conséquences :**
  - Perte de repères et friction utilisateur : incapacité de savoir d'un coup d'œil quels terminaux du foyer recevaient la diffusion synchronisée.
  - Impossibilité de déconnecter rapidement un écran de la synchronisation en un clic.
  - Redondance ergonomique entre le bouton Cast natif et la liste des terminaux.
  - Confusion d'identité matérielle en présence de multiples appareils connectés.

* **Causes Racines :**
  - **Absence de Partitionnement d'État dans la Modale** : Les terminaux du compte étaient filtrés sans tenir compte de `dev.syncGroupId !== 'standalone'` ni de leur statut d'activité réelle.
  - **Omission du Contrôle In-Place de Synchronisation** : Aucun appel vers `setDeviceSyncGroup(dev.deviceId, 'standalone')` n'était exposé directement sur les lignes d'appareils de la modale.
  - **Bouton Cast Natif Isolé en Dur** : `triggerNativeCast` était branché sur un composant séparé au sommet de la modale au lieu d'intégrer le récepteur TV directement dans la liste dynamique selon son état de connexion.
  - **Résolution Incomplète du User-Agent** : L'identité locale et distante utilisait des fallbacks génériques au lieu d'analyser précisément le modèle d'appareil, la version d'OS et le navigateur.

* **Bonnes Pratiques de Remédiation :**
  - **Partitionnement Visuel Strict : "Mes écrans connectés" vs "Mes écrans déconnectés"** :
    - Segmenter les appareils en deux sections clairement identifiées :
      - `🟢 Mes écrans connectés` : regroupe les écrans du compte en ligne et synchronisés (`isOnline && syncGroupId !== 'standalone'`), les récepteurs Cast actifs et la télévision diffusant un média.
      - `⚪ Mes écrans déconnectés` : regroupe les écrans en mode indépendant (`standalone`), les écrans hors ligne et les cibles TV/Cast en veille sur le réseau local.
  - **Bouton de Déconnexion Direct In-Place (`[Déconnecter]`)** :
    - Intégrer sur chaque terminal connecté un bouton direct appelant `setDeviceSyncGroup(dev.deviceId, 'standalone')` ou `disconnectCastTotally(false)`, déconnectant immédiatement l'appareil de la synchronisation et le déplaçant en temps réel dans "Mes écrans déconnectés".
    - Ajouter symétriquement un bouton `[Synchroniser]` dans "Mes écrans déconnectés" pour ré-attacher l'écran en un clic via `setDeviceSyncGroup(dev.deviceId, 'default')`.
  - **Suppression du Bouton Isolé & Intégration Dynamique de la TV** :
    - Supprimer définitivement le bloc "Caster sur ma Télévision".
    - Présenter la cible TV/Cast native (`Télévision / Google Cast`) directement dans les listes : dans "Mes écrans déconnectés" lorsqu'elle est disponible avec boutons `[Diffuser]` et `[Connecter]`, et dans "Mes écrans connectés" avec bouton `[Déconnecter]` lorsqu'une diffusion sans fil est active.
  - **Détection des Vrais Noms d'Appareils (`getRealDeviceDisplayName`)** :
    - Dériver les noms réels et lisibles à partir du User-Agent et du matériel : ex. `Google Chrome (Linux)`, `Apple Safari (iPhone)`, `Samsung Smart TV (Tizen)`, `LG Smart TV (webOS)`, `Chromecast Salon`, etc.

## 🛑 125. Coupure de Lecture au Repli du Lecteur Vidéo, Destruction de Balise DOM par Conteneur Dynamique `Pressable`, Polling Réseau Incessant & Auto-Synchronisation Rétroactive avec son Propre Appareil (`FloatingBottomPlayer.tsx`, `accountSyncService.ts`, `playerStore.ts`)

* **Problème / Symptôme :**
  1. Lors du repli du lecteur vidéo cinématique en barre flottante (« ▼ Réduire »), la lecture du média se coupait instantanément alors que l'UX attendue exige une lecture autonome et continue au repli, au dépli et lors de la navigation entre toutes les pages du site.
  2. La balise vidéo perdait sa position (`currentTime` réinitialisé à 0) et son instance HLS était détruite et reconstruite à chaque bascule de taille.
  3. Une boucle de polling réseau agressive interrogeait le serveur toutes les 850ms (`setInterval(runSyncTick, 850)`) pour récupérer l'état de lecture du compte, saturant la bande passante et provoquant des conflits d'état permanents.
  4. Un terminal connecté au compte finissait par se synchroniser avec son propre état distant (auto-synchronisation réflexive), écrasant sa propre progression et provoquant des coupures ou des retours en arrière intempestifs.

* **Conséquences :**
  - Rupture brutale de l'expérience utilisateur (UX dégradée) : impossibilité de réduire le lecteur pour continuer à écouter ou regarder tout en explorant la médiathèque.
  - Saccades et interruptions de flux lors du redimensionnement de l'interface.
  - Gaspillage massif de bande passante et de batterie dû au polling réseau permanent à 850ms même lorsqu'aucune action n'était en cours.
  - Régression de synchronisation : un appareil en cours de lecture recevait son propre écho serveur et se mettait lui-même en pause.

* **Causes Racines :**
  - **Destruction de l'Élément DOM `<video>` par `<Pressable>` Dynamique** : Dans `FloatingBottomPlayer.tsx`, l'élément `<video>` était directement encapsulé dans un composant `<Pressable focusable={!isExpanded} accessibilityRole={!isExpanded ? "button" : undefined}>`. Sous React Native Web, la modification dynamique de `accessibilityRole` entre `button` et `undefined` conduit le moteur à remplacer le tag HTML hôte (`<button>` / `<div role="button">` vs `<div>`), ce qui force React à démonter l'ensemble de l'arborescence descendante. La balise `<video>` était ainsi purement et simplement détruite puis recréée à chaque repli/dépli.
  - **Événements DOM `pause` Asynchrones Non Filtrés** : Lors d'un redimensionnement CSS brusque (passage instantané de 100vw/100vh plein écran à la miniature 58x40px), le moteur de rendu Chromium suspend brièvement le pipeline de textures vidéo et émet un événement natif `pause`. L'ancien gestionnaire considérait cet événement comme un ordre utilisateur et invoquait `playerStore.setPlaying(false)`, figeant définitivement la lecture.
  - **Polling Réseau Incessant et Superflu (850ms)** : Le service `accountSyncService.ts` exécutait une boucle d'interrogation HTTP toutes les 850ms, sollicitant le serveur en continu même sans le moindre changement d'état.
  - **Auto-Synchronisation Réflexive avec son Propre Appareil** : Dans la boucle de synchronisation, la condition de filtrage expirait au bout de 3 secondes (`now - updatedAt < 3000`). Au-delà de ce délai, le terminal considérait son propre état renvoyé par le serveur comme un ordre émanant d'un appareil tiers et l'appliquait sur lui-même via `applyRemoteOrder`.

* **Bonnes Pratiques de Remédiation :**
  - **Sanctuarisation d'un Conteneur Vidéo DOM Invariant (`player_video_container`)** :
    - Remplacer le conteneur `<Pressable>` dynamique par un conteneur `<View nativeID="player_video_container">` statique dont le type de composant et les props ne changent jamais (seul son `style` CSS de positionnement et dimension est ajusté).
    - Découpler l'interaction tactile : le clic d'agrandissement en mode replié est confié à un composant frère transparent `<Pressable style={StyleSheet.absoluteFill} onPress={handleExpand} />` affiché uniquement quand le lecteur est replié. La balise DOM `<video>` reste intacte et pérenne pendant toute la vie de la session (0 ms de re-buffering, zéro destruction).
  - **Filtrage Résilient des Pauses DOM Non Sollicitées** :
    - Dans `<video onPause={...}>`, ne basculer `setPlaying(false)` **que si et seulement si** l'action provient d'un geste humain délibéré (`userInitiatedActionRef.current === "PAUSE"`).
    - Si une pause système ou de layout shift survient alors que le média est déclaré en cours de lecture (`activeMedia.isPlaying === true`), ignorer la pause et relancer immédiatement la lecture via `v.play().catch(...)`.
  - **Synchronisation Événementielle Uniquement sur Changement Réel** :
    - Éliminer formellement tout polling réseau agressif à 850ms.
    - Synchroniser UNIQUEMENT lorsqu'il y a un changement effectif d'état :
      - Action utilisateur directe (Play, Pause, Seek, Audio, Sous-titre, Volume, Mute, Ouverture, Fermeture) → diffusion immédiate via `BroadcastChannel` (0 ms entre onglets) et transmission serveur avec `isAction: true`.
      - Progression de lecture → émise uniquement par palier significatif de 5 secondes de lecture naturelle (dans `playerStore.updatePosition`).
    - Fréquence de veille détendue (10s) pour détecter les changements extérieurs réels initiés sur d'autres appareils du compte, avec réveil instantané au focus de la fenêtre (`window.focus`, `visibilitychange`).
  - **Règle Absolue d'Exclusion Locale : Zéro Synchronisation Distante avec son Propre Appareil** :
    - Dans `applyRemoteOrder`, vérifier rigoureusement l'identité matérielle de base : si `remote.originDeviceId` ou `remote.deviceId` correspond à l'appareil local (`isSelf`), l'ordre est immédiatement ignoré. Un appareil ne se synchronise jamais avec lui-même.

## 🛑 124. Boucle d'Écho Vidéo DOM (Echo Feedback Loop), Collision d'Identifiants Multi-Onglets (`deviceId`) & Blocage Mutuel en Mode Synchronisé (`userPlaybackSync.ts`, `accountSyncService.ts`, `deviceIdentity.ts`, `FloatingBottomPlayer.tsx`, `playerStore.ts`)

* **Problème / Symptôme :**
  1. En mode de synchronisation multi-écrans (`syncGroupId = 'default'`), deux lecteurs vidéo (`player_div`) parvenaient à s'enregistrer et se connecter au serveur, mais la lecture ne démarrait pas ou se bloquait immédiatement.
  2. Les deux lecteurs se bloquaient mutuellement en se renvoyant en continu la même réponse en miroir : dès que l'un essayait de lire, l'autre le remettait en pause ou le décalait en boucle, empêchant tout visionnage fluide.
  3. L'architecture attendue n'était pas respectée : `Appareil 1 ou 2 interagissant avec le player → Serveur → Appareils 1 et 2 synchronisés recevant le nouvel ordre`. Au lieu de cela, chaque lecteur réagissait aux événements synthétiques de son propre décodeur HTML5 et renvoyait son état en permanence au serveur, écrasant l'ordre officiel.

* **Conséquences :**
  - Blocage mutuel total des terminaux connectés au même compte : la vidéo saccadait, refusait de passer en lecture continue ou basculait instantanément en pause.
  - Collisions destructrices lors des tests sur la même machine (deux onglets ou fenêtres partageant le même `deviceId` en `localStorage`) : les deux instances se prenaient mutuellement pour le Leader, ignoraient les ordres distants et s'écrasaient réciproquement.
  - Dérive temporelle erratique due à des micro-seeks incessants dès qu'une fraction de seconde d'écart apparaissait entre les horloges locales des deux navigateurs.

* **Causes Racines :**
  - **Événements DOM Passifs Re-diffusés au Réseau (`onPlay` / `onPause`)** : Dans `FloatingBottomPlayer.tsx`, les écouteurs natifs `<video onPlay={...} onPause={...}>` appelaient `playerStore.setPlaying(..., true)` avec `shouldBroadcast = true`. Ainsi, dès qu'un ordre distant démarrait ou mettait en pause la balise vidéo, ou dès que le navigateur déclenchait une pause temporaire de buffering ou d'autoplay bloqué, le lecteur renvoyait une requête POST `/sync` au serveur. Le serveur prenait cette réaction passive pour une nouvelle volonté utilisateur et la renvoyait à l'autre appareil, créant une boucle infinie d'écho ping-pong.
  - **Collision d'Identifiants `deviceId` en Multi-Onglets** : `deviceIdentity.ts` lisait l'identifiant matériel uniquement dans `localStorage`. Deux onglets sur le même navigateur avaient exactement le même `deviceId`. Chacun se croyait émetteur de l'ordre distant (`originDeviceId === myDeviceId`) et refusait d'appliquer l'ordre du serveur.
  - **Absence de Numérotation Séquentielle des Ordres (`orderSeq`)** : Le serveur ne disposait pas d'un numéro d'ordre monotone incrémenté à chaque interaction utilisateur. Les battements passifs réguliers de progression écrasaient les ordres de pause récents.
  - **Période de Grâce Trop Longue & Polling Lent (1800ms)** : Le polling réseau à 1.8s laissait un intervalle de flottement propice aux collisions de paquets HTTP, tandis qu'une grâce de 4 secondes bloquait la réception des ordres de l'autre appareil.

* **Bonnes Pratiques de Remédiation :**
  - **Souveraineté des Ordres Utilisateur Explicites (`orderSeq`, `actionTimestamp`, `originDeviceId`)** :
    - Le serveur devient la source unique de vérité. Chaque interaction utilisateur (Play, Pause, Seek, Open, Audio, Sous-titre) incrémente `orderSeq++` et horodate l'ordre avec `actionTimestamp`.
    - Tout battement passif (`isAction: false`) est strictement interdit de modifier l'état de lecture (`isPlaying`) ou de contredire un ordre utilisateur récent (< 3.5s).
  - **Éradication Totale de la Boucle d'Écho DOM** :
    - Dans `FloatingBottomPlayer.tsx`, `onPlay` et `onPause` ne diffusent au réseau (`shouldBroadcast = true`) **que si et seulement si** l'action a été explicitement initiée par un geste humain (`userInitiatedActionRef.current === 'PLAY'` ou `'PAUSE'`).
    - Les événements résultants de la synchronisation distante (`syncPlayingFromRemote`, buffer, fin de chargement) modifient l'UI locale sans JAMAIS envoyer de requête réseau.
  - **Identifiant Unique par Session/Onglet (`getLocalPlaybackDeviceId`)** :
    - Combinaison de l'identifiant matériel avec un jeton de session d'onglet (`sessionStorage`) : `${baseDeviceId}_${tabId}`. Deux fenêtres sur le même PC ont des identifiants distincts et se synchronisent parfaitement.
  - **Canal Local Instantané (`BroadcastChannel`) & Polling Réactif (850ms)** :
    - Utilisation de `BroadcastChannel(ums_playback_sync_channel)` pour propager les ordres en 0 ms entre onglets locaux.
    - Polling dynamique sous 850ms pour une synchronisation réseau fluide et quasi-instantanée.
  - **Calcul Intelligent de la Dérive Temporelle** :
    - Calcul de la position théorique attendue : `expected = positionSeconds + (isPlaying ? elapsed : 0)`. Aucun seek n'est effectué si l'écart est inférieur à 2.5 secondes, garantissant une lecture continue sans saccades.

## 🛑 123. Piège de Focus DOM & Violation WAI-ARIA `Blocked aria-hidden on an element because its descendant retained focus`, Blocage du Responder System & Navigations Redondantes vers Écran Vide (`_layout.tsx`, `media/[id].tsx`, `player/[id].tsx`, `FloatingBottomPlayer.tsx`, `playerStore.ts`)

* **Problème / Symptôme :**
  1. Lors du repli du lecteur vidéo cinématique en barre flottante ("▼ Réduire") ou lors de la navigation inter-écrans sur le site (notamment depuis `/media/[id]` ou `/player/[id]`), la console du navigateur émettait des erreurs critiques Chromium :
     `Blocked aria-hidden on an element because its descendant retained focus. The focus must not be hidden from assistive technology users. Avoid using aria-hidden on a focused element or its ancestor. Consider using the inert attribute instead...`
     pointant vers des éléments comme le bouton de réduction (`collapseBtn`), le bouton de lecture (`playBtn`) ou des liens d'ancrage (`<a>`).
  2. Après le repli du lecteur, cliquer sur le bouton Lecture (`▶`) de la barre repliée ne déclenchait rien du tout : les clics souris et taps tactiles étaient totalement avalés ou inopérants.
  3. L'écran `/player/[id]` n'était plus qu'un conteneur vide affichant "Chargement de la lecture..." avec des hooks fantômes (`useCastReceiver` avec `videoRef.current = null`) qui diffusaient un battement erroné (`0s`, `isPlaying: false`) et surchargeaient le processeur d'écouteurs d'événements de touches clavier concurrents.
  4. L'action "Regarder" sur la fiche `media/[id].tsx` naviguait inutilement vers `/player/[id]` pour forcer l'expansion du lecteur persistant, puis le bouton "▼ Réduire" naviguait dans l'autre sens par `router.replace(/media/ + id)`, déclenchant un va-et-vient d'écrans superposés qui masquait l'écran précédent avec `style="display: none;" aria-hidden="true"` tout en conservant le focus sur un élément interne inaccessible.

* **Conséquences :**
  - Blocage sévère de l'arbre d'accessibilité WAI-ARIA sous Chromium / Blink : le moteur refuse d'appliquer `aria-hidden` et gèle ou corrompt la capture de pointeur de React Native Web (`responderSystem`).
  - Impossibilité absolue pour l'utilisateur de relancer ou de commander la lecture d'un média lorsqu'il est replié ou en naviguant sur une autre page du site.
  - Conflits permanents de battements de présence et de télécommande universelle entre `player/[id].tsx` et le `RootLayout` persistant de `_layout.tsx`.

* **Causes Racines :**
  - **Absence de Libération du Focus Actif (`.blur()`) avant Changement d'Écran et Repli** : Sous React Native Web, les éléments interactifs (`Pressable` avec `focusable={true}`) reçoivent le focus DOM du navigateur (`tabIndex="0"`). Lorsque React Navigation / Expo Router bascule d'un écran à un autre, il applique `style="display: none;" aria-hidden="true"` sur le conteneur de l'écran inactif. Si le bouton cliqué (`playBtn`, `backBtn` ou `collapseBtn`) conserve le focus DOM (`document.activeElement`), la spécification W3C WAI-ARIA interdit formellement d'isoler un descendant focalisé derrière un ancêtre `aria-hidden="true"`.
  - **Goulot d'Étranglement du Responder System React Native Web** : Dès lors que le focus navigateur est coincé sur un élément d'un conteneur masqué ou démonté, la chaîne de dispatch synthétique de React Native Web refuse de focaliser ou de déclencher `onPress` sur les autres composants du document.
  - **Va-et-vient Inutile entre Pages Écrans et Lecteur Persistant** : Alors que `FloatingBottomPlayer` a été sanctuarisé comme une div autonome et globale montée au niveau du `RootLayout`, `media/[id].tsx` continuait de déclencher un changement de route vers `/player/[id]`, au lieu d'ouvrir directement le média en place dans le lecteur autonome (`playerStore.openMedia({ ..., expand: true })`).

* **Bonnes Pratiques de Remédiation :**
  - **Sentinelle Anti-Focus-Trap Universelle dans `_layout.tsx`** :
    - Écouter systématiquement les changements de route (`pathname`) et invoquer `(document.activeElement as HTMLElement)?.blur?.()` pour garantir qu'aucun élément ne conserve le focus lors du passage d'un écran à un autre.
    - Déployer un `MutationObserver` et des écouteurs globaux `focusin` et `pointerdown` : si `document.activeElement` se retrouve à un quelconque moment descendant d'un conteneur avec `[aria-hidden="true"]` ou `[style*="display: none"]`, forcer immédiatement son floutage (`blur()`) et réattribuer le focus sain à `document.body`.
  - **Floutage Systématique aux Transitions du Lecteur (`FloatingBottomPlayer.tsx`)** :
    - Dans `handleCollapse`, `handleExpand`, `handleClose` et sur le bouton `collapseBtn`, appeler systématiquement `(document.activeElement as HTMLElement)?.blur()` avant d'altérer l'état d'expansion ou de déclencher une navigation.
  - **Ouverture Directe In-Place sur les Fiches Médias (`media/[id].tsx`)** :
    - Remplacer `router.push(/player/ + id)` par l'invocation directe de `playerStore.openMedia({ ..., expand: true })`. L'utilisateur reste sur la fiche média et le lecteur cinématique se déploie instantanément sans provoquer de transition d'écran destructrice.
  - **Assainissement Radical de `player/[id].tsx`** :
    - Supprimer les hooks obsolètes `useCastReceiver` et `usePlayerControls` qui utilisaient une `videoRef` nulle. La gestion Cast et le pilotage universel sont intégralement et exclusivement pris en charge par `_layout.tsx` et `FloatingBottomPlayer`.
  - **Résilience de Relance Audio sous Autoplay Policy** :
    - Dans `playerStore.setPlaying` et `handleTogglePlay`, intercepter `NotAllowedError` lors de l'appel `v.play()` pour basculer automatiquement en sourdine (`v.muted = true`) et permettre la reprise fluide de la vidéo même en arrière-plan sans blocage navigateur.

## 🛑 122. Échec de Reprise de Lecture en Mode Replié / Caché, Écrasement par Boucle de Synchronisation Réseau (`accountSyncService.ts`), Perte d'Action Utilisateur par Mutex `isPublishing` & Conflit d'Événements Asynchrones DOM (`FloatingBottomPlayer.tsx`, `playerStore.ts`, `accountSyncService.ts`, `_layout.tsx`, `player/[id].tsx`)

* **Problème / Symptôme :**
  1. En mode replié (mini-lecteur flottant persistant en bas d'écran), après avoir réduit la vue cinéma ou lors de la navigation, cliquer sur le bouton Play (`▶`) ne parvenait pas à relancer la lecture du média : le bouton restait bloqué sur `▶` ou oscillait pendant une milliseconde avant de se figer.
  2. Le repli du lecteur cinéma ("▼ Réduire") ne mettait pas systématiquement le flux en pause propre, laissant une ambiguïté d'état où le flux continuait de tourner en arrière-plan sans action explicite de l'utilisateur.
  3. Lors de la navigation hors de la page `/player` (ex: navigation sur l'accueil, les fiches médias, la TV en direct), le battement de cœur Cast (`sendCastHeartbeat`) envoyait un objet vide `{}` au lieu des métadonnées du média en cours, rendant l'appareil invisible ou déclaré inactif pour les télécommandes et casters distants. De plus, `pollDeviceCommands` dans `_layout.tsx` ignorait toutes les commandes de lecture (`PLAY`, `PAUSE`, `SEEK`, `STOP`, `SET_VOLUME`, `MUTE`), empêchant tout pilotage à distance dès que le lecteur était replié.
  4. La miniature vidéo en mode replié accusait un décalage vertical (top: 16px au lieu de 22px sur desktop et 18px au lieu de 24px sur mobile), laissant dépasser 6px du poster statique sous la vidéo en raison de la hauteur réservée par la barre de progression scrubber (12px) et du centrage dans la ligne de 60px.
  5. Quitter la page `/player/[id]` déclenchait systématiquement `leavePlayback(id)` sur le serveur, retirant faussement l'utilisateur de la session active alors même que la lecture restait ouverte et autonome dans le mini-lecteur permanent.

* **Conséquences :**
  - Impossibilité pour l'utilisateur de relancer la lecture d'un média sans être contraint de ré-agrandir le lecteur en plein écran.
  - Exception `AbortError: The play() request was interrupted by a call to pause()` émise par le moteur vidéo du navigateur lors de chaque tentative de lecture.
  - Perte de contrôle totale via Google Cast ou télécommande multi-écrans dès que l'utilisateur naviguait sur le site.
  - Désynchronisation de présence sociale et indicateurs de spectateurs erronés lors du repli du lecteur.

* **Causes Racines :**
  - **Perte Silencieuse des Actions Utilisateur par Verrou Mutex In-Flight (`isPublishing`)** : Dans `accountSyncService.ts`, `reportAccountPlayback` contenait la garde `if (!user || isPublishing) return;`. Lorsque le battement périodique d'arrière-plan (~2.2s) était en cours d'envoi réseau, toute interaction utilisateur immédiate (`isAction: true` pour Play, Pause ou Seek) était purement et simplement jetée. Le serveur ne recevait jamais le changement d'état `isPlaying: true` ni la prise de leadership (`leaderDeviceId`).
  - **Écrasement en Boucle par le Polling de Compte (`syncPlayingFromRemote(false)`)** : Toutes les 1800ms, `startAccountPlaybackSyncLoop` interrogeait le serveur. Comme le serveur possédait encore l'ancien état (`isPlaying: false`) suite à la perte de l'action, le callback `syncPlayingFromRemote(false)` forçait immédiatement `v.pause()` sur le lecteur local dans un délai de 0 à 1,8 seconde après que l'utilisateur eut appuyé sur Lecture.
  - **Interruption de Promesse `v.play()` par Événement `pause` Asynchrone DOM Tardif** : Dans `FloatingBottomPlayer.tsx`, la balise `<video onPause={...}>` ne vérifiait pas l'intention utilisateur ni le timestamp du dernier ordre de lecture. Si un événement `pause` résiduel de la mise en pause précédente (lors du repli) arrivait au moment où `v.play()` démarrait, `onPause` remettait `playerStore.setPlaying(false)` et Hook 3 invoquait `v.pause()`, provoquant l'erreur critique `AbortError: The play() request was interrupted by a call to pause()`.
  - **Carence d'Ordre Direct dans `playerStore.setPlaying`** : Auparavant, `setPlaying` se contentait d'émettre un signal React sans piloter directement l'élément DOM `<video>`, dépendant de re-renders et de `Hook 3` pour déclencher `v.play()`. En mode replié ou lors de la navigation inter-pages, les délais de frame pouvaient différer l'exécution au point où la politique d'autoplay du navigateur bloquait le son ou la lecture.
  - **Absence de Mise à Jour Optimiste lors du Cast en Mode Replié** : En mode Cast (`isCasting`), `handleTogglePlay` envoyait la commande HTTP mais n'actualisait ni `activeCastTarget.isPlaying` ni `playerStore.setPlaying`, laissant le bouton bloqué visuellement sur `▶` jusqu'au prochain battement de synchronisation distant (1,2s).
  - **Double Invocation Instantanée par Clic Synthétique (`onClick` + `onPress`)** : Sur React Native Web, assigner simultanément `onPress={handleTogglePlay}` et la prop DOM native `{ onClick: handleTogglePlay }` entraînait l'exécution séquentielle des deux gestionnaires lors d'un même clic de souris ou tap tactile. La première exécution appelait `playerStore.setPlaying(true)` et `v.play()`, puis la seconde exécution immédiate inversait l'état à `setPlaying(false)` et appelait `v.pause()`.
  - **Carence de Relais Cast & Commandes en Mode Arrière-Plan (`_layout.tsx`)** : L'intervalle global n'interrogeait pas `playerStore.getState().activeMedia` pour renseigner `sendCastHeartbeat`, et `pollDeviceCommands` ne traitait que l'action `LOAD`, jetant toutes les actions de lecture.
  - **Appel Inconditionnel de `leavePlayback` dans le Démontage de `/player/[id]`** : La fonction de nettoyage du composant d'écran appelait `leavePlayback(id)` même si `playerStore` conservait activement le même média dans le mini-lecteur persistant.

* **Bonnes Pratiques de Remédiation :**
  - **Mise en File d'Attente Mutex (`pendingReport`) dans `accountSyncService.ts`** :
    - Ne jamais rejeter un appel `reportAccountPlayback` lorsque `isPublishing` est actif. Empiler la charge utile dans `pendingReport` et propager `isAction: true` pour dépiler immédiatement l'action dès que la requête en vol s'achève.
  - **Période de Grâce Souveraine de 4 Secondes (`isWithinUserGracePeriod()`)** :
    - Enregistrer systématiquement le timestamp de chaque action utilisateur explicite (`recordUserAction()`) lors d'un Play, Pause ou Seek.
    - Dans `syncPlayingFromRemote` et dans `startAccountPlaybackSyncLoop`, si `isWithinUserGracePeriod()` est vrai, interdire formellement à tout événement distant ou désynchronisation réseau d'écraser l'état local ou de mettre le lecteur en pause.
  - **Sanctuarisation Discriminée de l'Action (`userInitiatedActionRef`) & Filtrage des `onPause` Tardifs** :
    - Remplacer le booléen générique par un état typé (`'PLAY' | 'PAUSE' | 'SEEK' | null`) accompagné de `lastUserPlayRequestTimeRef`.
    - Dans `<video onPause={...}>`, si l'utilisateur a demandé `PLAY` dans les 1200ms précédentes ou si `playerStore.getState().activeMedia?.isPlaying` est vrai, ignorer l'événement pause du DOM pour ne jamais annuler la relance de la lecture.
  - **Pilotage Direct et Immédiat du DOM dans `playerStore.setPlaying`** :
    - Dès que `setPlaying(isPlaying)` est appelé, ordonner directement `v.play()` ou `v.pause()` sur la balise `video[data-player-div-video="true"]` sans attendre le cycle de vie React.
  - **Mise à Jour Optimiste Instantanée du Cast (`activeCastTarget.isPlaying = nextPlay`)** :
    - Mettre à jour immédiatement l'état de la cible Cast et appeler `playerStore.setPlaying(nextPlay)` lors du toggle Play/Pause en mode Cast replié pour un retour visuel à 0ms.
  - **Débouncing Temporel & Évaluation Autoritaire (`now - lastToggleTimeRef.current < 300`)** :
    - Protéger `handleTogglePlay` par une temporisation de 300ms éliminant 100% des doublons d'événements `onClick` et `onPress`.
    - Lire l'état `isPlaying` actuel directement depuis le singleton `playerStore.getState().activeMedia` pour garantir une inversion univoque et atomique (`nextPlay = !currentMedia.isPlaying`).
  - **Pause Automatique Explicite au Repli (`handleCollapse`)** :
    - Mettre systématiquement le média local (`v.pause()`) et le Cast (`sendCastCommand('PAUSE')`) en pause propre avant de passer `isExpanded: false`.
  - **Persistance Universelle du Cast & Télécommande Multi-Écrans (`_layout.tsx`)** :
    - Injecter l'état complet de `activeMedia` (`currentMediaId`, `mediaTitle`, `positionSeconds`, `durationSeconds`, `isPlaying`, `volume`, `isMuted`) dans `sendCastHeartbeat` lors de la navigation globale.
    - Mapper l'ensemble des commandes distantes (`PLAY`, `PAUSE`, `SEEK`, `STOP`, `SET_VOLUME`, `MUTE`, `UNMUTE`, `LOAD`) vers les méthodes correspondantes de `playerStore`.
  - **Alignement Pixel-Perfect de la Miniature Vidéo** :
    - Caler `miniVideoStyle` et `videoContainerMini` à `top: 22px` sur Desktop et `top: 24px` sur Mobile pour recouvrir exactement le cadre de miniature 58x40 et 50x36.
  - **Conditionnement de la Clôture de Session Sociale** :
    - N'exécuter `leavePlayback(id)` au démontage de `/player/[id]` que si le média a réellement été fermé ou remplacé dans le store applicatif (`!curActive || curActive.id !== String(id)`).

---

## 🛑 121. Désynchronisation de Pause/Play en Mode Replié & Perte de Clics sur les Raccourcis du Menu par Verrouillage PanResponder et ScrollIntoView Global (`FloatingBottomPlayer.tsx`, `FloatingBottomPlayer.styles.ts`, `SiteHeader.tsx`, `index.tsx`, `TagSearchBar.tsx`)

* **Problème / Symptôme :**
  1. En mode replié (mini-lecteur flottant en bas de l'écran), cliquer sur le bouton Play/Pause (`▶` / `⏸`) ne répondait pas correctement : le bouton semblait inactif, basculait parfois sans relancer ou couper la vidéo, ou restait bloqué dans un état incohérent avec le flux réel.
  2. Par intermittence, les boutons des raccourcis du menu de navigation (catégories Sagas, Films, Séries, etc. ainsi que les raccourcis utilisateur Favoris, Amis, Salons, Fil d'avis) devenaient totalement inactifs (les clics ne faisaient rien). Le problème ne se résolvait que par un rechargement forcé de la page (`F5`), ce qui dégradait l'expérience utilisateur et rompait la fluidité PWA.
  3. Cliquer sur le premier raccourci de catégorie ("Sagas") ou sur le logo UMS pour revenir au sommet de l'accueil ne fonctionnait pas si l'utilisateur avait déjà fait défiler la page.
  4. Dès qu'une image ou un composant finissait de charger après un saut de catégorie, l'écran était brutalement ramené en arrière à l'ancienne position de défilement.
* **Conséquences :**
  - Impossibilité pour l'utilisateur de mettre en pause ou de reprendre sa lecture sans déplier le lecteur en grand écran.
  - Sensation de freeze ou de bugs intermittents sur la barre de navigation supérieure, obligeant à des rechargements sauvages.
  - Perte de contrôle sur la navigation par catégories.
* **Causes Racines :**
  - **Inversion d'État Asynchrone dans `handleTogglePlay`** : Dans `FloatingBottomPlayer.tsx`, `handleTogglePlay` inspectait la propriété DOM de l'élément vidéo `v.paused` au lieu de la vérité de l'état React `isPlaying`. En cas de mise en mémoire tampon, de suspension d'arrière-plan ou de décalage de frame, `v.paused` pouvait être vrai alors que le store était en lecture, tentant un `v.play()` au lieu d'une pause. De plus, `playerStore.setPlaying(true)` n'était appelé que dans la résolution asynchrone du `.then()` de `v.play()`, laissant l'UI dans un état transitoire où un second clic provoquait une interruption de promesse (`AbortError: The play() request was interrupted by a call to pause()`).
  - **Ignorance des Événements Vidéo Matériels dans `onPause` / `onPlay`** : La condition `if (userInitiatedRef.current)` bloquait la synchronisation vers le store si la pause provenait du système (casque Bluetooth, touche multimédia clavier, fin de média ou mise en veille), laissant l'icône sur `⏸` alors que la vidéo était à l'arrêt.
  - **Verrouillage Global du `PanResponder` par `scrollIntoView`** : Dans `SiteHeader.tsx`, un `useEffect` déclenchait `chipEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })` sur le document dès que la catégorie active changeait (par le scroll de l'utilisateur). Ce défilement automatique global plaçait le `ScrollView` horizontal en état de défilement animé permanent. Dans React Native Web, tout clic sur un composant enfant (`Pressable`) pendant un défilement actif est intercepté et consommé par le `ScrollResponder` pour arrêter l'animation, annulant purement et simplement le `onPress`.
  - **Sensibilité aux Micro-Mouvements Souris** : Les utilisateurs de souris et trackpads effectuent naturellement 1 à 2 pixels de micro-déplacement entre le pointer-down et le pointer-up. React Native Web interprète ce jitter comme une intention de drag horizontal et annule l'événement `onPress`.
  - **Blocage du Retour Sommet dans `applyScroll`** : La fonction `applyScroll(y)` contenait la garde `if (y <= 0) return;`. Par conséquent, tout appel avec `y = 0` (retour au sommet ou catégorie d'indice 0) retournait immédiatement sans exécuter le scroll !
  - **Snap-Back Agressif de Restauration (`isRestoringScroll`)** : Lors du retour depuis une fiche média, `isRestoringScroll.current` restait vrai jusqu'à un événement `wheel` ou `touchstart`. Lors d'un clic de saut de catégorie, ce flag n'était pas désactivé : dès que `onContentSizeChange` se déclenchait lors du chargement des miniatures, `applyScroll(savedHomeScrollY)` était ré-exécuté, annulant le saut et renvoyant l'utilisateur à sa position précédente.
* **Bonnes Pratiques de Remédiation :**
  - **Bascule Synchrone Immédiate & Indépendante du DOM (`nextPlay = !isPlaying`)** :
    - Déterminer la prochaine action directement à partir de la négation de l'état réactif `!isPlaying`.
    - Appeler immédiatement `playerStore.setPlaying(nextPlay, true, true)` pour mettre à jour l'interface instantanément (0 ms de latence perceptuelle).
    - Exécuter ensuite `v.play()` (avec rattrapage automatique si le navigateur bloque l'autoplay non-muet via `NotAllowedError`) ou `v.pause()`.
  - **Double Écouteur Clic Web Natif & Isolation Pointer-Events** :
    - Ajouter systématiquement la prop `{...(Platform.OS === 'web' ? { onClick: (e) => { e.stopPropagation(); handleAction(); } } : {})}` sur tous les boutons interactifs du lecteur et des barres d'en-tête pour contourner les limitations du PanResponder.
    - Appliquer `pointerEvents="none"` sur les textes et icônes enfants pour garantir que l'élément cliquable parent reçoit 100% des événements de souris.
  - **Défilement Horizontal Strictement Isolé (`scrollEl.scrollTo`)** :
    - Bannir `scrollIntoView` global sur les éléments d'en-tête. Cibler uniquement le nœud DOM du `ScrollView` horizontal (`scrollEl.scrollTo({ left: targetScrollLeft, behavior: 'smooth' })`).
  - **Libération Immédiate de la Restauration & Correction de `applyScroll`** :
    - Remplacer `if (y <= 0) return;` par `const targetY = Math.max(0, y);` dans `applyScroll`.
    - Dans `handleJumpToCategory` et `handleScrollToTop`, positionner immédiatement `isRestoringScroll.current = false` et `scrollRestoredRef.current = true` pour sanctuariser la position d'arrivée.
    - Calculer l'offset de saut dans `handleJumpToCategory` en soustrayant la hauteur réelle du header fixe (`headerPaddingTop`), garantissant un alignement pixel-perfect du titre de catégorie sous la barre.

---

## 🛑 120. Échec de Déplacement dans la Barre de Progression (Seek / Scrubber `NaN`), Absence de Dragging Interactif et Goulots d'Étranglement de Chargement Initial (`FloatingBottomPlayer.tsx`, `FloatingBottomPlayer.styles.ts`, `CastControlBar.tsx`, `pwaDataCache.ts`, `pwaImageCache.ts`, `taxonomyRoutes.ts`, `index.ts`, `index.tsx`)

* **Problème / Symptôme :**
  1. Lors de la lecture d'un média (mode replié ou mode cinéma déplié), impossible d'avancer ou reculer depuis la barre de progression : cliquer dessus ne déplaçait pas la lecture ou provoquait un blocage / reset.
  2. Aucun support du glisser-déplacer (drag/scrubbing tactile et souris) : l'utilisateur ne pouvait pas faire défiler la tête de lecture de manière continue le long de la barre.
  3. La zone tactile était limitée à 4px ou 6px de haut, rendant le ciblage extrêmement pénible et imprécis sur smartphone et tablette.
  4. Temps de chargement initial ralenti par plusieurs anomalies : re-téléchargement double de chaque affiche (`new Image()` + second `fetch()` redondant), hydratation erronée du cache mémoire reconnaissant toute donnée LocalStorage comme périmée, absence de compression HTTP Hono sur les gros payloads JSON, et 8 à 9 requêtes SQL lourdes exécutées systématiquement sans cache serveur sur `/api/ui/taxonomy`.
* **Conséquences :**
  - Perte de contrôle sur la lecture : impossible de sauter un passage ou de naviguer dans un film.
  - Exception silencieuse `TypeError: Failed to set the currentTime property on HTMLMediaElement: The provided double value is non-finite` due à des coordonnées évaluées à `NaN`.
  - Surcharge réseau et latence perceptible au démarrage de l'application.
* **Causes Racines :**
  - **Incompatibilité Événementielle React Native Web (`e.clientX` non défini)** : Dans l'événement `GestureResponderEvent` de React Native Web, la propriété `clientX` n'existe pas à la racine de l'objet `e` (contrairement au DOM natif). L'opération `(e.clientX - rect.left)` évaluait donc `(undefined - rect.left) => NaN`. La variable `target` valait `NaN`, ce qui bloquait l'affectation de `currentTime` et injectait `NaN` dans le `playerStore`.
  - **Hit-Box Trop Étroite (4px - 6px)** : Les conteneurs n'avaient pas de zone tampon de capture (hit-area) transparente.
  - **Hydratation du Cache PWA (`isFresh` avant hydratation de `entry`)** : Dans `fetchWithCache`, la variable `entry` en RAM était inspectée avant d'appeler `getCachedData`. Au rechargement, `entry` valait `undefined`, ce qui invalidait faussement le cache LocalStorage encore frais et relançait toutes les requêtes réseau.
  - **Double Téléchargement d'Images dans `pwaImageCache.ts`** : `prefetchImageToCache` instanciat `new Image().src = url` tout en déclenchant un `fetch(url)` parallèle, doublant le trafic réseau pour chaque vignette alors que le Service Worker intercepte déjà nativement les requêtes du constructeur d'images.
  - **Absence de Cache Mémoire Côté Backend (`GET /api/ui/taxonomy`)** : Requêtes SQL lourdes avec jointures multiples et expressions régulières exécutées à chaque appel HTTP sans mémoïsation serveur.
* **Bonnes Pratiques de Remédiation :**
  - **Extracteur Universel de Coordonnées Tactiles / Souris** : Normaliser l'accès aux coordonnées via `extractClientX(e)` inspectant `e.clientX`, `e.nativeEvent.clientX`, `e.pageX`, `e.nativeEvent.pageX`, `touches[0].clientX`, `changedTouches[0].clientX` et fallback sur `locationX`.
  - **Moteur de Scrubbing Interactif Continu (Drag & Drop)** : Implémenter un cycle complet `onPointerDown` / `onPointerMove` / `onPointerUp` avec mise à jour en direct de `scrubPos` et de la barre bleue, affichage d'un thumb rond blanc et d'une infobulle de prévisualisation temporelle (tooltip), puis application du `seekTo` définitif au relâchement.
  - **Hit-Area Confortable de 22-26px** : Encapsuler la fine barre de 4px ou 6px dans un conteneur interactif avec `paddingVertical` et `pointerEvents: "none"` sur les enfants internes.
  - **Hydratation Préalable du Cache LocalStorage** : Vérifier et hydrater `entry` depuis le LocalStorage avant de tester la fraîcheur (`Date.now() - entry.timestamp < staleTime`).
  - **Suppression du Second Fetch Redondant** : Se fier à `new Image()` et à l'interception native du Service Worker pour mettre en cache les visuels sans saturer la bande passante.
  - **Activation de la Compression Hono (`compress()`) & Cache Serveur 60s** : Compression Gzip/Brotli automatique et mémoïsation en RAM serveur de `/api/ui/taxonomy` (< 1 ms de réponse).

---

## 🛑 119. Encombrement Non-Responsive des Barres de Contrôles sur Smartphone, Éjection de Boutons Hors-Écran et Dépréciation de `style.resizeMode` (`FloatingBottomPlayer.tsx`, `FloatingBottomPlayer.styles.ts`, `media/[id].tsx`, `MediaStudioSection.tsx`, `ForumAssociationsModule.tsx`)

* **Problème / Symptôme :**
  1. Sur smartphone (largeur < 768px, notamment écrans 360-414px), les boutons du lecteur multimédia (Cast, Déplier, Fermer en mode replié ; Partager, Avis, Plein écran en mode cinéma) débordaient horizontalement de l'écran et devenaient inaccessibles à droite.
  2. Avertissement Metro/Webpack : `Image: style.resizeMode is deprecated. Please use props.resizeMode.`
  3. Erreur de syntaxe Metro : `Expecting Unicode escape sequence \uXXXX` due à une séquence d'échappement mal interprétée dans les chaînes multilignes.
* **Conséquences :**
  - Expérience mobile dégradée : boutons de fermeture ou d'agrandissement invisibles, barre supérieure tronquée.
  - Pollution des logs de console et blocage potentiel du bundler.
* **Causes Racines :**
  - **Surcharge Horizontale des Rangées de Contrôles** : Présence simultanée sur smartphone des libellés textuels complets (`🔊 Audio`, `💬 Sous-titres`, `📡 Cast`, `🔗 Partager`, `⭐ Avis`, `⛶ Plein écran`) au lieu d'icônes compactes, et conservation des boutons de saut `-10s` et `+30s` dans la mini-barre basse de 68px alors que le scrubber est déjà accessible au doigt.
  - **Dépréciation React Native Web** : Propriété `resizeMode` passée dans l'objet de style `StyleSheet.create` au lieu de l'attribut direct JSX `<Image resizeMode="..." />`.
* **Bonnes Pratiques de Remédiation :**
  - **Adaptation Granulaire Mobile / Desktop (`isMobile = width < 768`)** :
    - Mode replié (68px) : Sur mobile, n'afficher que le bouton central `Play/Pause`, la miniature compacte (50x36) et les 3 actions rapides `[📡] [▲] [✕]`. Les boutons `-10s` et `+30s` ainsi que les puces audio/sous-titres restent réservés aux grands écrans desktop.
    - Mode cinéma déplié : Remplacement des libellés textuels par des puces d'icônes compactes (`🔊`, `💬`, `📡`, `🔗`, `⭐`, `⛶`) et réduction de `collapseBtn` à `▼` avec troncature automatique du titre (`numberOfLines={1}, flex: 1, minWidth: 0`), garantissant un alignement parfait sur 100% des smartphones sans aucun débordement.
  - **Migration Propre de `resizeMode`** : Utiliser exclusivement la prop native JSX `<Image resizeMode="cover" ... />` et purger toute occurrence de `resizeMode` dans les objets `styles`.

---

## 🛑 118. Positionnement Relatif de la Miniature Vidéo dans le Lecteur Dépliable, Décalage Flexbox et Éjection des Boutons Hors-Écran (`FloatingBottomPlayer.tsx`, `FloatingBottomPlayer.styles.ts`)

* **Problème / Symptôme :**
  1. Lors du repliement du lecteur dépliable en mode mini-lecteur flottant au bas de l'écran, l'élément `<video>` apparaissait en dehors de l'emplacement de miniature prévu (`posterThumb`), se superposant en haut à gauche et provoquant un bug graphique majeur.
  2. La rangée principale des commandes (`mainRow`) et tous ses boutons (Play/Pause, -10s, +30s, Cast, Déplier, Fermer) étaient repoussés vers le bas et se retrouvaient partiellement ou totalement hors-écran.
* **Conséquences :**
  - Impossibilité pour l'utilisateur de cliquer confortablement sur les commandes du mini-lecteur.
  - Artefact visuel disgracieux : le conteneur mesurant 68px de hauteur se retrouvait saturé à plus de 108px de contenu vertical sans masquage de débordement (`overflow: hidden` manquant).
* **Causes Racines :**
  - **Positionnement en Flux Relatif (`position: 'relative'`) sur `videoContainerMini`** : La miniature vidéo était déclarée comme un bloc standard en flux vertical (`flexDirection: 'column'`) avant la barre de progression (4px) et la rangée principale (64px). La vidéo ajoutait donc ses 40px de hauteur au-dessus de la barre de progression, repoussant `mainRow` de 44px vers le bas et éjectant les boutons en dehors du conteneur de 68px.
  - **Absence d'alignement absolu sur le slot d'ancrage** : L'élément vidéo n'était pas ancré de manière absolue au-dessus de `posterThumb` (`top: 16px`, `left: 12px`, `width: 58px`, `height: 40px`), ce qui rompait le gabarit visuel.
  - **Absence de protection `overflow: 'hidden'` sur le conteneur replié** : Le conteneur laissait déborder les éléments enfants au lieu de verrouiller hermétiquement sa hauteur à 68px.
* **Bonnes Pratiques de Remédiation :**
  - **Isolation Absolue de la Miniature Vidéo (`FloatingBottomPlayer.styles.ts`)** :
    - Attribuer `position: 'absolute', top: 16, left: 12, width: 58, height: 40, borderRadius: 6, zIndex: 10` à `videoContainerMini`. L'élément vidéo est ainsi totalement extrait du flux Flexbox vertical du conteneur replié et se positionne au pixel près au-dessus de `posterThumb`.
    - Le flux Flexbox ne contient plus que `progressBarBg` (4px) et `mainRow` (64px), totalisant exactement 68px de hauteur, garantissant un centrage vertical parfait de tous les boutons et éliminant tout débordement.
  - **Verrouillage Hermétique `overflow: 'hidden'` sur `containerCollapsed`** : Garantit qu'aucun élément ou défilement parasite ne peut franchir la frontière des 68px.
  - **Délégation Tactile d'Agrandissement & Gestion du Cast** :
    - Sur `videoContainerMini`, encapsuler dans un `Pressable` avec `onPress={!isExpanded ? handleExpand : undefined}` et `pointerEvents: isExpanded ? 'auto' : 'none'` sur la balise `<video>` pour que tout clic sur la miniature déplie immédiatement le lecteur vers la vue cinéma.
    - Lorsque le Cast est actif ou qu'aucun flux direct n'est joué, masquer le conteneur vidéo avec `{ display: 'none' }` pour laisser apparaître le visuel de couverture (`posterThumb`) sans voile noir.

---

## 🛑 117. Duplication de Balises Vidéo entre Page Lecteur et Mini-Lecteur Flottant, Destruction Inutile du Flux lors du Changement de Page & Écrasement de l'État par Battements Suiveurs Passifs (`FloatingBottomPlayer.tsx`, `player/[id].tsx`, `userPlaybackSync.ts`, `playerStore.ts`, `accountSyncService.ts`)

* **Problème / Symptôme :**
  1. Conflit, instabilité et latence lors du passage entre la page dédiée `/player/[id]` et le mini-lecteur flottant `FloatingBottomPlayer` (`player_div`) : destruction de l'élément `<video>`, recréation de l'instance Hls.js, rechargement complet des tampons, perte de buffering, et saccades à chaque changement d'écran ou navigation dans la PWA.
  2. Écrasement erratique de la lecture en cours par les battements de cœur passifs (`isAction: false`) d'anciens appareils suiveurs envoyés au serveur, entrant en collision avec l'appareil actif piloté par l'utilisateur.
  3. Perte de simplicité et d'élégance architecturale : multiplication de composants de lecture vidéo redondants dans l'application au lieu d'un unique cœur souverain persistant.
* **Conséquences :**
  - Coupure audio et vidéo lors de la navigation entre les pages de l'application.
  - Désynchronisation multi-écrans sur le compte utilisateur : le leader se voyait écrasé par la progression en retard d'un suiveur passif.
  - Risque d'erreur de rendu et fuites de mémoire par multiplication d'instances Hls.js concurrentes.
* **Causes Racines :**
  - **Duplication de Balises `<video>` et d'Instances Hls.js** : Le mini-lecteur flottant masquait son interface et détruisait son flux dès que l'utilisateur atteignait l'URL `/player`, obligeant la page à ré-instancier un lecteur vidéo complet à partir de zéro, détruisant la continuité PWA.
  - **Absence de Protection sur les Battements Passifs Côté Backend (`userPlaybackSync.ts`)** : Lorsqu'un appareil suiveur envoyait son battement de progression de routine avec `isAction: false`, le serveur réécrivait l'état de groupe avec le corps de cet appareil suiveur même si un leader actif était en train de diffuser.
* **Bonnes Pratiques de Remédiation :**
  - **Le Lecteur Autonome Dépliable comme Cœur Unique du Site (`FloatingBottomPlayer.tsx`)** :
    - Une seule et unique balise `<video>` HTML5 pour toute l'application PWA, montée à la racine dans `_layout.tsx`.
    - Persistance absolue : le lecteur ne se démonte jamais lors des transitions de pages (`/`, `/media/[id]`, `/tv`, `/explore`, etc.).
    - Div dépliable autonome : passe instantanément du mode replié (barre flottante 68px au bas du site avec contrôles) au mode déplié (vue cinéma 100vw x 100vh avec toutes les options, contrôles tactiles, sauts d'intro, sous-titres, audio et Cast) par simple mutation CSS, sans aucune interruption du flux vidéo ni re-buffering (0 ms de latence).
    - Ouverture asynchrone universelle : tout clic sur « Regarder », un épisode ou une chaîne TV active immédiatement `playerStore.openMedia` avec dépliement automatique.
  - **Souveraineté du Dernier Appareil Touchant le Player (Last-Interaction-Wins) :**
    - Règle d'or : *Le dernier appareil touchant le player a raison (c'est la dernière modif qui compte) : Appareils interagissant avec le player → Serveurs → Appareil synchronisé recevant.*
    - Toute interaction utilisateur volontaire (play, pause, seek, audio, sous-titres, changement de média) émet `{ isAction: true }` et accorde instantanément et sans délai le leadership à cet appareil sur le serveur.
    - Les battements passifs de suiveurs (`isAction: false`) ne peuvent jamais écraser ni modifier l'état de lecture du leader actif.

---

## 🛑 116. Destruction Récursive de l'Instance HLS au Basculement Play/Pause, Réinitialisation Sauvage de la Progression à 0 et Blocage Audio sur Android (`VideoPlayerView.tsx`, `mediaStream.ts`, `mediaTracks.ts`, `playerStore.ts`, `accountSyncService.ts`)

* **Problème / Symptôme :**
  1. Lors du visionnage d'un média, dès que l'utilisateur mettait la vidéo en pause, la progression temporelle se remettait immédiatement ou au redémarrage au tout début du média (00:00), effaçant l'avancement déjà parcouru.
  2. Sur les appareils Android (smartphones, tablettes, Android TV), le son était systématiquement inaudible, muet ou désactivé :
     - Les fichiers `.mkv` (conteneur non pris en charge nativement par les navigateurs mobiles et Android Chrome) étaient servis en flux direct sans transcodage, provoquant une absence totale de piste audio.
     - Les pistes audio multi-canaux (surround 5.1/7.1, AC3, EAC3, DTS) étaient recopiées brutes (`-c:a copy`) dans les segments MPEG-TS HLS, alors qu'Android n'a pas de décodeur matériel ou de mixeur stéréo pour ces formats dans le navigateur.
     - La politique de sécurité Autoplay d'Android Chrome bloquait la lecture automatique avec son (`NotAllowedError`). La vidéo basculait alors en `muted: true` sans possibilité pour l'utilisateur de réactiver le son de manière évidente.
* **Conséquences :**
  - Impossibilité pour l'utilisateur de faire une pause sans perdre sa position dans le film ou l'épisode.
  - Expérience utilisateur dégradée sur Android avec un média muet et l'impression d'un lecteur défectueux.
* **Causes Racines :**
  - **`isPlaying` Inclus dans le Tableau de Dépendances de l'Effet HLS (`VideoPlayerView.tsx`) :**
    L'effet de montage Hls.js contenait `[streamUrl, shouldUseHlsJs, isPlaying]`. À chaque bascule play/pause, `isPlaying` changeait de valeur, provoquant l'exécution immédiate de la fonction de nettoyage `hls.destroy()`. Une nouvelle instance Hls.js était alors instanciée à partir de zéro, réinitialisant l'élément `<video>` et son `currentTime` à 0.
  - **Absence de Transcodage Automatique pour le Conteneur `.mkv` et l'Audio Multi-Canal :**
    Dans `mediaStream.ts` et `mediaTracks.ts`, la détection de compatibilité ne vérifiait que l'extension `.avi`. Les fichiers `.mkv` avec H.264 et AAC étaient considérés comme 100% natifs, alors que les navigateurs mobiles ne disposent d'aucun démultiplexeur Matroska natif dans le DOM HTML5.
  - **Manque de Geste Utilisateur d'Unmute et Absence de Bannière Mobile :**
    Sur Android, les événements `touchstart` n'activent pas les permissions audio dans Chromium. Seuls les événements `touchend` ou `click` sont des gestes d'activation légitimes (*User Activation*).
* **Bonnes Pratiques de Remédiation :**
  - **Sanctuaire de l'Instance HLS :**
    Retirer formellement `isPlaying` du tableau de dépendances de l'effet HLS (`[streamUrl, shouldUseHlsJs]`). Découpler le pilotage de play/pause dans un `useEffect` univoque dédié qui invoque simplement `v.play()` ou `v.pause()` sans jamais détruire le lecteur ni vider les tampons de segments.
  - **Garantie Stéréo AAC Universelle sur HLS (`mediaStream.ts`) :**
    Dans la génération des segments HLS, vérifier que la piste audio sélectionnée est bien du stéréo AAC (`channels <= 2`). Si le flux d'origine est en 5.1, 7.1, AC3, EAC3, DTS, TrueHD ou FLAC, forcer le mixage stéréo AAC `-c:a aac -b:a 192k -ac 2`.
  - **Redirection 307 Systématique vers HLS pour `.mkv` et Audio Non-Stéréo Web :**
    Dans `mediaStream.ts`, tout fichier dont le conteneur n'est pas strictement web-natif (`.mp4`, `.webm`) ou dont l'audio n'est pas stéréo AAC est redirigé vers le master HLS.
  - **Bannière Flottante Réactive d'Activation Audio Android :**
    En cas de blocage d'autoplay par le navigateur, afficher une bannière explicite « 🔇 Son désactivé — Appuyez ici pour activer le son 🔊 » et attacher l'activation audio sur `onPointerDown` et `onTouchEnd` du conteneur vidéo.

---

## 🛑 115. Collisions Multi-Maîtres (Multi-Master Ping-Pong Loops), Vol Réciproque de Leadership par Événements Vidéo Synthétiques & Échec de Synchronisation de Compte Multi-Écrans (`accountSyncService.ts`, `userPlaybackSync.ts`, `userDeviceRegistry.ts`, `playerStore.ts`, `player/[id].tsx`, `VideoPlayerView.tsx`, `FloatingBottomPlayer.tsx`)

* **Problème / Symptôme :**
  1. Lorsqu'un utilisateur tentait de regarder des médias de manière synchronisée entre plusieurs appareils ou écrans connectés au même compte (ex: TV et Smartphone, ou deux onglets de navigateur) :
     - Les deux lecteurs entraient dans une boucle de combat acharné (*tug-of-war*), alternant de manière erratique entre pause et reprise, ou écrasant continuellement la position temporelle à 0.
     - L'appareil récepteur (Follower) ne parvenait pas à suivre la lecture du premier appareil (Leader), ou bien prenait le contrôle intempestivement dès l'ouverture de la page.
     - En cas de pause sur l'appareil A, l'appareil B mettait en pause sa vidéo, mais cette pause locale renvoyait immédiatement une commande d'action vers le serveur, volant le rôle de Leader et renvoyant une commande conflictuelle vers A.
  2. Le registre backend retournait un champ `deviceId` non renseigné ou `undefined` dans `getGroupPlayback()`, provoquant l'évaluation permanente `remote.deviceId !== myDeviceId` à `true` (parce que `undefined !== "dev_xxx"`), piégeant tous les terminaux dans une boucle de suiveurs passifs sans aucun diffuseur actif.
  3. Lors de l'ouverture directe de `/player/[id]` sur un second appareil, le lecteur repartait du début ou de la progression sauvegardée en base au lieu d'hériter instantanément de la lecture en cours en direct sur le compte.
* **Conséquences :**
  - Impossibilité totale de visionner un média de manière synchronisée entre les écrans d'un même compte utilisateur.
  - Saccades, gels de lecture, redémarrages intempestifs du flux vidéo et frustration extrême de l'utilisateur.
* **Causes Racines :**
  - **Absence de Distinction entre Événements Utilisateur Authentiques et Événements Vidéo Synthétiques :**
    Lorsque le suiveur B recevait une synchronisation distante de play/pause via `syncPlayingFromRemote(isPlaying)` ou de seek via `seekTo(pos)`, le store appelait les méthodes de l'élément HTML5 `<video>` (`v.play()`, `v.pause()`, `v.currentTime = pos`). Le navigateur émettait alors les événements DOM natifs `onplay` et `onpause`. Dans `player/[id].tsx`, les gestionnaires `handlePlay` et `handlePause` appelaient `playerStore.setPlaying(..., true, true)` avec le flag `isExplicitAction = true`, trompant le serveur en lui indiquant qu'une action manuelle de l'utilisateur avait eu lieu sur l'appareil B. L'appareil B volait ainsi le statut de Leader, renvoyant un état erroné à l'appareil A.
  - **Omission de `deviceId` dans `getGroupPlayback` :**
    Dans `backend/src/devices/userDeviceRegistry.ts`, la méthode retournait l'objet `playback` brut sans y adjoindre la clé `deviceId`, empêchant les clients frontend d'identifier quel appareil était le véritable émetteur de l'état.
  - **Absence de Verrou Réentrant de Synchronisation Distante :**
    Le store `playerStore` ne disposait d'aucun moyen d'indiquer aux composants enfants qu'une modification d'état ou de flux était en cours d'application par un flux descendant, provoquant la ré-émission immédiate d'événements ascendants.
  - **Rejet Autoplay Navigateur Interprété comme une Pause Voulue :**
    Sur les navigateurs mobiles et certains ordinateurs, le démarrage automatique de la vidéo sans interaction tactile préalable levait une exception `NotAllowedError`. L'événement `onpause` résultant était propagé comme une pause délibérée de l'utilisateur, figeant la lecture sur l'ensemble des écrans du compte.
* **Bonnes Pratiques de Remédiation :**
  - **Architecture Ordonnée Leader / Follower & Flag `isAction` :**
    - Dans `userPlaybackSync.ts`, la structure de groupe distingue formellement les simples battements de progression (`isAction: false`) des prises de leadership volontaires (`isAction: true`).
    - Seule une interaction utilisateur authentique et prouvée (clic bouton, barre de progression, saut de générique, raccourci clavier) émet `{ isAction: true }` et transfère le rôle de Leader.
  - **Verrou Anti-Bouclage Distant `remoteSyncLockDepth` dans `playerStore.ts` :**
    - Implémentation des méthodes `beginRemoteSync()`, `endRemoteSync()` et `isApplyingRemoteSync()`.
    - `syncPlayingFromRemote` et `seekTo(..., false)` activent le verrou de synchronisation.
    - Dans `player/[id].tsx`, `handlePlay` et `handlePause` vérifient `playerStore.isApplyingRemoteSync()` : si le verrou est actif, la mise à jour visuelle locale est appliquée mais **aucun message n'est renvoyé au serveur**.
  - **Détection Proactive au Montage du Lecteur (`player/[id].tsx`) :**
    - À l'ouverture de `/player/[id]`, une requête `fetchAccountPlayback()` est exécutée immédiatement pour aligner la position temporelle, la lecture/pause, l'audio et les sous-titres sur la session active du compte.
  - **Sanctuaire de l'Autoplay (`userInitiatedRef` & `VideoPlayerView.tsx`) :**
    - Rejet de l'autoplay géré silencieusement (bascule en muet ou attente d'un clic utilisateur) sans notifier d'action de pause vers le Leader.
  - **Validation Automatisée par Tests d'Intégration :**
    - Suite de tests complète [`testAccountPlaybackSync.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/test/testAccountPlaybackSync.ts) validant la non-régression à 100%.

---

## 🛑 114. Boucle Infinie de Synchronisation d'État Réactive (Maximum Update Depth Exceeded), Surchauffe par Re-Renders 4Hz et Polling Réseau Redondant (`player/[id].tsx`, `playerStore.ts`, `VideoPlayerView.tsx`, `accountSyncService.ts`, `_layout.tsx`, `userDeviceService.ts`)

* **Problème / Symptôme :**
  1. Lors de l'accès à la page de visionnage d'un média (`/player/[id]`), une erreur bloquante React était immédiatement levée dans la console web :
     `Web ERROR Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render. Code: [id].tsx:233:9 setActiveAudio(playerState.activeMedia.activeAudio); Call Stack: useEffect (src/app/player/[id].tsx:233:9) RootLayout (src/app/_layout.tsx:80:9)`.
     L'application plantait et figeait l'écran dans une boucle infinie de re-renders.
  2. Le site et le lecteur vidéo présentaient une lourdeur et des ralentissements notables lors de la lecture :
     - Re-rendus massifs et continus du composant lecteur et de tous ses sous-composants à raison de 4 fois par seconde (250 ms), provoquant une surconsommation CPU et des pertes d'images.
     - Redémarrage intempestif de la lecture ou réinitialisation de `positionSeconds` et `durationSeconds` lors d'un changement de piste audio ou de sous-titre.
     - Chute de performance due à un flux continu de requêtes de polling réseau concurrentes (battements de cœur Cast toutes les 1.5s, écoute de télécommande, synchronisation de compte toutes les 1.4s, heartbeat appareils toutes les 2.2s), y compris lorsque l'onglet du navigateur était réduit ou en arrière-plan.
  3. En mode multi-appareils, le basculement d'une langue audio sélectionnée était rétrogradé involontairement vers `'auto'` par des synchronisations distantes concurrentes, et des à-coups temporels (rubber-banding / seek stuttering) survenaient entre deux appareils en lecture miroir.
* **Conséquences :**
  - Crash systématique de React Web (« Maximum update depth exceeded ») empêchant tout visionnage sur la page lecteur.
  - Surchauffe du processeur client et vidage accéléré de la batterie sur ordinateur portable et smartphone.
  - Expérience utilisateur dégradée (ralentissements, saccades de défilement, désynchronisations audio/sous-titres).
* **Causes Racines :**
  - **Double Source de Vérité en Conflit Bidirectionnel (Ping-Pong Loop) :**
    Dans `player/[id].tsx`, les états `activeAudio` et `activeSubtitle` étaient gérés simultanément en local (`useState`) et dans le store global `playerStore`. Un `useEffect` écoutait `playerState.activeMedia.activeAudio` et appelait `setActiveAudio`. Dès que `setActiveAudio` s'exécutait, `streamUrl` était recalculé, déclenchant un second `useEffect` qui appelait `playerStore.openMedia(...)`, lequel notifiait `playerStore`, réveillant à nouveau le premier `useEffect` dans un cycle synchrone infini.
  - **Overhead Massif à 4Hz par `updatePosition` & Variable d'État Factice :**
    - L'événement natif `<video onTimeUpdate>` se déclenche 4 fois par seconde (250 ms). Dans `VideoPlayerView.tsx`, un `useState` inutilisé (`curTime`) était mis à jour 4 fois par seconde, provoquant 4 re-renders inutiles par seconde du composant vidéo.
    - Dans `playerStore.ts`, chaque appel à `updatePosition` déclenchait inconditionnellement `notify()`, forçant `usePlayerState` à notifier tous ses abonnés (`FloatingBottomPlayer`, etc.) 4 fois par seconde.
    - Dans `[id].tsx`, `usePlayerState()` était appelé sans utilité réelle au niveau racine, forçant la reconstruction de l'intégralité de l'écran 4 fois par seconde.
  - **Écrasement de Position dans `openMedia` :**
    `playerStore.openMedia` écrasait aveuglément `positionSeconds: 0`, `durationSeconds: 0` et `isPlaying: true` même lorsque le média ouvert était identique à celui déjà en cours de lecture.
  - **Concurrence Réseau Non Modérée (Polling en Arrière-Plan) :**
    Les boucles de polling (`_layout.tsx`, `userDeviceService.ts`, `accountSyncService.ts`) tournaient à haute fréquence (1.4s à 1.5s) même lorsque l'onglet du navigateur était inactif (`document.hidden`).
* **Bonnes Pratiques de Remédiation :**
  - **Canal Événementiel Découplé & Élimination du Ping-Pong Réactif :**
    - Suppression intégrale de l'effet bidirectionnel surveillant le store dans `player/[id].tsx`.
    - Création de récepteurs d'événements dédiés univoques : `onRemoteAudioChange((audio) => ...)` et `onRemoteSubtitleChange((sub) => ...)`.
    - Initialisation unique et sanctuarisée de `playerStore.openMedia` via le ref de contrôle `openedMediaIdRef.current !== String(id)`.
    - Suppression de la souscription superflue `usePlayerState()` au niveau racine de `[id].tsx`.
  - **Sanctuarisation de la Position dans `openMedia` :**
    - Dans `playerStore.openMedia`, si le média en cours correspond déjà à l'identifiant (`isSameMedia`), conserver scrupuleusement `positionSeconds`, `durationSeconds`, `isPlaying` et les pistes déjà choisies.
  - **Filtrage par Seconde Pleine (Division par 4 des Re-Renders) :**
    - Dans `playerStore.updatePosition`, `notify()` n'est invoqué que si la seconde entière a progressé (`Math.floor(prevSec) !== Math.floor(current)`).
    - Suppression de l'état local factice `curTime` dans `VideoPlayerView.tsx`.
  - **Anti-Downgrade Audio & Anti-Oscillation Temporelle dans `accountSyncService.ts` :**
    - Interdiction formelle d'écraser une piste audio concrète (`1`, `2`, `fra`) par la valeur générique `'auto'`.
    - Temporisation des sauts temporels distants (debounce 3000 ms avec dérive minimale de 3.5s) pour éradiquer tout effet de bégaiement miroir.
  - **Gestion Éco-Énergétique & Pause en Arrière-Plan (`document.hidden`) :**
    - Mise en veille du polling dans `_layout.tsx`, `userDeviceService.ts` et `accountSyncService.ts` lorsque l'onglet est en arrière-plan (`document.hidden`) et qu'aucun média ne joue.

---

## 🛑 113. Dépendances Circulaires (Require Cycles) dans les Services de Lecture, Rejet CORS sur En-tête X-Device-Id en Preflight et Dépréciation des Styles Shadow/TextShadow sur React Native Web

* **Problème / Symptôme :**
  1. Lors du chargement de l'application web ou au redémarrage de Metro/Expo, la console affichait 3 avertissements de dépendances circulaires critiques :
     - `Require cycle: src/services/playerStore.ts -> src/services/castState.ts -> src/services/playerStore.ts`
     - `Require cycle: src/services/playerStore.ts -> src/services/castState.ts -> src/services/accountSyncService.ts -> src/services/playerStore.ts`
     - `Require cycle: src/services/castState.ts -> src/services/accountSyncService.ts -> src/services/castState.ts`
     Ces cycles risquaient d'initialiser des singletons à `undefined` lors de l'exécution initiale, provoquant des erreurs silencieuses de synchronisation ou de lecteur.
  2. Sur la page lecteur (`/player/[id]`) et dans le mini-lecteur flottant (`FloatingBottomPlayer`), des erreurs `TypeError: Failed to fetch` étaient levées lors de l'appel à `fetchMediaTracks`:
     - `Web ERROR [fetchMediaTracks] Exception: [TypeError: Failed to fetch]`
     Le navigateur bloquait la requête réseau dès la phase preflight (CORS).
  3. Des avertissements de dépréciation continus polluaient la console sous navigateur web :
     - `Web WARN "shadow*" style props are deprecated. Use "boxShadow".`
     - `Web WARN "textShadow*" style props are deprecated. Use "textShadow".`
  4. Sur la page TV en direct (`/tv`), lorsqu'un utilisateur sélectionnait une catégorie de chaînes, toutes les autres catégories disparaissaient de la barre de filtres parce que les catégories étaient calculées sur le tableau filtré plutôt que sur la taxonomie complète de l'API.
* **Conséquences :**
  - Risques de variables non initialisées au premier chargement à cause des cycles d'importation.
  - Échec de récupération des pistes audio et sous-titres (`fetchMediaTracks`) sous navigateur, privant les utilisateurs des options de sélection de langues et forçant le fallback par défaut.
  - Pollution de la console développeur par des avertissements de dépréciation React Native Web.
  - Impossibilité pour l'utilisateur de zapper entre différentes catégories IPTV sans recharger la page.
* **Causes Racines :**
  - **Couplage Fort Tripartite :** `playerStore.ts` importait directement `accountSyncService.ts` et `castState.ts`, pendant que `castState.ts` importait `playerStore.ts` et `accountSyncService.ts`, et `accountSyncService.ts` importait `playerStore.ts` et `castState.ts`.
  - **Omission de `X-Device-Id` dans `Access-Control-Allow-Headers` :** Lors de l'envoi de requêtes avec `credentials: 'include'` et l'en-tête personnalisé `X-Device-Id`, les navigateurs vérifient strictement la réponse preflight OPTIONS. Puisque `credentials: true` interdit l'usage du joker `*` pour les en-têtes personnalisés, l'absence de `X-Device-Id` dans `allowHeaders` provoquait un rejet CORS immédiat sans envoi du GET.
  - **Props de Style Rétro-Compatibles :** React Native Web 0.20+ déprécie formellement `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`, `textShadowColor`, `textShadowOffset`, `textShadowRadius` au profit de `boxShadow` et `textShadow`.
  - **Calcul Local Réducteur :** Dans `tv.tsx`, `categories` était calculé via `useMemo` sur la liste `channels` (qui ne contenait que les chaînes de la catégorie active), au lieu d'utiliser l'endpoint dédié `fetchIptvCategories()`.
* **Bonnes Pratiques de Remédiation :**
  - **Architecture DAG Sans Cycle (Directed Acyclic Graph) :**
    - `castState.ts` ne dépend plus ni de `playerStore` ni de `accountSyncService`. Il gère purement l'état cible du Cast et expose `subscribeActiveCastTarget(fn)`.
    - `playerStore.ts` importe `castState.ts` (pour l'état local du Cast) et expose `registerPlaybackBroadcaster({ report, stop })` sans jamais importer `accountSyncService.ts`.
    - `accountSyncService.ts` importe `playerStore` et `castState` et s'enregistre comme diffuseur de compte auprès de `playerStore`.
    - La chaîne de dépendance devient unidirectionnelle et acyclique : `castState` -> `playerStore` -> `accountSyncService`. 0 require cycle.
  - **Autorisation Complète des En-têtes CORS en Preflight :**
    - Ajout explicite de `X-Device-Id`, `x-device-id`, `Range`, `range` dans `cors({ allowHeaders: [...] })` dans `backend/src/index.ts`, `mediaStream.ts` et `cast.ts`.
  - **Styles Adaptatifs Platform-Aware Zéro Dépréciation :**
    - Utilisation systématique de `...(Platform.OS === 'web' ? { boxShadow: '...' } : { shadowColor: '...', shadowOffset: ..., elevation: ... })` et `...(Platform.OS === 'web' ? { textShadow: '...' } : { textShadowColor: '...', ... })`. Élimination à 100% des avertissements console.
  - **Taxonomie Stable des Chaînes TV (`tv.tsx`) :**
    - Récupération initiale des catégories via `fetchIptvCategories()` pour préserver la totalité des catégories dans la barre de filtre quel que soit le filtrage actif.
  - **Débouncing de la Recherche d'Exploration (`explore.tsx`) :**
    - Temporisation de 200ms sur `searchCatalog(query)` pour fluidifier la saisie et éliminer les requêtes réseau superflues en rafale.

---

## 🛑 112. Verrouillage Rigide du Mono-Flux par Compte, Impossibilité de Déconnexion à Distance & Conflit d'Identité Matérielle Multi-Écrans

* **Problème / Symptôme :**
  1. Lorsqu'un utilisateur souhaitait regarder un programme sur son PC tout en laissant ses enfants ou son conjoint visionner un anime sur la télévision du salon avec le même compte, le système imposait un verrouillage mono-lecture rigide écrasant systématiquement la lecture en cours dès qu'un second écran démarrait une vidéo.
  2. Impossible pour un utilisateur de voir quels appareils ou navigateurs étaient connectés à son compte, de savoir quelle page ou quel média chaque écran était en train de consulter, ni de fermer une session oubliée à distance (ex: sur la TV d'une location, le PC d'un ami ou un ancien smartphone).
  3. L'absence d'un identifiant matériel unifié (`ums_device_id`) entraînait la coexistence de doubles identifiants divergents (`ums_cast_device_id` vs `ums_account_device_id`), causant des désynchronisations et empêchant de cibler directement un écran connecté pour lui envoyer un média ou le télécommander.
* **Conséquences :**
  - Conflits d'utilisation intempestifs au sein d'un même foyer : batailles de télécommande involontaires où chaque écran forçait son média sur tous les autres.
  - Faille d'intégrité de session : persistance indéfinie de jetons valides sur des appareils distants sans moyen pour l'utilisateur de révoquer l'accès.
  - Impossibilité d'effectuer des diffusions multi-room personnalisées (ex: diffuser simultanément sur Salon + Cuisine tout en gardant la Chambre indépendante).
* **Causes Racines :**
  - **Stockage d'État Mono-Clé Global par `userId` :** L'état de lecture était stocké dans une `Map<string, AccountPlaybackState>` indexée uniquement par `userId`. Tout appel à `POST /api/playback/sync` écrasait aveuglément l'état de tous les écrans du compte.
  - **Absence de Registre Matériel & de Liste Noire de Révocation :** Le serveur ne tenait aucun registre des `deviceId` actifs par utilisateur et le middleware d'authentification ne vérifiait que la signature cryptographique du jeton sans contrôle d'empreinte d'appareil.
  - **Manque de Support des Groupes de Diffusion (`syncGroupId`) :** Aucune notion de groupe de synchronisation n'existait, empêchant de distinguer un visionnage synchronisé (miroir) d'un visionnage autonome (`standalone`).
* **Bonnes Pratiques de Remédiation :**
  - **Module d'Identité Matérielle Unifié (`deviceIdentity.ts`) :**
    - Générer une empreinte unique stable `ums_device_id` conservée dans le stockage local, partagée de manière cohérente entre le Cast, le gestionnaire de compte et la télécommande universelle.
    - Détecter dynamiquement le type de terminal (`TV`, `MOBILE`, `BROWSER`, `DESKTOP`).
  - **Registre Centralisé des Appareils Connectés (`userDeviceRegistry.ts`, `userDeviceRoutes.ts`) :**
    - Enregistrer chaque appareil lors de ses battements de cœur réguliers (2,2s) avec sa route active (`currentRoute`), son média en cours, son groupe de synchro et son horodatage de présence.
    - Offrir des endpoints de supervision (`GET /api/user/devices`), de renommage personnalisé et de transmission de commandes distantes (`LOAD_MEDIA`, `NAVIGATE`, `PAUSE`, `PLAY`, `SEEK`, `STOP`).
  - **Contrôle d'Intégrité & Déconnexion à Distance (`access.ts`) :**
    - Transmettre systématiquement `X-Device-Id: <deviceId>` sur chaque requête API.
    - Maintenir une liste noire en mémoire vive des appareils révoqués par utilisateur.
    - Rejeter immédiatement avec HTTP 401 `DEVICE_REVOKED` toute tentative d'accès par un terminal révoqué.
    - Fournir la sécurité 1-clic `disconnectAllOtherDevices` pour purger toutes les autres sessions actives.
    - Côté client, intercepter `DEVICE_REVOKED` ou la commande `REVOKE_SESSION` pour fermer le lecteur (`playerStore.closeMedia()`), purger le stockage (`authStore.logout()`) et alerter l'utilisateur.
  - **Matrice de Synchronisation Flexible (`syncGroupId`) :**
    - Permettre à chaque appareil de basculer en 1 clic entre le Mode Synchronisé (`syncGroupId = 'default'` ou groupe sur-mesure) et le Mode Autonome (`syncGroupId = 'standalone'`).
    - En mode autonome, le client ne subit aucun piratage de sa lecture par les autres écrans, tout en restant supervisable à distance.
    - Permettre la diffusion simultanée multi-room (`broadcastMediaToDevices`) pour grouper plusieurs appareils sélectionnés en miroir parfait.
  - **Expérience Utilisateur Complète & Transparente :**
    - Intégrer un onglet dédié « 📱 Appareils & Diffusions » dans Mon Espace (`/user?tab=DEVICES`).
    - Proposer un raccourci direct dans la modale de profil (`AccountModal.tsx`).
    - Unifier la modale de Cast (`CastModal.tsx`) pour afficher à la fois les téléviseurs physiques (Google Cast / AirPlay) et l'ensemble des navigateurs et écrans connectés au compte.

---

## 🛑 111. Blocage de Lecture sur Codecs Non-Natifs (DTS-HD MA, HEVC, AVI), Désynchronisation Multi-Appareils d'un Même Compte & Échec IPTV par Contenu Mixte

* **Problème / Symptôme :**
  1. Certains médias encodés avec des pistes audio DTS/DTS-HD MA (ex: *Ratatouille* `2007.Ratatouille.1920x802.BDRip.x264.DTS-HD.MA.mkv`), de la vidéo HEVC/H.265 (ex: *James Bond Goldfinger* `1964 goldfinger multi 1080p bluray x265 ac3-dam.mkv`) ou des conteneurs AVI (ex: *Ratatouille.avi*) fonctionnaient parfaitement sous VLC mais bloquaient indéfiniment ou restaient muets dans le navigateur web.
  2. Lorsqu'un utilisateur lançait un média sur un appareil ou démarrait un Cast vers une TV, les autres appareils connectés au même compte continuaient leur propre lecture isolée ou ne suivaient pas le média casté (aucune synchronisation du média en cours, des secondes écoulées, ni des pistes audio et sous-titres).
  3. Des chaînes IPTV non fonctionnelles restaient affichées comme actives sans être grisées, et des chaînes légitimes en HTTP (ex: *France 3 Côte d'Azur* `http://89.187.185.76:8080/France3/...`) étaient bloquées par le navigateur en déploiement HTTPS au titre du Contenu Mixte (*Mixed Content Blocked*).
* **Conséquences :**
  - Blocage frustrant de films emblématiques du catalogue et échec incompréhensible pour l'utilisateur alors que les fichiers sont sains sous VLC.
  - Absence de contrôle unifié : un compte pouvait lancer plusieurs lectures concurrentes sans synchronisation, brisant l'expérience multi-écrans fluide et la télécommande de Cast.
  - Guide des chaînes TV pollué par des flux morts ou bloqués par les règles de sécurité HTTPS des navigateurs.
* **Causes Racines :**
  - **Remuxing Monolithique Bloquant vs Requêtes HTTP Range :** Pour les fichiers audio non-natifs, le serveur tentait un remuxing FFMPEG intégral du fichier de 6.5 Go. Le processus monopolisait la réponse HTTP pendant plus de 45 secondes, provoquant l'expiration des délais de connexion (*timeout*) de la balise `<video>` du navigateur. Pour le HEVC, Chromium sous Linux ne dispose pas de décodeur matériel natif et rejette le conteneur MP4/MKV.
  - **Absence d'Architecture de Synchronisation de Compte Mono-Lecture :** Aucune route centralisée ne synchronisait l'état de lecture global du compte utilisateur entre ses différents terminaux (smartphones, PC, PWA TV), et la boucle de Cast ne répercutait pas l'état du média casté sur le compte.
  - **Testeur IPTV Naïf & Blocage de Contenu Mixte :** Le testeur IPTV validait les chaînes sur un simple code HTTP 200 sans vérifier si la réponse était en réalité une page HTML d'erreur du fournisseur. De plus, les flux HTTP directs étaient insérés sans passerelle HTTPS, déclenchant le blocage de sécurité des navigateurs.
* **Bonnes Pratiques de Remédiation :**
  - **Moteur de Transcodage HLS VOD à la Volée (< 50ms) (`mediaTracks.ts`, `mediaStream.ts`) :**
    - Détecter automatiquement si la vidéo (`h264`, `av1`, `vp8`, `vp9`) ou l'audio (`aac`, `mp3`, `opus`) nécessite une adaptation (`requiresHls`).
    - Générer un manifeste virtuel HLS VOD `master.m3u8` en mémoire (< 15ms) découpé en tranches de 6,0 secondes.
    - Transcoder dynamiquement à la volée chaque segment `segment_:index.ts` : `-c:v copy` en 45ms pour les vidéos H264 avec transcodage audio AAC, ou `-c:v libx264 -preset ultrafast` pour HEVC/MPEG-4, avec mise en cache locale dans `/tmp/ums_cache/segments/`.
    - Rediriger automatiquement les requêtes de lecture directe vers HLS (`HTTP 307`) pour les médias incompatibles.
  - **Moteur de Synchronisation Mono-Lecture par Compte (`userPlaybackSync.ts`, `accountSyncService.ts`, `playerStore.ts`) :**
    - Assigner un `deviceId` unique persistant à chaque terminal dans `localStorage`.
    - Maintenir en mémoire backend l'état de lecture actif unique du compte (`userId`, `deviceId`, `mediaId`, `positionSeconds`, `isPlaying`, `activeAudio`, `activeSubtitle`, `castTargetId`).
    - Établir une boucle de synchronisation réconciliant en temps réel (< 1400ms) tous les terminaux du compte : chargement automatique du média, calage à la seconde, synchronisation de l'état play/pause et des langues audio/sous-titres.
    - Lier la boucle de Cast (`castState.ts`) à la synchronisation de compte : tout changement sur la TV castée se reflète immédiatement sur l'ensemble des écrans du compte.
  - **Proxy Universel HLS IPTV & Sonde Stricte (`streamTester.ts`, `liveProxyService.ts`, `iptv.ts`) :**
    - Renforcer le testeur IPTV : valider l'en-tête `#EXTM3U`, rejeter catégoriquement les réponses `<!DOCTYPE html>`, et vérifier la validité du premier fragment vidéo `.ts` (Range 0-1024 octets).
    - Mettre en place un proxy inverse de flux IPTV `/api/iptv/proxy` réécrivant à la volée tous les sous-manifestes et chunks `.ts` avec les en-têtes CORS universels, éliminant totalement les erreurs de Contenu Mixte sur domaine HTTPS (`cool.sweaw.com`).

---

## 🛑 110. Prolifération de Faux Fichiers et Désynchronisation des Dossiers Physiques (PBAC) lors de Déplacements ou Suppressions sur Disque

* **Problème / Symptôme :**
  1. Après avoir supprimé des fichiers ou des dossiers multimédias sur disque et relancé un scan, les fichiers supprimés continuaient d'apparaître dans l'interface et dans la recherche comme s'ils étaient toujours présents (tentatives de lecture échouant en HTTP 404 / 422).
  2. Après avoir déplacé des fichiers vers un nouveau dossier (ex: d'un disque dur externe vers le stockage principal ou réorganisation de répertoires), les médias apparaissaient toujours rattachés à l'ancien dossier manquant dans l'explorateur physique PBAC (`/admin/folders`), ou généraient des doublons parasites.
  3. Des séries (`SHOW`) et sagas (`COLLECTION`) vides continuaient d'exister en base de données alors que tous leurs épisodes ou films avaient été supprimés.
* **Conséquences :**
  - Pollution de la base de données avec des milliers de nœuds fantômes orphelins.
  - Règles de partitionnement physique (PBAC) faussées par des chemins obsolètes.
  - Frustration de l'utilisateur confronté à des médias injouables ("faux fichiers").
* **Causes Racines :**
  - **Absence de Passe de Purge lors du Scan :** Le crawler parcourait les fichiers présents sur le disque et les insérait, mais ne comparait jamais les chemins enregistrés en base (`video_file_path`, `nfo_file_path`) avec le système de fichiers réel. Les médias disparus n'étaient jamais retirés.
  - **Absence de Réconciliation par Empreinte lors des Déplacements :** L'ingestion se basait uniquement sur le chemin absolu (`eq(videoFilePath, videoPath)`). Dès qu'un fichier changeait de dossier, le système l'insérait comme un nouveau média sans détecter qu'il s'agissait du même fichier, laissant l'ancien chemin en doublon fantôme.
  - **Amnésie des Événements `unlink` / `unlinkDir` dans le Watcher Chokidar :** Le service de surveillance en arrière-plan n'écoutait que `add` et `change`. Les suppressions de fichiers ou dossiers physiques n'étaient jamais interceptées.
  - **Comptage Naïf dans l'Explorateur de Dossiers (`folderExplorer.ts`) :** L'agrégation de dossiers se basait sur les chemins en base sans vérifier `fs.existsSync()`, matérialisant des dossiers fantômes avec des compteurs erronés.
* **Bonnes Pratiques de Remédiation :**
  - **Moteur Universel de Réconciliation & Purge (`mediaReconciler.ts`) :**
    - Exécuter systématiquement une passe de réconciliation (`reconcileAndPruneLibrary`) avant et après chaque scan.
    - Vérifier l'accessibilité du volume parent (`isDiskAccessibleForPath`) pour sanctuariser les disques amovibles débranchés d'une purge accidentelle.
    - Réconcilier les fichiers déplacés par empreinte cryptographique (`oshash`, `crc32`) ou nom de fichier (`path.basename`), en migrant automatiquement les favoris (`userFavorites`), progressions (`watchProgress`) et avis (`mediaReposts`) vers le nœud valide, puis supprimer le doublon obsolète.
    - Purger atomiquement les nœuds dont le fichier n'existe plus sur le disque.
    - Supprimer automatiquement les séries (`SHOW`) sans aucun épisode et les sagas (`COLLECTION`) sans aucun film.
  - **Réconciliation Proactive lors de l'Ingestion (`mediaIngester.ts`) :**
    - Avant toute nouvelle insertion, rechercher si un nœud existant portait le même fichier dont l'ancien chemin n'existe plus sur disque, et mettre à jour directement ses chemins sans créer de doublon.
  - **Écoute Réactive de Suppression dans Chokidar (`watcher/index.ts`) :**
    - Brancher les écouteurs `.on('unlink', handleFileUnlink)` et `.on('unlinkDir', handleDirUnlink)` pour réagir instantanément aux suppressions physiques.
  - **Filtrage Strict dans l'Explorateur de Dossiers (`folderExplorer.ts`) :**
    - Valider `fs.existsSync(filePath)` avant d'incrémenter le compteur d'un dossier, garantissant que seuls les fichiers réels soient comptabilisés.

---

## 🛑 109. Disparition des Sous-Titres en Mode Plein Écran (Isolation du Top-Layer Navigateur) et Synchronisation Dynamique des Pistes WebVTT

* **Problème / Symptôme :**
  1. En mode fenêtré, les sous-titres fonctionnaient, mais dès l'activation du plein écran (via le bouton plein écran des contrôles vidéo natifs, le double-clic ou la touche F), les sous-titres disparaissaient totalement de l'image.
  2. Auparavant, une tentative de double incrustation provoquait un dédoublement gênant des sous-titres sous certains navigateurs.
* **Conséquences :**
  - Impossibilité pour les utilisateurs malentendants ou adeptes de VOSTFR de visionner leurs contenus en immersion grand écran.
  - Dégradation majeure de l'ergonomie vidéo.
* **Causes Racines :**
  - **Isolation par le Top-Layer du Compositeur Navigateur :** Lorsqu'un élément HTML5 `<video>` entre en plein écran natif (`requestFullscreen()`), le navigateur place exclusivement cet élément dans la couche d'affichage supérieure (*top-layer* du compositeur GPU).
  - Tous les éléments HTML / React frères et parents (dont les overlays React `<View style={styles.subtitleOverlay}>`) sont strictement exclus du rendu et masqués par le navigateur.
  - Si la balise `<video>` ne contient pas de balise enfant `<track>` native valide ou si ses `textTracks` sont désactivées, aucun sous-titre ne peut être affiché par le moteur vidéo en plein écran.
* **Bonnes Pratiques de Remédiation :**
  - **Intégration Systématique de `<track>` dans `<video>` :**
    - Insérer la balise native `<track key={subtitleUrl} kind="subtitles" src={subtitleUrl} default />` directement comme enfant de `<video>`.
    - Supprimer l'overlay React custom pour garantir une source unique de vérité et éliminer tout risque de dédoublement.
  - **Gestion Dynamique des TextTracks :**
    - Écouter les événements `addtrack` et `change` sur `v.textTracks` pour forcer `t.mode = 'showing'` dès qu'une piste est activée, et `t.mode = 'disabled'` lorsque les sous-titres sont coupés (`activeSubtitle === 'off'`).
  - **Stylisation Universelle via `::cue, video::cue` (`global.css`) :**
    - Définir dans la feuille de style globale le rendu des sous-titres (`::cue`) avec contraste élevé (`rgba(0, 0, 0, 0.82)`), ombre portée marquée et typographie lisible, garantissant un rendu esthétique et constant en fenêtré comme en plein écran.

---

## 🛑 108. Encombrement de la Barre Supérieure du Lecteur, Conflit Balise `<track>` / Overlay et Perte de Position lors du Changement Audio

* **Problème / Symptôme :**
  1. La barre supérieure du lecteur était surchargée avec 7+ boutons et un ascenseur horizontal qui débordait et masquait le titre.
  2. Présence d'un bouton redondant `[ 🔊 Son ]` encombrant l'interface alors que les contrôles vidéo HTML5 intègrent déjà le réglage de volume.
  3. L'arrière-plan du lecteur vidéo affichait un cadre bleu ardoise (`#0f172a`) au lieu d'un noir pur cinéma.
  4. Les sous-titres étaient instables ou dédoublés lors de la sélection, et le basculement audio remettait la vidéo au début (0:00).
* **Conséquences :**
  - Expérience utilisateur dégradée, interface non rationnelle et surchargée.
  - Frustration lors du changement de langue audio qui forçait l'utilisateur à rechercher manuellement sa position dans la vidéo.
  - Conflits de rendu visuel sur les sous-titres sous Chrome et Safari.
* **Causes Racines :**
  - **Surcharge de Commandes Secondaires :** Les actions secondaires (Avis, Partage, Cast, Audio, Sous-titres, Micro) étaient étalées dans une barre de défilement horizontal en tête d'écran au lieu d'être centralisées dans la modale d'options `PlayerMenuModal`.
  - **Bouton Son Redondant :** Un bouton `Son` occupait inutilement l'espace principal à côté de Retour et Réduire.
  - **Marges et Fond Thématique Inadaptés :** `videoPlaceholder` appliquait `backgroundColor: '#0f172a'`, `margin: Spacing.two`, et `borderRadius: Radius.lg`, créant des bandes claires autour de la vidéo.
  - **Incohérence du Rechargement de `<track>` dans Chromium :** L'HTML5 `<track>` n'est pas conçu par les moteurs de rendu pour se recharger dynamiquement lors d'une simple modification de l'attribut `src` en React, et entre en collision avec les overlays personnalisés.
  - **Absence de Restauration de Position sur Switch Audio :** Lorsque la piste audio changeait, `streamUrl` était reconstruit, réinitialisant la balise `<video>` à 0 car la position courante n'était pas mémorisée ni réinjectée lors du `onCanPlay`.
* **Bonnes Pratiques de Remédiation :**
  - **Rationalisation Ergonomique de la Barre Supérieure :**
    - Supprimer le bouton `Son` de la barre supérieure.
    - Diviser la barre supérieure en 3 blocs purs : Gauche (`← Retour`, `▼ Réduire`), Centre (`mediaTitle`), Droite (`⛶ Plein écran`, `⚙️ Menu`).
    - Regrouper toutes les commandes secondaires (Audio, Sous-titres, Cast, Partage, Repost, Salon vocal) dans la modale `PlayerMenuModal`.
  - **Fond Noir Pur (#000000) et Plein Cadre :**
    - Configurer `backgroundColor: '#000000'`, `margin: 0`, `borderRadius: 0` sur `videoPlaceholder`, `container` et la balise `<video>`.
  - **Chargeur de Sous-Titres WebVTT Pur JavaScript :**
    - Parser les fichiers WebVTT directement côté client (`parseWebVttCues`) et synchroniser l'affichage avec `onTimeUpdate`.
    - Bannir la balise `<track>` native dans ce contexte pour supprimer tout risque de sous-titre fantôme ou dédoublé.
    - Côté backend, accélérer l'extraction ffmpeg via `-nostdin -vn -an` avec mise en cache mémoire (`subtitleCache`).
  - **Préservation Immuable de Position (`pendingAudioSeekRef`) :**
    - Mémoriser la position de lecture actuelle avant tout changement de `streamUrl`.
    - Ré-appliquer instantanément `v.currentTime = pendingAudioSeekRef.current` dès l'événement `onCanPlay` et relancer la lecture sans à-coup.

---

## 🛑 107. Dédoublement des Sous-Titres WebVTT, Échec d'Extension Temporaire FFMPEG & Surchauffe du Heartbeat Cast

* **Problème / Symptôme :**
  1. Les sous-titres de la vidéo apparaissaient en double (dédoublés et superposés à l'écran).
  2. L'icône de volume du lecteur HTML5 natif restait grisée et le son inaudible sous Chromium.
  3. Le menu des options du player (`PlayerMenuModal`) n'était pas responsive et débordait de l'écran en particulier sur mobile / mode paysage.
  4. La console affichait l'erreur CORS / 521 : `Access to fetch at 'https://api.cool.sweaw.com/api/cast/heartbeat' from origin 'https://cool.sweaw.com' has been blocked by CORS policy ... net::ERR_FAILED 521`.
* **Conséquences :**
  - Lecture illisible avec deux couches de sous-titres superposées.
  - Impossibilité pour Chromium de lire l'audio des vidéos multi-pistes.
  - Menu d'options tronqué et inaccessible sur petits écrans tactiles ou en orientation paysage.
  - Inondation de requêtes réseau bloquée par Cloudflare WAF renvoyant un statut 521 sans en-tête CORS.
* **Causes Racines :**
  - **Conflit de Mode TextTrack (`showing` vs Overlay JSX) :** Dans `VideoPlayerView.tsx`, `tracks[i].mode` était défini à `showing` tout en extrayant `cue` pour un composant React `<View style={styles.subtitleOverlay}>`. Le navigateur dessinait son propre texte noir natif pendant que React dessinait l'overlay personnalisé, produisant deux rendus simultanés.
  - **Extension Manquante pour FFMPEG (`mediaStream.ts`) :** Le fichier temporaire de remuxing était nommé `${cacheFile}.tmp.${Date.now()}` (sans extension de conteneur). FFMPEG ne pouvait déterminer le format cible (`Unable to find a suitable output format`), avortait instantanément, et le serveur retombait sur le fichier brut MKV dont la piste 1 était AC3 (incompatible avec Chromium/Linux).
  - **MaxHeight Fixe & Absence de FlexShrink (`PlayerMenuModal.tsx`) :** Le menu utilisait une hauteur maximale rigide de 460px sans adaptation aux écrans mobiles en mode paysage (hauteur de 360-420px), poussant le bas de la modale hors de l'écran.
  - **Intervalle Agressif de 1200ms dans `useCastReceiver.ts` :** Deux requêtes POST/GET répétées toutes les 1.2s déclenchaient une limitation de débit Cloudflare (erreur 521).
* **Bonnes Pratiques de Remédiation :**
  - **Mode `hidden` pour les Sous-Titres Personnalisés :** Dans `VideoPlayerView.tsx`, assigner `tracks[i].mode = hidden`. Le navigateur parse les cues WebVTT et émet `oncuechange` sans afficher le texte natif, laissant l'overlay React afficher un rendu unique, net et sans balises HTML.
  - **Nommage Conforme des Fichiers Temporaires FFMPEG :** Utiliser `${cacheFile}.tmp_${Date.now()}.mkv` afin que FFMPEG reconnaisse le conteneur Matroska, produisant un remuxing rapide sans perte (9s pour 2.6 Go) avec piste 1 AAC native pour le navigateur.
  - **Responsivité Dynamique (`useWindowDimensions`) :** Adapter la hauteur du menu en fonction de l'orientation (`isLandscape ? height - 90 : Math.min(460, height - 150)`), avec `flexShrink: 1` et descriptions compactes à une ligne.
  - **Espacement du Heartbeat & Auto-Inscription Récepteur :** Augmenter l'intervalle de battement à 5000ms avec référence immuable (`isPlayingRef`), et auto-enregistrer le récepteur côté backend si le device n'est plus en cache.

---

## 🛑 106. Confusion Visuelle entre Micro Vocal et Son Média & Échec de Lecture Audio Multi-Pistes Incompatibles (AC3/DTS vs AAC)

* **Problème / Symptôme :**
  1. L'utilisateur signale que le son du lecteur vidéo est encore « désactivé et grisé ».
  2. Aucun son n'est émis lors de la lecture de vidéos contenant des flux audio AC3/DTS (ex: films multi-langues `Quand vient la nuit (2014).mkv`), et le curseur de volume du lecteur natif de Chromium apparaît grisé et barré.
* **Conséquences :**
  - Confusion ergonomique totale pour l'utilisateur : croyant cliquer sur le son du film, il activait/coupait en réalité le microphone WebRTC de salon vocal.
  - Absence totale d'audio sur les vidéos encodées avec des pistes AC3 non supportées par Chromium sur Linux, rendant le visionnage inaudible.
* **Causes Racines :**
  - **Ambiguïté Visuelle & Conflit d'Icônes (UI/UX) :**
    Dans `player/[id].tsx`, le bouton du salon vocal WebRTC (mode micro) était initialisé avec `isMuted = true`, affichant l'émoji haut-parleur muet `🔇`, le libellé textuel `Mode Silence (1)` et un fond gris ardoise sombre (`#475569`). Tout utilisateur percevait ce bouton comme le contrôle du son du média et concluait que le son était coupé et grisé. De surcroît, aucun bouton direct d'activation/coupure du son du média n'était présent dans la barre supérieure ni dans le menu des options.
  - **Incompatibilité Codec Navigateur (AC3 vs Chromium) :**
    Dans les fichiers MKV multi-pistes, les premières pistes audio sont fréquemment encodées en AC3 (`ac3` 192k) et les pistes suivantes en AAC (`aac` 320k). Les navigateurs basés sur Chromium (sur Linux) ne disposent pas des décodeurs propriétaires AC3 sous licence logicielle dans leur balise `<video>` HTML5 standard. Lorsque l'API sélectionnait la première piste audio correspondant à la langue française sans vérifier le codec, Chrome recevait un flux AC3 qu'il ne pouvait pas décoder, forçant la coupure matérielle du son.
  - **Erreur de Sélecteur de Flux dans `ffprobe` (`mediaStream.ts`) :**
    La commande `ffprobe` utilisait `-select_streams 0:${audio}` au lieu de `-select_streams ${audio}`. Cette syntaxe provoquait l'erreur `Invalid stream specifier: 0:7`, empêchant la détection native du codec AAC et déclenchant un transcodage lourd de plusieurs gigaoctets qui dépassait le timeout HTTP.
* **Bonnes Pratiques de Remédiation :**
  - **Séparation Stricte du Son Média et du Microphone :**
    - Réserver exclusivement l'émoji microphone `🎙️` et des libellés sans ambiguïté (`Micro off` / `En direct`, `Microphone : Salon vocal`) pour le contrôle vocal WebRTC. Bannir formellement `🔇` et `Mode Silence` pour désigner un micro.
    - Ajouter un bouton dédié au Son du Média dans la barre supérieure `[ 🔊 Son ]` / `[ 🔇 Muet ]` avec mise en évidence visuelle bleue active (`soundActiveBtn`), ainsi qu'une entrée explicite dans le menu d'options (`PlayerMenuModal.tsx`).
  - **Priorisation Systématique des Codecs Compatibles Navigateurs Web (`mediaTracks.ts`) :**
    - Lors de la sélection automatique de la piste audio par défaut, filtrer et prioriser impérativement les codecs supportés nativement sans CPU (`aac`, `mp3`, `opus`, `vorbis`, `flac`) avant les codecs propriétaires (`ac3`, `eac3`, `dts`).
  - **Sélecteur ffprobe Conforme & Remuxing Atomique Non-Bloquant (`mediaStream.ts`) :**
    - Utiliser `-select_streams ${targetAudio}` pour sonder fidèlement le codec de la piste demandée.
    - Si le codec est AAC/MP3, exécuter un remuxing rapide en flux direct `-c:a copy` avec nom de cache temporaire et renommage atomique, protégé par une file d'attente en-vol (`inFlightRemuxes`) pour dédoublonner les requêtes HTTP Range concurrentes.

---

## 🛑 105. Erreur NullPointer dans le Débounce de Sauvegarde de Progression et Son Multimédia Muet par Défaut (`playerStore.ts`, `VideoPlayerView.tsx`)

* **Problème / Symptôme :**
  1. Lors de la fermeture du lecteur ou du changement de page, une exception surgissait en console web :
     `Web ERROR [TypeError: Cannot read properties of null (reading 'id')] Code: playerStore.ts:151:55: reportPlaybackProgress(state.activeMedia!.id, current, duration, false).catch(() => {});`
  2. Le son des médias n'était pas activé par défaut (restait muet ou sans garantie de volume à 100%), dégradant l'immersion.
* **Conséquences :**
  - Exception non interceptée polluant les logs d'exécution et brisant le signalement de progression.
  - Expérience utilisateur frustrante où l'utilisateur devait manuellement réactiver le son à chaque lancement.
* **Causes Racines :**
  - **Déréférencement imprudent après un Timer Asynchrone :** `updateProgress()` armait un délai `saveTimer = setTimeout(..., 3000)`. Si l'utilisateur fermait le lecteur ou naviguait pendant ces 3 secondes, `state.activeMedia` passait à `null` via `closeMedia()`. À l'échéance du timer, l'expression `!state.activeMedia?.isLive` s'évaluait à `!undefined === true`, et l'accès `state.activeMedia!.id` déclenchait le crash `TypeError: Cannot read properties of null (reading 'id')`. En outre, `closeMedia()` n'annulait pas `saveTimer`.
  - **Absence d'Initialisation Explicite du Son :** L'état `openMedia()` ne réinitialisait pas formellement `isMuted` à `false` et `volume` à `1`, et la balise `<video>` n'avait pas d'assignation explicite à l'initialisation.
* **Bonnes Pratiques de Remédiation :**
  - **Sanctuarisation de la Sauvegarde Asynchrone (`playerStore.ts`) :**
    - Annuler systématiquement le timer (`clearTimeout(saveTimer)`) dans `closeMedia()` et `dismissLastPlayback()`.
    - Capturer `currentMediaId` et valider rigoureusement `state.activeMedia && state.activeMedia.id === currentMediaId && !isLiveMedia` avant tout appel à `reportPlaybackProgress()`.
  - **Activation Systématique du Son par Défaut :**
    - Dans `openMedia()`, définir inconditionnellement `state.isMuted = false` et `state.volume = 1`, et synchroniser les balises vidéo (`v.muted = false; v.volume = 1`).
    - Dans `VideoPlayerView.tsx` et `FloatingBottomPlayer.tsx`, appliquer `muted={false}` / `muted={playerState.isMuted}`, volume à 100%, et armer un réveil sonore one-shot sur la première interaction utilisateur si la politique d'autoplay du navigateur restreint temporairement le son sans geste préalable.

---

## 🛑 104. Violation des Règles des Hooks React lors du Ré-agrandissement du Lecteur Vidéo (`FloatingBottomPlayer`)

* **Problème / Symptôme :** Lors du passage du mini-lecteur flottant (`#player_div`) vers le lecteur plein écran `/player/[id]` (via le bouton « ⛶ Agrandir »), l'application plante avec l'erreur :
  `Uncaught Error: Rendered fewer hooks than expected. This may be caused by an accidental early return statement. src/app/_layout.tsx (92:7) <FloatingBottomPlayer />`
* **Conséquences :**
  - Crash fatal de React et de l'interface complète de l'application lors du ré-agrandissement.
  - Impossibilité pour l'utilisateur de basculer son média du mini-lecteur vers la vue plein écran.
* **Causes Racines :**
  - **Early Returns placés avant des Hooks `useEffect` :**
    Dans `FloatingBottomPlayer.tsx`, des clauses de sortie conditionnelles (`if (isOnPlayerScreen) return null;`, `if (!activeMedia ...) return ...;`) étaient positionnées avant trois hooks `useEffect` (gestion du cycle de vie vidéo HLS/direct, synchronisation play/pause, et synchronisation volume/mute).
  - Lors de la navigation vers `/player/[id]`, `isOnPlayerScreen` devenait `true`. Le composant exécutait alors le `return null` prématuré, sautant les trois hooks `useEffect` subséquents.
  - React exige que le nombre et l'ordre des hooks appelés soient rigoureusement identiques à chaque cycle de rendu. La diminution soudaine du nombre de hooks provoquait l'exception fatale `Rendered fewer hooks than expected`.
* **Bonnes Pratiques de Remédiation :**
  - **Déclaration Inconditionnelle de Tous les Hooks au Sommet du Composant :**
    - Tous les hooks (`useState`, `useRef`, `useEffect`) doivent impérativement être déclarés au sommet de la fonction composant, sans exception.
    - Aucun `return` précoce ne doit précéder un hook.
  - **Gestion Interne des Conditions dans les Effets :**
    - Intégrer les conditions de garde (`isOnPlayerScreen`, `Platform.OS !== 'web'`, `!activeMedia?.streamUrl`, `isCasting`) directement à l'intérieur du corps des `useEffect`, avec nettoyage propre (`hlsInstance.destroy()`).
  - **Relégation des Sorties Conditionnelles (Early Returns) Juste Avant le Rendu JSX :**
    - Les vérifications de masquage (`if (isOnPlayerScreen) return null;`, etc.) ne sont exécutées qu'après que 100% des hooks et fonctions de gestion d'événements ont été enregistrés.

---

## 🛑 103. Rupture de Lecture lors de la Réduction du Lecteur Vidéo vers le Mini-Lecteur Flottant (`FloatingBottomPlayer`, `playerStore`)

* **Problème / Symptôme :** Lorsque l'utilisateur clique sur « ▼ Réduire » (ou revient à l'accueil) pendant la lecture d'une vidéo, la div du mini-lecteur flottant (`#player_div`) s'affiche bien en bas de l'écran mais le média se met en pause et refuse catégoriquement de continuer ou de démarrer lors d'un appui sur le bouton Lecture `▶`.
* **Conséquences :**
  - Rupture complète de l'expérience de lecture continue (« YouTube-style »).
  - L'utilisateur est forcé de rouvrir le grand lecteur plein écran pour entendre ou voir son média.
* **Causes Racines :**
  - **Événement `pause` provoqué par le démontage :** Lors de la navigation depuis `/player/[id]` vers `/`, le composant `VideoPlayerView` se démonte de l'arbre DOM. Le navigateur déclenche alors nativement l'événement `pause` sur la balise `<video>`, qui déclenchait `handlePause()` dans `player/[id].tsx`, écrasant `playerStore.activeMedia.isPlaying` à `false`.
  - **Absence de moteur vidéo physique dans le mini-lecteur :** `FloatingBottomPlayer` affichait uniquement une image fixe (`<Image>`) ou un glyphe `▶` dans `posterThumb`, sans aucune balise `<video>` HTML5 pour exécuter réellement le flux audio/vidéo (`activeMedia.streamUrl`).
* **Bonnes Pratiques de Remédiation :**
  - **Sanctuarisation de l'État de Lecture lors du Démontage (`player/[id].tsx`) :**
    - Introduire un indicateur `isLeavingScreenRef.current = true` lors de l'appui sur « Réduire » ou « Retour » et dans le cleanup du composant.
    - Dans `handlePause()`, n'appeler `playerStore.setPlaying(false)` que si `!isLeavingScreenRef.current`, préservant intact l'état `isPlaying: true` lors du passage de témoin vers le mini-lecteur.
    - Synchroniser la position exacte `videoRef.current.currentTime` vers `playerStore.updateProgress` immédiatement avant la navigation.
  - **Intégration d'un Moteur Vidéo Réel dans le Mini-Lecteur (`FloatingBottomPlayer.tsx`) :**
    - Intégrer une balise `<video>` réelle dans `posterThumb` (position absolue, `objectFit: 'cover'`, `data-player-div-video="true"`).
    - Prendre en charge les flux directs et les flux HLS (`hls.js`).
    - Lier les événements natifs `onPlay`, `onPause`, `onTimeUpdate` et `onEnded` pour faire progresser dynamiquement la barre de lecture, le timer et synchroniser les boutons de contrôle `Play/Pause`, `-10s`, `+30s` et barre de scrubbing.
