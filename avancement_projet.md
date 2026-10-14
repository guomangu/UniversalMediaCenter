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

### 🗂️ Taxonomie, Cartes & Navigation Hiérarchique
- [x] **Structure d'accueil catégorisée :** Catégories verticales > Tags verticaux (Cards) > Médias en grille compacte.
- [x] **Pagination dynamique & à la volée :**
  - Limite de 5 tags par catégorie avec bouton de chargement dynamique "+10 tags".
  - Limite de 15 médias par tag avec bouton de chargement dynamique "+10 médias".
- [x] **Regroupement intelligent (Loi Groupe vs Fichier Unique) :**
  - Les séries (`SHOW`) et sagas/collections (`COLLECTION`) s'affichent comme des groupes parents sans polluer la vue d'accueil avec leurs centaines d'épisodes/films enfants.
  - Les films autonomes s'affichent individuellement (`MOVIE`).
- [x] **Menu Flottant Unifié (`SiteHeader.tsx`) :**
  - En-tête fixe en haut de page (`position: fixed`, glassmorphism, blur).
  - Intégration des raccourcis de catégories cliquables directement **dans** le menu flottant avec bouton `🏠 Haut`.
  - Accès direct au profil et à l'administration.
- [x] **Navigation Stack & Réactivité des Clics (`_layout.tsx`, `MediaTile.tsx`) :**
  - Architecture Expo Router basée sur `<Stack screenOptions={{ headerShown: false }}>` permettant d'ouvrir `/media/[id]`, `/forum/[topic]`, `/admin`, `/player/[id]`.
  - Clic complet (affiche + titre) sur les cartes médias pour ouvrir la fiche détaillée avec lecture, groupe d'épisodes et forum WhatsApp.
  - Correction de l'erreur 500 sur le filtre de qualité via transtypage explicite `node_type::text ILIKE`.

### 💬 Forum WhatsApp Universel Multimédia (`/forum/[topic]`)
- [x] **Universal Clickable Text :** Tous les textes (titres, tags, catégories, overviews) sont cliquables pour ouvrir leur salon de forum dédié.
- [x] **Messagerie style WhatsApp :** Bulles de messages, citations/réponses (`replyTo`), support des images, vidéos, audios/notes vocales, documents et liens.
- [x] Persistance PostgreSQL avec indexation optimisée sur `topic_slug`.

### 🧹 Nettoyage des Métadonnées & Normalisation des Titres (`watcher/titleCleaner.ts`)
- [x] Priorisation intelligente du titre original exempt de tags de release.
- [x] Nettoyage des motifs techniques (`1080p`, `720p`, `x264`, `x265`, `BDRip`, `MULTi`, `VFF`, etc.).
- [x] Formatage standardisé des épisodes de séries TV : `<TitreSérie> - S<Saison>E<Episode>`.

### 🔄 Enrichissement & Mise à Jour Prioritaire (`watcher/metadataEnricher.ts`)
- [x] Classement dynamique par besoin (`needScore`) pour enrichir en priorité les médias incomplets.
- [x] Résolution multi-sources : TVmaze et Wikipedia Opensearch / REST API.
- [x] Bouton `Mettre à jour la médiathèque` dans `/admin`.

### 🎬 Streaming Vidéo & Lecteur HTML5 (`routes/mediaStream.ts`, `player/[id].tsx`)
- [x] Streaming HTTP Range (206 Partial Content) fluide pour MKV, MP4, WebM et IPTV.
- [x] Lecteur vidéo universel avec contrôles et saut d'intro (+85s).

---

## 🟡 2. Chantiers Suivants (Par Ordre de Priorité)

1. **Intégration du Transcodeur Matériel (`ums_transcoder`) :** Détection automatique des formats vidéo non supportés nativement (HEVC 10-bit, audio DTS) et bascule vers VAAPI / NVENC à la volée.
2. **Reconnaissance Temporelle & Chapitrage Automatique :** Détection d'intro pour alimenter `chaptersJson`.
3. **Téléchargement Hors-Ligne & Profils Multi-Utilisateurs :** Synchronisation locale de fichiers multimédias.
