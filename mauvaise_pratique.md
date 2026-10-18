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
