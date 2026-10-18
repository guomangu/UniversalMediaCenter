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
