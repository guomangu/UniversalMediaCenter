# État d'Avancement du Projet : Universal Media Stack (UMS)

Dernière mise à jour : 14 Octobre 2026

---

## 🟢 1. Fonctionnalités Réalisées & Validées

### 🎯 Synchronisation Bidirectionnelle `param.yaml` & Administration
- [x] Fichier central `param.yaml` synchronisé dynamiquement avec validation Zod (`paramSchema.ts`).
- [x] Chiffrement sécurisé du mot de passe admin via Argon2id.
- [x] Hot-reload automatique sur modification directe du fichier par un agent IA ou administrateur.
- [x] Gestion des inscriptions à la volée (`registerOnTheFly`) et du mode sur invitation uniquement (`invitationOnly`).
- [x] Interface d'administration modulaire `/admin` avec gestion des utilisateurs et des paramètres du site.
- [x] **En-tête unifié persistant sur `/admin` :** Intégration de `SiteHeader` sur la page d'administration garantissant l'accès permanent au logo, retour à l'accueil, sélection de profil et navigation.

### 🌐 Résolution Réseau LAN & Architecture Proxy
- [x] **Résolveur d'Hôte Dynamique à l'Exécution (`apiConfig.ts`) :** Détection automatique de `window.location.hostname` permettant à l'application de dialoguer instantanément avec le backend sans bloquer sur un `localhost:3000` hardcodé.
- [x] **Compatibilité Gateway Caddy & Reverse Proxy :** Configuration du proxy amont avec `header_up Host {upstream_hostport}` pour éviter les rejets d'origine de Metro bundler et harmoniser les flux sur le port 8080.
- [x] **Désactivation Splash Screen Bloquant sur Web (`animated-icon.tsx`, `_layout.tsx`) :** Suppression du verrouillage de démarrage asynchrone sur navigateur afin d'éliminer tout blocage en écran infini.

### 🗂️ Taxonomie, Cartes & Navigation Hiérarchique
- [x] **Structure d'accueil catégorisée :** Catégories verticales > Tags verticaux (Cards) > Médias en défilement horizontal.
- [x] **Transmission des tags aux groupes de médias :**
  - Les tags des médias liés sont transmis au groupe parent (`SHOW`, `COLLECTION`).
  - Aucun tag n'est vide sur la page d'accueil : les groupes apparaissent sous chaque tag partagé par leurs épisodes ou films liés.
- [x] **Tri prioritaire des tags par quantité (`count DESC`) :**
  - Toutes les catégories ordonnent leurs tags par volume de médias liés décroissant.
- [x] **Mode Responsive Smartphone Robuste :**
  - Menu d'en-tête adaptatif (`SiteHeader.tsx`) : sur smartphone (< 768px), passage en 2 rangées propres.
  - Élimination des débordements avec `paddingTop: 86` dynamique et pleine largeur (`width: 100%`).
- [x] **Films de cette suite avec affiches & fallbacks (`MediaChildrenRow.tsx`) :**
  - Sur `/media/[id]`, chaque film d'une saga ou épisode d'une série affiche sa vignette/affiche dédiée avec fallback automatique.
- [x] **Genres & Thématiques avec Médias Liés (`MediaGenreSection.tsx`, `mediaRelated.ts`) :**
  - Sur `/media/[id]`, affichage vertical de chaque tag de genre/thème avec défilement horizontal des autres médias partageant ce tag (exclusion du groupe actuel).
- [x] **Pagination dynamique & à la volée :**
  - Limite de 5 tags par catégorie avec bouton "+10 tags".
  - Limite de 15 médias par tag avec bouton "+10 médias" basé sur `hasMore`.
- [x] **Regroupement intelligent (Loi Groupe vs Fichier Unique) :**
  - Groupes parents pour les sagas/séries, affichage direct pour les films autonomes.

### 💬 Forum WhatsApp Universel Multimédia (`/forum/[topic]`)
- [x] **Universal Clickable Text :** Tous les textes (titres, tags, catégories, overviews) ouvrent leur salon de forum dédié.
- [x] **Messagerie style WhatsApp :** Bulles de messages, citations/réponses (`replyTo`), images, vidéos, audios, documents et liens.
- [x] Persistance PostgreSQL avec indexation optimisée sur `topic_slug`.

### 🎬 Streaming Vidéo & Lecteur HTML5 (`routes/mediaStream.ts`, `mediaTranscoder.ts`, `player/[id].tsx`)
- [x] Streaming HTTP Range (206 Partial Content) direct pour un chargement instantané.
- [x] **Transcodage Qualité Dynamique (1080p, 720p, 480p, Auto) :** FFmpeg redimensionne le flux vidéo à la volée sur demande de l'utilisateur, tout en conservant le curseur temporel (`currentTime`) pour une continuité fluide.
- [x] **Sélection de Langue Audio (VF / VO / Piste 2 / Auto) :** Modal dédié (`PlayerAudioModal.tsx`) et routage des pistes audio via FFmpeg (`-map 0:v:0 -map 0:m:language:...`).
- [x] **Sous-Titres Garantis & Double Incrustation :**
  - Détection automatique récursive des fichiers `.srt` / `.vtt` dans le dossier, les sous-dossiers et parents (`../Subtitles`).
  - Extraction à la volée des pistes sous-titres embarquées dans les conteneurs MKV/MP4 via FFmpeg.
  - Piste WebVTT continue de secours et incrustation visuelle nette (`subtitleOverlay`) via écouteur d'événements `oncuechange`.
- [x] **Ergonomie des Contrôles :** Repositionnement flottant de *Passer l'Introduction* (`bottom: 84`) pour ne plus masquer la barre de progression.
- [x] **Fonctionnalités de Partage (`PlayerShareModal.tsx`) :** Partage natif Web Share API, copie instantanée du lien et redirection forum.

---

## 🟡 2. Diagnostic & Bonnes Pratiques Réseau / Accès Externe

1. **Accès via IP Locale (`http://192.168.1.93:8080/`) :**
   - Toujours spécifier le port de la passerelle (:8080) ou le port dev (:8081). Sans port, le navigateur tape sur le port 80 où aucun service ne répond.
2. **Proxies Locaux & VPN (NekoBox, Sing-box, Xray, etc.) :**
   - Si un proxy système ou TUN est actif, inclure `192.168.1.0/24` ou `192.168.1.93` dans la liste des exclusions / bypass du proxy afin d'éviter l'erreur **HTTP ERROR 502** renvoyée par le serveur proxy distant incapable de joindre une IP LAN privée.
3. **Pare-feu d'Application (OpenSnitch) :**
   - Autoriser explicitement les connexions entrantes pour `node`, `caddy`, et `pasta` sur les interfaces locales `enp0s13f0u3u3` pour éviter les timeouts de file d'attente.
