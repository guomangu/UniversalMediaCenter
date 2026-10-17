  - **Utiliser Exclusivement \`scrollRef.current.scrollTo({ y, animated: true })\` :** C'est la seule méthode universellement comprise et synchronisée par le moteur React Native Web.
  - **Verrou Anti-Jitter (\`isJumpingRef\`) :** Poser un verrouillage temporaire (750 ms) pendant l'animation de saut pour suspendre la détection intermédiaire de \`updateActiveCategory\` et garantir une arrivée fluide et stable sur la cible.

---

## 🛑 84. Faille d'Étanchéité des Dossiers Restreints par Amnésie de Taxonomie, Conteneurs sans Chemins Physiques et Alias Multi-OS

* **Problème / Symptôme :** Un utilisateur restreint (ex: profil Enfant ou Membre sans droit d'accès à certains répertoires) accède quand même aux films, séries ou épisodes situés dans les dossiers physiques qui lui sont interdits.
* **Conséquences :** Brèche de sécurité majeure dans le contrôle d'accès parental et partitionnement des bibliothèques ; violation directe de la promesse de protection ABAC.
* **Causes Racines :**
  - **Amnésie de la Route de Taxonomie Principale :** L'endpoint \`GET /api/ui/taxonomy/medias\`, qui alimente pourtant tous les rails et catalogues de la page d'accueil, n'intégrait aucun filtre utilisateur et servait l'intégralité de la base de données brute.
  - **Conteneurs sans Chemins Physiques Directs (\`SHOW\`, \`COLLECTION\`, \`SEASON\`) :** Les séries et collections ont \`video_file_path\` à \`null\` en base. Une vérification naïve de \`isMediaAllowedForUser\` sur ces conteneurs testait une chaîne vide, laissant passer toutes les séries dont les épisodes étaient pourtant dans un dossier interdit.
  - **Discordance Multi-OS (/var/home vs /home sur Fedora Atomic/Bazzite) :** Si un fichier était indexé sous \`video_file_path = /home/...\` et que la règle interdisait \`/var/home/...\` (ou inversement), un simple \`includes\` échouait.
  - **Assimilation Erronée des Dossiers Relatifs à des Racines Disque :** Une règle comme \`/Films/Adultes\` était traitée comme un chemin absolu à la racine \`/\` du système d'exploitation au lieu de matcher les sous-dossiers correspondants.
  - **Cache PWA Global Indépendant de l'Utilisateur :** Le \`localStorage\` client partageait la même clé de cache \`tax_...\` entre l'administrateur et les utilisateurs restreints sur le même navigateur.
* **Bonnes Pratiques de Remédiation :**
  - **Double Barrière SQL + JS (Loi Zero-Leak) :** Générer systématiquement des clauses SQL \`buildMediaAccessConditions(user, tableAlias)\` directement dans les requêtes de taxonomie, doublées d'un filtre JavaScript strict \`isMediaAllowedForUser\`.
  - **Résolution Automatique des Chemins d'Enfants :** Pour tout SHOW, SEASON ou COLLECTION, résoudre dynamiquement l'\`effectivePhysicalPath\` et les chemins des enfants (\`childPaths\`) afin que le blocage d'un dossier interdise automatiquement le conteneur parent.
  - **Normalisation Symétrique des Chemins & Segments :** Traiter de façon transparente les alias \`/var/home\` $\leftrightarrow$ \`/home\`, normaliser en Unicode NFC et valider les frontières de répertoires.
  - **Isolation Stricte du Cache Local par Utilisateur :** Clés de cache versionnées incluant l'identifiant et le rôle utilisateur (\`tax_v7_${userKey}_...\`) et purge immédiate de tous les caches au \`logout\` ou à la connexion.

---

## 🛑 85. Pollution Visuelle de l'Accueil par des Catégories de Tags Vides et Désynchronisation des Raccourcis d'En-tête

* **Problème / Symptôme :** Sur la page d'accueil, des sections de catégories de tags (ex: Sagas, Séries, Films, Studios, etc.) s'affichent avec leur titre et un badge « 0/X tags » alors qu'aucun média n'y est présent, ou un chip de raccourci reste affiché dans la barre supérieure (\`SiteHeader\`) et fait sauter l'utilisateur vers le néant lors du clic.
* **Conséquences :**
  - Expérience utilisateur encombrée et dégradée (UI polluée de cadres vides sur mobile, desktop et TV).
  - Désynchronisation trompeuse entre les raccourcis supérieurs et le contenu réel de la page.
  - Incohérence lors de l'application de filtres de types (ex: filtre « Films » laissant la section « Séries » vide affichée) ou de recherche textuelle.
* **Causes Racines :**
  - **Masquage conditionnel restreint à la recherche :** \`CategorySection\` ne renvoyait \`null\` que si \`searchQuery\` était actif (\`if (searchQuery && allEmpty) return null;\`). En navigation normale ou avec un filtre par type (\`activeFilter\`), les sections sans aucun média restaient affichées.
  - **Amnésie du parent (\`HomeScreen\`) :** \`CategorySection\` n'émettait aucun événement de visibilité vers le haut ; \`SiteHeader\` recevait la liste statique brute de toutes les catégories sans savoir lesquelles contenaient des cartes réelles.
  - **Absence de filtrage \`HAVING COUNT > 0\` au niveau SQL :** L'endpoint \`GET /api/ui/taxonomy\` renvoyait des tags avec \`count = 0\` et des catégories orphelines.
  - **Stagnation des compteurs :** Lors d'un changement de filtre, \`counts\` conservait les anciennes valeurs au lieu de les réinitialiser de façon synchrone pendant la phase de rendu React.
* **Bonnes Pratiques de Remédiation :**
  - **Filtrage SQL Amont & Rejet des Vides :** Appliquer systématiquement \`HAVING COUNT(...) > 0\` sur toutes les agrégations de taxonomie, et éliminer toute catégorie sans aucun tag avec média à la racine de l'API.
  - **Règle de Masquage Universelle de Section :** Si une catégorie ne contient aucun tag actif avec des médias (\`activeTags.length === 0\`) ou si tous les tags visibles chargés rapportent 0 média (\`allVisibleLoaded && totalCount === 0\`), renvoyer inconditionnellement \`null\` sans afficher de conteneur ni de badge.
  - **Notification Réactive Parent-Enfant (\`onVisibilityChange\`) :** Informer \`HomeScreen\` dès qu'une section devient vide pour actualiser \`visibleCategories\` transmis à \`SiteHeader\`.
  - **Repli Automatique du Chip Actif :** Si la catégorie active devient masquée lors d'un filtrage, basculer immédiatement \`activeCategoryId\` sur la première catégorie visible.

---

## 🛑 86. Amnésie de Contrôle d'Accès dans les Moteurs de Recommandations Connexes et Cache PWA d'Écran Détail Partagé

* **Problème / Symptôme :** Sur la fiche d'un média (`/media/[id]`), des œuvres interdites apparaissent dans les sections « Genres & Thématiques » (`relatedTags`), « Titres Similaires » (`similarMedias`), les œuvres du même studio ou la saga parente, ou bien un utilisateur restreint visualisant une fiche directement accède aux données restées en cache LocalStorage/Mémoire d'une session précédente.
* **Conséquences :**
  - Violation flagrante du contrôle parental et du partitionnement physique des dossiers (Loi Zero-Leak).
  - Un enfant ou invité peut découvrir des affiches, titres ou métadonnées de films interdits via les blocs de recommandation ou le cache PWA.
* **Causes Racines :**
  - **Omission de l'argument `user` dans les calculateurs de graphes et de similarité :** Des fonctions comme `getRelatedTagsForMedia` ou `getTfIdfSimilarMedias` requêtaient la base de données brute sans aucune clause `buildMediaAccessConditions` et sans appeler `isMediaAllowedForUser`.
  - **Amnésie des routes connexes :** Les endpoints de studios (`studioFilmsRows`), sagas parentes (`parentSaga`), exploration (`/stats`), chaînes IPTV (`/live`), reposts et séances de visionnage partagées ne vérifiaient pas si les médias cibles respectaient les restrictions de l'utilisateur courant.
  - **Clés de cache frontend globales et amnésie de la mémoire vive :** Les requêtes API et les hooks d'écran de détail mettaient en cache les réponses sous des clés agnostiques à l'utilisateur (`media_detail_${id}`). Au logout, seul une partie du LocalStorage était purgée, laissant la `Map` mémoire vive intacte.
* **Bonnes Pratiques de Remédiation :**
  - **Propagation Universelle du Profil `user` :** Tout moteur de calcul de proximité sémantique, de tag ou de recommandation doit accepter `user: UserSession` en paramètre obligatoire, injecter les filtres SQL amont et filtrer en mémoire JS.
  - **Filtrage des Conteneurs et Sagas :** Si une saga parente ne compte plus aucun média accessible pour l'utilisateur (`sagaSiblings.length === 0`), masquer l'intégralité du bloc saga.
  - **Isolation Stricte du Cache Client :** Inclure systématiquement `${userKey}` dans toutes les clés de cache LocalStorage et requêtes GET côté client (`media_detail_${userKey}_${id}`).
  - **Purge Globale Mémoire + Disque :** Lors du logout ou du switch de compte, vider instantanément à la fois le LocalStorage et la `Map` mémoire vive du client PWA (`clearMemoryCache()`).
  - **Écran de Repli Convivial :** En cas d'accès direct par URL à une œuvre interdite, renvoyer immédiatement HTTP 403 et afficher une carte soignée « Contenu Restreint » invitant cordialement à revenir à l'accueil.

---

## 🛑 87. Flash Visuel de Données Dépassées ou Fictives (FOUC) et Pré-Rendu Optimiste de Tags Sans Médias Confirmés

* **Problème / Symptôme :** Lors d'un rechargement forcé (`Ctrl+Maj+R`) ou d'une connexion avec profil restreint, les titres de catégories et les noms de tags (y compris d'œuvres interdites ou de faux tags par défaut) s'affichent pendant 2 à 3 secondes, avant de disparaître soudainement une fois les médias chargés. L'utilisateur restreint a ainsi le temps d'apercevoir l'existence de contenus qui lui sont interdits.
* **Conséquences :**
  - Fuite d'information cognitive : l'utilisateur découvre l'existence de films, sagas ou catégories interdites.
  - Sensation de bug visuel (sauts d'éléments dans l'interface et disparition brutale de bandeaux).
* **Causes Racines :**
  - **Constantes de repli avec données mockées en dur :** `DEFAULT_TAXONOMY_CATEGORIES` contenait des titres en dur (Pixar, Rocky, Tarantino...). Sur un rechargement forcé sans cache LocalStorage, le hook `useState` initialisait immédiatement ces catégories fictives.
  - **Initialisation optimiste de `loading` à `false` :** `HomeScreen` démarrait avec `loading = false`, rendant immédiatement les composants enfants avant même la première réponse HTTP de l'API.
  - **Fuite du titre de tag avant validation des médias (`TagCard.tsx`) :** Le composant `TagCard` affichait le bandeau d'en-tête (`tag.label`) tant que `loading` était à `true`, même si `medias.length === 0`. Si la requête retournait ensuite 0 média autorisé, le tag disparaissait, mais son titre avait été exposé pendant 3 secondes.
  - **Affichage prématuré du titre de catégorie (`CategorySection.tsx`) :** La section s'affichait par défaut tant que tous les tags n'avaient pas fini de charger (`!(allVisibleLoaded && totalCount === 0)`).
  - **Amnésie des enfants dans les requêtes de sagas (`taxonomyRoutes.ts`) :** La clause SQL `COUNT(c.id)` ne filtrait pas les enfants `c` par les permissions de l'utilisateur.
* **Bonnes Pratiques de Remédiation :**
  - **Bannir les listes de tags mockées :** `DEFAULT_TAXONOMY_CATEGORIES` doit être un tableau strictement vide (`[]`).
  - **État de chargement strict au boot :** `loading = !cached || cached.length === 0`. Tant que les catégories vérifiées ne sont pas disponibles, afficher uniquement un indicateur d'attente sobre sans aucun texte.
  - **Zéro affichage sans média confirmé :** Dans `TagCard`, si `medias.length === 0`, renvoyer inconditionnellement `null`. Un titre de tag ne doit JAMAIS apparaître à l'écran sans au moins 1 média accessible certifié.
  - **Catégorie conditionnée à `hasConfirmedMedia` :** `CategorySection` ne doit afficher son en-tête que si au moins un média a été effectivement validé (`totalCount > 0`).
  - **Filtrage SQL strict sur les enfants `c` :** Appliquer `childConds = buildMediaAccessConditions(user, 'c')` dans `sagasQuery` pour que les sagas sans aucun film autorisé aient `count = 0` dès la requête SQL initiale.

---

## 🛑 88. Troncature Mobile des Onglets et Barres d'Actions par Absence de Conteneur Défilable Horizontal

* **Problème / Symptôme :** Sur écran de smartphone ou petit écran tactile (< 600px), les barres de navigation multi-onglets (ex: Panneau d'administration, Espace utilisateur, sélecteurs de zones de layout) sont tronquées sur le côté droit. Les onglets situés après le 2e ou 3e élément sont masqués ou inaccessibles.
* **Conséquences :**
  - Impossibilité pour un administrateur sur mobile d'accéder aux sections clés (« Comptes », « Rails & Layout », « param.yaml », « Sources IPTV »).
  - Dégradation sévère de l'expérience mobile sur les profils (« Reprendre », « Favoris », « Salons »).
* **Causes Racines :**
  - Utilisation d'un simple `<View style={{ flexDirection: 'row' }}>` non scrollable et sans retour à la ligne pour des séries de 5 ou 6 boutons horizontaux de plus de 120px chacun.
  - Absence de `flexShrink: 0` et de `whiteSpace: 'nowrap'`, provoquant le rétrécissement anormal ou le pliage du libellé des boutons.
* **Bonnes Pratiques de Remédiation :**
  - **Encapsulation Systématique dans `<ScrollView horizontal>` :** Remplacer tout conteneur d'onglets ou de filtres par un `<ScrollView horizontal showsHorizontalScrollIndicator={false}>`.
  - **Prise en charge Web & Tactile :** Configurer `overflowX: 'auto'`, `WebkitOverflowScrolling: 'touch'`, `scrollbarWidth: 'none'` pour garantir un glissement fluide au doigt sur mobile et à la molette sur desktop.
  - **Boutons Incompressibles :** Appliquer `flexShrink: 0` et `whiteSpace: 'nowrap'` sur chaque onglet pour préserver l'intégrité visuelle des libellés et icônes.

---

## 🛑 89. Désynchronisation de Format de Réponse API vs Frontend pour les Favoris et Amnésie de Cache

* **Problème / Symptôme :** L'onglet « Favoris » de la page utilisateur affiche systématiquement une liste vide ou ne charge rien alors que l'utilisateur a plusieurs favoris en base, ou le retrait/ajout d'un favori ne se reflète pas immédiatement à l'écran.
* **Conséquences :**
  - Fonctionnalité de favoris perçue comme brisée ou inopérante.
  - Obligation de recharger toute la page pour espérer voir le changement.
* **Causes Racines :**
  - **Incompatibilité de contrat de données :** L'API `GET /api/users/me/favorites` renvoyait un tableau JSON brut `[ { id, ... } ]`, tandis que le client frontend exécutait `data.favorites || []`. Comme `data` était un tableau, `data.favorites` valait `undefined`, résolvant toujours un tableau vide `[]`.
  - **Amnésie de cache :** Lors du basculement d'un favori (`toggleFavorite`), le cache mémoire du profil n'était pas invalidé ou mis à jour de façon optimiste.
* **Bonnes Pratiques de Remédiation :**
  - **Dépouillement Défensif du JSON :** Utiliser systématiquement `Array.isArray(data) ? data : (data.favorites || [])` pour absorber les variantes de formats de réponse.
  - **Mise à Jour Optimiste et Émission d'Événements :** Mettre à jour immédiatement la liste locale de favoris (retrait instantané de la carte sans rechargement lourd) et synchroniser le cache mémoire avec la nouvelle liste.

---

## 🛑 90. Asymétrie Relationnelle dans les Requêtes d'Amis et Divergence de Salons Privés 1-on-1

* **Problème / Symptôme :** Deux utilisateurs amis ne voient pas les publications de l'autre dans leur fil d'avis, ou lorsqu'un utilisateur ouvre un message privé avec un ami, les deux personnes se retrouvent dans des salons séparés et ne reçoivent pas les messages mutuels.
* **Conséquences :**
  - Rupture totale de la communication privée 1-on-1.
  - Fil d'avis tronqué masquant la moitié des interactions sociales entre amis.
* **Causes Racines :**
  - **Requête unilatérale en base :** La table `user_friends` enregistre `(userId, friendId)`. Une requête naïve `WHERE userId = sessionUser.id` omettait systématiquement toutes les amitiés où l'utilisateur courant était le destinataire `friendId`.
  - **Génération asymétrique de slug de topic :** La génération de slug basée sur `private-user-${otherUserId}` créait un salon `private-user-B` pour l'utilisateur A et un salon `private-user-A` pour l'utilisateur B, cloisonnant les deux correspondants dans des discussions étanches.
* **Bonnes Pratiques de Remédiation :**
  - **Requête Bidirectionnelle Symétrique :** Utiliser systématiquement `or(eq(userId, sessionUser.id), eq(friendId, sessionUser.id))` et extraire l'ID du partenaire `row.userId === sessionUser.id ? row.friendId : row.userId`.
  - **Génération Déterministe de Slug Trié :** Construire les salons de messagerie directe avec les identifiants triés par ordre lexicographique : `dm-${[userA.id, userB.id].sort().join('-')}`, garantissant un identifiant unique partagé par les deux participants.

---

## 🛑 91. Absence d'Upsert et Omission de Flux Global dans les Avis et Activités Sociales

* **Problème / Symptôme :** Un utilisateur publiant un deuxième avis sur une œuvre crée un doublon au lieu de mettre à jour son appréciation, ou l'onglet « Fil d'avis » reste vide tant qu'un utilisateur n'a pas explicitement ajouté des amis.
* **Conséquences :**
  - Encombrement et duplication des avis communautaires sous les œuvres.
  - Sensation de réseau social « ville fantôme » pour tout nouvel utilisateur sans cercle d'amis préexistant.
* **Causes Racines :**
  - Insertion brute `INSERT INTO user_reposts` sans clause d'upsert (`onConflictDoUpdate`) ou vérification d'unicité préalable par `(userId, mediaId)`.
  - Absence d'un endpoint de feed d'activité combiné réunissant les avis des amis, les avis de l'utilisateur et les avis récents de la communauté.
* **Bonnes Pratiques de Remédiation :**
  - **Mise à Jour Idempotente (Upsert) :** Avant d'insérer une critique, vérifier si l'utilisateur a déjà publié sur l'œuvre et effectuer un `UPDATE` (mise à jour de la note et du commentaire) plutôt qu'un double `INSERT`.
  - **Feed Hybride & Tri Temporel :** Proposer un endpoint `GET /api/reposts/feed` combinant dynamiquement les avis du cercle d'amis et les avis publics récents, tout en appliquant les restrictions d'accès ABAC/PBAC.
