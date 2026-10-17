* **Problème / Symptôme :**
  1. Sur la page `/player`, les boutons d'actions supérieures (« Avis & Repost », « Partager », « Cast », « Audio », « ST », « Plein Écran ») débordent de l'écran sur smartphone, écrasent le titre et deviennent illisibles ou inaccessibles.
  2. Les 24 films disponibles pour un utilisateur restreint par dossier (ex: « Membre Standard [MEMBRE] ») ne s'affichent pas sur la page d'accueil, l'API de taxonomie (`/api/ui/taxonomy`) subissant un timeout réseau HTTP (> 25 secondes) et renvoyant une liste vide.
* **Conséquences :**
  - Expérience utilisateur dégradée sur smartphone, boutons rognés et impossibilité d'accéder aux fonctionnalités du lecteur.
  - Page d'accueil vide (« Aucun média trouvé ») pour les profils restreints par dossiers autorisés, donnant la fausse impression que le catalogue est inaccessible.
* **Causes Racines :**
  - Disposées en ligne simple avec largeurs textuelles fixes, les 6 actions du lecteur dépassent la largeur maximale disponible (360-480px) sur smartphone.
  - L'expression SQL résolvant le chemin physique d'un média (`COALESCE(video_file_path, (SELECT ... FROM media_nodes WHERE parent_id = ...), nfo_file_path)`) plaçait la sous-requête corrélée avant `nfo_file_path`. Faute d'index B-tree sur `parent_id` et `value_id`, et avec la duplication inutile de 10 clauses `ILIKE` non ancrées (causes de scans séquentiels répétés), chaque agrégation de taxonomie prenait plus de 5 secondes.
  - De plus, les 14 films du dossier ne disposant pas d'attributs EAV de genre étaient absents des rails de genre exclusifs de la catégorie Films.
* **Bonnes Pratiques de Remédiation :**
  - **Menu Lecteur Responsive & Modal Adaptatif (`player/[id].tsx`, `PlayerMenuModal.tsx`) :** Détecter la largeur d'écran via `useWindowDimensions()`. Sur smartphone, offrir une barre défilable horizontalement et intégrer un bouton dédié « ⚙️ Options » ouvrant une modale ergonomique plein écran/bottom sheet donnant un accès 1-tap à l'ensemble des 6 actions avec le pattern Sibling Backdrop.
  - **Optimisation Algorithmique des Conditions d'Accès SQL (`mediaAccessSql.ts`) :** Placer `nfo_file_path` avant toute recherche d'enfants (`COALESCE(video_file_path, nfo_file_path, (SELECT c.video_file_path FROM media_nodes c WHERE c.parent_id = n.id AND c.video_file_path IS NOT NULL LIMIT 1))`). Distinguer par un `else` les racines absolues (`isSystemRoot`) des motifs partiels. Créer les index B-Tree sur `parent_id` et `node_eav_links(value_id)`, abaissant le temps d'exécution de 24 000 ms à 50 ms.
  - **Exposition Exhaustive du Catalogue Films (`taxonomyRoutes.ts`, `CategorySection.tsx`) :** Ajouter le tag souverain « Tous les Films » en tête de la section Films avec le décompte réel (24) et lever l'exclusion intra-catégorie sur les films et séries pour garantir la visibilité intégrale des œuvres autorisées.

---

## 🛑 96. Simulation Factice d'Arborescence par Liste Plate sans Filtrage Récursif de Repliement (Expand/Collapse)

* **Problème / Symptôme :** Dans le gestionnaire de dossiers physiques de l'administration (`AdminPhysicalFolderSelector.tsx`), les boutons « ▼ Tout Déplier », « ▲ Tout Replier » et les chevrons de chaque dossier basculent visuellement l'icône de `▶` à `▼`, mais aucun sous-dossier n'est jamais masqué ou déplié. L'arborescence reste une liste plate massive et statique de tous les dossiers existants (plus de 500 dossiers affichés simultanément).
* **Conséquences :**
  - Impossibilité pour l'administrateur d'explorer confortablement ses disques et bibliothèques ou de replier les dossiers secondaires.
  - Perte totale du repère hiérarchique : les sous-dossiers ne sont pas visuellement rattachés à leur parent direct car la liste brute était ordonnée par profondeur (`depth`) plutôt que par parcours d'arbre.
