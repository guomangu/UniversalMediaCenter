# Spécification Technique & Guide de Référence : Lecteur Vidéo (Player) et Diffusion Sans Fil (Cast)

> **The Universal Media Stack (UMS)** — Plateforme Coolove  
> Document d'architecture de référence : Lecteur Multimédia Universel, Mini-Lecteur Flottant (`player_div`), et Moteur de Cast Synchronisé Multi-Écrans.

---

## 1. Architecture & Fonctionnalités du Lecteur Vidéo (Player)

Le lecteur vidéo d'UMS est conçu pour offrir une expérience de lecture fluide, instantanée et résiliente sur tous les types d'écrans (smartphones, tablettes, ordinateurs de bureau, Smart TVs) sans nécessiter d'application native lourde ni de configuration manuelle.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LECTEUR MULTIMÉDIA UMS                             │
├───────────────────────────────┬─────────────────────────────────────────────┤
│      Moteur Vidéo HTML5       │  • Balise <video> native cross-browser      │
│       & HLS.js Universel      │  • Fond noir pur (#000000) cinéma immersif  │
│                               │  • Buffer anti-décrochage & auto-recovery   │
├───────────────────────────────┼─────────────────────────────────────────────┤
│     Pistes Audio & Langues    │  • Multi-audio avec extraction à la volée   │
│                               │  • Mémorisation temporelle continue         │
│                               │  • Reprise exacte à la seconde sur switch   │
├───────────────────────────────┼─────────────────────────────────────────────┤
│   Sous-titres Multi-Sources   │  • Parser WebVTT JavaScript direct client   │
│                               │  • Zéro conflit balise native <track>       │
│                               │  • Zéro dédoublement, affichage instantané  │
├───────────────────────────────┼─────────────────────────────────────────────┤
│  Barre Supérieure Épurée      │  • [← Retour] [▼ Réduire]                   │
│                               │  • Titre centré sur 1 ligne                 │
│                               │  • [⛶ Plein écran] [⚙️ Menu]                │
├───────────────────────────────┼─────────────────────────────────────────────┤
│  Contrôle Parental & Sécurité │  • Double barrière PBAC / ABAC étanche      │
│                               │  • Écran de garde "Contenu Bloqué"          │
│                               │  • Zéro fuite de métadonnées confidentielles│
└───────────────────────────────┴─────────────────────────────────────────────┘
```

### 1.1. Gestion des Flux & Formats
- **Lecture VOD Locale / Réseau :** Prise en charge des conteneurs MKV, MP4, WebM, AVI, MOV et TS avec requêtes HTTP par plages d'octets (`Range: bytes=start-end`) assurant un démarrage instantané et un saut fluide dans la vidéo (*Zero-CPU streaming*).
- **Fond Noir Pur (#000000) :** L'intégralité du conteneur du lecteur, de l'élément `<video>` et des écrans d'état adopte une couleur de fond noir absolu `#000000` sans marge latérale ni bordures claires résiduelles, assurant une parfaite intégration esthétique dans le noir complet.
- **Flux IPTV en Direct :** Prise en charge des flux HLS (`.m3u8`) et proxification de flux distants via Hono et HLS.js avec gestion des erreurs réseau et récupération automatique de buffer (`bufferStalledError`).
- **Détection des Fichiers Incomplets ou Corrompus :**  
  Vérification de l'intégrité de l'en-tête du fichier (signature EBML `1a45dfa3` pour MKV, `ftyp` pour MP4, détection des zéros purs de pré-allocation BitTorrent). En cas de fichier inachevé, le serveur renvoie HTTP 422 (`CORRUPTED_FILE`) et le lecteur affiche un écran d'information clair et sécurisé :
  `⚠️ Fichier Incomplet ou Corrompu - Le téléchargement de ce fichier n'a pas été achevé sur le disque source`.
- **Politique Zéro 404 sur les Affiches (Artworks) :**  
  L'endpoint `/api/media/:id/poster` et ses variantes (`/thumb`, `/fanart`) appliquent une chaîne de fallback récursive (affiche directe $\rightarrow$ vignette $\rightarrow$ fanart $\rightarrow$ parent $\rightarrow$ enfants). Si aucune image physique n'existe, le serveur génère dynamiquement un poster vectoriel SVG élégant aux dimensions cinéma avec dégradé sombre et le titre du média. **Aucune erreur HTTP 404 n'est émise pour les médias existants**.

### 1.2. Barre Supérieure Rationnelle & Modale d'Options Dédiée (`PlayerMenuModal`)
- **Éradication de l'Encombrement Visuel :**  
  La barre supérieure flottante ne contient plus de barre de défilement horizontal de 7 boutons. Elle est rationalisée en 3 zones distinctes et lisibles sur tout écran :
  - **Zone Gauche :** Boutons d'action immédiate `[ ← Retour ]` et `[ ▼ Réduire ]`.
  - **Zone Centrale :** Titre du contenu en cours (`mediaTitle`) centré, tronqué proprement en cas de dépassement.
  - **Zone Droite :** Bouton `[ ⛶ ]` (Plein écran) et bouton `[ ⚙️ Menu ]`.
- **Suppression du Bouton Son Redondant :**  
  Le bouton `Son` de la barre supérieure a été retiré, le lecteur HTML5 intégrant déjà la barre de volume et le contrôle muet natif.
- **Centralisation dans `PlayerMenuModal` :**  
  Toutes les fonctionnalités secondaires sont regroupées dans la boîte de dialogue d'options :
  - 🔊 **Pistes Audio :** Choix de la langue sonore avec badge de la sélection active.
  - 💬 **Sous-titres :** Choix de la langue ou désactivation avec badge d'état.
  - 📡 **Diffuser (Cast) :** Appairage d'écran distant Google Cast, AirPlay ou UMS.
  - 🎙️ **Salon Vocal :** Micro WebRTC et nombre de spectateurs connectés.
  - 🔗 **Partager :** Lien direct ou session Watch Party.
  - ✍️ **Avis & Repost :** Notation, critique et partage d'activité.
  - ⛶ **Plein écran :** Bascule en mode immersif sans bordure.

### 1.3. Architecture Audio & Préservation de Position lors du Changement de Piste
- **Continuité de Lecture sans Perte de Position :**  
  Lorsqu'un utilisateur sélectionne une nouvelle piste audio dans `PlayerAudioModal`, l'URL de flux `streamUrl` est régénérée avec le paramètre `?audio=<index>`.
  - `VideoPlayerView.tsx` maintient une référence temps réel de la position de lecture (`lastTimeRef.current`).
  - Au moment du changement de `streamUrl`, `pendingAudioSeekRef.current` mémorise la position exacte.
  - Dès le déclenchement de l'événement `onCanPlay`, la vidéo se repositionne instantanément (`v.currentTime = pendingAudioSeekRef.current`) et relance la lecture automatiquement. L'utilisateur ne subit aucune remise à zéro du média.
- **Priorisation des Codecs Compatibles Navigateurs Web (Chromium / Linux) :**  
  Dans les fichiers MKV multi-pistes, l'API `/api/media/:id/tracks` filtre et privilégie systématiquement les codecs pris en charge nativement (`aac`, `mp3`, `opus`, `vorbis`, `flac`) pour la langue préférée configurée (`fra`).
  - L'endpoint `/api/media/:id/stream` sonde la piste sélectionnée avec `ffprobe` (`-select_streams <index>`). Si la piste est déjà compatible (AAC/MP3), un remuxing instantané sans perte `-c:a copy` est produit et servi avec support complet des requêtes `Range: bytes=start-end`. Si la piste est incompatible (AC3/DTS), un transcodage vers AAC stéréo 192k est déclenché de manière protégée et atomique.

### 1.4. Moteur de Sous-Titres WebVTT Universel (Mode Fenêtré & Plein Écran)
- **Architecture Native HTML5 & Résolution du Top-Layer Plein Écran :**  
  En mode plein écran natif (déclenché par le bouton plein écran des contrôles `<video>` ou double-clic), les navigateurs isolent l'élément `<video>` dans une couche supérieure (*top-layer* du compositeur GPU) et masquent tous les overlays HTML/React frères.  
  - Pour garantir un affichage irréprochable en plein écran comme en mode fenêtré, le lecteur utilise la balise native `<track key={subtitleUrl} kind="subtitles" src={subtitleUrl} default>` embarquée au cœur de la balise `<video>`.
  - **Synchronisation Dynamique des Pistes (TextTracks) :** Un effet d'écoute (`v.textTracks`, événements `addtrack` et `change`) force automatiquement `mode = 'showing'` dès qu'une piste est sélectionnée, et `mode = 'disabled'` si l'utilisateur choisit "Désactivé".
  - **Zéro Dédoublement :** L'overlay React tiers est supprimé, garantissant une source unique de rendu pour éliminer tout conflit ou duplication de sous-titres.
  - **Stylisation Universelle via `::cue` (`global.css`) :** Définition centralisée d'un style haute visibilité (`video::cue`) avec arrière-plan sombre translucide `rgba(0, 0, 0, 0.82)`, typographie moderne, ombre portée nette (`text-shadow`) et padding ajusté, s'adaptant automatiquement au ratio de l'image sans collision avec la barre de progression.
- **Extraction Accélérée Côté Backend (`mediaSubtitles.ts`) :**  
  - Commande ffmpeg optimisée avec `-nostdin -vn -an` (ignorant totalement les flux vidéo et audio lourds).
  - Timeout étendu à 20 secondes.
  - Mise en cache mémoire RAM (`subtitleCache`) pour un temps de réponse de 0 ms dès le deuxième appel.

### 1.5. Commandes & Raccourcis Clavier / Télécommande
- **Espace / MediaPlayPause :** Bascule Lecture / Pause.
- **Flèches Gauche / Droite :** Recul rapide de -10 secondes / Avance de +10 secondes (ou +30 secondes).
- **Touche 'S' :** Saut direct du générique d'introduction (*Skip Intro*).
- **Touche 'F' / Plein Écran :** Bascule en mode Plein Écran immersif sans barre d'adresse.

---

## 2. Le Mini-Lecteur Flottant Persistant (`player_div`)

Afin d'offrir une continuité de lecture analogue à l'expérience YouTube, le lecteur ne s'arrête pas lorsque l'utilisateur quitte la page `/player`. Un conteneur flottant persistant portant l'identifiant strict `player_div` est arrimé en permanence au bas de l'écran sur toutes les pages de l'application.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MINI-LECTEUR "player_div"                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Barre de progression interactive : clic pour naviguer dans le média]      │
├─────────┬──────────────────────┬────────────────────────┬───────────────────┤
│ [Vidéo] │ Titre du média       │  [ -10s ]  [ ▶ / ⏸ ]   │ 💬 ST : FR        │
│ [58x40] │ 04:12 / 48:30        │        [ +30s ]        │ 🔊 Audio : FR     │
│         │                      │                        │ 📡 Cast : Salon   │
│         │                      │                        │ ⛶ Agrandir  ✕     │
└─────────┴──────────────────────┴────────────────────────┴───────────────────┘
```

### 2.1. Moteur Vidéo Autonome & Hand-Off Sans Coupure
1. **Moteur Multimédia Dédié dans la Miniature :**  
   Contrairement à une simple vignette statique, `FloatingBottomPlayer` embarque sa propre balise `<video>` HTML5 réelle (format 58x40, `objectFit: 'cover'`) directement dans le conteneur `posterThumb`.  
   - Pour les flux VOD directs (MP4, MKV, WebM), la balise lit nativement le flux `streamUrl`.
   - Pour les flux IPTV en direct (`.m3u8`), une instance légère de `Hls.js` est instanciée avec gestion des workers et faible latence.
   - La vidéo tourne en direct pendant que l'utilisateur navigue dans les menus, explore les fiches de films ou consulte les forums.
2. **Sanctuarisation du Passage de Témoin (Hand-off) :**  
   Lors du démontage de la vue plein écran `/player/[id]`, le navigateur déclenche par défaut un événement `pause` natif sur la balise vidéo unmountée.  
   - Un booléen de contrôle `isLeavingScreenRef.current = true` inhibe tout écrasement prématuré de `isPlaying = false` dans `playerStore`.
   - La position de lecture courante est instantanément injectée dans le store pour que le mini-lecteur reprenne exactement à la bonne seconde sans à-coup.
3. **Contrôles Complets & Scrubbing :**
   - **Barre de Scrubbing Cliquable :** Clic direct pour sauter à n'importe quel instant du média.
   - **Saut Rapide (-10s / +30s) :** Recul ou avance immédiate via `handleSeekRelative`.
   - **Play / Pause :** Bascule réactive locale ou distante sur la cible Cast.
   - **Sélecteurs Modaux Intégrés :** Accès direct à `PlayerSubtitleModal`, `PlayerAudioModal` et `CastModal`.
   - **Agrandir (Expand) :** Clic sur la vidéo, le titre ou « ⛶ Agrandir » pour retourner en plein écran sur `/player/[id]` en passant le paramètre `joinTime` pour une reprise immédiate.
   - **Fermer (Close) :** Arrêt propre du flux vidéo, destruction de l'instance HLS, déconnexion Cast et bascule vers la bannière de reprise.

### 2.2. Architecture React & Conformité Stricte aux Règles des Hooks (*Rules of Hooks*)
Pour garantir une stabilité absolue lors du ré-agrandissement vers `/player/[id]` :
- **Aucun Retour Prématuré Avant les Hooks :**  
  Tous les hooks React (`useState`, `useRef`, `useEffect`) sont impérativement positionnés au sommet du composant `FloatingBottomPlayer.tsx`. Aucune condition `if (isOnPlayerScreen) return null;` ou `if (!activeMedia) return null;` n'est autorisée avant la fin de l'enregistrement des hooks.
- **Gardes Internes dans les Effets :**  
  Les conditions de désactivation (`isOnPlayerScreen`, `Platform.OS !== 'web'`, `isCasting`) sont évaluées exclusivement **à l'intérieur** du corps des `useEffect`, assurant ainsi que le nombre de hooks exécutés demeure strictement constant (zéro erreur `Rendered fewer hooks than expected`).
- **Sorties Conditionnelles (Early Returns) Déplacées au Seuil du JSX :**  
  Les retours conditionnels (`null`, bannière de reprise, ou lecteur complet) sont exécutés uniquement après que 100% des hooks et callbacks d'événements ont été enregistrés.

### 2.3. Reprise de Lecture "Dernière Lecture" (Style YouTube)
Lorsque aucun média n'est activement en cours de lecture, mais qu'une session récente existe dans le stockage local (`ums_last_playback`), `player_div` affiche une bannière discrète :
`Reprendre : [Titre du film] (Position : MM:SS)` avec deux actions :
- **▶ Reprendre :** Relance instantanément le visionnage au point exact d'interruption via `/player/[id]?joinTime=...`.
- **✕ Ignorer :** Masque la bannière et libère l'espace visuel.

### 2.4. Fenêtres Modales Isolées (`PlayerMenuModal`, `CastModal`) & Protection Flexbox
Pour éviter que les fenêtres d'options du lecteur ne soient tronquées, cachées ou décentrées :
- **Portail Racine `<Modal>` :** Les fenêtres modales sont téléportées au sommet du document DOM (`document.body`) via le composant natif `<Modal visible animationType="fade" transparent>`.
- **Centrage Absolu Inviolable :** Utilisation d'un overlay fixe (`position: 'fixed'`, top/bottom/left/right: 0) avec `justifyContent: 'center'`, `alignItems: 'center'`, et pour la carte modale : `margin: 'auto'`, `alignSelf: 'center'`.
- **Protection Anti-Débordement Vertical :** Définition stricte d'un plafond de hauteur adaptatif (`maxHeight: 'min(86vh, 560px)'`) et encapsulation du contenu dans un `ScrollView` avec `flexShrink: 1`, garantissant l'accès à tous les boutons même sur petits écrans tactiles.

---

## 3. Diffusion Sans Fil (Cast) & Synchronisation Multi-Écrans

Le système de Cast d'UMS fusionne trois technologies complémentaires pour garantir une compatibilité totale avec tous les équipements du foyer.

```
                               ┌────────────────────────────────┐
                               │   UMS Caster (Navigateur PWA)  │
                               └──────────────┬─────────────────┘
                                              │
              ┌───────────────────────────────┼───────────────────────────────┐
              │                               │                               │
              ▼                               ▼                               ▼
   ┌────────────────────┐          ┌────────────────────┐          ┌────────────────────┐
   │  Google Cast SDK   │          │ HTML5 Remote /     │          │ Passerelle UMS     │
   │  (Chromecast, TV)  │          │ Apple AirPlay      │          │ (Écrans Web, TV)   │
   └────────────────────┘          └────────────────────┘          └──────────┬─────────┘
                                                                             │
                                                                             │
                                                                             ▼
                                                                   ┌────────────────────┐
                                                                   │ UMS Receiver       │
                                                                   │ (Smart TV / PWA)   │
                                                                   └────────────────────┘
```

### 3.1. Résolution d'Adresse LAN Dynamique
Les récepteurs externes (comme le Chromecast ou une Smart TV Samsung/LG) n'ont pas accès aux noms d'hôtes internes `localhost` ou `127.0.0.1`.
- L'API `/api/cast/info` résout l'adresse IPv4 routable sur le réseau local physique (ex: `192.168.1.93`).
- La fonction `resolveLanStreamUrl()` substitue automatiquement l'hôte et adjoint un jeton de session signé cryptographiquement (`?token=...`), permettant au Chromecast de lire le flux protégé sans requérir de cookies de session.

### 3.2. Protocole de Synchronisation Bidirectionnelle Caster $\leftrightarrow$ Cible
1. **Émission d'État par la Cible (Receiver) :**
   Toutes les 5000ms (avec mémorisation de l'état par référence `isPlayingRef`), l'écran cible envoie un battement de cœur (`POST /api/cast/heartbeat`) rapportant son état réel :
   `{ currentMediaId, mediaTitle, positionSeconds, durationSeconds, isPlaying, volume, isMuted, audioTrack, subtitleTrack }`.
2. **Réception & Contrôle par le Caster :**
   Le Caster interroge périodiquement l'état de la cible (`fetchDeviceStatus(targetId)`). Sa barre de progression, son bouton lecture/pause et ses indicateurs audio/sous-titres s'alignent en temps réel sur la cible.
3. **Transmission des Commandes :**
   Toute action sur le lecteur du Caster émet immédiatement une commande ciblée :
   - `PLAY` / `PAUSE`
   - `SEEK` (`positionSeconds`)
   - `SET_VOLUME` (`volume`)
   - `MUTE` / `UNMUTE`
   - `SET_AUDIO` (`audio`)
   - `SET_SUBTITLE` (`subtitle`)
   - `STOP` (interruption de la lecture)

### 3.3. Persistance & Reconnexion Automatique après Rechargement
- L'identifiant de la cible active est sanctuarisé dans le `localStorage` sous la clé `ums_active_cast_target_id`.
- **Comportement après fermeture de l'onglet :**  
  Si l'utilisateur ferme son navigateur sur son téléphone portable et le rouvre 15 minutes plus tard, l'application détecte automatiquement la session de Cast en cours, interroge l'état actuel de la TV et rétablit instantanément la télécommande synchronisée dans `player_div` sans aucune reconfiguration.

### 3.4. Déconnexion Totale (*Total Disconnect*)
Pour mettre un terme propre à la diffusion, deux actions distinctes sont proposées :
1. **Arrêter la lecture sur la TV (`disconnectCastTotally(true)`) :**
   Envoie un signal `STOP` à l'écran cible qui quitte le lecteur pour revenir à la page d'accueil UMS, met fin à la session Google Cast SDK, et purge le stockage local du Caster.
2. **Déconnecter la télécommande (`disconnectCastTotally(false)`) :**
   Rétablit le contrôle local sans perturber la diffusion en cours sur le téléviseur.

---

## 4. Moteur de Transcodage HLS VOD à la Volée & Compatibilité Universelle

Certains formats et codecs vidéo/audio de pointe ou anciens ne peuvent pas être décodés nativement par le moteur HTML5 standard des navigateurs web (particulièrement sous Linux / Chromium) :
- **Audio DTS / DTS-HD MA** (ex: *Ratatouille* `2007.Ratatouille.1920x802.BDRip.x264.DTS-HD.MA.mkv`) : blocage ou silence complet sous navigateur.
- **Vidéo HEVC / H.265 10-bit** (ex: *Goldfinger* `1964 goldfinger multi 1080p bluray x265 ac3-dam.mkv`) : rejet navigateur avec `MEDIA_ELEMENT_ERROR: Format error`.
- **Conteneurs AVI / MPEG-4 Part 2** (ex: *Ratatouille* `N° 090 - 2007 Walt Disney - Ratatouille.avi`) : conteneur non pris en charge par la balise `<video>`.

### 4.1. Détection Automatique des Codecs Cibles (`mediaTracks.ts`)
L'API inspecte les flux du conteneur via `ffprobe` et qualifie automatiquement l'éligibilité native :
- **Codecs vidéo natifs :** `h264`, `av1`, `vp8`, `vp9`. Tout autre codec (`hevc`/`h265`, `mpeg4`, `msmpeg4v3`) active le flag `requiresHls = true`.
- **Codecs audio natifs :** `aac`, `mp3`, `opus`, `vorbis`, `flac`. Tout codec haute définition ou incompatible (`dts`, `dca`, `ac3`, `eac3`, `truehd`) active `requiresHls = true`.
- **Conteneur :** Les extensions `.avi` forcent également `requiresHls = true`.

### 4.2. Génération de Playlists HLS Virtuelles & Découpage Segmentaire (< 50ms)
Contrairement aux remuxers monolithiques qui bloquaient les requêtes HTTP pendant 45 à 60 secondes pour réécrire l'intégralité du fichier sur disque :
1. **Manifeste Virtuel `master.m3u8` :** Généré en mémoire en moins de 15 millisecondes, découpant virtuellement le média en segments MPEG-TS de 6,0 secondes.
2. **Transcodage Atomique par Segment `segment_:index.ts` :**  
   - Lorsque la vidéo est déjà H.264 (comme *Ratatouille*), ffmpeg applique `-c:v copy` et ne transcode que l'audio en AAC stéréo. Le segment de 6 secondes est produit en **moins de 50 ms**.
   - Lorsque la vidéo est HEVC ou MPEG-4 (comme *Goldfinger*), ffmpeg transcode le segment à la volée via `-c:v libx264 -preset ultrafast -crf 22 -c:a aac`.
3. **Mise en Cache Rapide des Chunks :** Les segments générés sont conservés dans `/tmp/ums_cache/segments/` pour une réactivité instantanée lors des retours en arrière ou lors de visionnages partagés.
4. **Redirection Transparente :** L'endpoint standard `GET /api/media/:id/stream` redirige avec HTTP 307 vers la playlist HLS dès qu'un transcodage est requis, garantissant une compatibilité totale et immédiate.

---

## 5. Synchronisation de Compte Mono-Lecture & Alignement Intégral Multi-Écrans

Conformément à la spécification, un compte utilisateur est restreint à **une seule lecture active à la fois** et tous les écrans connectés au même profil partagent une synchronisation en temps réel absolue.

### 5.1. Principe de l'Écran Miroir & Identifiant Matériel (`deviceId`)
- Chaque instance de navigateur ou PWA génère et conserve un identifiant d'appareil unique dans `localStorage` (`ums_account_device_id`).
- L'état de lecture actif du compte est synchronisé en mémoire backend sous l'entité :
  ```typescript
  interface AccountPlaybackState {
    userId: string;
    deviceId: string;
    mediaId: string;
    mediaTitle: string;
    positionSeconds: number;
    durationSeconds: number;
    isPlaying: boolean;
    activeAudio: string;
    activeSubtitle: string;
    isCastActive: boolean;
    castTargetId?: string;
    updatedAt: number;
  }
  ```

### 5.2. Maintien en Étape Synchronisée (Lockstep Sync)
- **Signalisation Ascendante (Toutes les 1200ms) :** Dès qu'un média est lancé, l'appareil actif notifie `POST /api/playback/sync`.
- **Réception Descendante (Polling 1400ms) :** Tous les autres appareils connectés au compte interrogent `GET /api/playback/sync` :
  - Si un autre appareil joue un média, le média est automatiquement chargé.
  - La lecture / pause est répercutée instantanément.
  - La position temporelle est réconciliée si l'écart dépasse 1,5 seconde.
  - La piste audio (`activeAudio`) et la piste de sous-titres (`activeSubtitle`) sont synchronisées à l'identique.
- **Synchronisation Symétrique avec le Cast :**  
  Lorsqu'un média est casté sur une TV ou un Chromecast, la boucle de surveillance du Cast (`castState.ts`) répercute l'état du média casté directement dans `playerStore` et notifie `reportAccountPlayback`. L'ensemble des écrans du compte suit ainsi la diffusion TV en temps réel.

---

## 6. Moteur IPTV Live : Testeur Strict & Proxy CORS/HTTPS Intégral

### 6.1. Qualification Stricte des Flux TV (`streamTester.ts`)
Les flux IPTV instables ou expirés étaient auparavant marqués actifs par de simples requêtes HEAD incomplètes. L'algorithme a été renforcé :
- Sonde d'en-tête `HEAD` avec vérification stricte du code HTTP 200/206/302.
- En cas de manifeste HLS `.m3u8`, téléchargement du manifeste et validation stricte de l'en-tête `#EXTM3U`.
- Rejet catégorique des pages d'erreur HTML masquées sous HTTP 200 (ex: portails FAI ou erreurs Cloudflare renvoyant `<!DOCTYPE html>`).
- Téléchargement et inspection du premier chunk vidéo MPEG-TS (`Range: bytes=0-1024`) avec timeout de 3500ms.
- Les flux en échec sont immédiatement marqués `state = 'ERROR'`, grisant automatiquement la chaîne dans le guide EPG et les grilles TV.

### 6.2. Proxy Universel HLS & Neutralisation du Contenu Mixte (`liveProxyService.ts`, `/api/iptv/proxy`)
Lorsque le frontend est servi en HTTPS sécurisé (`https://cool.sweaw.com`), les flux IPTV distants diffusés en simple HTTP (`http://89.187.185.76:8080/...`) étaient impitoyablement bloqués par les navigateurs au titre du **Contenu Mixte Bloqué** (*Mixed Content Blocked*).
- **Réécriture Dynamique Complète :** Le proxy de flux Hono `/api/iptv/proxy` télécharge les manifestes `.m3u8`, analyse chaque sous-manifeste et chaque fragment `.ts`, et réécrit l'intégralité des URLs relatives ou absolues sous la forme :
  `/api/iptv/proxy?url=${encodeURIComponent(absoluteChunkUrl)}`
- **En-têtes CORS Universels :** Toutes les requêtes de fragments et manifestes répondent avec `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: Range, Content-Type, Authorization`, et `Accept-Ranges: bytes`, autorisant un streaming HLS fluide sans aucun blocage navigateur.
