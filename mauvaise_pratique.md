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

## 🛑 86. Amnésie de Contrôle d\x27Accès dans les Moteurs de Recommandations Connexes et Cache PWA d\x27Écran Détail Partagé

* **Problème / Symptôme :** Sur la fiche d\x27un média (`/media/[id]`), des œuvres interdites apparaissent dans les sections « Genres & Thématiques » (`relatedTags`), « Titres Similaires » (`similarMedias`), les œuvres du même studio ou la saga parente, ou bien un utilisateur restreint visualisant une fiche directement accède aux données restées en cache LocalStorage/Mémoire d\x27une session précédente.
* **Conséquences :**
  - Violation flagrante du contrôle parental et du partitionnement physique des dossiers (Loi Zero-Leak).
  - Un enfant ou invité peut découvrir des affiches, titres ou métadonnées de films interdits via les blocs de recommandation ou le cache PWA.
* **Causes Racines :**
  - **Omission de l\x27argument `user` dans les calculateurs de graphes et de similarité :** Des fonctions comme `getRelatedTagsForMedia` ou `getTfIdfSimilarMedias` requêtaient la base de données brute sans aucune clause `buildMediaAccessConditions` et sans appeler `isMediaAllowedForUser`.
  - **Amnésie des routes connexes :** Les endpoints de studios (`studioFilmsRows`), sagas parentes (`parentSaga`), exploration (`/stats`), chaînes IPTV (`/live`), reposts et séances de visionnage partagées ne vérifiaient pas si les médias cibles respectaient les restrictions de l\x27utilisateur courant.
  - **Clés de cache frontend globales et amnésie de la mémoire vive :** Les requêtes API et les hooks d\x27écran de détail mettaient en cache les réponses sous des clés agnostiques à l\x27utilisateur (`media_detail_${id}`). Au logout, seul une partie du LocalStorage était purgée, laissant la `Map` mémoire vive intacte.
* **Bonnes Pratiques de Remédiation :**
  - **Propagation Universelle du Profil `user` :** Tout moteur de calcul de proximité sémantique, de tag ou de recommandation doit accepter `user: UserSession` en paramètre obligatoire, injecter les filtres SQL amont et filtrer en mémoire JS.
  - **Filtrage des Conteneurs et Sagas :** Si une saga parente ne compte plus aucun média accessible pour l\x27utilisateur (`sagaSiblings.length === 0`), masquer l\x27intégralité du bloc saga.
  - **Isolation Stricte du Cache Client :** Inclure systématiquement `${userKey}` dans toutes les clés de cache LocalStorage et requêtes GET côté client (`media_detail_${userKey}_${id}`).
  - **Purge Globale Mémoire + Disque :** Lors du logout ou du switch de compte, vider instantanément à la fois le LocalStorage et la `Map` mémoire vive du client PWA (`clearMemoryCache()`).
  - **Écran de Repli Convivial :** En cas d\x27accès direct par URL à une œuvre interdite, renvoyer immédiatement HTTP 403 et afficher une carte soignée « Contenu Restreint » invitant cordialement à revenir à l\x27accueil.

---

## 🛑 87. Flash Visuel de Données Dépassées ou Fictives (FOUC) et Pré-Rendu Optimiste de Tags Sans Médias Confirmés

* **Problème / Symptôme :** Lors d\x27un rechargement forcé (`Ctrl+Maj+R`) ou d\x27une connexion avec profil restreint, les titres de catégories et les noms de tags (y compris d\x27œuvres interdites ou de faux tags par défaut) s\x27affichent pendant 2 à 3 secondes, avant de disparaître soudainement une fois les médias chargés. L\x27utilisateur restreint a ainsi le temps d\x27apercevoir l\x27existence de contenus qui lui sont interdits.
* **Conséquences :**
  - Fuite d\x27information cognitive : l\x27utilisateur découvre l\x27existence de films, sagas ou catégories interdites.
  - Sensation de bug visuel (sauts d\x27éléments dans l\x27interface et disparition brutale de bandeaux).
