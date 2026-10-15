  - **Restauration Transparente d'Erreurs :** Écouter `Hls.Events.ERROR` et appeler systématiquement `hls.startLoad()` sur `NETWORK_ERROR` et `hls.recoverMediaError()` sur `MEDIA_ERROR`.
  - **Sanctuaire Live vs VOD :** Désactiver formellement les déclencheurs de fin de lecture (`onNearEnd`, compte à rebours de suite) lorsque le média est identifié comme flux direct (`isLive = true`), et relancer immédiatement la lecture en cas d'événement `ended` intempestif.

---

## 🛑 58. Sauts Angulaires Orthogonaux en Navigation Spatiale D-Pad et Surcharge d'Autocomplétion Synchrone

* **Problème / Symptôme :** Sur télécommande ou manette, appuyer sur la touche directionnelle Droite depuis un bouton ou une carte sautait de manière illogique vers la barre de recherche située tout en haut de la page. Par ailleurs, sur la page d'accueil, la frappe de chaque caractère dans la barre de recherche lançait des dizaines de requêtes d'autocomplétion lourdes et superflues.
* **Conséquences :** Navigation spatiale imprévisible et frustrante ; latence et consommation CPU/réseau excessive lors de la saisie.
* **Causes Racines :**
  - **Calcul de Distance Spatial Non-Conique :** L'algorithme comparait `dx > 5` sans vérifier si la distance verticale `dy` écrasait `dx`. Un élément situé 300px plus haut mais ayant un centre décalé de 10px à droite était considéré comme valide pour la touche 'Droite'.
  - **Re-rendu Synchrone à Chaque Touche (`onChangeText` direct) :** `TagSearchBar` appelait immédiatement la fonction de recherche globale du parent, ré-exécutant le filtrage sur des centaines de tags.
* **Bonnes Pratiques de Remédiation :**
  - **Alignement Géométrique par Ligne et Colonne (`useTvNavigation.ts`) :** Détecter le chevauchement vertical (`hasVOverlap`). En l'absence de chevauchement sur la même rangée, rejeter tout candidat dont l'écart vertical dépasse `dx * 1.2` lors d'un mouvement horizontal.
  - **Recherche Explicite Différée (`TagSearchBar.tsx`) :** Isoler la saisie dans un état local `localText` et ne déclencher la recherche parent qu'à la validation explicite (touche Entrée ou clic sur '🔍 Rechercher'), tout en vidant immédiatement au clic sur '✕'.

---

## 🛑 59. Double Déclenchement sur Touche Entrée / Capture Phase Provoquant l'Annulation Instantanée d'une Action à Deux États (Plein Écran)

* **Problème / Symptôme :** Lors de l'appui sur la touche « Entrée » sur un bouton à bascule (comme « Plein Écran »), l'action basculait puis s'annulait instantanément (le plein écran s'activait et se désactivait en moins de 2 millisecondes), alors qu'un clic à la souris fonctionnait parfaitement.
* **Conséquences :** Impossibilité d'utiliser le mode plein écran au clavier ou à la télécommande depuis son bouton dédié.
* **Causes Racines :**
  - **Collision Capture Phase vs Gestionnaire Natif :** Le gestionnaire global de navigation spatiale écoutait les événements clavier en phase de capture (`{ capture: true }`) et exécutait `active.click()` sur la touche Entrée.
  - **Activation Double pour les Éléments Déjà Cliquables :** Les boutons HTML natifs (`<button>`) ainsi que les composants React Native Web (`Pressable` avec `role="button"`) interceptent déjà nativement la touche Entrée pour émettre un `click` ou appeler `onPress`. L'appel préalable à `active.click()` provoquait donc deux activations consécutives dans la même boucle d'événement.
* **Bonnes Pratiques de Remédiation :**
  - **Filtrage des Éléments Déjà Cliquables (`useTvNavigation.ts`) :** Ne jamais appeler artificiellement `active.click()` lors d'un événement `Enter` si l'élément actif est déjà un bouton ou un lien (`BUTTON`, `A`, `[role="button"]`, `[role="link"]`). Laisser le navigateur ou React Native Web propager naturellement l'événement.
  - **Anti-Rebond Universel de Sécurité (`fullscreen.ts`) :** Ajouter un verrou temporel (debounce) de 450 ms dans `toggleFullscreen` interdisant toute inversion d'état immédiate consécutive à des événements rapprochés.

---

## 🛑 60. Piège de Focus dans le Scrubber de la Balise Vidéo Native et Masquage du Bouton « Passer l'intro » sans Souris

