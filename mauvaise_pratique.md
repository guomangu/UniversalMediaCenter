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

---

## 🛑 65. Piège de Focus dans le Shadow DOM du Lecteur Vidéo Natif (`<video controls>`) et Rétention des Touches Directionnelles

* **Problème / Symptôme :** Lors de la navigation au clavier ou à la télécommande dans la page `/player`, dès que l'utilisateur clique sur la vidéo ou active la barre de progression, le focus système est capturé par l'élément interne `<input type="range">` du Shadow DOM natif du navigateur. Dès lors, les flèches directionnelles Haut/Bas ne permettent plus d'atteindre les boutons de la barre supérieure (Retour, Audio, Sous-titres, Plein Écran) et l'utilisateur se retrouve prisonnier de la barre de lecture.
* **Conséquences :** Rupture de l'accessibilité TV/manette (D-Pad), impossibilité de remonter vers les contrôles supérieurs sans souris physique, et dégradation de l'expérience utilisateur.
* **Causes Racines :**
  - **Focus Direct sur l'Élément Vidéo (`tabIndex={0}` implicite avec `controls`) :** Laisser le focus natif s'établir directement sur la balise `<video>` permet au moteur de rendu du navigateur (Blink/Gecko) de transférer le focus sur les sous-composants non stylables du Shadow DOM (scrubber, volume).
  - **Absence de Conteneur Focusable Intermédiaire :** Sans conteneur parent explicite interceptant les événements, l'arbre d'accessibilité DOM ne peut pas diriger la navigation spatiale vers le niveau hiérarchique supérieur.
  - **Sélecteur de Qualité Factice :** Présence d'un menu de sélection de qualité vidéo (`PlayerQualityModal`) n'ayant aucun effet sur le flux HLS DirectPlay sous-jacent, induisant l'utilisateur en erreur.
* **Bonnes Pratiques de Remédiation :**
  - **Délégation de Focus vers un Conteneur Spatial (`VideoPlayerView.tsx`) :**
    - Assigner `tabIndex={-1}` à la balise `<video>` et rediriger son événement `onFocus` vers un conteneur parent focusable (`Pressable` avec `data-player-container="true"` et `tabIndex={0}`).
    - Ainsi, les touches Gauche / Droite pilotent la progression temporelle (-10s / +10s) au niveau applicatif sans jamais piéger le focus dans le Shadow DOM.
  - **Liaison Spatiale Bidirectionnelle Déterministe (`useTvNavigation.ts`) :**
    - Relier explicitement la touche Haut du conteneur lecteur vers les boutons de la barre supérieure (`[data-player-topbar="true"]`).
    - Relier la touche Bas de la barre supérieure directement au conteneur lecteur ou au bouton « Passer l'intro ».
  - **Élimination des Contrôles Inopérants :**
    - Supprimer tout bouton d'action décoratif (comme le choix de qualité statique) pour ne conserver que les fonctionnalités réellement actives et adaptatives du lecteur.

---

## 🛑 66. Présence Incongrue du Bouton « Passer l'intro » sur des Flux Télévisés et Médias IPTV en Direct

* **Problème / Symptôme :** Lors du visionnage d'une chaîne de télévision en direct (IPTV) dans `/player`, le bouton « Passer l'intro » apparaissait pendant les 90 premières secondes de visionnage ou lors du zapping, alors qu'un flux en direct continu ne comporte par définition aucun générique skippable et qu'un saut temporel (+85s) brise la synchronisation du flux live.
* **Conséquences :** Confusion ergonomique majeure pour l'utilisateur, pollution visuelle inutile sur l'écran TV et risque de sauter en avant au-delà du buffer direct, provoquant des erreurs de lecture.
* **Causes Racines :**
  - **Calcul d'Intro Fallback Non Conditionné au Type de Contenu (`VideoPlayerView.tsx`) :** L'expression calculant la visibilité du bouton se basait uniquement sur `curTime < (intro?.end ?? 90.04)` sans vérifier si le média était en direct (`isLive = true`).
  - **Délai d'Acquisition de l'Attribut `isLive` (`player/[id].tsx`) :** L'état `isLive` était initialisé à `false` par défaut et n'était mis à jour qu'asynchronement après résolution de la promesse `fetchMediaDetail`, laissant une fenêtre d'affichage parasite au montage du composant.