* **Causes Racines :**
  - L'état `expandedPaths` mettait à jour un ensemble de chemins en mémoire, mais le rendu JSX exécutait aveuglément `folders.map(...)` sur la totalité des dossiers sans conditionner la présence d'un élément enfant à l'état déplié de ses ancêtres.
  - Les sous-dossiers n'étaient pas groupés par parent (`childrenMap`), provoquant l'affichage de tous les sous-dossiers de profondeur 3 après l'intégralité des dossiers de profondeur 2.
* **Bonnes Pratiques de Remédiation :**
  - **Groupement Récursif & Nœuds Racines (`childrenMap`, `topLevelNodes`) :** Construire une table de correspondance parent $\rightarrow$ enfants et identifier automatiquement les nœuds de premier niveau (ceux sans `parentPath` ou dont le parent n'est pas dans l'ensemble indexé).
  - **Parcours en Profondeur Pré-Ordonné (Pre-Order Depth-First) :** Aplatir l'arborescence via une fonction récursive `traverse(node, level)` qui insère immédiatement chaque dossier parent puis ses enfants directs **uniquement** si `expandedPaths.has(node.path)`.
  - **Indentation Dynamique & Ergonomie Tactile :** Calculer l'indentation relative au niveau dans l'arbre (`level * 20px`), agrandir la zone tactile du chevron (24x24px) et permettre le clic direct sur le libellé du dossier pour déplier/replier instantanément.

---

## 🛑 97. Fuite d'Activité / Position Sociale sur Contenus Restreints & Erreur de Flux Trompeuse (Zero-Leak PBAC/ABAC)

* **Problème / Symptôme :**
  1. Lorsqu'un utilisateur rejoint la « Position » ou l'activité en direct d'un contact (badge `Position : [Titre]` avec bouton « Rejoindre ➔ » dans le forum, ou statut `🍿 Regarde : [Titre]` avec bouton « Rejoindre ▶ » dans l'onglet Amis) alors que son profil n'a pas les droits PBAC/ABAC sur le média cible (dossier interdit, tag exclu ou âge CSA dépassé), le lecteur affiche à tort une erreur de flux en direct : `Diffusion En Direct Indisponible - Flux multimédia temporairement indisponible (Erreur diffuseur ou lien expiré)`.
  2. Le titre et la présence de l'œuvre interdite sont fuis auprès des utilisateurs restreints (violation de la politique Zero-Leak).
* **Conséquences :**
  - Confusion chez l'utilisateur qui suppose un bug réseau ou un lien cassé du diffuseur au lieu de comprendre qu'il s'agit d'un contrôle d'accès parental ou physique.
  - Violation de confidentialité et de cloisonnement (PBAC) : un profil restreint (ex: enfant ou membre limité) peut voir les titres de films adultes ou de répertoires confidentiels consultés par ses amis.
* **Causes Racines :**
  - Les points d'entrée d'activité sociale (`GET /topics/:slug/messages` dans `forumRoutes.ts`, `GET /api/friends` dans `friendActionRoutes.ts`, `GET /api/sessions/active` dans `sessionRoutes.ts`) renvoyaient aveuglément les objets de position et de visionnage sans vérifier si l'utilisateur demandeur disposait des droits d'accès sur le `mediaId` ciblé.
  - Lors de la navigation vers `/player/${mediaId}`, le serveur refusait légitimement le flux vidéo (HTTP 403 Forbidden). L'élément `<video>` échouait donc à charger la source, déclenchant le gestionnaire `onError` de `VideoPlayerView.tsx` qui affichait le message d'erreur générique IPTV/livestream au lieu d'un écran d'accès non autorisé.