* **Problème / Symptôme :** Lors de la navigation directionnelle au clavier sur la page `/player`, le focus restait piégé dans la barre de progression (timeline) du lecteur vidéo, interdisant l'accès aux boutons de la barre supérieure. De plus, le bouton « Passer l'intro » disparaissait au bout de 3 secondes dès lors qu'aucune souris physique ne bougeait.
* **Conséquences :** Lecteur vidéo inutilisable à la télécommande TV ou au clavier sans souris.
* **Causes Racines :**
  - **Focus Forcé sur la Balise Vidéo avec Contrôles (`tabIndex={0}` + `.focus()`) :** Donner le focus à une balise `<video controls>` force les navigateurs à transférer le clavier aux contrôles Shadow DOM internes (notamment le slider de progression), interceptant les flèches directionnelles.
  - **Filtrage Géométrique par Boîte Englobante sur Conteneur Superposé :** La vidéo occupant tout l'espace d'arrière-plan (`top: 8px`), les boutons d'overlay situés en haut (`top: 12px`) étaient exclus par le filtre directionnel `tR.top < cR.top - 2`.
  - **Dépendance à la Souris (`mouseActive`) pour les Actions d'Accessibilité :** Conditionner l'affichage du bouton de générique à `mouseActive` condamnait le bouton à s'évaporer sur Smart TV ou lors d'une utilisation au clavier sans souris.
* **Bonnes Pratiques de Remédiation :**
  - **Neutralisation du Scrubber Navigateur :** Définir `tabIndex={-1}` sur `<video>` et ne pas forcer le focus logiciel sur l'élément vidéo brut.
  - **Passerelles Directionnelles Spécifiques Lecteur :** Lorsque l'élément actif est dans le lecteur vidéo, la touche Haut transfère directement le focus sur la barre supérieure (`[data-player-topbar="true"]`), et la touche Bas cible le bouton « Passer l'intro » (`[data-skip-intro="true"]`).
  - **Visibilité Continue des Actions Temporelles :** Conserver le bouton « Passer l'intro » affiché pendant toute la durée du segment d'intro indépendamment de tout mouvement de souris, lui octroyer un indicateur de focus clair (`scale: 1.08`, contour blanc), et prévoir un raccourci clavier direct (`S`).

---

## 🛑 61. Maintien d'Overlays et Boutons Superposés en Plein Écran Polluant la Toile Vidéo

* **Problème / Symptôme :** Lors du passage en plein écran sur le lecteur vidéo `/player`, l'ensemble des boutons de la barre supérieure (Retour, Voix, Partager, Cast, Audio, ST, Qualité, Plein Écran) restaient superposés en permanence au-dessus du film.
* **Conséquences :** Dégradation sévère du confort de visionnage et sensation d'une interface non immersive polluant l'écran.
* **Causes Racines :**
  - **Absence d'Écouteur d'État Plein Écran :** Les composants React d'overlay étaient conditionnés à des états statiques sans observer les événements natifs `fullscreenchange` de l'API Fullscreen du DOM.
  - **Sortie Non Reliée aux Touches Universelles :** L'absence d'interception de la touche Échap et de la touche Retour de télécommande (`isEscape || isBackNav`) empêchait de quitter le plein écran sans cibler un bouton physique à l'écran.
* **Bonnes Pratiques de Remédiation :**
  - **Masquage Intégral en Plein Écran (`!isFullscreen`) :** Suivre les événements `fullscreenchange` / `webkitfullscreenchange` et masquer tous les bandeaux de boutons dès que `isFullscreen` est actif pour une toile cinématographique 100 % épurée.
  - **Sortie Ergonomique par Échap ou Retour Télécommande (`useTvNavigation.ts`) :** Intercepter `isEscape` ou `isBackNav` lorsque `isFullscreenActive()` est vrai pour quitter immédiatement le plein écran et restaurer les commandes sans quitter la page.

---

## 🛑 62. Dictature du Chemin de Répertoire et Confiance Aveugle aux Balises NFO Étrangères Écrasant la Typologie d'Épisode

* **Problème / Symptôme :** Des épisodes de séries TV (notamment Peaky Blinders Saison 4) étaient classés de manière aberrante en tant que films indépendants (`node_type = 'MOVIE'`), apparaissant isolément dans le catalogue de films avec des affiches génériques, tandis que la série globale apparaissait tronquée ou vide.
* **Conséquences :** Séparation brutale des épisodes du corpus de la série, absence de lecture séquentielle, perte des métadonnées TMDb et désorientation totale de l'utilisateur.
* **Causes Racines :**
  - **Dictature du Chemin de Dossier (`guessitParser.ts`) :** Le parser Guessit forçait inconditionnellement `mediaType = 'movie'` dès que le chemin absolu du fichier contenait `/films/`, `/film/` ou `/crime/`, écrasant la présence formelle de motifs d'épisodes (`S04E05`, `4x05`, `saison 4 episode 5`).
  - **Confiance Aveugle aux Balises XML NFO (`nfoParser.ts`) :** Lorsqu'un fichier `.nfo` externe généré par un scraper tiers contenait une balise racine `<movie>`, le parseur adoptait aveuglément le type `MOVIE`, ignorant les motifs de numérotation d'épisodes présents dans le nom de fichier ou dans les métadonnées vidéo.
  - **Verrouillage de la Réparation Hiérarchique (`hierarchyRepair.ts`) :** Le script de réparation ignorait systématiquement les nœuds typés `MOVIE`, empêchant toute requalification ultérieure d'un épisode mal étiqueté lors de l'ingestion initiale.