* **Bonnes Pratiques de Remédiation :**
  - **Garde `!isLive` Absolue sur l'Affichage de l'Intro (`VideoPlayerView.tsx`) :** Interdire formellement le rendu du composant avec `const showBtn = !isLive && !isFullscreen && showSkipIntro && ...`.
  - **Propagation Synchrone de l'Origine Direct (`TvChannelCard.tsx`, `MediaCard.tsx`) :** Transmettre le paramètre `isLive=1` dès la navigation vers `/player/[id]` afin que le lecteur sache immédiatement, avant même le premier appel réseau, qu'il s'agit d'un flux direct.
  - **Neutralisation des États et Handlers d'Intro (`player/[id].tsx`) :** Forcer `showSkipIntro={false}` et `intro={null}` pour tout flux identifié comme `isLive` ou `LIVE_CHANNEL`.

---

## 🛑 67. Dictionnaires de Fautes de Frappe Codés en Dur dans le Nettoyeur de Titre

* **Problème / Symptôme :** Tentative de corriger des fautes de frappe de releases (ex: `Peacky Blinders` -> `Peaky Blinders`, `Breking Bad` -> `Breaking Bad`) par des conditions régulières hardcodées `if (/^peac?ky/i) return 'Peaky Blinders'`.
* **Conséquences :** Dette technique incontrôlable, impossibilité de passer à l'échelle sur des milliers de séries et films, fragilité aux variantes orthographiques imprévues et maintenance manuelle permanente.
* **Causes Racines :**
  - **Absence de Pipeline Phonétique et Algorithmique Universel :** Le recours à un dictionnaire statique résulte du manque d'un moteur de réconciliation floue in-database et de fallback tolérant aux fautes lors des requêtes distantes.
* **Bonnes Pratiques de Remédiation :**
  - **Normalisation Phonétique Graphématique Universelle (`normalizePhoneticSpelling`) :** Dé-doubler les consonnes répétées (`vikinggs` -> `vikings`), normaliser les digraphes courants (`ck` -> `k`, `ph` -> `f`) de façon purement algorithmique sans dictionnaire statique.
  - **Résolution Hybride PostgreSQL Locale (`pg_trgm` + `dmetaphone` + `levenshtein`) :** Rapprocher les variantes d'un média à la volée en base locale dès lors que `dmetaphone(title) = dmetaphone(query)` ou `similarity(title, query) >= 0.65`.
  - **Cascade de Repli TMDb Résiliente (`resolveFuzzyTmdbId`) :** Si la recherche exacte TMDb échoue, déclencher la recherche phonétique puis l'API d'autocorrection linguistique Wikipedia OpenSearch ("Did you mean") pour obtenir le titre propre officiel.

---

## 🛑 68. Court-Circuitage d'HLS.js par `canPlayType` Faux-Positif et Défaillance de Téléchargement des Segments en Direct

