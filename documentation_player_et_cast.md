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
│      Moteur Vidéo HTML5       │  • Balise <video> native cross-browser     │
│       & HLS.js Universel      │  • Détection automatique flux direct IPTV   │
│                               │  • Buffer anti-décrochage & auto-recovery   │
├───────────────────────────────┼─────────────────────────────────────────────┤
│     Pistes Audio & Langues    │  • Multi-audio avec extraction à la volée   │
│                               │  • Transcodage sélectif ffmpeg (-map 0:a:x) │
│                               │  • Détection automatique langue préférée    │
├───────────────────────────────┼─────────────────────────────────────────────┤
│   Sous-titres Multi-Sources   │  • Pistes textuelles <track kind="subtitles">│
│                               │  • Fichiers externes (.srt, .ass, .vtt)     │
│                               │  • Extraction temps réel sous-titres MKV    │
├───────────────────────────────┼─────────────────────────────────────────────┤
│  Navigation & Chapitrage      │  • Saut automatique de générique "Skip Intro"│
│                               │  • Découpage en chapitres (Intro, Épisode)  │
│                               │  • Reprise exacte de position (à la seconde)│
├───────────────────────────────┼─────────────────────────────────────────────┤
│  Contrôle Parental & Sécurité │  • Double barrière PBAC / ABAC étanche      │
│                               │  • Écran de garde "Contenu Bloqué"          │
│                               │  • Zéro fuite de métadonnées confidentielles│
└───────────────────────────────┴─────────────────────────────────────────────┘
```

### 1.1. Gestion des Flux & Formats
- **Lecture VOD Locale / Réseau :** Prise en charge des conteneurs MKV, MP4, WebM, AVI, MOV et TS avec requêtes HTTP par plages d'octets (`Range: bytes=start-end`) assurant un démarrage instantané et un saut fluide dans la vidéo (*Zero-CPU streaming*).
- **Flux IPTV en Direct :** Prise en charge des flux HLS (`.m3u8`) et proxification de flux distants via Hono et HLS.js avec gestion des erreurs réseau et récupération automatique de buffer (`bufferStalledError`).
- **Détection des Fichiers Incomplets ou Corrompus :**  
  Vérification de l'intégrité de l'en-tête du fichier (signature EBML `1a45dfa3` pour MKV, `ftyp` pour MP4, détection des zéros purs de pré-allocation BitTorrent). En cas de fichier inachevé, le serveur renvoie HTTP 422 (`CORRUPTED_FILE`) et le lecteur affiche un écran d'information clair et sécurisé :
  `⚠️ Fichier Incomplet ou Corrompu - Le téléchargement de ce fichier n'a pas été achevé sur le disque source`.
- **Politique Zéro 404 sur les Affiches (Artworks) :**  
  L'endpoint `/api/media/:id/poster` et ses variantes (`/thumb`, `/fanart`) appliquent une chaîne de fallback récursive (affiche directe $\rightarrow$ vignette $\rightarrow$ fanart $\rightarrow$ parent $\rightarrow$ enfants). Si aucune image physique n'existe, le serveur génère dynamiquement un poster vectoriel SVG élégant aux dimensions cinéma avec dégradé sombre et le titre du média. **Aucune erreur HTTP 404 n'est émise pour les médias existants**.

### 1.2. Commandes & Raccourcis Clavier / Télécommande
- **Espace / MediaPlayPause :** Bascule Lecture / Pause.
- **Flèches Gauche / Droite :** Recul rapide de -10 secondes / Avance de +10 secondes (ou +30 secondes).
- **Touche 'S' :** Saut direct du générique d'introduction (*Skip Intro*).
- **Touche 'F' / Plein Écran :** Bascule en mode Plein Écran immersif sans barre d'adresse.

---

## 2. Le Mini-Lecteur Flottant (`player_div`)

