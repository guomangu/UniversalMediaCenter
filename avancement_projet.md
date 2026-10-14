### 🔐 Système de Comptes Robuste, Mots de Passe & Protection Globale du Contenu
- [x] **Comptes Uniques avec Mot de Passe (Scrypt) :**
  - Fin du faux sélecteur multi-profils par instance : chaque session est associée à un utilisateur unique avec adresse e-mail et mot de passe chiffré via `scrypt` (sel aléatoire 16 octets, vérification en temps constant anti-timing attack).
  - Suppression intégrale de la fonctionnalité "Changer de profil" (fichiers `AccountProfilesView.tsx`, `AccountProfileCard.tsx`, `AccountCreateView.tsx` et `QuickProfileModal.tsx` retirés).
  - Modal "Mon Compte" dédié (`AccountModal.tsx`) affichant l'identité, le statut (Administrateur/Membre), les permissions et le bouton de déconnexion.
- [x] **Initialisation "Zéro Compte" & Premier Administrateur :**
  - Reset complet de la base (`users` vide).
  - Détection automatique (`GET /api/auth/status`) : si aucun compte n'existe (`hasUsers: false`), la page `/login` bascule automatiquement en mode initialisation où le premier compte créé devient automatiquement l'Administrateur du serveur avec tous les droits.
- [x] **Formulaires Conformes pour Google Chrome & Navigateurs :**
  - Implémentation de balises `<form method="post">` avec `<input name="username" autoComplete="username">` et `<input name="password">`.
  - Attribut `autoComplete="new-password"` à l'inscription pour déclencher la suggestion de mot de passe fort sécurisé par Google Chrome / gestionnaires de mots de passe.
  - Attribut `autoComplete="current-password"` à la connexion pour activer le remplissage automatique et l'enregistrement de trousseau.
- [x] **Protection Globale du Contenu & Redirections :**
  - Toutes les routes de données (`/api/ui/*`, `/api/search/*`, `/api/iptv/*`, `/api/forum/*`, `/api/media/*`) exigent une authentification active (`requireAuth`).
  - Composant de garde frontend (`AuthGuard.tsx`) : toute tentative d'accès anonyme aux catalogues, listes, streaming ou recherche redirige instantanément vers `/login?returnUrl=...&error=...`.
  - Protection de la console d'administration (`/admin`) : redirection avec message d'erreur si l'utilisateur connecté n'est pas administrateur.
- [x] **Exception de Partage Sécurisé Spécifique (`shareToken`) :**
  - Un membre connecté peut générer un lien de partage signé (`POST /api/media/:id/share-token`).
  - Le lien généré (`/player/:id?share=<token>` ou `/media/:id?share=<token>`) permet à un destinataire externe d'accéder **uniquement et strictement** à cette œuvre spécifique sans exiger de compte.
  - Toute tentative d'accéder à une autre œuvre ou de naviguer sur l'accueil ou le catalogue avec ce token reste strictement bloquée et redirige vers `/login`.

### 📺 Page Dédiée Télévision en Direct (IPTV), Recherche & Forums de Chaînes (`/tv`, `TvChannelCard.tsx`, `TvSearchBar.tsx`)
- [x] **Écran Dédié "TV" (`/tv`) :**
  - Page accessible directement depuis le bouton `📺 TV` de la barre de navigation `SiteHeader`.
  - Présentation en grille respirante et fluide de toutes les chaînes IPTV en direct avec badges `🔴 EN DIRECT` et catégories.
- [x] **Barre de Recherche Intelligente & Filtrage par Catégories (`TvSearchBar.tsx`) :**
  - Recherche instantanée par nom de chaîne, pays, ou mot-clé avec bouton d'effacement rapide.
  - Défilement horizontal de pilules de catégories synchronisées depuis le backend (`/api/iptv/categories`).
- [x] **Forum WhatsApp Dédié par Chaîne :**
  - Chaque chaîne dispose de son propre forum de discussion communautaire en direct (`/forum/[topic]` avec `topic = channel.slug`).
  - Accès direct depuis le bouton `💬 Forum` sur chaque carte de chaîne et depuis le lecteur vidéo `/player/[id]`.
- [x] **Streaming Direct Live HLS (`mediaStream.ts`) :**
  - Redirection transparente des flux live HLS (`streamUrl`) vers le lecteur universel sans exiger de fichier physique local.

### 💬 Forum WhatsApp Universel Multimédia (`/forum/[topic]`)
- [x] **Universal Clickable Text :** Tous les textes (titres, tags, catégories, overviews) ouvrent leur salon de forum dédié.
- [x] **Messagerie style WhatsApp :** Bulles de messages, citations/réponses (`replyTo`), images, vidéos, audios, documents et liens.
- [x] **Auteur Dynamique :** Utilisation automatique du nom du profil connecté (`currentUser.displayName`) pour les messages postés.
- [x] Persistance PostgreSQL avec indexation optimisée sur `topic_slug`.