* **Problème / Symptôme :** Lors du visionnage d'une chaîne de télévision en direct (IPTV) dans `/player`, la lecture démarre puis s'arrête ou se fige irrémédiablement dans les 3 premières secondes.
* **Conséquences :** Impossibilité totale de regarder la télévision en direct sur navigateur Web, le lecteur lisant le premier fragment puis s'interrompant définitivement.
* **Causes Racines :**
  - **Faux-Positif de `canPlayType` Court-Circuitant HLS.js (`VideoPlayerView.tsx`) :** Le composant conditionnait l'utilisation d'HLS.js à `Boolean(Hls.isSupported() && !canPlayNative)`. Or, sous Chromium/Linux, avec certains codecs système (GStreamer) ou avec des extensions de lecture HLS, `video.canPlayType('application/vnd.apple.mpegurl')` retourne une chaîne non vide ("maybe"), qui est évaluée comme `true` en JavaScript. Par conséquent, `!canPlayNative` valait `false` et HLS.js était purement et simplement DÉSACTIVÉ (`shouldUseHlsJs = false`).
  - **Incapacité du Moteur HTML5 Natif à Gérer les Playlists HLS Glissantes :** Forcé en mode natif `<video src={streamUrl}>`, le navigateur télécharge le fichier m3u8 comme un simple fichier multimédia, lit le premier chunk audio/vidéo présent dans le buffer initial (~3 secondes), puis s'arrête net car il est incapable de rafraîchir la playlist en boucle sans MediaSource Extensions (MSE).
  - **Chargement Asynchrone CDN Externe (`_layout.tsx`) :** L'injection tardive de `hls.min.js` depuis un CDN externe accentuait ce problème en n'étant pas disponible au montage du composant.
* **Bonnes Pratiques de Remédiation :**
  - **Priorité Souveraine à HLS.js sur le Web (`shouldUseHlsJs = Boolean(Hls.isSupported())`) :** Conformément aux spécifications officielles HLS.js, dès lors que le navigateur supporte les MediaSource Extensions (`Hls.isSupported() = true`), HLS.js DOIT impérativement prendre en charge le flux sur le Web. Seul iOS Safari (où MSE est bridé sur `<video>` et `Hls.isSupported()` est faux) doit utiliser le fallback natif.
  - **Intégration Embarquée Pure de `hls.js` :** Importer `hls.js` statiquement dans le bundle (`import Hls from 'hls.js'`) pour garantir une disponibilité synchrone dès la première frame.
  - **Auto-Reprise Résiliente sur Flux Live (`onWaiting`, `bufferStalledError`) :** Maintenir la relance continue et interdire le verrouillage de `userPausedRef` lors des micro-recalibrages de buffer direct.


---

## 🛑 69. Détection HLS Abusive sur `/stream` Bloquant les Médias VOD et Route `/api/user/favorites/check/:id` Manquante

* **Problème / Symptôme :** Les vidéos VOD (films, épisodes) ne se lancent plus sur `/player`, la console du navigateur affiche `Failed to load resource: net::ERR_FAILED` et une erreur 404 sur `/api/user/favorites/check/:id`.
* **Conséquences :** Blocage complet du lecteur vidéo sur les médias VOD et échec des vérifications d'état favori.
* **Causes Racines :**
  - **Condition HLS Trop Permissive (`streamUrl.includes('/stream')`) :** L'URL standard de streaming des médias VOD étant `/api/media/:id/stream`, tester `streamUrl.includes('/stream')` forçait Hls.js sur des fichiers volumineux (MKV/MP4 de plusieurs Go). Hls.js tentait de télécharger et analyser le binaire comme un fichier texte M3U8, entraînant un dépassement mémoire/XHR et un rejet `net::ERR_FAILED`.
  - **Absence du Endpoint de Vérification (`userFavoritesRoutes.ts`) :** Le frontend appelait `GET /api/user/favorites/check/:id`, mais le routeur backend ne déclarait que `GET /favorites`, provoquant un 404 immédiat.
* **Bonnes Pratiques de Remédiation :**
  - **Ciblage Précis du Protocole HLS (`VideoPlayerView.tsx`) :** Réserver HLS exclusivement aux flux `.m3u8`, à l'IPTV (`/iptv/`) ou aux flux déclarés `isLive`. Les médias VOD traditionnels doivent être servis directement via la balise `<video src={streamUrl}>` avec support HTTP 206 Range.
  - **En-têtes CORS et Support HEAD/OPTIONS (`mediaStream.ts`) :** Exposer explicitement `Access-Control-Allow-Origin: *`, `Access-Control-Expose-Headers` et gérer les requêtes `HEAD`/`OPTIONS` pour le pré-chargement et la validation de format du lecteur HTML5.
  - **Exposition Exhaustive des Routes Favoris (`userFavoritesRoutes.ts`) :** Déclarer `GET /favorites/check/:id` et `GET /favorites/:id` renvoyant `{ isFavorite: boolean }`.

