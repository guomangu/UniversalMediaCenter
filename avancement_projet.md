  - Bouton `⏹ Stop` ajouté juste à côté du bouton d'envoi (`➤`), focusable à la télécommande (`focusable={true}`), permettant de désactiver immédiatement la saisie et de reprendre la navigation sur les messages ou l'en-tête.
- [x] **Téléversement Réel de Fichiers & Pièces Jointes dans les Forums :**
  - Endpoint backend modulaire `POST /api/forum/upload` et `GET /api/forum/attachments/:filename` dans [`forumUpload.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/forumUpload.ts).
  - Remplacement complet des liens factices par un sélecteur natif de l'OS hôte (`<input type="file">` invisible déclenché au clic / télécommande).
  - Prise en charge des Photos / Images réelles, Vidéos, Audios, Documents PDF et GIFs avec téléversement en arrière-plan, barre de progression et aperçu avant envoi.
  - Affichage direct et responsive dans [`ForumMessageBubble.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/ForumMessageBubble.tsx).

---

### 🏷️ Types de Profils (Packs) Paramétrables & Déport ABAC (`/admin`, `AdminProfileTypesTab.tsx`, `profileTypesRoutes.ts`)
- [x] **Gestion Modulaire des Packs & Types de Profils :**
  - Routeur dédié `backend/src/routes/profileTypesRoutes.ts` monté sur `/api/admin/profile-types` avec synchronisation temps réel dans `param.yaml`.
  - Onglet dédié **"Types de Profils"** dans l'espace administration (`AdminProfileTypesTab.tsx`) regroupant la configuration complète des règles d'accès.
  - Déplacement du module **"Sécurité ABAC : Filtrage par Tags & Dossiers"** au sein de chaque pack de profil (`AdminUserTagManager.tsx`).
  - Presets prêts à l'emploi :
    - `ADMINISTRATEUR` : droits complets, gestion de la plateforme.
    - `MEMBRE` : accès standard au catalogue complet.
    - `ENFANT` : limité aux dessins animés, famille, CSA -10, blocage violence et horreur.
    - `SAFEZONE` : adolescents et famille (CSA -12), blocage des contenus gores et adultes.
    - `SEULEMENT_DES_MARVEL` : whitelist restreinte exclusivement aux tags Marvel / Super-héros.
- [x] **Attribution et Liaison Directe aux Utilisateurs (`AdminUserRow.tsx`, `access.ts`) :**
  - Bouton interactif en un clic sur chaque ligne utilisateur pour cycler ou assigner instantanément son pack de profil (`🏷️ Pack: Enfant`, `Safezone`, `Membre`, etc.).
  - Héritage automatique des permissions dans `access.ts` : dès qu'un utilisateur est lié à un type de profil, il hérite immédiatement de sa whitelist de tags, blacklist de tags, dossiers exclus, limite CSA et droits IPTV/DL sans configuration redondante.

---

### 📺 Résilience des Chaînes TV Live, CDN Freebox/Oqee & Gestion des Erreurs 403
- [x] **Élimination de l'erreur `ERR_CONNECTION_RESET` sur les Logos Oqee/Freebox (`TvChannelCard.tsx`) :**
  - Détection préventive du CDN privé `img1.dc2.oqee.net` qui rejette les connexions des clients web tiers.
  - Bascule instantanée vers un badge logo vectoriel propre avec initiales de la chaîne sans lever d'erreur réseau console.
  - Gestionnaire d'erreur `onError={() => setImgError(true)}` garantissant l'absence de logo brisé sur l'ensemble des chaînes.
- [x] **Gestion Élégante des Flux 403 et Diffuseurs Hors Ligne (`VideoPlayerView.tsx`) :**
  - Interception des erreurs réseau fatales HLS (`Hls.Events.ERROR` avec code HTTP 403/404) et HTML5 `<video onError>`.
  - Remplacement de l'écran noir muet par un overlay informatif glassmorphe invitant l'utilisateur à choisir une autre chaîne ou resynchroniser la playlist sans bloquer l'application.
