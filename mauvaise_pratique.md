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
