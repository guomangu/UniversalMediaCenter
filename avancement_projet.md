  - `/live` redirige instantanément vers la nouvelle page dédiée `/tv`.

---

### 🔐 Système de Comptes Robuste, Mots de Passe & Protection Globale du Contenu
- [x] **Comptes Uniques avec Mot de Passe (Scrypt) :**
  - Sessions sécurisées avec scrypt et salage aléatoire.
  - Détection automatique "Zéro compte" sur `/api/auth/status` : le premier utilisateur devient Administrateur.
  - Formulaires conformes Google Chrome (`autoComplete="username"`, `autoComplete="current-password"`, `autoComplete="new-password"`).
  - Protection globale du contenu via `requireAuth` et `AuthGuard.tsx`.
  - Exception de partage sécurisé temporaire via `shareToken`.

---

### 📺 Page Dédiée Télévision en Direct (IPTV), Recherche & Forums de Chaînes (`/tv`)
- [x] Grille de chaînes en direct avec badge `🔴 EN DIRECT`.
- [x] Barre de recherche instantanée et filtres par catégories.
- [x] Forum WhatsApp dédié par chaîne (`/forum/[channel-slug]`).
- [x] Streaming direct live HLS.

---

### 🛡️ Administration Avancée, Sécurité ABAC (Tags & Dossiers) & Gestion IPTV (`/admin`)
- [x] **Restauration & Protection Antisuicide des Comptes Administrateurs :**
  - Restauration immédiate en base PostgreSQL du compte `guuu@gmail.com` avec privilèges `is_admin = true` et `profile_role = 'ADMIN'`.
  - Garde-fou strict côté serveur (`userAdminRoutes.ts`) interdisant formellement l'auto-suppression de l'administrateur actif (`400 Bad Request`).
  - Composant atomique `ConfirmModal.tsx` pour afficher systématiquement une modale de confirmation avant la suppression irréversible d'un compte ou d'une source.
- [x] **Gestion Complète des Sources IPTV (`AdminIptvTab.tsx`, `iptvSources.ts`) :**
  - Routeur dédié `iptvSources.ts` (< 100 lignes) : consultation (`GET`), ajout et première synchro (`POST`), resynchronisation ciblée (`POST /:id/sync`), bascule active/inactive (`PATCH /:id`), suppression (`DELETE /:id`).
  - Interface dédiée avec liste des bouquets enregistrés, badges d'état (Actif / Inactif), date de dernière synchronisation, actions en un clic et formulaire d'ajout.
- [x] **Harmonisation Terminologique (Mot de passe au lieu de Code PIN) :**
  - Remplacement total des mentions de code PIN par "Mot de passe" dans l'interface d'administration et les fiches profils.
  - Champ de réinitialisation/mise à jour du mot de passe directement intégrable dans `AdminUserRow.tsx`.
- [x] **Contrôle d'Accès ABAC par Tags & Exclusion de Dossiers pour Profils :**
  - Nouvelles colonnes PostgreSQL `allowed_tags`, `blocked_tags`, `blocked_folders` et `profile_role` sur la table `users`.
  - Composant modulaire `AdminUserTagManager.tsx` avec barre de recherche et filtres instantanés :
    - **Whitelist (Tags exclusivement autorisés)** : restriction de visibilité aux seuls tags déclarés pour ce profil.
    - **Blacklist (Tags strictement interdits)** : masquage et blocage des contenus portant les tags interdits (ex: Horreur, Violence, Adulte).
    - **Exclusion de dossiers (Blacklist chemins)** : masquage des répertoires de la médiathèque pour certains profils (ex: `/Animes`, `/Films/Horreur`).
  - Filtrage dynamique automatique dans les rails d'accueil (`ui.ts`), les requêtes de médias (`media.ts`) et les flux de streaming (`mediaStream.ts`).
- [x] **Barre de Recherche Multi-Comptes dans l'Admin (`AdminUsersTab.tsx`) :**
  - Recherche instantanée par nom, adresse e-mail ou rôle/profil pour administrer facilement des dizaines ou centaines d'utilisateurs sans saturation visuelle.
- [x] **Centralisation & Dynamisation Étendue dans `param.yaml` (`paramSchema.ts`, `paramManager.ts`, `AdminConfigTab.tsx`) :**
  - Gestion dynamique globale sans valeurs codées en dur :
    - `server` : `siteName`, `siteTagline`, `corsOrigins`, `publicBaseUrl`.
    - `security` : `invitationOnly`, `invitationCodes`, `defaultPasswordRequired`, `defaultMaxCsaAge`.
    - `profiles` : `defaultRole`, `defaultCanDownload`, `defaultCanTranscode`, `defaultCanWatchIptv`, `defaultMaxCsaAge`, `defaultBlockedTags`, `defaultAllowedTags`, `defaultBlockedFolders`.
    - `media` : `globalExcludedFolders` (dossiers ignorés par défaut lors de l'indexation comme `.git`, `@eaDir`, `#recycle`), `defaultAudioLanguage`, `defaultSubtitleLanguage`.
    - `ui` : `theme`, `enableHeroSpotlight`, `enableSkipIntro`, `skipIntroDurationSeconds`, `cardsPerRail`, `bannerHeight`.
  - Onglet `AdminConfigTab.tsx` étendu permettant de modifier et synchroniser en direct ces paramètres avec `param.yaml`.

---

### 🎮 Navigation Télécommande Fluide dans les Formulaires & Vrai Téléversement Médias Forums
- [x] **Navigation Spatiale Non-Bloquante dans les Formulaires (`useTvNavigation.ts`) :**
  - Élimination complète du piégeage de curseur entre les lettres : les flèches directionnelles (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`) permettent désormais de sortir du champ et de déplacer le focus spatial vers les éléments voisins sans forcer le déplacement du curseur texte.
  - La touche **Entrée** ouvre / focalise le clavier virtuel de l'OS hôte ou du navigateur client.
  - Les touches **Retour / Escape** libèrent instantanément le focus du champ de saisie (`active.blur()`).
- [x] **Bouton Stop Dédié dans la Barre de Discussion (`ForumInputBar.tsx`) :**
  - Bouton `⏹ Stop` ajouté juste à côté du bouton d'envoi (`➤`), focusable à la télécommande (`focusable={true}`), permettant de désactiver immédiatement la saisie et de reprendre la navigation sur les messages ou l'en-tête.
- [x] **Téléversement Réel de Fichiers & Pièces Jointes dans les Forums :**
  - Endpoint backend modulaire `POST /api/forum/upload` et `GET /api/forum/attachments/:filename` dans [`forumUpload.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/forumUpload.ts).
  - Remplacement complet des liens factices par un sélecteur natif de l'OS hôte (`<input type="file">` invisible déclenché au clic / télécommande).
  - Prise en charge des Photos / Images réelles, Vidéos, Audios, Documents PDF et GIFs avec téléversement en arrière-plan, barre de progression et aperçu avant envoi.
  - Affichage direct et responsive dans [`ForumMessageBubble.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/ForumMessageBubble.tsx).
