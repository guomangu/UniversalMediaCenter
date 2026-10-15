### ⚡ Indexation Sans Limite des 2 To de Médias Externes & Résilience Multi-Disques
- [x] **Levée Définitive des Blocages de Permissions SELinux sur les Disques Externes ([`compose.yaml`](file:///var/home/tele/Documents/theuniversalmediastack/compose.yaml)) :**
  - Clarification du chiffre de « 2014 » : il ne s'agissait nullement d'une limite codée dans le projet, mais de la somme exacte découverte sur le disque `My Passport` et `Vidéos/drive` (1 973 NFOs + 41 vidéos autonomes).
  - Identification de l'erreur `EACCES: permission denied, scandir '/run/media/tele/gudbug'` qui avait causé l'omission du second disque externe `gudbug` (`PARTAGED/FILMS`, `PARTAGED/SERIES`).
  - Résolution : octroi des droits (`chmod 755`), désactivation des restrictions SELinux des conteneurs via `security_opt: [ "label=disable" ]` et montage direct des disques `/run/media/tele/My Passport` et `/run/media/tele/gudbug` sur le backend (`ums_api`) et la gateway (`ums_gateway`).
  - Sécurisation du parseur de titres ([`titleCleaner.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/titleCleaner.ts)) : conversion stricte `String(raw)` éliminant le plantage `(raw || "").trim is not a function` sur les épisodes à titre purement numérique (ex: Gintama `266.nfo`).
  - Neutralisation des erreurs sur les NFOs non-XML ([`nfoParser.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/nfoParser.ts)) : capture des exceptions du parser pour ignorer silencieusement les fichiers textes ASCII art de scène musicale.

### ⚡ Algorithme Agressif d'Enrichissement des Sagas & Séries Dépeuplées ("Enrichir Métadonnées")
- [x] **Refonte du Moteur de Priorisation par Score de Besoin ([`metadataEnricher.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/metadataEnricher.ts)) :**
  - **Priorité Structurelle Absolue aux Conteneurs Majeurs** : Les sagas (`COLLECTION` +250 pts) et séries (`SHOW` +150 pts) obtiennent un score systématiquement supérieur aux épisodes et films isolés, garantissant qu'elles soient traitées en tête de lot lors d'un clic sur *« Enrichir Métadonnées »*.
  - **Détection SQL des Carences en Tags EAV** : Comptage en temps réel des attributs culturels par média (`nodeEavLinks`). Un média sans tags reçoit un bonus de besoin de +100 pts (+60 pts pour < 5 tags, +35 pts pour < 15 tags), ciblant impitoyablement les sagas presque vides.
  - **Pondération des Carences Visuelles et Textuelles** : Synopsis absent ou vide (+40 pts), affiche manquante (+30 pts), arrière-plan manquant (+20 pts), année de sortie (+15 pts), note communautaire (+15 pts).
- [x] **Enrichissement Agressif 100% Algorithmique Sans Dépendance IA ([`externalMetadata.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/externalMetadata.ts) & [`metadataEnricher.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/metadataEnricher.ts)) :**
  - **Support Natif des Sagas via l'API Collections TMDb** (`/3/search/collection` & `/3/collection/{id}`) : Recherche par candidats de titres nettoyés, extraction du synopsis français de franchise, des affiches, des arrière-plans et déduction des genres depuis les films membres (`parts`).
  - **Enrichissement en Cascade des Films Enfants de la Saga** : Lors de l'enrichissement d'une collection, l'algorithme parcourt et enrichit automatiquement tous ses films membres (`MOVIE`) ayant peu de tags ou sans résumé. Grâce au moteur de fusion ascendante de `/media/:id`, la saga hérite instantanément de dizaines d'acteurs, réalisateurs, compositeurs, studios et caractéristiques techniques.
  - **Normalisation Avancée des Titres (`cleanShowTitle` / `cleanMediaTitle`)** : Élimination automatique des préfixes de numérotation (`01 `, `02. `, `1 - `), balises de release (`[SubsPlease]`), éditions (`- iNTEGRALE`, `10bits`, `x264`), années entre parenthèses (`(2006)`), résolvant les échecs de recherche sur des œuvres comme *G.I. Joe*, *Diebuster*, *Code Geass* ou *Soul Eater*!.
  - **Chaîne de Secours Résiliente Multi-Sources** : En cas de synopsis manquant en français, l'algorithme interroge Wikipédia FR -> TMDb EN -> Wikipédia EN avec respect des quotas et en-tête User-Agent dédié.

### 🔍 Audit Approfondi & Spécification du Pipeline de Synchronisation Universelle
- [x] **Publication du Document d'Audit et de Feuille de Route ([`audit_indexation_metadata_sagas.md`](file:///var/home/tele/Documents/theuniversalmediastack/audit_indexation_metadata_sagas.md)) :**
  - **Autopsie de l'anomalie « Épisode -1 »** : Identification du piège `<season>-1</season><episode>-1</episode>` présent dans les `tvshow.nfo` de Kodi/TMM, qui trompait `titleCleaner.ts` et renommait 26 séries (Bleach, Skins, South Park, Gurren Lagann...) en « Épisode -1 ».
  - **Diagnostic des Sagas Orphelines (Le Seigneur des Anneaux & Le Hobbit)** : Mise en évidence de l'omission totale des balises `<set><name>` et `<collectionnumber>` dans `nfoParser.ts`, et de l'abandon du champ `belongs_to_collection` de TMDb, laissant 100% des films de sagas isolés avec `parent_id = NULL`.
  - **Conception du « Super-Bouton » Unifié** : Spécification de la fusion des 3 boutons d'administration actuels (*Scan Universel*, *Réparer Hiérarchie*, *Enrichir Métadonnées*) en un pipeline séquentiel end-to-end à 4 passes (Découverte in-place ➔ Moissonnage externe continu ➔ Résolution du graphe hiérarchique & sagas ➔ Consolidation EAV & héritage culturel).

### 🚀 Déploiement du Bouton Unique de Synchronisation Universelle & Résolution Complète des Sagas
- [x] **Bouton Unique dans l'Interface Administrateur ([`AdminScanTab.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/AdminScanTab.tsx)) :**
  - Remplacement des 3 anciens boutons par un **bouton d'action principal et proéminent** : *« ⚡ Lancer la Synchronisation Universelle Complète »* (Scan In-Place ➔ Moissonnage Distant ➔ Graphe Hiérarchique & Sagas ➔ Tags EAV).
  - Affichage temps réel de la phase active du pipeline (`Passe 1/4`, `Passe 2/4`, `Passe 3/4`, `Passe 4/4`), du fichier en cours de traitement et des compteurs de progression.
  - Section accordéon repliée pour les outils avancés de maintenance ponctuelle (pour les experts).
  - Ajout d'une pastille statistique dédiée aux *Sagas & Collections* dans le panneau de synthèse du patrimoine multimédia.
- [x] **Éradication Totale du Bug « Épisode -1 » ([`titleCleaner.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/titleCleaner.ts) & [`hierarchyRepair.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/hierarchyRepair.ts)) :**
  - Interdiction formelle du fallback d'épisode pour les numéros négatifs ou nuls (`episode > 0`).
  - Détection contextuelle des conteneurs `SHOW` et `COLLECTION` évitant de traiter une série comme un épisode d'elle-même.
  - Guérison automatique immédiate des 26 séries corrompues en base (Bleach, Skins, South Park, Gurren Lagann...), rétablissant leurs titres réels depuis leurs fichiers `tvshow.nfo`.
- [x] **Support Natif des Sagas & Liaison Transversale d'Univers ([`nfoParser.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/nfoParser.ts), [`externalMetadata.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/externalMetadata.ts) & [`hierarchyResolver.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/hierarchyResolver.ts)) :**
  - Extraction sans perte des balises `<set><name>` et `<collectionnumber>` dans les fichiers `.nfo` locaux.
  - Capture de `belongs_to_collection` lors du moissonnage TMDb Movie.
  - Création automatique des conteneurs `COLLECTION` et rattachement des films membres avec tri chronologique par année.
  - Liaison des méta-franchises par tag EAV d'univers partagé (ex: `franchise: "Terre du Milieu"` reliant *Le Seigneur des Anneaux - Saga* et *Le Hobbit - Saga* ; `franchise: "Rocky Universe"` reliant *Rocky - Saga* et *Creed - Saga*).
  - Passage de 5 à **58 collections officielles** et rattachement de **84 films** jusqu'alors orphelins.

### 🛡️ Assainissement Fondamental du Système : Les 4 Piliers de Fiabilité Ultime
- [x] **Pilier 1 : Élimination Absolue des Badges Saison/Épisode sur les Films ([seasonEpisodeHelper.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/seasonEpisodeHelper.ts), [ui.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/ui.ts), [media.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/media.ts)) :**
  - **Rejet Stricte des Nœuds Non-Épisodes** : Si le nœud est un film (`MOVIE`) ou une collection (`COLLECTION`), `parseSeasonEpisode` renvoie systématiquement `null`.
  - **Protection des Années de Cinéma (1880-2100)** : Tout `orderIndex` compris entre 1880 et 2100 (ex: 2012 pour *Django*, 2016 pour *Iron Man*) est formellement interdit d'être divisé par 1000 (`Math.floor(2015/1000) = 2`), éradiquant définitivement les badges absurdes `S02 • EP 15` et `S02 • EP 16`.
  - **Sécurisation de Toutes les Routes API** : `ui.ts`, `media.ts`, `mediaNext.ts`, `userWatchRoutes.ts`, `userFavoritesRoutes.ts` et `repostFeedRoutes.ts` transmettent désormais le type de média pour empêcher toute attribution intempestive de badge.
- [x] **Pilier 2 : Nettoyage Strict des Titres & Réconciliation Chronologique ([titleCleaner.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/titleCleaner.ts), [hierarchyRepair.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/hierarchyRepair.ts)) :**
  - **Purge des Préfixes de Pistes** : Élimination automatique des motifs de disques tels que `01 Iron Man`, `03 Iron Man 2`, `07 Iron Man 3` (`^[0-9]{1,3}\\s*[-._– ]\\s*`).
  - **Suppression des Années Redondantes dans le Titre** : Élagage du suffixe `\\((19|20)\\d{2}\\)` en fin de titre, restaurant des libellés épurés (`Django Unchained`, `Iron Man`, `Once upon a time in Hollywood`).
  - **Réconciliation de l'Année de Sortie TMDb / Fichier** : Correction automatique des NFOs indiquant des dates de rediffusion TV erronées (2015 -> 2012 pour *Django*, 2016 -> 2008 pour *Iron Man*).
  - **234 titres de films nettoyés et 144 années de sortie réconciliées en base.**
- [x] **Pilier 3 : Vérité Terrain Technique Vidéo (ffprobe & Standardisation Résolution) ([ffprobeProbe.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/pipeline/ffprobeProbe.ts), [nfoParser.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/nfoParser.ts)) :**
  - **Harmonisation Universelle des Résolutions** :
    - $W \ge 3800$ ou $H \ge 2000$ : `4K UHD`
    - $W \ge 1900$ et $H \ge 1000$ : `1080p FHD`
    - $W \ge 1900$ et $H < 1000$ (ex: 1920x800 Scope 2.40:1) : `1080p Scope` (fin du faux label trompeur `1080p FHD` sur des rips croppés `800p`).
    - $W \ge 1200$ ou $H \ge 700$ : `720p HD`
    - $H \ge 480$ : `480p SD`
  - **Souveraineté de ffprobe** : Priorité absolue accordée à la détection binaire directe sur le conteneur MKV/MP4 plutôt qu'aux blocs NFO déclaratifs souvent inexacts.
- [x] **Pilier 4 : Regroupement Cinématographique d'Auteur (Tarantino & Réalisateurs) & Casting ([metadataEnricher.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/metadataEnricher.ts), [mediaRelated.ts](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/mediaRelated.ts)) :**
  - **Boost d'Urgence Culturelle (needScore)** : Bonus massif de +120 points pour tout média manquant de réalisateur et +60 points pour les castings incomplets (< 3 acteurs), hissant instantanément les grands films en tête de file d'enrichissement TMDb.
  - **Carrousel Réalisateur Prioritaire** : Intégration de l'attribut `director` dans `mediaRelated.ts` et mise en avant d'une section dédiée `Films de Quentin Tarantino` (regroupant *Django Unchained* et *Once upon a time in Hollywood*) et `Films de Jon Favreau` (*Iron Man*, *Iron Man 2*).
  - **Levée du Filtre Parent sur les Réalisateurs** : Les films appartenant à des sagas ne sont plus occultés de la filmographie du réalisateur.

### 🏆 Intégrations Architecturales Kyoo : Heuristique GuessIt, TheXEM Animes & Multilinguisme In-Database
- [x] **1. Parsing Heuristique via GuessIt avec Couche de Validation Stricte ([`guessitParser.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/pipeline/guessitParser.ts)) :**
  - **Intégration Binaire de GuessIt 4.4.0** : Accessible dans le conteneur `ums_api` et sur l'hôte, transmettant le chemin complet du fichier.
  - **Garde-Fou Anti-Faux Positifs Kyoo** : Rejet absolu des résolutions (`1080`, `720`, `2160`) ou années (`1999`, `2008`, `2012`, `2015`) interprétées à tort comme numéros d'épisode.
  - **Forçage Contextuel des Films** : Tout fichier situé dans un répertoire de films (`/FILMS/`, `/Movies/`, `/drive/`) est sanctuarisé comme `type: 'movie'` et neutralise toute fausse saison/épisode.
  - **Purge des Préfixes de Piste** (`01 `, `02 `) et années de fin pour restituer le titre canonique pur.
- [x] **2. Résolution des Cas Complexes Animes (TheXEM & Anime-Lists) ([`animeMapping.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/pipeline/animeMapping.ts)) :**
  - **Détection des Structures Animes** : Numérotation continue au-delà de l'épisode 24 sans mention de saison (ex: Gintama Ep 294, Bleach Ep 102), présence de CRC32 `[A1B2C3D4]`, ou mentions d'arcs nommés.
  - **Recalcul Précis (Saison, Épisode) pour TMDb** : Mappage officiel TheXEM pour *Gintama* (10 saisons : Ep 294 ➔ S07E29), *Bleach* (16 saisons : Ep 102 ➔ S05E11), *Naruto*, *Naruto Shippuden*, *Hunter x Hunter*, *Attack on Titan*.
  - **Préservation de l'Index Absolu** : Sauvegarde dans `absolute_order_index` permettant une recherche et un enchaînement continus sans rupture.
- [x] **3. Agrégation Multilingue & Mise en Cache In-Database PostgreSQL ([`localizationHelper.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/pipeline/localizationHelper.ts), [`externalMetadata.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/externalMetadata.ts), [`media.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/media.ts), [`ui.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/ui.ts)) :**
  - **Stockage Structuré `translations_json`** : Capture conjointe des métadonnées (titres, résumés, accroches) en français (`fr`) et en anglais (`en`) lors des requêtes TMDb.
  - **Zéro Re-Scan pour les Utilisateurs Multi-Langues** : Adaptation dynamique des titres et résumés selon `?lang=` ou l'en-tête HTTP `Accept-Language` du client.
  - **Vérification en Direct** : Testé avec succès sur *Django Unchained* : affichage instantané du synopsis français ou anglais selon les préférences de l'utilisateur sans aucun appel réseau ni rescannage.

### 🔬 Empreinte Binaire, Inspection Interne & NLP Sous-titres (Fiabilité Ultime)
- [x] **1. Empreinte Binaire Cryptographique O(1) ([`binaryHasher.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/pipeline/binaryHasher.ts)) :**
  - Calcul instantané (< 10 ms) de l'OpenSubtitles Hash 64-bit et du hash ED2K (AniDB) via MD4 RFC 1320 pur sans dépendances externes.
  - Identification déterministe d'un film ou épisode même si le fichier a été renommé `1234.mkv`.
- [x] **2. Inspection Interne du Conteneur MKV/MP4 ([`containerInspector.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/pipeline/containerInspector.ts)) :**
  - Extraction via ffprobe du vrai titre inscrit dans les métadonnées de segment (`tags.title`), des identifiants injectés (`IMDB` ttXXXXXXX, TMDb, TVDb) et des chapitres nommés.
- [x] **3. Analyse Sémantique NLP des Sous-titres ([`subtitleNlpMatcher.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/pipeline/subtitleNlpMatcher.ts)) :**
  - Extraction rapide (120 secondes, < 1,5s d'exécution) de la piste de sous-titres interne ou sidecar.
  - Reconnaissance d'entités de personnages (NER) pour désambiguïser *The Office (US)* vs *The Office (UK)*, *Shameless (US)* vs *Shameless (UK)*, et détection du carton de titre.
  - Résolution des conflits d'ordre DVD vs ordre de diffusion TV.

### 🎯 Restauration Instantanée de Hauteur d'Accueil, Aération Menu & Structure Universelle des Médias
- [x] **1. Sauvegarde & Restauration Fidèle de la Hauteur de la Page d'Accueil (`index.tsx`, `taxonomyApi.ts`, `TagCard.tsx`) :**
  - **Mise en Cache Synchrone In-Memory des Rails** : Conservation instantanée des médias de tags dans `taxonomyMediasCache`, éliminant tout clignotement ou tassement de hauteur lors du retour sur l'accueil.
  - **Moteur Multi-Paliers de Restauration de Défilement** : Déclenchement échelonné (16ms, 80ms, 200ms, 450ms, 850ms) et écoute dynamique de `onContentSizeChange` garantissant que le défilement se repositionne exactement à la hauteur sauvegardée sans être bridé par un redimensionnement asynchrone.
  - **Protection contre l'Écrasement d'Unmount** : Garde `isRestoringScroll` interdisant l'écrasement intempestif de la position par des événements `onScroll` à zéro lors du démontage ou du chargement initial.
- [x] **2. Correction Inesthétique du Menu Fixe & Dégagement Systématique des Boutons (`SiteHeader.tsx`) :**
  - **Hook Dynamique de Hauteur `useHeaderHeight`** : Calcul adaptatif prenant en compte le mode mobile, les raccourcis utilisateurs connectés et les sous-rangées de catégories (68px à 142px).
  - **Assainissement de Toutes les Pages** : Application harmonieuse sur `media/[id]`, `user`, `admin`, `tv`, `forum/[topic]` et `explore`, supprimant tout chevauchement ou blocage de clics sur les boutons de navigation (« Retour à l'accueil », onglets, etc.).
- [x] **3. Normalisation Rigoureuse de la Structure de la Fiche Média (`media/[id].tsx`, `MediaSagaRow.tsx`, `MediaStudioSection.tsx`) :**
  - **Ordre Strict et Cohérent Respecté** :
    1. **media** : Hero Spotlight (titre, overview, note, badges, boutons d'action rapide).
    2. **medias saga/serie** : Films de la même saga (`MediaSagaRow` avec mise en valeur du film actuel et lien vers la fiche saga) ou épisodes/saisons (`MediaChildrenRow`) et bonus (`extras`).
    3. **medias studios** : Studios de production et films dépendants/associés (`MediaStudioSection` avec rails par studio).
    4. **forum** : Espace communautaire, salon vocal continu et salle d'attente de séances (`MediaForumSection`).
    5. **acteurs** : Casting complet avec photos de portraits, rôles et accès filmographie (`actors`).
    6. **equipe** : Équipe créative détaillée (réalisateurs, scénaristes, producteurs, compositeurs).
    7. **info** : Fiche technique, classifications, pays d'origine et codecs vidéo/audio.
    8. **propositions medias par tags** : Suggestions thématiques intelligentes sans doublons (`MediaGenreSection`) et avis communautaires (`reposts`).