---

## 🛑 70. Collision entre Navigation Spatiale des Boutons et Progression Média sur la Page Lecteur

* **Problème / Symptôme :** Lors de la navigation directionnelle au clavier ou à la télécommande dans la barre d'outils du lecteur (boutons Retour, Voix, Partager, Cast, Audio, ST, Plein Écran), chaque appui sur les flèches Gauche/Droite déclenchait simultanément le déplacement du focus ET le saut temporel dans la vidéo (recul ou avance de 10s).
* **Conséquences :** Impossibilité de sélectionner un bouton sans dérégler la lecture en cours, expérience chaotique pour l'utilisateur.
* **Causes Racines :**
  - **Perte des Attributs `data-*` dans React Native Web :** Déclarer `data-player-topbar="true"` directement sur un `<View>` est ignoré par React Native Web, rendant inopérant le sélecteur `active.closest('[data-player-topbar="true"]')`.
  - **Absence de Cloisonnement des Modes (Normal vs Plein Écran) :** Les écouteurs clavier exécutaient le seek média (`v.currentTime = next`) sans vérifier si l'interface affichait ses boutons de contrôle ou si le lecteur était en immersion plein écran.
* **Bonnes Pratiques de Remédiation :**
  - **Séparation Étanche des Deux Modes (`usePlayerControls.ts` & `useTvNavigation.ts`) :**
    - **Mode Normal (`!isFullscreen`) :** Les flèches directionnelles sont strictement dédiées à la navigation spatiale entre les boutons de la barre supérieure et les overlays interactifs. Aucun seek média ne peut être déclenché.
    - **Mode Plein Écran (`isFullscreen`) :** Les boutons d'interface étant masqués pour une immersion totale, les flèches Gauche/Droite gèrent exclusivement la progression temporelle (-10s / +10s) et Espace gère Lecture/Pause.
  - **Attributs DOM Résilients (`dataSet`) :** Utiliser systématiquement `{...({ dataSet: { playerTopbar: 'true' } } as any)}` pour garantir la persistance des sélecteurs de ciblage dans le DOM HTML5.

---

## 🛑 71. Sélection Inutile du Conteneur Englobant du Lecteur Vidéo lors de la Navigation D-Pad Télécommande

