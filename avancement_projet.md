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

### 🌐 Menu Navigation à 2 Niveaux & Recherche Assainie
- [x] **En-tête à deux étages (`SiteHeader.tsx`) :**
  - **1er étage (supérieur) :** Logo UMS à gauche, boutons de profil (`+ Profil`) et d'administration (`⚙️ Admin`) à droite.
  - **2ème étage (inférieur) :** Raccourcis de catégories avec bouton `🏠 Haut` et défilement horizontal fluide (`showsHorizontalScrollIndicator={false}`) occupant 100% de la largeur sans aucun rognage sur le bord de l'écran.
- [x] **Masquage des tags et catégories vides lors de la recherche (`TagCard.tsx`, `CategorySection.tsx`) :**
  - Lors d'une recherche depuis la page d'accueil, aucun tag avec 0 média n'est affiché.
  - Suppression des cartes vides parasites ("Aucun média trouvé pour ce filtre") au profit d'un affichage ciblé et instantané.
  - Masquage automatique des catégories entières ne comportant aucun résultat pour la recherche courante.

### 🗂️ Taxonomie, Cartes & Navigation Hiérarchique
- [x] **Structure d'accueil catégorisée :** Catégories verticales > Tags verticaux (Cards) > Médias en défilement horizontal.
- [x] **Transmission des tags aux groupes de médias :**
  - Les tags des médias liés sont transmis au groupe parent (`SHOW`, `COLLECTION`).
  - Aucun tag n'est vide sur la page d'accueil : les groupes apparaissent sous chaque tag partagé par leurs épisodes ou films liés.
- [x] **Tri prioritaire des tags par quantité (`count DESC`) :**
  - Toutes les catégories ordonnent leurs tags par volume de médias liés décroissant.
- [x] **Films de cette suite avec affiches & fallbacks (`MediaChildrenRow.tsx`) :**
  - Sur `/media/[id]`, chaque film d'une saga ou épisode d'une série affiche sa vignette/affiche dédiée avec fallback automatique.
- [x] **Genres & Thématiques avec Médias Liés (`MediaGenreSection.tsx`, `mediaRelated.ts`) :**
  - Sur `/media/[id]`, affichage vertical de chaque tag de genre/thème avec défilement horizontal des autres médias partageant ce tag (exclusion du groupe actuel).
- [x] **Pagination dynamique & à la volée :**
  - Limite de 5 tags par catégorie avec bouton "+10 tags".
  - Limite de 15 médias par tag avec bouton "+10 médias" basé sur `hasMore`.

### 🎬 Streaming Vidéo, Pistes Audio & Qualité Dynamique (`mediaStream.ts`, `mediaTracks.ts`, `player/[id].tsx`, `VideoPlayerView.tsx`)
- [x] **Barre de progression complète & Direct Play :**
  - En mode par défaut (`audio: auto`, `quality: auto`), streaming direct en HTTP 206 Partial Content (Byte-Range) avec `Content-Range` et `Content-Length`. Durée totale reconnue instantanément par `<video>`.
- [x] **Changement de Langue Audio Dynamique & Effectif :**
  - Sélection d'une piste audio réelle depuis le modal (`🔊 Audio`).
  - L'URL de streaming intègre dynamiquement `?audio=<index>` (ex: `audio=2` pour le japonais sur Bleach).
  - FFmpeg route à la volée le flux audio sélectionné (`-map 0:v:0 -map 0:<index>`) sans réencodage vidéo (`-c:v copy`), démarrage instantané.
- [x] **Changement de Qualité / Résolution Dynamique :**
  - Sélection de la résolution souhaitée (`1080p`, `720p`, `480p`) depuis le modal (`⚙️ Qualité`).
  - L'URL de streaming intègre `?quality=<valeur>`.
  - FFmpeg redimensionne le flux à la volée avec le preset `ultrafast` et diffuse le flux MP4 fragmenté.
- [x] **Continuité Temporelle lors des Changements :**
  - Le lecteur mémorise le curseur temporel (`savedTimeRef`) et repositionne automatiquement la lecture au même instant (`onLoadedMetadata`) lors du basculement de langue ou de résolution.
- [x] **Sous-Titres Réels Garantis :**
  - Extraction à la volée des sous-titres texte réels embarqués ou externes (`.srt`/`.vtt`), synchronisation WebVTT et affichage textuel instantané.

### 💬 Forum WhatsApp Universel Multimédia (`/forum/[topic]`)
- [x] **Universal Clickable Text :** Tous les textes (titres, tags, catégories, overviews) ouvrent leur salon de forum dédié.
- [x] **Messagerie style WhatsApp :** Bulles de messages, citations/réponses (`replyTo`), images, vidéos, audios, documents et liens.
- [x] Persistance PostgreSQL avec indexation optimisée sur `topic_slug`.

---

## 🟡 2. Diagnostic & Bonnes Pratiques Réseau / Accès Local

1. **Accès Local :**
   - Accès privilégié et testé sur `localhost:8080` (Gateway Caddy) ou `localhost:3000` (API Backend).
2. **Accès via IP Locale (`http://192.168.1.93:8080/`) :**
   - Toujours spécifier le port de la passerelle (:8080).
   - En présence de tunnels VPN ou proxies applicatifs (ex: NekoBox), ajouter `192.168.1.0/24` dans la liste de contournement/bypass du proxy.
