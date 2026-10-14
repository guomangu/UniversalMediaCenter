### 👤 Espace Utilisateur Complet, Statistiques, Reprise & Liste d'Amis (`/user`, `UserScreen.tsx`)
- [x] **Tableau de Bord & Statistiques en Direct :**
  - **Statistiques personnelles utilisateur :** Total d'heures visionnées (calculé depuis `watch_progress`), nombre de médias terminés, nombre de favoris enregistrés, nombre d'amis confirmés, nombre d'avis & reposts publiés, nombre de salons de forum actifs.
  - **Statistiques du catalogue serveur :** Nombre total de films, séries, épisodes et chaînes TV en direct issus de PostgreSQL.
- [x] **Reprise de Lecture (Continue Watching) & Historique :**
  - Liste dédiée des médias en cours de lecture avec barre de progression pourcentage (style Netflix) et bouton de reprise immédiate au timestamp exact.
  - Historique complet de visionnage avec statut (complété / en cours) et bouton de relecture rapide.
- [x] **Gestion des Favoris (Watchlist) :**
  - Table PostgreSQL `user_favorites` avec unicité `(user_id, node_id)`.
  - Bouton interactif ❤️ sur chaque fiche média (`MediaDetailScreen`) pour ajouter/retirer en un clic.
  - Onglet dédié dans l'espace utilisateur listant les favoris avec bascule immédiate vers la lecture.
- [x] **Salons de Forum Participés :**
  - Requête d'agrégation recensant tous les salons et sujets de forum (`forum_messages`) où l'utilisateur a posté des messages.
  - Affichage du nombre de messages et lien direct vers le salon WhatsApp du média ou de la chaîne.
- [x] **Personnalisation Complète du Profil :**
  - Modal contextuelle progressive (`ProfileEditModal.tsx`) pour modifier son nom d'affichage / pseudo, sa bio cinéphile / statut, et choisir son avatar parmi une sélection d'icônes ou custom.
  - Persistance en base PostgreSQL (`users.bio`, `users.avatar_url`).
- [x] **Réseau Social & Système d'Amis (`/api/friends`, `UserFriendsTab.tsx`) :**
  - Table PostgreSQL `user_friends` avec états `PENDING` et `ACCEPTED`.
  - Recherche instantanée d'utilisateurs sur la plateforme par nom ou e-mail.
  - Envoi de demandes d'amis, acceptation/refus en 1 clic, et gestion des amis confirmés.
- [x] **Forum Privé Personnel Réservé aux Amis (`private-user-[userId]`) :**
  - Chaque utilisateur dispose de son propre salon de discussion privé sécurisé.
  - **Contrôle d'accès strict côté serveur (Hono) :** Seul le propriétaire du salon et ses amis confirmés (`ACCEPTED`) sont autorisés à lire et écrire des messages. Toute tentative par un tiers non-ami est bloquée par un `403 Forbidden`.
  - Accès direct depuis l'espace utilisateur ("Mon Salon Privé") et depuis chaque fiche ami ("Salon Privé de [Ami]").
- [x] **Avis & Repost de Médias avec Notation (`/api/reposts`, `MediaRepostModal.tsx`, `UserFeedTab.tsx`) :**
  - Table PostgreSQL `media_reposts` reliant utilisateur, média, note (1 à 5 étoiles) et commentaire optionnel.
  - Bouton "🔄 Avis & Repost" sur chaque média ouvrant une modal dédiée.
  - Fil d'actualité social dans l'espace utilisateur affichant les publications et recommandations partagées par ses amis.

---

### 🍿 Enchaînement Automatique Binge-Watching "Comme Netflix" (`/player/[id]`, `VideoPlayerView.tsx`, `mediaNext.ts`)
- [x] **Enchaînement Automatique sans Télécommande :**
  - Endpoint intelligent `GET /api/media/:id/next` calculant l'épisode ou la suite chronologique suivante dans la série, animé ou saga.
  - Détection automatique de la fin du média ou des 10 dernières secondes.
  - Overlay flottant glassmorphe en bas à droite : compte à rebours de 8 secondes, vignette, titre de l'épisode suivant, badge saison/épisode, bouton "▶ Regarder maintenant" et bouton "✕ Annuler".
  - Navigation automatique `router.replace` au terme du compte à rebours : permet de regarder toute la nuit une série dans l'ordre sans toucher la télécommande ni la souris.
- [x] **Support Multi-Saisons & Ordre Chronologique :**
  - Transition automatique de la fin d'une saison (ex: S01E24) vers le premier épisode de la saison suivante (ex: S02E01).
  - Prise en charge des suites de films dans une collection ou franchise.

---

### 🏷️ Tagging Saillant Saisons & Numéros d'Épisodes (`seasonEpisodeHelper.ts`)
- [x] **Extraction et Normalisation Universelle :**
  - Module atomique dédié détectant tous les formats standards de séries et anime (`S01E03`, `1x03`, `EP03`, `E03`, `Épisode 3`).
  - Calcul d'un rang numérique de tri invariant `(season * 10000) + episode`.
- [x] **Mise en Valeur Visuelle UI/UX (Zero Coin Aigu & Contrastes) :**
  - Badges saillants arrondis (`Radius.pill`, couleur indigo/violet contrastée) affichant clairement `S01 • EP 03` ou `S01E03` sur :
    - Les cartes de médias (`MediaCard.tsx`)
    - Les tuiles de catégories (`MediaTile.tsx`)
    - La rangée d'épisodes de séries (`MediaChildrenRow.tsx`)
    - L'en-tête de la fiche détaillée (`MediaDetailScreen.tsx`)
    - L'overlay de lecteur vidéo (`PlayerScreen.styles.ts`)

---

### 🧭 Redirection & Zéro Page Vide
- [x] **Écran d'Accueil Tolérant (`index.tsx`) :**
  - Si le catalogue est en cours d'ingestion ou vide, affichage d'un panneau d'accueil chaleureux avec boutons fonctionnels directs vers la TV en Direct (`/tv`), l'Espace Utilisateur (`/user`), et l'Administration (`/admin`).
- [x] **Catch-all 404 Automatique (`+not-found.tsx`) :**
  - Toute route inexistante ou URL erronée affiche un écran bienveillant avec compte à rebours et redirige automatiquement l'utilisateur vers l'accueil.
- [x] **Redirection des Anciennes Routes :**
  - `/live` redirige instantanément vers la nouvelle page dédiée `/tv`.

---

### 🔐 Système de Comptes Robuste, Mots de Passe & Protection Globale du Contenu
- [x] **Comptes Uniques avec Mot de Passe (Scrypt) :**
  - Sessions sécurisées avec scrypt et salage aléatoire.
  - Détection automatique "Zéro compte" sur `/api/auth/status` : le premier utilisateur devient Administrateur.
  - Formulaires conformes Google Chrome (`autoComplete="username"`, `autoComplete="current-password"`, `autoComplete="new-password"`).
  - Protection globale du contenu via `requireAuth` et `AuthGuard.tsx`.
  - Exception de partage sécurisé temporaire via `shareToken`.

### 📺 Page Dédiée Télévision en Direct (IPTV), Recherche & Forums de Chaînes (`/tv`)
- [x] Grille de chaînes en direct avec badge `🔴 EN DIRECT`.
- [x] Barre de recherche instantanée et filtres par catégories.
- [x] Forum WhatsApp dédié par chaîne (`/forum/[channel-slug]`).
- [x] Streaming direct live HLS.
