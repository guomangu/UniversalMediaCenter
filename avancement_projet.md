### ⚡ Algorithme Agressif d'Enrichissement des Sagas & Séries Dépeuplées ("Enrichir Métadonnées")
- [x] **Refonte du Moteur de Priorisation par Score de Besoin ([`metadataEnricher.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/metadataEnricher.ts)) :**
  - **Priorité Structurelle Absolue aux Conteneurs Majeurs** : Les sagas (`COLLECTION` +250 pts) et séries (`SHOW` +150 pts) obtiennent un score systématiquement supérieur aux épisodes et films isolés, garantissant qu'elles soient traitées en tête de lot lors d'un clic sur *« Enrichir Métadonnées »*.
  - **Détection SQL des Carences en Tags EAV** : Comptage en temps réel des attributs culturels par média (`nodeEavLinks`). Un média sans tags reçoit un bonus de besoin de +100 pts (+60 pts pour < 5 tags, +35 pts pour < 15 tags), ciblant impitoyablement les sagas presque vides.
  - **Pondération des Carences Visuelles et Textuelles** : Synopsis absent ou vide (+40 pts), affiche manquante (+30 pts), arrière-plan manquant (+20 pts), année de sortie (+15 pts), note communautaire (+15 pts).
- [x] **Enrichissement Agressif 100% Algorithmique Sans Dépendance IA ([`externalMetadata.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/externalMetadata.ts) & [`metadataEnricher.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/metadataEnricher.ts)) :**
  - **Support Natif des Sagas via l'API Collections TMDb** (`/3/search/collection` & `/3/collection/{id}`) : Recherche par candidats de titres nettoyés, extraction du synopsis français de franchise, des affiches, des arrière-plans et déduction des genres depuis les films membres (`parts`).
  - **Enrichissement en Cascade des Films Enfants de la Saga** : Lors de l'enrichissement d'une collection, l'algorithme parcourt et enrichit automatiquement tous ses films membres (`MOVIE`) ayant peu de tags ou sans résumé. Grâce au moteur de fusion ascendante de `/media/:id`, la saga hérite instantanément de dizaines d'acteurs, réalisateurs, compositeurs, studios et caractéristiques techniques.
  - **Normalisation Avancée des Titres (`cleanShowTitle` / `cleanMediaTitle`)** : Élimination automatique des préfixes de numérotation (`01 `, `02. `, `1 - `), balises de release (`[SubsPlease]`), éditions (`- iNTEGRALE`, `10bits`, `x264`), années entre parenthèses (`(2006)`), résolvant les échecs de recherche sur des œuvres comme *G.I. Joe*, *Diebuster*, *Code Geass* ou *Soul Eater*.
  - **Chaîne de Secours Résiliente Multi-Sources** : En cas de synopsis manquant en français, l'algorithme interroge Wikipédia FR -> TMDb EN -> Wikipédia EN avec respect des quotas et en-tête User-Agent dédié.

### 🎬 Fusion & Enrichissement Exhaustif des Sagas de Films (COLLECTION)
- [x] **Agrégation Dynamique des Métadonnées Culturelles des Films Enfants ([media.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/media.ts), [mediaRelated.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/mediaRelated.ts), [media/[id].tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/media/[id].tsx)) :**
  - Identification et résolution des 3 causes majeures expliquant le manque de métadonnées des sagas :
    1. *Absence structurelle de NFO maître* : Contrairement aux séries/animés qui disposent d'un `tvshow.nfo` maître à la racine, les sagas de films étaient composées de NFOs enfants individuels sans NFO parent exhaustif.
    2. *Cloisonnement de la requête EAV* : `GET /api/media/:id` interrogeait uniquement `node_id = media.id`, rendant le conteneur de saga aveugle aux centaines de métadonnées portées par ses films.
    3. *Absence d'héritage des métriques* : Note communautaire inexistante sur le conteneur, absence de calcul de moyenne et année de sortie réduite à une seule date.
  - Résolution complète :
    - Fusion ascendante SQL de 100% des tags culturels (Casting complet, Réalisateurs, Scénaristes, Compositeurs, Producteurs, Studios, Caractéristiques techniques) ordonnés par récurrence dans la saga (`movie_occurrence_count DESC`).
    - Calcul automatique de la note moyenne de la saga (ex: 7.3/10 pour Matrix, 7.4/10 pour Pixar) et badge dédié *"Note moyenne saga"*.
    - Calcul dynamique de la plage temporelle de la saga (ex: *1995 - 2024* pour Pixar, *1999 - 2003* pour Matrix).
    - Génération d'un résumé élégant automatique et affichage fluide dans le Hub de Métadonnées avec plafonnement anti-surcharge (50 acteurs principaux, 20 réalisateurs/auteurs/studios).
    - Intégration dans `mediaRelated.ts` permettant à la saga d'alimenter pleinement la section *"Genres & Thématiques"* avec les œuvres connexes du catalogue.
    - Prise en charge de la progression de lecture des collections dans les rails d'accueil (`ui.ts`).

### 🎯 Déduplication Stricte Sans Doublons dans "Genres & Thématiques" (`/media/[id]`)
- [x] **Déduplication Séquentielle Intra-Page Inter-Tags ([mediaRelated.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/mediaRelated.ts) & [MediaGenreSection.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/MediaGenreSection.tsx)) :**
  - Application stricte de la règle d'accueil : un média déjà apparu dans un tag précédent sur la page ne réapparaît plus dans aucun tag suivant de la section "Genres & Thématiques".
  - Côté backend : `getRelatedTagsForMedia` trie les tags par richesse de contenu, initialise `seenMediaIds` (avec `mediaId` et `parentId`), filtre chaque groupe séquentiellement et re-trie pour placer les tags avec œuvres uniques restantes en tête.
  - Côté client : `MediaGenreSection` filtre réactivement les œuvres via un ensemble `seenMediaIds` en mémoire, excluant l'œuvre en cours de consultation (`currentMediaId`) et tout doublon inter-tags.
  - Les tags dont toutes les œuvres ont déjà été affichées dans les sections précédentes basculent automatiquement dans le bloc épuré *"Autres tags associés (aucun média supplémentaire)"* sous forme de pastilles discrètes `TagPill`.
  - Harmonisation visuelle : suppression de l'emoji `💬` au profit de `Forum • [Tag]` et intégration dans la nouvelle palette reposante (`#1d2127`, surfaces `rgba(38, 44, 54, 0.65)`).

### 🎬 Catégorie "Réalisateur", DA Sobre & Palette Reposante Mid-Tone (Sans Emojis)
- [x] **Ajout de la Catégorie "Réalisateur" dans la Taxonomie d'Accueil ([taxonomyRoutes.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/taxonomyRoutes.ts)) :**
  - Requête d'agrégation SQL sur l'attribut EAV `code = 'director'` regroupant films, sagas et séries associées aux réalisateurs (Pete Docter, Brad Bird, Jonathan Cohen, Mark Andrews, etc.).
  - Intégration dans la liste des catégories principales retournées par `GET /api/ui/taxonomy` avec `id = 'directors'` et titre `"Réalisateur"`.
  - Prise en charge dédiée dans l'endpoint `GET /api/ui/taxonomy/medias` assurant le filtrage direct et performant des œuvres selon le réalisateur sélectionné.

- [x] **Direction Artistique Neutre, Adulte et Reposante (Entre-Deux Clair / Sombre) ([theme.ts](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/constants/theme.ts), [global.css](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/global.css)) :**
  - Remplacement du fond sombre tranchant `#0f172a` et des néons électriques (`#6366f1`) par une palette minérale graphite/ardoise reposante (`#1d2127`, surface `rgba(38, 44, 54, 0.75)`).
  - Couleurs équilibrées et apaisantes pour les yeux : suppression de la fatigue visuelle sans basculer ni en mode sombre agressif ni en mode clair éblouissant.
  - Typographie nuancée en platine doux (`#edeef2`, corps `#9ba7b7`, sous-titres `#8a95a5`), bordures feutrées et anneau de focus adouci (`rgba(148, 163, 184, 0.75)`).

- [x] **Élimination Exhaustive des Emojis & Épure Visuelle ([SiteHeader.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/SiteHeader.tsx), [TagSearchBar.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/TagSearchBar.tsx), [CategorySection.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/CategorySection.tsx), [TagCard.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/TagCard.tsx), [MediaTile.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/MediaTile.tsx), [MediaCard.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/MediaCard.tsx), [media/[id].tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/media/[id].tsx)) :**
  - Remplacement des emojis décoratifs par une typographie nette, soignée et professionnelle.
  - En-tête : logos et onglets épurés (`UMS`, `Favoris`, `Amis`, `Salons`, `Fil d'avis`, `TV`, `Admin`, `Connexion`).
  - Recherche & Filtres : suppression de la loupe et uniformisation des tags de filtres rapides.
  - Badges des médias : `Film`, `Série`, `Saga`, `S01 • EP 01` en cartouches discrets et élégants ; badge `EN SÉANCE` en terracotta mesuré au lieu du rouge criard et sans emoji pop-corn.
  - Fiche détaillée du média : refonte des titres de sections du Hub de Métadonnées (`Casting & Artistes`, `Réalisation & Équipe Créative`, `Studios & Production`, `Origine & Lieux de tournage`, `Notes & Classification`, `Caractéristiques techniques & Codecs`).

- [x] **Sublimation du Design des Cards & Ergonomie UX Préservee ([MediaTile.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/MediaTile.tsx), [MediaCard.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/MediaCard.tsx), [MediaChildrenRow.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/MediaChildrenRow.tsx), [TagPill.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/TagPill.tsx)) :**
  - Structure et arborescence 100% préservées.
  - Coins adoucis, bordures subtiles au quart de contraste, pastilles d'années et de notes dans des tons champagne/sable reposants (`#cfb991`).
  - Cartes d'épisodes et tags adoucis avec des thèmes de couleurs désaturés pour une lecture fluide et agréable.

### ⚡ UX & Nettoyage Réactif des Séances, Vidéos In-Place & Lightbox Popup Forum, Liens Intelligents sans Doublon
- [x] **Clôture Déterministe et Nettoyage en Temps Réel des Séances et Badges "En Séance" ([sessionRoutes.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/sessionRoutes.ts), [presenceStore.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/presenceStore.ts), [player/[id].tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/player/[id].tsx)) :**
  - Fin définitive des séances fantômes qui restaient affichées indéfiniment (ex: `🔴 EN COURS Initié par : TeleAdmin Pro Séance Soirée Popcorn 👥 1 spectateur`).
  - Déploiement d un garbage collector automatique serveur (`cleanupExpiredSessions`) supprimant les participants inactifs (> 25s sans ping) et clôturant en `status = "ENDED"` toute séance abandonnée ou sans hôte.
  - Exécution systématique du nettoyage en préambule des routes `GET /api/sessions/active` et `GET /api/sessions/media/:nodeId`, ainsi qu en boucle de fond autonome (toutes les 10s).
  - Élimination des faux positifs de présence sur l accueil (`🍿 1 en séance`) : `getUserLastLocation` vérifie désormais la présence d un ping de lecture actif en mémoire avant de déclarer un utilisateur `isLive`, basculant instantanément en statut inactif dès qu il quitte le lecteur.
  - Décrochage instantané lors de la fermeture d onglet (`beforeunload` / `pagehide`) envoyant les requêtes `leavePlayback` et `leaveSession` avec `keepalive: true`.

- [x] **Lecture Automatique In-Place des Vidéos du Forum & Modale Popup Grand Format avec Son ([InlineVideoPlayer.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/InlineVideoPlayer.tsx), [ForumMediaModal.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/ForumMediaModal.tsx), [ForumMessageBubble.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/ForumMessageBubble.tsx)) :**
  - Les vidéos partagées dans les discussions du forum sont désormais lues automatiquement et en boucle (mode muet doux) dès qu elles sont affichées dans la bulle de message, sans rupture de contexte.
  - Pastille interactive élégante sur la vidéo : `🔊 Cliquer pour agrandir avec le son`.
  - Clic sur la vidéo ouvrant une modale popup responsive en grand format (`ForumMediaModal`), déverrouillant le son et offrant les contrôles complets de lecture (lecture/pause, timeline, volume, plein écran, fermeture `✕` ou touche `Échap`).
  - Prise en charge identique pour les images / GIFs et documents : prévisualisation in-place et ouverture plein écran haute résolution dans la même modale harmonieuse.

- [x] **Élimination des Doublons de Cartes Médias au Profit du Bouton Intelligent "Rejoindre ➔" ([ForumMessageBubble.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/ForumMessageBubble.tsx), [ForumInputBar.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/ForumInputBar.tsx)) :**
  - Détection automatique et suppression des cartes redondantes "🍿 Œuvre citée pour séance" lorsque l en-tête de l auteur affiche déjà sa position ou sa séance active (`📍 [Titre]` ou `🔴 En séance : [Titre]`).
  - Priorité absolue donnée au lien le plus intelligent et concis : le bouton d action directe "Rejoindre ➔" sous le nom de l auteur.
  - Allègement du libellé de l input bar en `🍿 Média lié : [Titre]`.

- [x] **Suppression Définitive de la Section "🔗 Liens Externes & Fiches Officielles" ([media/[id].tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/media/[id].tsx)) :**
  - Retrait complet du bloc de liens externes superflus de la fiche détaillée du média, purgeant l interface et concentrant l attention sur l expérience de lecture, les artistes, la fiche technique et le forum de discussion.

### 🌟 Hub Exhaustif de Métadonnées, Reprise Automatique Universelle, Fiabilisation des Appels Vocaux & Raccourcis Utilisateurs
- [x] **Rétablissement & Affichage Intégral des Métadonnées sous le Forum ([media/[id].tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/media/[id].tsx) & [media.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/media.ts)) :**
  - Correction de l'extraction Drizzle avec postgres.js (Array.isArray(linkedTags)) permettant le chargement sans perte des 101+ tags et attributs EAV.
  - Déploiement d'un Hub de Métadonnées complet structuré sous la section forum et salle d'attente :
    - 🎭 **Casting & Artistes** (Acteurs avec photos, rôles narratifs, tags interactifs cliquables).
    - 🎬 **Réalisation & Création** (Réalisateurs, scénaristes, producteurs, compositeurs).
    - 🏢 **Studios & Sociétés de Production** (Studios, labels, distributeurs).
    - 🌍 **Origine & Lieux** (Pays d'origine, lieux de tournage).
    - 🛠️ **Fiche Technique & Flux** (Codecs vidéo/audio, résolution, débit, aspect ratio, canaux, sous-titres, langues).
    - ⭐ **Notes & Classifications d'Âge** (Note communautaire, classification CSA / MPAA).
    - 🔗 **Liens & Identifiants Externes** (Badges interactifs directs vers IMDb, TMDb, TVmaze, AniDB, Wikipédia avec ouverture native in-browser).
- [x] **Reprise de Lecture Automatique & Barres de Progression Universelles ([VideoPlayerView.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/VideoPlayerView.tsx), [player/[id].tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/player/[id].tsx), [MediaCard.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/MediaCard.tsx), [MediaChildrenRow.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/MediaChildrenRow.tsx), [ui.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/ui.ts)) :**
  - Hydratation de watchProgress pour tous les rails d'accueil (uiRails) et tous les épisodes d'une série.
  - Affichage de la jauge rouge de progression au bas de chaque image (MediaCard.tsx) et de chaque vignette d'épisode (MediaChildrenRow.tsx), positionnée avec élégance au-dessus des badges de séance active.
  - Reprise intelligente : le bouton ▶ Regarder de la fiche série bascule automatiquement en ▶ Reprendre (S01 • EP 03) sur le dernier épisode entamé.
  - Le lecteur vidéo (PlayerScreen & VideoPlayerView) s'initialise directement à la seconde exacte mémorisée avec toast d'information immédiat.
- [x] **Correction Définitive des Appels Vocaux Continus ([LiveVoiceRoomBar.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/LiveVoiceRoomBar.tsx) & [presenceStore.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/presenceStore.ts)) :**
  - Élimination du bogue MediaRecorder.start(timeslice) qui privait les tranches suivantes de l'en-tête EBML indispensable aux navigateurs.
  - Génération déterministe de tranches fermées (recorder.stop() toutes les 2.5s) produisant 100% de fichiers WebM/Opus autonomes et complets.
  - Mise en place d'une file d'attente audio séquentielle (audioQueueRef) côté récepteur pour diffuser sans coupure, sans saccade et sans fin les voix des participants.
- [x] **Raccourcis Utilisateurs Omniprésents sur Toutes les Pages ([SiteHeader.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/SiteHeader.tsx), [user.tsx](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/user.tsx)) :**
  - Intégration dans le header universel des 4 accès directs : ❤️ Favoris (X), 👥 Amis, 💬 Mes Salons, 🔄 Fil d'avis.
  - Compteur dynamique en temps réel pour les favoris synchronisé via l'événement favoritesUpdated.
  - Prise en charge du paramètre d'URL ?tab= dans /user, ouvrant instantanément l'onglet ciblé lors d'un clic depuis n'importe quelle page du site.
  - Déploiement du SiteHeader sur /media/[id], /explore, /user, /tv, /admin et /forum/[topic].

### 🎙️ Lecture Vocale In-Place, Appels Vocaux Directs, Présence Active des Séances & Navigation Rapide Inter-Membres
- [x] **Lecture Vocale Directe In-Place sur la Page du Forum ([`InlineAudioPlayer.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/InlineAudioPlayer.tsx) & [`ForumMessageBubble.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/ForumMessageBubble.tsx)) :**
  - Fin de l'ouverture intempestive dans un nouvel onglet : les messages vocaux sont désormais écoutables directement au sein de la bulle de discussion sur la page du forum.
  - Lecteur audio intégré avec bouton Play/Pause interactif, temps écoulé / durée et barre de progression fluide.
- [x] **Suppression des Faux Éléments de Citation, Disparition du Rôle de "Gérant" & Dernière Page Connue Cliquable :**
  - Élimination de la rangée "Citer un épisode pour la séance" : le bouton "Proposer une séance" suffit amplement pour initier des visionnages.
  - Retrait des mentions et notations intrusives de "Gérant".
  - Affichage automatique sous chaque auteur dans le forum de sa **dernière page connue ou média actuellement visionné** avec pastille cliquable (`🔴 En séance : [Titre du média]` ou `📍 [Dernier média]`) permettant de le rejoindre immédiatement dans sa séance d'un simple clic.
- [x] **Bouton d'Appel Vocal Direct & Vocaux Continus ([`LiveVoiceRoomBar.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/LiveVoiceRoomBar.tsx) & [`presenceStore.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/presenceStore.ts)) :**
  - Ajout du bouton `📞 Appel direct` / `Rejoindre l'appel` dans l'en-tête du forum avec badge dynamique de spectateurs actifs en direct.
  - Support des vocaux continus (`MediaRecorder` découpé en tranches de 2.5s) permettant de converser en temps réel sans devoir enregistrer et envoyer manuellement chaque message, avec diffusion audio instantanée aux participants connectés.
- [x] **Indicateur Dynamique "X en séance" sur Cartes et Groupes de Médias ([`MediaCard.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/MediaCard.tsx), [`ForumTopMediasRail.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/ForumTopMediasRail.tsx) & [`sessionStore.ts`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/services/sessionStore.ts)) :**
  - Détection automatique et temps réel des spectateurs actifs (même solo : `1 en séance`, `3 en séance`) via le nouveau gestionnaire de présence et le heartbeat de lecture vidéo (`POST /api/media/:id/progress`).
  - Agrégation automatique des épisodes vers la série parente pour que la fiche série reflète immédiatement les spectateurs en cours.
  - Règle stricte : la div `🍿 X en séance` s'affiche exclusivement si le nombre de spectateurs est $\ge 1$, et n'affiche jamais "0 en séance".
- [x] **Correction du Système de Discussion Synchronisée / Asynchrone :**
  - Remplacement du mécanisme bloquant d'IntersectionObserver par un polling asynchrone résilient à 2.5s qui ne gèle plus jamais.
  - Ajout de l'affichage optimiste immédiat lors de l'envoi d'un message et auto-envoi direct dès la fin d'un enregistrement vocal.
- [x] **Résolution de l'Erreur 404 sur l'Enrichissement des Métadonnées ([`AdminScanTab.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/AdminScanTab.tsx)) :**
  - Remplacement du fetch relatif non routé par l'appel unifié `triggerLibraryRefresh()` (`${getApiBaseUrl()}/api/admin/library/refresh` avec en-têtes d'authentification administrateur), rétablissant l'enrichissement TVmaze / Wikipedia sans clé payante.

### 🚀 Architecture de Scraping Multimodal Kyoo++, Résolution Déterministe de Hiérarchie & Scanner Universel In-Place (`/admin`, `AdminScanTab.tsx`, `pipeline/`, `hierarchyResolver.ts`)
- [x] **Résolution Déterministe de la Hiérarchie et Élimination des Collisions Séries/Saisons :**
  - **Résolution Déterministe de la Racine de Série ([`hierarchyResolver.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/hierarchyResolver.ts)) :**
    - Traversée ascendante depuis le chemin physique du fichier jusqu'au `tvshow.nfo` physique ou à la racine de catégorie (`Series/`, `Animes/`).
    - Attribution absolue et inviolable de chaque épisode à son dossier de série physique, avec exclusion formelle de tout préfixe `LIKE` flou sans séparateur.
    - Création automatique et propre du conteneur `SHOW` pour les séries sans NFO (`Serial Experiments Lain`, `Diebuster`) avec titre nettoyé.
  - **Groupement Précis des Arcs, Saisons et Détection Restreinte des Extras ([`folderGrouper.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/folderGrouper.ts)) :**
    - Analyse des sous-dossiers relatifs entre la racine de la série et le fichier (`Season 1`, `Saison 2`, arcs d'anime `01- Soul Society`, sous-dossiers `Films/`, et nomenclatures alternatives `R1`, `R2`, `Picture Drama`, `Part 1`, `Cour 1`).
    - Élimination des contaminations de faux bonus : détection des extras (`isExtra`) cantonnée strictement aux dossiers de coulisses immédiats (`/(?:featurettes|extras|bonus|deleted scenes)/`), évitant qu'un dossier de release avec `+ Extras` ne marque tous les épisodes en bonus.
  - **Suppression Totale de l'Entrelacement Inter-Saisons (S01E01, S02E01...) ([`mediaHierarchy.ts`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/utils/mediaHierarchy.ts)) :**
    - Extraction prioritaire de la saison et de l'épisode depuis `SxxExx` avant tout fallback d'ordre absolu, garantissant la séparation étanche des onglets `Saison 1 (25)`, `Saison 2 (25)` et `Picture Drama (21)`.
    - Tri hiérarchique quadri-dimensionnel (`season ASC` $\rightarrow$ `episode ASC` $\rightarrow$ `orderIndex ASC` $\rightarrow$ `fsSortKey ASC`) assurant que même sur la vue consolidée "Tous", la totalité de la Saison 1 précède la Saison 2 sans aucune alternance.
  - **Décodage Arithmétique Universel des Badges et Tags ([`seasonEpisodeHelper.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/seasonEpisodeHelper.ts) & [`media.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/media.ts)) :**
    - Décodage automatique des index $\ge 1000$ (`orderIndex = season * 1000 + episode`) : conversion systématique en `S02 • EP 01` et tag `S02E01`, bannissant définitivement les libellés bruts "EP 2001, 2002".
  - **Calcul d'Index d'Ordre Multi-Saisons sans Collision ([`mediaIngester.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/mediaIngester.ts)) :**
    - Application de la formule `orderIndex = season * 1000 + episode` pour toute saison > 1 (ex: S02E01 = 2001, S02E02 = 2002), éliminant les collisions avec la saison 1.
    - Respect des numéros absolus d'animes et préservation intégrale des titres narratifs.
  - **Moteur de Réconciliation Automatique de la Médiathèque ([`hierarchyRepair.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/hierarchyRepair.ts)) :**
    - 3ème passe automatique du scan récursif universel réassignant en direct tous les médias orphelins ou mal rattachés.
    - Nettoyage des noeuds `SEASON` non-jouables créés par `season.nfo` et suppression des vidéos erronées associées aux métadonnées pures.
    - Décontamination des faux extras et suppression des noeuds fantômes sans fichiers.
    - Exposition via l'endpoint d'administration `POST /api/admin/scan/rebuild-hierarchy` et bouton interactif dédié `🔄 Réparer la Hiérarchie` dans la console d'administration.