* **Bonnes Pratiques de Remédiation :**
  - **Filtrage Zéro-Fuite Côté Serveur (`canUserAccessMediaNodeId`) :**
    - Dans `forumRoutes.ts`, ne renvoyer `loc` sous `authorLocation` pour chaque message que si `canUserAccessMediaNodeId(user, loc.mediaId)` est vrai. Si l'accès est refusé, `authorLocation` vaut strictement `null`, masquant complètement le badge `Position : [Titre]` et le bouton `Rejoindre ➔`.
    - Dans `friendActionRoutes.ts`, assigner `currentActivity = null` si l'ami visionne un média interdit au profil connecté. L'ami reste indiqué en ligne (`isOnline: true`), mais le titre restreint et le bouton `Rejoindre ▶` sont invisibilisés.
    - Dans `sessionRoutes.ts`, filtrer les `activeMediaCounts` et séances actives pour exclure les médias interdits pour les non-administrateurs.
  - **Écran de Garde Explicite Côté Lecteur (`player/[id].tsx`) :**
    - Intercepter les réponses 403 Forbidden de `fetchMediaDetail` et positionner l'état `isForbidden(true)` sans monter `<VideoPlayerView>` ni tenter de charger le flux vidéo.
    - Afficher une carte sombre explicite « 🔒 Accès non autorisé » expliquant la politique de restriction avec un bouton tactile « ← Retour au catalogue ».

---

## 🛑 98. Masquage Prématuré d'un Composant Parent Avant Chargement de ses Enfants Asynchrones (Deadlock de Rendu)

* **Problème / Symptôme :** Sur la page d'accueil (`HomeScreen`), les 24 films autorisés pour un profil restreint (ex: « Membre Standard [MEMBRE] ») ne s'affichent pas du tout lorsque le cache local du navigateur est vierge. La catégorie « Films » disparaît de l'écran ainsi que son raccourci dans l'en-tête (`SiteHeader`).
* **Conséquences :**
  - Blocage complet de l'accès au catalogue pour tout nouvel utilisateur ou session sans cache persistant.
  - Impression d'une interface défaillante ou d'un catalogue vide.
* **Causes Racines :**
  - `CategorySection.tsx` conditionnait son rendu JSX à `hasConfirmedMedia = totalCount > 0 || Object.values(mediasByTag).some(...)`. Sur un cache vierge, `totalCount` valait initialement `0`. Le composant retournait donc immédiatement `null`.
  - En retournant `null`, `CategorySection` n'insérait jamais ses composants enfants `<TagCard>` dans l'arborescence React. Ces derniers ne pouvaient donc jamais monter, appeler `fetchTaxonomyMedias` ni incrémenter le décompte (`onCountChange`).
  - De surcroît, le `useEffect` de `CategorySection` notifiait `onVisibilityChange(category.id, false)` à `HomeScreen`, qui excluait définitivement la catégorie de `visibleCategories`.
* **Bonnes Pratiques de Remédiation :**
  - **Ne Jamais Bloquer le Montage des Nœuds Enfants en Cours de Chargement :** Un composant conteneur ne doit être considéré vide (`isConfirmedEmpty`) **uniquement** lorsque tous ses nœuds enfants visibles ont terminé leur requête asynchrone (`allVisibleLoaded === true`) ET que la somme des éléments retournés est égale à 0.
  - **Faire Foi aux Données Structurelles du Serveur :** Si l'API `/api/ui/taxonomy` indique déjà que la catégorie contient des médias (`cat.tags.some(t => Number(t.count) > 0)`), la catégorie doit rester visible et montée par défaut tant qu'aucune recherche ou filtre utilisateur actif n'a formellement infirmé la présence de résultats.
  - **Alignement des Clés de Cache Initiales :** Veiller à ce que la limite passée à `getCachedTaxonomyMedias` dans `getInitialCounts` corresponde exactement à celle utilisée par l'enfant lors de son fetch (ex: limite de 30 pour `all-movies`).