* **Bonnes Pratiques de Remédiation :**
  - **Garde Prioritaire Inviolable du Format Épisode (`guessitParser.ts`, `nfoParser.ts`) :** Si un fichier présente un motif clair d'épisode (`S\d+E\d+`, `\d+x\d+`, `saison \d+`) ou se trouve dans un dossier de saison, le type `EPISODE` doit prévaloir de manière absolue sur les dossiers parents (`/films/`) et sur les balises XML `<movie>`.
  - **Requalification Rétroactive Automatique (`hierarchyRepair.ts`) :** Détecter dans la base les nœuds `node_type = 'MOVIE'` contenant des motifs `SxxExx` dans leur titre ou nom de fichier, et les requalifier dynamiquement en `EPISODE` en les rattachant à leur série maîtresse.

---

## 🛑 63. Prolifération de Pseudo-Séries lors du Découpage par Dossiers de Saison et Pollution des Requêtes TMDb

* **Problème / Symptôme :** Une même série télévisée se retrouvait éclatée en plusieurs séries distinctes dans l'interface (ex: « Peaky Blinders - Saison 1 360p », « Peaky Blinders Saison 2 », « Peaky Blinders »), chacune ne contenant que les épisodes de sa saison respective. Par ailleurs, ces séries dérivées n'avaient ni poster ni synopsis TMDb.
* **Conséquences :** Fragmentation du catalogue, pollution visuelle, métadonnées absentes (fiches blanches sans poster), et impossibilité de naviguer entre saisons au sein d'une fiche unifiée.
* **Causes Racines :**
  - **Absence de Nettoyage Canonique des Noms de Dossiers (`resolveSeriesRoot`) :** Lorsqu'une saison résidait dans un dossier de premier niveau (ex: `Peaky Blinders - Saison 1 360p (2013)`), l'ingesteur créait un nœud `SHOW` portant ce nom brut au lieu de dériver le titre canonique `Peaky Blinders`.
  - **Pollution des Requêtes TMDb (`cleanShowTitle`) :** Les termes parasites (`Saison X`, `Season X`, `360p`, `480p`, `1080p`, `x264`) étaient transmis tels quels à l'API TMDb lors de la recherche TV, retournant 0 résultat.
* **Bonnes Pratiques de Remédiation :**
  - **Fonction Canonique Universelle (`extractCanonicalShowTitle`) :** Nettoyer agressivement tous les motifs de saisons, résolutions, codecs et groupes de release pour extraire le titre pur de la série avant toute création de nœud et avant toute requête vers TMDb.
  - **Agrégation et Déduplication Automatique (`hierarchyRepair.ts`) :** Identifier les pseudo-séries portant des variantes du même nom canonique via `pg_trgm`, élire le nœud maître (`SHOW`), migrer tous les épisodes et liens EAV sans conflit d'unicité, puis purger les nœuds doublons.

---

## 🛑 64. Rigidité des Catégories Racines (Amnésie du Singulier `/serie/`) et Désaffiliation d'Épisodes

* **Problème / Symptôme :** Sur certains volumes de stockage (comme `/My Passport`), l'ensemble des épisodes restaient orphelins avec `parent_id = null`, exclus des séries et invisibles dans les arborescences.
* **Conséquences :** Des centaines d'épisodes présents sur le disque n'étaient rattachés à aucune série et flottaient de façon erratique dans le système.
* **Causes Racines :**
  - **Liste Restrictive des Catégories Racines (`SERIES_ROOT_CATEGORIES`) :** La liste n'admettait que les formes plurielles (`series`, `séries`, `shows`), ignorant le singulier `serie` et `série` pourtant très fréquent dans l'organisation des disques durs.
* **Bonnes Pratiques de Remédiation :**
  - **Élargissement Exhaustif des Catégories Racines :** Inclure systématiquement les formes singulières et plurielles (`serie`, `series`, `série`, `séries`, `shows`, `tv shows`, `emission`, `emissions`).
  - **Résolution Floue Trigramme de Secours :** En l'absence de répertoire parent direct de type série, utiliser une recherche trigramme floue (`similarity > 0.4`) sur le titre canonique de l'épisode pour le raccrocher automatiquement au nœud `SHOW` existant le plus pertinent.
