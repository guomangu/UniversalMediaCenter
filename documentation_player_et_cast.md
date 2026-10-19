# Spécification Technique & Guide de Référence : Lecteur Vidéo (Player) et Diffusion Sans Fil (Cast)

Ce document rassemble et unifie l'ensemble des spécifications techniques, des règles d'ingénierie et des bonnes pratiques d'implémentation relatives au **Lecteur Vidéo Universel (Player)**, au **Moteur de Transcodage HLS VOD**, au **Système de Diffusion Sans Fil (Cast & Télécommande)**, à la **Synchronisation Mono-Lecture Multi-Écrans**, à la **Synchronisation Modulaire Multi-Room** et à la **Gestion des Appareils Connectés** de la plateforme **The Universal Media Stack**.

---

## Sommaire
- [1. Architecture & Fonctionnalités du Lecteur Vidéo (Player)](#1-architecture--fonctionnalités-du-lecteur-vidéo-player)
  - [1.1. Gestion des Flux & Formats](#11-gestion-des-flux--formats)
  - [1.2. Barre Supérieure Rationnelle & Modale d'Options Dédiée (`PlayerMenuModal`)](#12-barre-supérieure-rationnelle--modale-doptions-dédiée-playermenumodal)
  - [1.3. Architecture Audio & Préservation de Position lors du Changement de Piste](#13-architecture-audio--préservation-de-position-lors-du-changement-de-piste)
  - [1.4. Moteur de Sous-Titres WebVTT Universel (Mode Fenêtré & Plein Écran)](#14-moteur-de-sous-titres-webvtt-universel-mode-fenêtré--plein-écran)
  - [1.5. Barre de Progression Haute Précision & Glisser-Déplacer Tactile (Scrubbing Drag & Drop)](#15-barre-de-progression-haute-précision--glisser-déplacer-tactile-scrubbing-drag--drop)
  - [1.6. Commandes & Raccourcis Clavier / Télécommande](#16-commandes--raccourcis-clavier--télécommande)
- [2. Le Lecteur Autonome Dépliable (`player_div`) : Cœur Permanent de l'Application PWA](#2-le-lecteur-autonome-dépliable-player_div--cœur-permanent-de-lapplication-pwa)
  - [2.1. Moteur Vidéo Autonome & Hand-Off Sans Coupure](#21-moteur-vidéo-autonome--hand-off-sans-coupure)
  - [2.1.bis. Pause Automatique au Repli & Reprise Indépendante en Mode Replié](#21bis-pause-automatique-au-repli--reprise-indépendante-en-mode-replié)
  - [2.1.ter. Élimination des Pièges de Focus DOM & Conformité WAI-ARIA (Anti-Focus-Trap Sentinels)](#21ter-élimination-des-pièges-de-focus-dom--conformité-wai-aria-anti-focus-trap-sentinels)
  - [2.2. Architecture React & Conformité Stricte aux Règles des Hooks (*Rules of Hooks*)](#22-architecture-react--conformité-stricte-aux-règles-des-hooks-rules-of-hooks)
  - [2.3. Reprise de Lecture "Dernière Lecture" (Style YouTube)](#23-reprise-de-lecture-dernière-lecture-style-youtube)
  - [2.4. Fenêtres Modales Isolées (`PlayerMenuModal`, `CastModal`) & Protection Flexbox](#24-fenêtres-modales-isolées-playermenumodal-castmodal--protection-flexbox)
  - [2.5. Protection contre l'Accès Déconnecté & Déchargement Total au Logout](#25-protection-contre-laccès-déconnecté--déchargement-total-au-logout)
- [3. Diffusion Sans Fil (Cast) & Synchronisation Multi-Écrans](#3-diffusion-sans-fil-cast--synchronisation-multi-écrans)
  - [3.1. Résolution d'Adresse LAN Dynamique](#31-résolution-dadresse-lan-dynamique)
  - [3.2. Protocole de Synchronisation Bidirectionnelle Caster $\leftrightarrow$ Cible](#32-protocole-de-synchronisation-bidirectionnelle-caster--cible)
  - [3.3. Persistance & Reconnexion Automatique après Rechargement](#33-persistance--reconnexion-automatique-après-rechargement)
  - [3.4. Déconnexion Totale (*Total Disconnect*)](#34-déconnexion-totale-total-disconnect)
- [4. Moteur de Transcodage HLS VOD à la Volée & Compatibilité Universelle](#4-moteur-de-transcodage-hls-vod-à-la-volée--compatibilité-universelle)
  - [4.1. Détection Automatique des Codecs Cibles (`mediaTracks.ts`)](#41-détection-automatique-des-codecs-cibles-mediatracksts)
  - [4.2. Génération de Playlists HLS Virtuelles & Découpage Segmentaire (< 50ms)](#42-génération-de-playlists-hls-virtuelles--découpage-segmentaire--50ms)
- [5. Synchronisation de Compte Mono-Lecture & Alignement Intégral Multi-Écrans](#5-synchronisation-de-compte-mono-lecture--alignement-intégral-multi-écrans)
  - [5.1. Principe de l'Écran Miroir & Identifiant Matériel (`deviceId`)](#51-principe-de-lécran-miroir--identifiant-matériel-deviceid)
  - [5.2. Architecture Ordonnée Leader / Follower & Maintien en Étape Synchronisée (Lockstep Sync)](#52-architecture-ordonnée-leader--follower--maintien-en-étape-synchronisée-lockstep-sync)
- [6. Moteur IPTV Live : Testeur Strict & Proxy CORS/HTTPS Intégral](#6-moteur-iptv-live--testeur-strict--proxy-corshttps-intégral)
  - [6.1. Qualification Stricte des Flux TV (`streamTester.ts`)](#61-qualification-stricte-des-flux-tv-streamtesterts)
  - [6.2. Proxy Universel HLS & Neutralisation du Contenu Mixte (`liveProxyService.ts`, `/api/iptv/proxy`)](#62-proxy-universel-hls--neutralisation-du-contenu-mixte-liveproxyservicets-apiiptvproxy)
- [7. Gestion des Appareils Connectés au Compte & Déconnexion à Distance](#7-gestion-des-appareils-connectés-au-compte--déconnexion-à-distance)
  - [7.1. Registre Centralisé des Appareils (`userDeviceRegistry.ts`)](#71-registre-centralisé-des-appareils-userdeviceregistryts)
  - [7.2. Révocation de Session & Déconnexion à Distance](#72-révocation-de-session--déconnexion-à-distance)
- [8. Diffusion Flexible Multi-Écrans (Multi-Room) & Synchronisation Modulaire](#8-diffusion-flexible-multi-écrans-multi-room--synchronisation-modulaire)
  - [8.1. Matrice des Groupes de Synchronisation (`syncGroupId`)](#81-matrice-des-groupes-de-synchronisation-syncgroupid)
  - [8.2. Télécommande Universelle & Commandes Distantes (`DeviceAction`)](#82-télécommande-universelle--commandes-distantes-deviceaction)
  - [8.3. Diffusion Groupée 1-Clic (Multi-Room Broadcast)](#83-diffusion-groupée-1-clic-multi-room-broadcast)
  - [8.4. Interface Unifiée 'Diffuser & Télécommande' (`CastModal`) : Séparation Écrans Connectés / Déconnectés & Noms Réels](#84-interface-unifiée-diffuser--télécommande-castmodal--séparation-écrans-connectés--déconnectés--noms-réels)

---

## 1. Architecture & Fonctionnalités du Lecteur Vidéo (Player)

Le lecteur vidéo d'UMS est conçu pour offrir une expérience cinématographique fluide, sans saccade et ergonomique, accessible aussi bien depuis un navigateur web de bureau que sur smartphone ou téléviseur connecté.

### 1.1. Gestion des Flux & Formats
- **Support Direct HLS (`.m3u8`) & Fichiers Progressifs (`.mp4`, `.webm`) :**
  Si le navigateur client supporte nativement le format ou via la bibliothèque `hls.js`, le flux est transmis directement sans coût de transcodage serveur.
- **Transcodage Transparent à la Volée :**
  Pour les formats conteneurs complexes (`.mkv`, `.avi`, `.ts`) ou les pistes audio non prises en charge nativement (DTS, AC3, EAC3, TrueHD), le backend Hono transcode le flux à la volée vers du HLS standard (`video/mp4`, codec `avc1.640028`, audio `mp4a.40.2` AAC).

### 1.2. Barre Supérieure Rationnelle & Modale d'Options Dédiée (`PlayerMenuModal`)
- Afin d'éviter l'encombrement visuel sur petits écrans et de respecter les standards d'accessibilité, les contrôles secondaires sont regroupés dans une fenêtre modale d'options épurée.
- Boutons permanents de la barre supérieure :
  - **Retour / Fermer (✕) :** Arrête la lecture et réinitialise le lecteur.
  - **Réduire (▼) :** Replie le lecteur en barre flottante sans couper la lecture audio/vidéo.
  - **Diffuser / Cast (📡) :** Ouvre la modale de sélection de téléviseurs et d'écrans distants.
  - **Menu d'options (⚙️) :** Ouvre la modale `PlayerMenuModal` permettant de sélectionner les pistes audio, les pistes de sous-titres, la vitesse de lecture et la qualité.

### 1.3. Architecture Audio & Préservation de Position lors du Changement de Piste
- Lors de la sélection d'une piste audio alternative, la position temporelle exacte (`currentTime`) est capturée avant la commutation et restaurée immédiatement après l'accrochage du nouveau flux segmenté HLS, évitant tout retour intempestif au début de la vidéo.

### 1.4. Moteur de Sous-Titres WebVTT Universel (Mode Fenêtré & Plein Écran)
- Les sous-titres sont extraits ou convertis au format standard WebVTT (`text/vtt`).
- Ils sont injectés à la fois dans les éléments natifs `<track>` de la balise `<video>` et affichés via un overlay personnalisé synchronisé, garantissant leur lisibilité parfaite en mode plein écran natif navigateur (isolation du top-layer) et en mode fenêtré.

### 1.5. Barre de Progression Haute Précision & Glisser-Déplacer Tactile (Scrubbing Drag & Drop)
- Support complet du glisser-déplacer tactile sur smartphone et souris sur ordinateur.
- Calcul en temps réel du pourcentage et du temps ciblé avec prévisualisation des chapitres lorsque disponibles.

### 1.6. Commandes & Raccourcis Clavier / Télécommande
- `Espace` / `K` : Bascule Lecture / Pause.
- `Flèche Gauche` / `J` : Recul de 10 secondes.
- `Flèche Droite` / `L` : Avance de 10 secondes.
- `Flèche Haut` / `Flèche Bas` : Réglage du volume sonore.
- `M` : Coupure du son (Mute).
- `F` : Bascule en mode Plein Écran.

---

## 2. Le Lecteur Autonome Dépliable (`player_div`) : Cœur Permanent de l'Application PWA

### 2.1. Moteur Vidéo Autonome & Hand-Off Sans Coupure
Le lecteur vidéo persistant réside dans le composant racine `FloatingBottomPlayer` au niveau de l'orchestrateur `_layout.tsx`. Il ne subit aucun démontage lors de la navigation entre les écrans de l'application.

### 2.1.bis. Pause Automatique au Repli & Reprise Indépendante en Mode Replié
- Lors du repli du lecteur en barre flottante, le composant met la vidéo en pause douce tout en conservant son buffer et son état temporel.
- La lecture peut être reprise directement en mode replié via le bouton `▶` sans nécessiter de ré-agrandissement de l'interface.

### 2.1.ter. Élimination des Pièges de Focus DOM & Conformité WAI-ARIA (Anti-Focus-Trap Sentinels)
- Sentinelle automatique couplée à un `MutationObserver` dans `_layout.tsx` pour éliminer l'erreur WAI-ARIA `Blocked aria-hidden on an element because its descendant retained focus`.
- Libération systématique du focus (`document.activeElement?.blur()`) avant tout changement de disposition ou repli.

### 2.2. Architecture React & Conformité Stricte aux Règles des Hooks (*Rules of Hooks*)
- Tous les hooks React (`useState`, `useEffect`, `useRef`, `useCallback`) sont déclarés inconditionnellement au sommet des composants, bannissant tout retour anticipé conditionnel avant l'initialisation des hooks.

### 2.3. Reprise de Lecture "Dernière Lecture" (Style YouTube)
- Mémorisation de la progression de visionnage dans le `localStorage` et la base de données.
- Reprise automatique au point d'arrêt exact avec proposition de bouton "Reprendre à [MM:SS]".

### 2.4. Fenêtres Modales Isolées (`PlayerMenuModal`, `CastModal`) & Protection Flexbox
- Les modales sont encapsulées dans des conteneurs isolés avec z-index prioritaire (`99999`), protégeant la géométrie du lecteur sous-jacent contre tout débordement flexbox.

---


### 2.5. Protection contre l'Accès Déconnecté & Déchargement Total au Logout
- **Obligation Stricte d'Authentification :**
  L'accès au lecteur vidéo (que ce soit via la route `/player/[id]`, le bouton lecture de la fiche `/media/[id]` ou le composant persistant `FloatingBottomPlayer`) est strictement subordonné à la présence d'une session utilisateur valide (`getCurrentUser()`), sauf en présence d'un jeton de partage public explicite (`share`).
  Toute tentative de navigation vers `/player/[id]` en mode déconnecté interrompt immédiatement tout rendu et redirige de façon synchrone vers `/login?returnUrl=...`.
- **Déchargement et Destruction des Éléments DOM Vidéo & HLS au Logout :**
  Dès l'émission de l'événement système `ums_logout` (déconnexion volontaire ou révocation distante `DEVICE_REVOKED`) :
  1. `playerStore.closeMedia()` met en pause l'ensemble des balises `<video>` du DOM, purge leurs attributs `src` et invoque `.load()` pour libérer immédiatement le décodeur matériel.
  2. Les instances de transcodage `Hls.js` sont détruites (`hls.destroy()`).
  3. L'historique en mémoire `lastPlayback` est purgé (`dismissLastPlayback()`) pour éviter qu'une barre de reprise YouTube fantôme ne s'affiche à un utilisateur non authentifié.
  4. La session de Cast sans fil est coupée (`disconnectCastTotally(false)`), stoppant les requêtes de synchronisation réseau.
- **Éradication des Conflits de Reconnexion :**
  En déchargeant complètement le lecteur lors de la déconnexion, aucun socket ou flux réseau ne reste actif en arrière-plan avec l'ancien jeton révoqué. La reconnexion ultérieure s'exécute ainsi sur un état propre, sans risque de blocage ou d'écrasement.

## 3. Diffusion Sans Fil (Cast) & Synchronisation Multi-Écrans

Le système de Cast d'UMS fusionne trois technologies complémentaires pour garantir une compatibilité totale avec tous les équipements du foyer.

### 3.1. Résolution d'Adresse LAN Dynamique
Les récepteurs externes (comme le Chromecast ou une Smart TV Samsung/LG) n'ont pas accès aux noms d'hôtes internes `localhost` ou `127.0.0.1`.
- L'API `/api/cast/info` résout l'adresse IPv4 routable sur le réseau local physique (ex: `192.168.1.93`).
- La fonction `resolveLanStreamUrl()` substitue automatiquement l'hôte et adjoint un jeton de session signé cryptographiquement (`?token=...`), permettant au Chromecast de lire le flux protégé sans requérir de cookies de session.

### 3.2. Protocole de Synchronisation Bidirectionnelle Caster $\leftrightarrow$ Cible
1. **Émission d'État par la Cible (Receiver) :**
   Toutes les 5000ms, l'écran cible envoie un battement de cœur (`POST /api/cast/heartbeat`) rapportant son état réel :
   `{ currentMediaId, mediaTitle, positionSeconds, durationSeconds, isPlaying, volume, isMuted, audioTrack, subtitleTrack }`.
2. **Réception & Contrôle par le Caster :**
   Le Caster interroge périodiquement l'état de la cible (`fetchDeviceStatus(targetId)`). Sa barre de progression, son bouton lecture/pause et ses indicateurs audio/sous-titres s'alignent en temps réel sur la cible.
3. **Transmission des Commandes :**
   Toute action sur le lecteur du Caster émet immédiatement une commande ciblée :
   `PLAY`, `PAUSE`, `SEEK`, `SET_VOLUME`, `MUTE`, `UNMUTE`, `SET_AUDIO`, `SET_SUBTITLE`, `STOP`.

### 3.3. Persistance & Reconnexion Automatique après Rechargement
- L'identifiant de la cible active est sanctuarisé dans le `localStorage` sous la clé `ums_active_cast_target_id`.
- Si l'utilisateur ferme son navigateur sur son téléphone et le rouvre plus tard, l'application détecte automatiquement la session de Cast en cours et rétablit instantanément la télécommande.

### 3.4. Déconnexion Totale (*Total Disconnect*)
- **Arrêter la lecture sur la TV (`disconnectCastTotally(true)`) :** Envoie un signal `STOP` à l'écran cible et met fin à la session.
- **Déconnecter la télécommande (`disconnectCastTotally(false)`) :** Rétablit le contrôle local sans couper la diffusion TV.

---

## 4. Moteur de Transcodage HLS VOD à la Volée & Compatibilité Universelle

### 4.1. Détection Automatique des Codecs Cibles (`mediaTracks.ts`)
- Inspection des métadonnées du fichier source (codec vidéo, codec audio, conteneur).
- Sélection automatique du mode de diffusion : Direct Stream (remux direct) ou Transcode Audio (AAC) / Video (H.264).

### 4.2. Génération de Playlists HLS Virtuelles & Découpage Segmentaire (< 50ms)
- Les playlists virtuelles `.m3u8` sont générées à la volée par le serveur Hono en moins de 50ms.
- Les segments sont indexés temporellement pour permettre un saut immédiat à n'importe quel instant du film.
- **Continuité Temporelle & Éradication du Blocage à 5 Secondes :**
  - **Calibrage PTS Strict (`-output_ts_offset`, `-muxpreload 0`, `-muxdelay 0`) :** Lors de la génération à la volée de chaque segment MPEG-TS, l'horodatage de présentation (`PTS/DTS`) est strictement aligné sur la position globale (`startTime = index * 6`). Cela supprime tout saut arrière de DTS (qui bloquait le SourceBuffer du navigateur à la fin du segment 0, soit 5-6 secondes).
  - **Recherche Rapide & Précise en 2 Étapes :** Utilisation d'un pré-seek rapide (`-ss ${Math.max(0, startTime - 5)}` avant `-i`) et d'un seek précis (`-ss ${startTime > 5 ? 5 : startTime}` après `-i`), garantissant une découpe au millième de seconde près sans paquets résiduels orphelins.
  - **Conformité RFC 8216 (`#EXT-X-DISCONTINUITY`) :** Chaque segment à partir du segment 1 est précédé de la balise `#EXT-X-DISCONTINUITY` dans le manifeste `master.m3u8`, autorisant le démultiplexeur Hls.js à réinitialiser son offset de synchronisation sans rupture de flux.
  - **Préchauffage Anticipé en Tâche de Fond (Background Pre-generation) :** Dès qu'un segment `index` est sollicité par le client, le backend déclenche automatiquement la génération du segment suivant `index + 1` en arrière-plan. Lorsque le lecteur atteint la fin du segment en cours, le suivant est déjà en cache mémoire/disque (latence 0ms, zéro mise en mémoire tampon).
  - **Récupération Automatique d'Erreurs Hls.js (`FloatingBottomPlayer.tsx`) :** Interception de `bufferStalledError`, `NETWORK_ERROR` et `MEDIA_ERROR` avec relance transparente (`hls.recoverMediaError()`, `v.play()`), empêchant tout gel silencieux du lecteur.

---

## 5. Synchronisation de Compte Mono-Lecture & Alignement Intégral Multi-Écrans

### 5.1. Principe de l'Écran Miroir & Identifiant Matériel (`deviceId`)
- Chaque écran connecté au compte dispose d'un identifiant matériel unique et persistant (`deviceId`).
- Pour éviter que deux onglets d'un même navigateur se disputent le leadership, un identifiant de session d'onglet (`sessionStorage`) est adjoint : `${deviceId}_${tabId}`.

### 5.2. Architecture Ordonnée Leader / Follower & Maintien en Étape Synchronisée (Lockstep Sync)
- **Ordres Utilisateur Explicites (`orderSeq`) :** Seules les actions délibérées de l'utilisateur (Play, Pause, Seek) incrémentent le numéro d'ordre séquentiel et sont répercutées sur les suiveurs.
- **Filtrage des Événements DOM Passifs :** Les événements de lecture/pause générés par le navigateur ou les décodeurs locaux ne sont jamais retransmis comme de nouveaux ordres, éliminant tout blocage ping-pong.
- **Exclusion Souveraine de son Propre Appareil :** Un terminal ne s'auto-synchronise jamais avec un écho distant de ses propres actions.

---

## 6. Moteur IPTV Live : Testeur Strict & Proxy CORS/HTTPS Intégral

### 6.1. Qualification Stricte des Flux TV (`streamTester.ts`)
- Validation préalable de la connectivité et des codecs avant tout affichage dans la grille des chaînes.
- Détection des flux morts ou expirés avec marquage d'indisponibilité.

### 6.2. Proxy Universel HLS & Neutralisation du Contenu Mixte (`liveProxyService.ts`, `/api/iptv/proxy`)
- Tous les flux TV distants en HTTP non chiffré sont relayés par le proxy HTTPS Hono, éliminant le blocage de contenu mixte sur les navigateurs sécurisés.

---

## 7. Gestion des Appareils Connectés au Compte & Déconnexion à Distance

### 7.1. Registre Centralisé des Appareils (`userDeviceRegistry.ts`)
- Registre en mémoire côté serveur enregistrant tous les écrans connectés, leurs noms d'appareils, leurs adresses IP, leurs routes actuelles et leurs statuts en ligne/hors-ligne.

### 7.2. Révocation de Session à Usage Unique & Préservation de l'Appareil Appelant
- **Révocation Éphémère Consommable (`consumeRevocation`, `unrevokeDevice`) :**
  Lorsqu'un appareil est déconnecté à distance (via le bouton unitaire ou le bouton de masse *"Déconnecter tous les autres appareils"*), l'exclusion ne doit intervenir qu'une seule fois.
  Le middleware de contrôle d'accès (`access.ts`) et les routes de battement de cœur (`userDeviceRoutes.ts`) rejettent la requête avec un code HTTP 401 `DEVICE_REVOKED` et consomment immédiatement la révocation (`consumeRevocation`).
  Lors de la prochaine connexion réussie sur cet appareil (`/api/auth/login`), l'identifiant matériel est explicitement retiré de la liste de révocation (`unrevokeDevice`), empêchant toute boucle infinie de rejet.
- **Protection de l'Appareil Appelant (`isMatchingDevice`) :**
  Dans une architecture où les onglets d'un même navigateur peuvent adjoindre un suffixe d'instance (`_tab_xxx`), la comparaison d'identité matérielle pour l'exclusion de masse analyse la racine commune du `deviceId`. L'appareil ayant émis la commande de déconnexion de tous les autres écrans n'est ainsi jamais révoqué par inadvertance.


---

## 8. Diffusion Flexible Multi-Écrans (Multi-Room) & Synchronisation Modulaire

### 8.1. Matrice des Groupes de Synchronisation (`syncGroupId`) & Mode Manuel par Défaut
1. **Mode Indépendant Manuel par Défaut (`syncGroupId = 'standalone'`) :**
   Par défaut, tout appareil démarre en mode indépendant afin de ne pas perturber les autres écrans du foyer. Aucune synchronisation automatique n'est imposée sans action délibérée de l'utilisateur.
2. **Mode Synchronisé Volontaire (`syncGroupId = 'default'` ou personnalisé) :**
   Tous les appareils ayant explicitement rejoint le groupe de synchronisation via le menu Cast lisent le flux en miroir parfait selon le modèle événementiel souverain.

### 8.2. Télécommande Universelle & Commandes Distantes (`DeviceAction`)
- Contrôle complet à distance de n'importe quel écran du foyer (Play, Pause, Seek, Volume, Navigation).

### 8.3. Diffusion Groupée 1-Clic (Multi-Room Broadcast)
- Lancement simultané d'un média sur une sélection d'écrans en un seul clic.

### 8.4. Interface Unifiée 'Diffuser & Télécommande' (`CastModal`) : Les 5 Actions par Appareil & Curseur Souris Natif
- **Les 5 Boutons d'Action Dédiés par Appareil :**
  Pour chaque appareil présent dans la modale, l'interface met à disposition 5 actions ergonomiques directes avec wrap responsive :
  1. **`🔴 Déconnecter` :** Révoque la session de l'appareil distant ou coupe la diffusion Cast sur la TV.
  2. **`🔄 Synchroniser` :** Aligne l'appareil cible et l'appareil local sur le groupe de diffusion `'default'`, avec transfert du média en cours.
  3. **`📡 Caster` :** Projette le média actuellement en lecture sur l'écran cible et transforme l'appareil local en télécommande active.
  4. **`👀 Suivre` :** Ouvre localement sur l'appareil utilisateur le flux vidéo que l'écran distant est en train de lire, synchronisé à la seconde exacte.
  5. **`🎮 Connecter` :** Établit une liaison de télécommande avec l'écran cible sans interrompre ni altérer sa lecture en cours.
- **Réactivité Native Souris & Curseur `pointer` :**
  - Remplacement des calques transparents frères superposés par une détection directe sur l'overlay (`e.target === e.currentTarget && onClose()`), éliminant tout blocage du curseur de souris en style `default`.
  - Application systématique de `cursor: 'pointer'`, `userSelect: 'none'` et `pointerEvents="none"` sur les libellés internes, garantissant un clic instantané sans perte d'événement.

- **Partitionnement Visuel Strict :**
  - **🟢 Mes écrans connectés :** Regroupe tous les écrans du compte actuellement en ligne et en synchronisation active (`syncGroupId !== 'standalone'`), ainsi que les récepteurs Cast/TV actifs diffusant un média. Chaque écran dispose d'un bouton direct **`[Déconnecter]`**, permettant de dissocier instantanément l'appareil du groupe de synchronisation ou de couper la session de cast sans quitter la modale.
  - **⚪ Mes écrans déconnectés :** Regroupe les écrans en mode indépendant (`syncGroupId = 'standalone'`), les écrans hors-ligne, ainsi que les téléviseurs et récepteurs Cast disponibles sur le réseau local en attente de diffusion. Chaque écran dispose d'un bouton **`[Synchroniser]`** (ou `[Connecter]`) et d'un bouton `[Diffuser]`.
- **Intégration Transparente de la Télévision Locale :**
  - Suppression du bouton isolé et redondant *"Caster sur ma Télévision"*. Les cibles Cast (Chromecast, Android TV, Smart TV, Apple AirPlay) sont désormais pleinement intégrées dans les listes selon leur statut réel :
    - En statut inactif / en veille $\rightarrow$ présentées dans *"Mes écrans déconnectés"* avec actions `[Diffuser]` et `[Connecter]`.
    - En statut actif / en cours de diffusion $\rightarrow$ intégrées dans *"Mes écrans connectés"* avec action directe `[Déconnecter]`.
- **Affichage des Noms Réels et Complets des Appareils :**
  - Élimination des libellés génériques (*"Navigateur Web"*, *"Linux"*, *"Appareil Connecté"*).
  - Détection automatique et affichage du vrai nom du matériel et du navigateur via `getRealDeviceDisplayName` et `parseRealDeviceName` côté backend (ex: `Google Chrome (Linux)`, `Apple Safari (iPhone)`, `Samsung Smart TV (Tizen)`, `LG Smart TV (webOS)`, `Chromecast Salon`, etc.).

### 8.5. Résolution des Doublons d'Appareils, Contrôle de Désynchronisation Locale & Isolation Z-Index des Modales
- **Éradication des Doublons Inter-Registres :**
  - Fusion et déduplication rigoureuse entre `fetchUserDevices()` (appareils du compte) et `fetchCastDevices()` (récepteurs Cast découverts sur le LAN).
  - Tout terminal déjà répertorié dans les appareils du compte est automatiquement masqué de la liste des récepteurs Cast pour éviter qu'il n'apparaisse deux fois.
  - L'appareil local actuel est strictement exclu des listes d'écrans distants (`isThisDevice`), éliminant l'apparition redondante de son propre terminal.
  - Si une télévision ou un Chromecast est déjà découvert sur le réseau local avec son vrai nom, l'entrée générique "Télévision / Google Cast" est neutralisée.
- **Désynchronisation Souveraine de l'Appareil Local (`localBox`) :**
  - Le bloc "Cet appareil" affiche désormais le statut de synchronisation en temps réel (`🟢 Synchronisé` vs `⚪ Mode indépendant`).
  - Un bouton direct `[Désynchroniser]` / `[Synchroniser]` permet à l'utilisateur de détacher ou de rattacher son propre écran au groupe de synchronisation en un seul clic sans navigation, avec persistance dans `localStorage` (`setLocalSyncGroupId`) et notification au serveur (`setDeviceSyncGroup`).
- **File de Commandes pour la Désynchronisation Distante :**
  - L'appel `setSyncGroup` côté serveur empile désormais une commande `SET_SYNC_GROUP` à destination de l'appareil cible. Dès son prochain battement de cœur, le terminal distant reçoit l'ordre et bascule son mode local en `standalone`, rendant la désynchronisation pérenne.
- **Assainissement du Contexte d'Empilement CSS (Z-Index & Backdrop Trap) :**
  - Le conteneur modal (`styles.modal`) dispose impérativement de `position: 'relative'` et `zIndex: 10`, le plaçant de manière inviolable au-dessus du fond d'écran transparent (`StyleSheet.absoluteFill` à `zIndex: 1`).
  - L'overlay global (`styles.overlay`) est positionné à `zIndex: 999999` (strictement au-dessus des 99999 du conteneur lecteur plein écran).
  - Tous les boutons interactifs intègrent des écouteurs natifs web `onClick` avec `e.stopPropagation()` et `pointerEvents: 'none'` sur les libellés textuels, éliminant tout blocage de curseur ou interception intempestive par le PanResponder.

### 8.6. Résolution de la Continuité Temporelle du Cast, Déblocage du Multi-Room et Réactivité Haute-Fréquence (2s)
- **Éradication du Snapping à 0s sur le Scrubber en Mode Synchronisé :**
  - **Diagnostic :** En mode synchronisé (`syncGroupId = 'default'`), lorsqu'un seul appareil était présent ou que l'identifiant de l'onglet (`deviceId_tab_xxx`) était comparé à l'identifiant matériel de base (`deviceId`), le serveur rejetait les rapports de progression passifs en considérant l'émetteur comme un 'suiveur', puis renvoyait un groupe de lecture reconstruit avec `positionSeconds = 0`. Côté client, l'absence de vérification sur la racine matérielle (`split('_tab_')[0]`) déclenchait `applyRemoteOrder` et réinitialisait la barre de lecture à 0s.
  - **Solution :** Normalisation universelle via `isMatchingDevice` sur les deux tiers (front-end et back-end). L'appareil actif est reconnu souverainement comme leader de son propre flux. Le polling `GET /sync` ignore son propre terminal matériel si aucun autre appareil n'est actif dans le groupe.
  - **Période de Grâce Utilisateur (User Action Grace Period) :** Toute interaction tactile ou glisser-déplacer sur le scrubber déclenche une fenêtre d'immunité de 4 000 ms (`isWithinUserGracePeriod(4000)`) interdisant strictement à tout paquet réseau distant d'écraser la position temporelle choisie par l'utilisateur.

- **Reprise Exacte du Timestamp lors du Cast & de la Synchronisation :**
  - **Extraction Temps Réel (`getLivePosition`) :** Lors du clic sur 'Caster', 'Synchroniser' ou le Cast natif (Google Cast / AirPlay), la position exacte est extraite directement du tag `<video>` sous-jacent (`v.currentTime`) ou du store (`playerStore.getState().activeMedia.positionSeconds`).
  - **Transmission et Injection Immédiate :** Le payload `LOAD_MEDIA` et la requête Cast transmettent `positionSeconds: livePos`. Le récepteur exécute immédiatement `playerStore.openMedia` avec `initialTime: livePos` et `playerStore.seekTo(livePos)` sans repartir du début.

- **Déblocage Définitif de la Lecture en Modes Cast & Synchroniser :**
  - **Découplage de la Télécommande Cast (`activeCastTarget`) vs Synchronisation Écrans :**
    - En mode **Synchroniser** (`handleSyncAccountDevice`), les deux écrans sont des diffuseurs vidéo pairs : `activeCastTarget` n'est **JAMAIS** activé sur l'appareil local. La balise vidéo et le lecteur HLS continuent de tourner simultanément sur tous les écrans du groupe sans coupure ni écran d'attente.
    - En mode **Caster** (`handleCastToAccountDevice`), l'appareil local bascule en télécommande active, et la commande `LOAD_MEDIA` est relayée à l'écran cible qui charge le flux et lance la lecture instantanément.
  - **Surmontement des Politiques d'Autoplay Navigateur (`NotAllowedError`) :**
    - Dans Hook 3 et dans le gestionnaire de commandes distantes `executeRemoteCommand`, tout rejet `NotAllowedError` sur `v.play()` bascule automatiquement la balise en sourdine (`v.muted = true`) et relance la lecture immédiatement, en affichant la bannière unifiée *'Son désactivé — Appuyez pour activer'* pour respecter les contraintes des navigateurs modernes sans jamais bloquer le flux vidéo.

- **Réactivité Haute-Fréquence & Dispatcheur Universel de Commandes :**
  - Réduction de l'intervalle de détection de synchronisation réseau de 10s à **2s** (`syncTimer = setInterval(checkRemoteChanges, 2000)`).
  - Dans `sendCastCommand`, dispatch bivalent simultané vers `/api/cast/command` (Chromecast / Smart TV) et `/api/user/devices/command` (Appareils connectés au compte), assurant un contrôle réactif et instantané des boutons Play, Pause, Avance/Recul et Volume sur tous les types d'écrans.
