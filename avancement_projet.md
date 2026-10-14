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

---

## 🟡 2. Diagnostic & Bonnes Pratiques Réseau / Accès Local

1. **Accès Local :**
   - Accès privilégié et testé sur `localhost:8080` (Gateway Caddy) ou `localhost:3000` (API Backend).
2. **Accès via IP Locale (`http://192.168.1.93:8080/`) :**
   - Toujours spécifier le port de la passerelle (:8080).
   - En présence de tunnels VPN ou proxies applicatifs (ex: NekoBox), ajouter `192.168.1.0/24` dans la liste de contournement/bypass du proxy.