* **Problème / Symptôme :** Lors de la navigation à la télécommande sur la page `/player`, l'appui sur la touche Bas ou la navigation spatiale sélectionnait le conteneur plein écran global (`styles.videoPlaceholder`) et l'entourait d'une bordure violette inutile (`#6366f1`).
* **Conséquences :** Pollution visuelle, focus piégé sur un bloc non interactif ne permettant aucune action utilisateur utile.
* **Causes Racines :**
  - **Conteneur Parent Rendu Cliquable (`<Pressable focusable={true}>`) :** Le conteneur vidéo était encapsulé dans un `<Pressable>` avec `focusable={true}` et `tabindex="0"`, s'insérant artificiellement dans la liste des cibles navigables `getCandidates()`.
  - **Règle de Chute Descendante Inappropriée (`useTvNavigation.ts`) :** L'appui sur la flèche Bas depuis la barre d'outils ciblait en premier `playerContainer.focus()` au lieu de vérifier la présence d'un bouton d'action réel (comme « Passer l'intro »).
* **Bonnes Pratiques de Remédiation :**
  - **Neutralisation Définitive du Focus sur le Conteneur Média (`VideoPlayerView.tsx`) :** Utiliser un composant `<View>` pur avec `tabIndex={-1}`, `focusable={false}` et `dataSet={{ playerContainer: "true", focusable: "false" }}`.
  - **Suppression des Styles de Focus Superflus (`PlayerScreen.styles.ts`) :** Éliminer la bordure active sur `videoPlaceholderFocused`.
  - **Exclusion Explicite du Conteneur dans le Moteur TV (`useTvNavigation.ts`) :** Rejeter `el.getAttribute("data-player-container") === "true"` dans `isElementVisibleAndActive` et interdire la descente vers le conteneur vide.

---

## 🛑 72. Redirections Fixes Codées en Dur sur les Boutons de Retour au Lieu de Restaurer la Page Précédemment Visitée

* **Problème / Symptôme :** Les boutons de retour (ex: `← Retour à l'Agora & salons` sur `/forum/[topic]`, `← Retour à l'accueil` sur `/media/[id]`) forçaient une redirection statique (ex: `router.push("/forum")` ou `router.push("/")`), ignorant la provenance réelle de l'utilisateur.
* **Conséquences :** Rupture de la navigation : un utilisateur arrivant sur un topic forum depuis une fiche média ou depuis la recherche était expulsé sur l'agora au lieu de retrouver sa fiche média d'origine.
* **Causes Racines :**
  - **Absence de Restitution de l'Historique Navigateur :** Les composants utilisaient des appels impératifs `router.push("/...")` au lieu de consulter `window.history.back()` ou `router.back()`.
  - **Intitulés Trompeurs Liés à une Destination Fixe :** Les libellés contenaient des destinations arbitraires (`← Retour à l'Agora & salons`, `← Retour à l'accueil`) au lieu du standard universel `← Retour`.
* **Bonnes Pratiques de Remédiation :**
  - **Fonction de Navigation Arrière Universelle (`goBackOrFallback`) :** Interroger en priorité `window.history.back()` (dès lors que `window.history.length > 1`) ou `router.back()` pour revenir exactement sur la page visitée, avec repli gracieux (`fallbackRoute`) uniquement si l'utilisateur a accédé directement à l'URL par lien direct.
  - **Standardisation Visuelle et Ergonomique :** Libellé sobre et universel `← Retour` sur l'ensemble des vues applicatives.
---

## 🛑 73. Rétention Indéfinie des Chaînes IPTV Orphelines lors de la Suppression d'une Source Playlist

* **Problème / Symptôme :** Après la suppression d'une source IPTV dans le panneau `/admin` (notamment des playlists non fonctionnelles ou contenant des flux incompatibles type `plugin://plugin.video.vavooto/`), les chaînes restaient visibles et persistantes sur `/tv` et dans les catégories de la base de données.
* **Conséquences :** Pollution de l'interface TV avec des centaines de chaînes inopérantes, accumulation de catégories fantômes, doublons de noms avec des variantes tronquées.
* **Causes Racines :**
  - **Absence de Clé Étrangère et de Cascade :** La table `media_nodes` ne conservait aucun lien relationnel (`iptv_source_id`) vers `iptv_sources`. La route `DELETE /api/iptv/sources/:id` supprimait uniquement la ligne dans `iptv_sources`, laissant orphelines toutes les entrées `LIVE_CHANNEL` dans `media_nodes`.
  - **Mise en Cache PWA Rigide :** Le cache persistant `iptv_channels_*` et `iptv_categories` n'était jamais invalidé lors des modifications de sources dans l'administration.
* **Bonnes Pratiques de Remédiation :**
  - **Lien Relationnel PostgreSQL avec `ON DELETE CASCADE` :** Ajouter la colonne `iptv_source_id UUID REFERENCES iptv_sources(id) ON DELETE CASCADE` sur `media_nodes`. Toute suppression d'une source IPTV purge automatiquement toutes les chaînes associées en base.
  - **Invalidation Globale du Cache (`invalidateCacheByPrefix`) :** Déclencher l'invalidation automatique du cache `iptv_` dès qu'une source est créée, synchronisée, modifiée ou supprimée.
  - **Jointure Stricte sur les Catégories Vivantes :** Lier les catégories dans `GET /api/iptv/categories` aux chaînes `LIVE_CHANNEL` réellement existantes.

---

## 🛑 74. Omission d'Exports Utilitaires Critiques lors des Refactorisations d'API (`resolveImageUrl`)

* **Problème / Symptôme :** Crash au chargement de la fiche de détail média `<MediaDetailScreen>` avec l'erreur `TypeError: resolveImageUrl is not a function`.
* **Conséquences :** Écran rouge ou page blanche sur `/media/[id]` et dans les bulles de forum associées.
* **Causes Racines :** Remplacement accidentel de la totalité du fichier `api.ts` au lieu d'une mise à jour ciblée, supprimant l'export de `resolveImageUrl` indispensable à la conversion des chemins d'affiches et de fanarts.
* **Bonnes Pratiques de Remédiation :**
  - **Vérification Systématique des Exports Publics :** Conserver immuables les fonctions socles partagées (`resolveImageUrl`, `getVideoStreamUrl`, `fetchMediaDetail`).
  - **Tests TypeScript Pré-Déploiement :** Valider l'intégrité de l'arborescence des imports avant de valider toute modification.

---

## 🛑 75. Cascade Destructive sur parentId (ON DELETE CASCADE sur media_nodes) et Disparition Silencieuse de Médias Physiques

* **Problème / Symptôme :** Des films disparaissent soudainement de la bibliothèque lorsque l'utilisateur ou le scanner réorganise, fusionne ou supprime une collection ou un pseudo-show ("des films ont disparu").
* **Conséquences :** Perte d'indexation en base de données de centaines de films intacts sur disque, nécessitant une ré-indexation complète.
* **Causes Racines :** La clé étrangère parentId auto-référencée sur media_nodes était définie avec onDelete: 'cascade'. Dans un modèle EAV unifié où les films et les épisodes sont enfants de collections ou de séries, supprimer un nœud parent entraînait la suppression automatique en cascade de tous les médias descendants.
* **Bonnes Pratiques de Remédiation :**
  - **Contrainte ON DELETE SET NULL Inviolable :** Définir strictement parentId: uuid('parent_id').references((): AnyPgColumn => mediaNodes.id, { onDelete: 'set null' }) en Drizzle et en SQL PostgreSQL.
  - **Déliaison Préventive avant Nettoyage :** Avant toute suppression de collection ou série, exécuter systématiquement UPDATE media_nodes SET parent_id = NULL WHERE parent_id = target_id.

---

## 🛑 76. Création Abusive de Pseudo-SHOWs pour les Films et Scraping par Troncation Arbitraire de Mots

* **Problème / Symptôme :** Des films célèbres (Mon Voisin Totoro, Antigang) apparaissent étiquetés comme des séries canadiennes de meurtre / fait divers (Fear Thy Neighbor / Cream Productions), avec des cartes non-jouables (erreur 404 / illisibles) et des faux titres.
* **Conséquences :** Pollution massive de la bibliothèque par des centaines de faux SHOW vides sans fichier vidéo, métadonnées corrompues, incohérence totale des filtres par pays et studios.
* **Causes Racines :**
  - resolveParentShowNodeId était invoqué sans garde préalable sur des films autonomes (MOVIE), générant un SHOW vide pour chaque film.
  - Le scraper externe TMDb utilisait un fallback brutal tronquant le titre aux deux premiers mots ("Mon Voisin Totoro" -> "Mon Voisin") et acceptait aveuglément le premier résultat retourné sans calcul de similarité lexicale, capturant une série documentaire criminelle canadienne.
* **Bonnes Pratiques de Remédiation :**
  - **Garde d'Exclusion Stricte :** resolveParentShowNodeId ne doit être appelé QUE pour nodeType === 'EPISODE' et avec un contexte de série formel vérifié (resolveSeriesRoot). Un MOVIE ne doit JAMAIS générer ni dépendre d'un SHOW.
  - **Validation de Similarité String (Trigrammes + Jaccard >= 0.60) :** Bannir toute troncation aveugle de titre. Tout résultat d'API externe doit présenter une similarité lexicale minimale de 60% avec le titre d'origine sous peine de rejet immédiat.

---

## 🛑 77. Écrasement d'Affiches Dédiées par folder.jpg dans les Dossiers Multi-Films et Collisions de Préfixes

* **Problème / Symptôme :** Des dizaines de films dans un même répertoire partagent la même affiche erronée, et la série Soul Eater est renommée en "Soul" à cause du film d'animation Pixar Soul.
* **Conséquences :** Confusion visuelle grave, métadonnées interverties entre séries et films homonymes.
* **Causes Racines :**
  - detectAdjacentFiles parcourait les entrées de répertoire sans différencier les dossiers mono-film des répertoires partagés contenant des dizaines de vidéos. L'image générique folder.jpg écrasait l'affiche dédiée spécifique (antigang-poster.jpg).
  - L'expression régulière de détection d'épisode \d+x\d+ confondait les résolutions vidéo (1920x804, 1920x1080) avec le format SxxExx, requalifiant le film Soul en épisode et fusionnant abusivement son titre avec Soul Eater.
* **Bonnes Pratiques de Remédiation :**
  - **Priorité Absolue aux Artworks Spécifiques :** Les motifs <titre>-poster, <titre>-fanart, <titre>-logo priment impérativement. folder.jpg et poster.jpg ne sont tolérés QUE si le dossier ne contient qu'une seule vidéo ou est un dossier de série dédié.
  - **Exclusion des Résolutions Vidéo dans la Détection d'Épisode :** Bannir \d+x\d+ sans bornage strict (< 50 saisons et < 100 épisodes) et exiger la présence d'un répertoire racine de série identifié.

---

## 🛑 78. Omission des Formats d'Épisodes Alternatifs (Pistes Simples & Numérotation Absolue Anime sans SxxExx)

* **Problème / Symptôme :** Les épisodes de séries ou animes célèbres (`Bleach - 214 - ...mkv`, `Darling in the FranXX - 02 - ...mkv`, `7 - conjonctivite.avi`) ne reçoivent aucun badge d'épisode, ne sont pas triés correctement ou tombent en erreur d'ordonnancement.
* **Conséquences :** Expérience utilisateur dégradée, perte de la navigation séquentielle et badges invisibles dans l'interface de lecture.
* **Causes Racines :** L'algorithme `parseSeasonEpisode` ne recherchait que les motifs formels `S\d+E\d+` ou `\d+x\d+` et ignorait les motifs isolés entre tirets ` - 214 - ` ainsi que les numéros de pistes en tête de nom de fichier `7 - ...`.
* **Bonnes Pratiques de Remédiation :**
  - **Prise en Charge des Formats Isolés :** Détecter systématiquement `/(?:^|\s)[-_–]\s*0*([1-9]\d{0,3})\s*[-_–]/i` et `/^0*([1-9]\d{0,2})\s*[-_–]\s+[a-zA-Z]/i`.
  - **Bornage Strict des Motifs "x" :** N'accepter `\d+x\d+` que si $s < 50$ et $e < 150$ pour interdire formellement les résolutions vidéo (`1920x1080`, `1280x720`).

---

## 🛑 79. Absence de Typage dans l'Ingestion EAV et Fausses Hypothèses d'Itérabilité sur les Champs NFO Optionnels

* **Problème / Symptôme :** Crash brutal `TypeError: parsed.credits is not iterable` ou `parsed.mpaa` lors du traitement d'un fichier `.nfo`.
* **Conséquences :** Arrêt immédiat de l'ingestion d'un média ou interruption d'un scan complet en arrière-plan.
* **Causes Racines :** Utilisation aveugle de boucles `for (const x of parsed.field)` sans garde nulle préalable `(parsed.field || [])` et confusion sur les identifiants de propriétés de l'interface `ParsedNfo` (`writers` vs `credits`, `certification` vs `mpaa`).
* **Bonnes Pratiques de Remédiation :**
  - **Gardes Nulles Systématiques :** Toujours itérer sur `(parsed.field || [])`.
  - **Validation Stricte TypeScript (`tsc --noEmit`) :** Vérifier que le code source compile sans aucune erreur de typage avant d'exécuter le pipeline.