* **Causes Racines :**
  - **Constantes de repli avec données mockées en dur :** `DEFAULT_TAXONOMY_CATEGORIES` contenait des titres en dur (Pixar, Rocky, Tarantino...). Sur un rechargement forcé sans cache LocalStorage, le hook `useState` initialisait immédiatement ces catégories fictives.
  - **Initialisation optimiste de `loading` à `false` :** `HomeScreen` démarrait avec `loading = false`, rendant immédiatement les composants enfants avant même la première réponse HTTP de l\x27API.
  - **Fuite du titre de tag avant validation des médias (`TagCard.tsx`) :** Le composant `TagCard` affichait le bandeau d\x27en-tête (`tag.label`) tant que `loading` était à `true`, même si `medias.length === 0`. Si la requête retournait ensuite 0 média autorisé, le tag disparaissait, mais son titre avait été exposé pendant 3 secondes.
  - **Affichage prématuré du titre de catégorie (`CategorySection.tsx`) :** La section s\x27affichait par défaut tant que tous les tags n\x27avaient pas fini de charger (`!(allVisibleLoaded && totalCount === 0)`).
  - **Amnésie des enfants dans les requêtes de sagas (`taxonomyRoutes.ts`) :** La clause SQL `COUNT(c.id)` ne filtrait pas les enfants `c` par les permissions de l\x27utilisateur.
* **Bonnes Pratiques de Remédiation :**
  - **Bannir les listes de tags mockées :** `DEFAULT_TAXONOMY_CATEGORIES` doit être un tableau strictement vide (`[]`).
  - **État de chargement strict au boot :** `loading = !cached || cached.length === 0`. Tant que les catégories vérifiées ne sont pas disponibles, afficher uniquement un indicateur d\x27attente sobre sans aucun texte.
  - **Zéro affichage sans média confirmé :** Dans `TagCard`, si `medias.length === 0`, renvoyer inconditionnellement `null`. Un titre de tag ne doit JAMAIS apparaître à l\x27écran sans au moins 1 média accessible certifié.
  - **Catégorie conditionnée à `hasConfirmedMedia` :** `CategorySection` ne doit afficher son en-tête que si au moins un média a été effectivement validé (`totalCount > 0`).
  - **Filtrage SQL strict sur les enfants `c` :** Appliquer `childConds = buildMediaAccessConditions(user, \x27c\x27)` dans `sagasQuery` pour que les sagas sans aucun film autorisé aient `count = 0` dès la requête SQL initiale.

---

## 🛑 88. Troncature Mobile des Onglets et Barres d\x27Actions par Absence de Conteneur Défilable Horizontal

* **Problème / Symptôme :** Sur écran de smartphone ou petit écran tactile (< 600px), les barres de navigation multi-onglets (ex: Panneau d\x27administration, Espace utilisateur, sélecteurs de zones de layout) sont tronquées sur le côté droit. Les onglets situés après le 2e ou 3e élément sont masqués ou inaccessibles.
* **Conséquences :**
  - Impossibilité pour un administrateur sur mobile d\x27accéder aux sections clés (« Comptes », « Rails & Layout », « param.yaml », « Sources IPTV »).
  - Dégradation sévère de l\x27expérience mobile sur les profils (« Reprendre », « Favoris », « Salons »).
* **Causes Racines :**
  - Utilisation d\x27un simple `<View style={{ flexDirection: \x27row\x27 }}>` non scrollable et sans retour à la ligne pour des séries de 5 ou 6 boutons horizontaux de plus de 120px chacun.
  - Absence de `flexShrink: 0` et de `whiteSpace: \x27nowrap\x27`, provoquant le rétrécissement anormal ou le pliage du libellé des boutons.
* **Bonnes Pratiques de Remédiation :**
  - **Encapsulation Systématique dans `<ScrollView horizontal>` :** Remplacer tout conteneur d\x27onglets ou de filtres par un `<ScrollView horizontal showsHorizontalScrollIndicator={false}>`.
  - **Prise en charge Web & Tactile :** Configurer `overflowX: \x27auto\x27`, `WebkitOverflowScrolling: \x27touch\x27`, `scrollbarWidth: \x27none\x27` pour garantir un glissement fluide au doigt sur mobile et à la molette sur desktop.
  - **Boutons Incompressibles :** Appliquer `flexShrink: 0` et `whiteSpace: \x27nowrap\x27` sur chaque onglet pour préserver l\x27intégrité visuelle des libellés et icônes.