Afin d'offrir une continuité de lecture analogue à l'expérience YouTube, le lecteur ne s'arrête pas lorsque l'utilisateur quitte la page `/player`. Un conteneur flottant persistant portant l'identifiant strict `player_div` est arrimé en permanence au bas de l'écran.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MINI-LECTEUR "player_div"                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Barre de progression interactive : clic pour naviguer dans le média]      │
├─────────┬──────────────────────┬────────────────────────┬───────────────────┤
│ [Image] │ Titre du média       │  [ -10s ]  [ ▶ / ⏸ ]   │ 💬 ST : FR        │
│         │ 04:12 / 48:30        │        [ +30s ]        │ 🔊 Audio : FR     │
│         │                      │                        │ 📡 Cast : Salon   │
│         │                      │                        │ ⛶ Agrandir  ✕     │
└─────────┴──────────────────────┴────────────────────────┴───────────────────┘
```

### 2.1. Fonctionnement Multi-Pages
1. **Docking Automatique :** Lorsque l'utilisateur clique sur le bouton « ▼ Réduire » ou utilise la navigation vers une autre page (`/`, `/media/[id]`, `/forum`, `/explore`), la vidéo est immédiatement prise en charge par `FloatingBottomPlayer` dans la div `#player_div`.
2. **Contrôles Complets Intégrés :**
   - **Play / Pause / Seek :** Accès direct aux contrôles temporels.
   - **Sélecteur de Sous-titres :** Ouverture de la modale `PlayerSubtitleModal` pour changer de langue ou désactiver les sous-titres en un clic.
   - **Sélecteur de Piste Audio :** Choix de la langue ou piste audio originale à la volée.
   - **Accès Cast :** Indicateur de diffusion en cours ou ouverture de `CastModal`.
   - **Agrandir (Expand) :** Clic sur la miniature, le titre ou le bouton « ⛶ Agrandir » pour retourner en plein écran sur `/player/[id]` avec conservation exacte de la milliseconde de lecture.
   - **Fermer (Close) :** Arrêt propre de la lecture, sauvegarde de la position en base et bascule vers la bannière de reprise.

### 2.2. Reprise de Lecture "Dernière Lecture" (Style YouTube)
Lorsque aucun média n'est activement en cours de lecture, mais qu'une session récente existe dans le stockage local (`ums_last_playback`), `player_div` affiche une bannière discrète :
`Reprendre : [Titre du film] (Position : MM:SS)` avec deux actions :
- **▶ Reprendre :** Relance instantanément le visionnage au point exact d'interruption.
- **✕ Ignorer :** Masque la bannière et libère l'espace visuel.

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
   └────────────────────┘          └────────────────────┘          └─────────┬──────────┘
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
   Toutes les 1200ms, l'écran cible envoie un battement de cœur (`POST /api/cast/heartbeat`) rapportant son état réel :
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
   Libère la télécommande du Caster tout en laissant le film tourner sur la TV de salon. La session locale est réinitialisée et la clé `ums_active_cast_target_id` est effacée.

---

## 4. Tableau Récapitulatif des Endpoints & États

| Endpoint | Méthode | Rôle | Format de Réponse |
|---|---|---|---|
| `/api/media/:id/stream` | `GET`, `HEAD` | Streaming vidéo avec vérification d'intégrité et HTTP Range | Binaire (206 / 200) ou 422 `CORRUPTED_FILE` |
| `/api/media/:id/poster` | `GET` | Affiche officielle avec chaîne de fallback et SVG garanti | Image JPEG/PNG/WebP ou SVG (200 OK) |
| `/api/media/:id/tracks` | `GET` | Pistes audio, sous-titres et résolutions disponibles | JSON (`audioTracks`, `subtitleTracks`) |
| `/api/cast/info` | `GET` | Découverte de l'IP LAN du serveur pour les diffuseurs | JSON (`lanIp`, `port`, `gatewayPort`) |
| `/api/cast/devices` | `GET` | Liste des récepteurs et écrans UMS connectés | JSON (`devices: CastDevice[]`) |
| `/api/cast/device/:id` | `GET` | Statut temps réel d'un écran spécifique | JSON (`device: CastDevice`) |
| `/api/cast/command` | `POST` | Envoi d'une commande de télécommande (Seek, Pause...) | JSON (`success: true`) |
| `/api/cast/poll/:deviceId`| `GET` | Dépilement des commandes par l'écran récepteur | JSON (`commands: CastCommand[]`) |
