# Le Manifeste Ultime de l'Identification, du Nommage et des Métadonnées Médias
**De l'approche « Zero-Folder » de Kyoo à l'Architecture Multimodale Infaillible (Next-Gen)**

---

## 1. Philosophie Fondamentale : Le Changement de Paradigme

Les serveurs médias traditionnels (Plex, Jellyfin, Emby, Kodi) reposent sur un postulat daté : **l'arborescence des dossiers dicte l'identité du média**. Si l'utilisateur place un épisode de série dans un dossier de films ou utilise une numérotation absolue d'anime sans sous-dossier `Season XX`, le moteur échoue.

L'architecture moderne initiée par **Kyoo** et poussée à son paroxysme par le modèle **Next-Gen (« Kyoo++ »)** repose sur 4 lois fondamentales :

1. **Loi du « Zero-Folder Structure » :** Le chemin d'accès complet (`/dossier/parent/sous-dossier/fichier.mkv`) n'est qu'une chaîne d'indices textuels parmi d'autres. Un fichier déposé à la racine d'un dossier de téléchargement en vrac doit être identifié avec la même précision qu'un fichier rangé manuellement.
2. **Loi de l'Inspection sur la Déduction :** Le nom d'un fichier peut mentir (`VIDEO_01.mkv`, homonymes sans année, ordres DVD vs TV). L'ADN binaire du fichier (hash, conteneur MKV, sous-titres internes, durée réelle, empreinte audio) ne ment jamais.
3. **Loi du Découplage Absolu :** Le fichier physique sur le disque (`Video File`) est une entité distincte de l'œuvre logique (`Show / Movie / Episode`). Un seul fichier peut contenir deux épisodes (`S01E01-E02`), et un seul épisode peut exister en quatre versions (4K HDR, 1080p Light, Version Longue, Director's Cut).
4. **Loi de la Mutualisation Communautaire :** Aucune ambiguïté résolue par un humain ou par une analyse lourde ne doit être recalculée deux fois dans le monde.

---

## 2. Le Pipeline d'Identification Multimodal en 6 Niveaux (Architecture « Kyoo++ »)

Pour atteindre un taux de reconnaissance de **99,99 %** sans intervention humaine, le démon du scanner ne doit pas s'arrêter à une simple expression régulière. Il doit exécuter un **entonnoir de résolution en cascade (Waterfall Pipeline)**, allant de la méthode la plus rapide (0,5 ms) à l'analyse sémantique approfondie, jusqu'à dépasser un seuil de confiance critique ($\ge 0.95$).

### Niveau 1 : Empreinte Binaire & Identifiants Internes (Coût : ~1 à 3 ms | Fiabilité : 100 %)
Avant même de lire le nom du fichier, le scanner inspecte les octets du fichier :
* **OpenSubtitles Hash (OSHash) :** Calcul ultra-rapide en $O(1)$ prenant uniquement la taille totale du fichier ainsi que les premiers et derniers $64\text{ Ko}$. Ce hash permet d'interroger instantanément l'API OpenSubtitles/TMDB pour obtenir l'ID IMDb exact du film ou de l'épisode.
* **Hash ED2K & CRC32 (Spécial Anime) :** Extraction du CRC32 (souvent présent dans le nom `[A1B2C3D4]` ou calculé à la volée) et du hash ED2K pour interrogation directe de la base **AniDB**. Même si un fichier d'anime est renommé `abc.mkv`, son hash binaire l'identifie à la frame près (incluant le groupe de fansub et la version v1/v2).
* **Inspection des Tags du Conteneur (`ffprobe`) :** Lecture de l'en-tête du conteneur Matroska (`.mkv`) ou MP4. De nombreux fichiers embarquent nativement les balises `TITLE`, `IMDB_ID`, `TMDB_ID`, ou la date d'encodage originale dans leurs métadonnées internes.

### Niveau 2 : Analyse Lexicale Hybride — GuessIt + SLM Local (Coût : ~5 à 15 ms | Fiabilité : 92 %)
C'est ici que l'approche actuelle de Kyoo est fusionnée avec l'IA locale légère :
* **Passe 1 (Heuristique rapide via `GuessIt` / `rebulk`) :** Extraction déterministe des balises techniques (`1080p`, `HEVC`, `x265`, `BluRay`, `MULTI`), de l'année, du numéro de saison et d'épisode, et nettoyage des tags parasites.
* **Passe 2 (Small Language Model local en cas d'ambiguïté) :** Si `GuessIt` produit un titre douteux, un acronyme (`LotGH`, `FMA:B`, `KnY`) ou une syntaxe non standard, la chaîne complète du chemin est passée à un modèle quantifié local (ex: *Qwen-2.5-0.5B* ou *Llama-3.2-1B* sous ONNX/GGUF). Le SLM traduit l'acronyme en titre canonique complet et distingue le nom de l'arc narratif du titre principal.

### Niveau 3 : Tables de Vérité & Remapping Dynamique (Coût : ~2 ms | Fiabilité : 98 %)
Indispensable pour résoudre le conflit entre la numérotation des groupes de release (scène/fansub) et celle des bases de métadonnées (TMDB/TVDB) :
* **Intégration native de `Fribb/anime-lists` et `TheXEM` :** Pont automatique entre les identifiants `AniDB <-> MyAnimeList <-> AniList <-> TVDB <-> TMDB`.
* **Conversion Absolue $\leftrightarrow$ Saisonnière :** Transformation transparente d'un épisode en numérotation continue (ex: *One Piece - 1071*) vers le standard saisonnier de TMDB (*Saison 21, Épisode 180*).
* **Résolution des Saisons Éclatées (Split-Cour) :** Rattachement automatique des titres d'arcs (ex: *Attack on Titan: The Final Season Part 3*) à la saison numérique correspondante sur TMDB.

### Niveau 4 : Validation Physique & Contexte du Voisinage (Coût : ~5 ms | Fiabilité : 96 %)
Pour éliminer les collisions d'homonymes (ex: *Dune* 1984 vs 2021, *The Office* UK vs US, ou confusion entre un film et un épisode de série portant le même nom) :
* **Filtre par Durée Réelle (`Runtime Matching`) :** Comparaison de la durée exacte du flux vidéo (`ffprobe`) avec la durée théorique déclarée sur TMDB. Une tolérance de $\pm 8\%$ (pour gérer le *PAL Speedup* à $25\text{ fps}$ vs $23.976\text{ fps}$) permet d'écarter immédiatement un film de $110\text{ min}$ au profit d'un épisode pilote de $62\text{ min}$.
* **Inférence par Voisinage (`Sibling Context Clustering`) :** Si un dossier contient 11 fichiers clairement identifiés comme appartenant à la *Saison 1* d'une série et un 12ème fichier au nom corrompu ou ambigu de durée similaire ($24\text{ min}$), le moteur transfère le contexte du dossier parent au fichier orphelin.

### Niveau 5 : Analyse NLP des Sous-titres & Reconnaissance d'Entités (Coût : ~30 à 80 ms | Fiabilité : 99,5 %)
Le juge de paix ultime lorsque le nom est générique (`S01E02.mkv`) ou que la série souffre du syndrome **Ordre DVD vs Ordre Diffusion TV** (*Firefly*, *Futurama*, *Monogatari*, *La Casa de Papel*) :
* **Extraction Express de la Piste Texte :** Lecture des premières lignes de la piste de sous-titres interne (`.srt`, `.ass`, `.vtt`) ou externe sans décoder la vidéo.
* **Reconnaissance d'Entités Nommées (NER) :** Analyse fréquentielle des noms propres dans les dialogues. La présence de *"Michael Scott"* vs *"David Brent"* tranche instantanément entre *The Office (US)* et *The Office (UK)*.
* **Empreinte de Dialogues (Subtitle Fingerprinting) :** Alignement de 5 répliques horodatées avec la base de sous-titres de référence pour identifier **quel épisode exact** se trouve dans le conteneur, indépendamment de son numéro de fichier erroné.

### Niveau 6 : Empreinte Acoustique & Visuelle (Coût : ~200 ms | Fiabilité : 99 %)
Utilisé en dernier recours (fichiers sans sous-titres et au nom détruit type `TITLE_01.mkv`) ET en tâche de fond pour l'expérience utilisateur :
* **Chromaprint / AcoustID :** Génération de l'empreinte acoustique des 5 premières minutes pour identification musicale/sonore et détection automatique des segments récurrents (**Skip Intro / Skip Outro / Skip Recap**) par corrélation croisée entre les épisodes d'une même saison.
* **pHash Vidéo (Perceptual Hashing) :** Extraction de 5 images-clés (*keyframes*) espacées dans le fichier et calcul d'un hash perceptuel ($64\text{ bits}$) résistant au redimensionnement et à la compression, comparé à une base communautaire.

---

## 3. Le Modèle Mathématique du « Score de Confiance » (Bayesian Matcher)

Au lieu d'un choix binaire aveugle, le moteur attribue à chaque candidat TMDB/TVDB un **Score de Confiance Global ($S_{\text{total}}$)** compris entre $0$ et $1$ :

$$S_{\text{total}} = \max \left( S_{\text{hash}}, \sum_{i} w_i \cdot s_i \right)$$

Où :
* $S_{\text{hash}} \in \{0, 1\}$ : Correspondance exacte d'empreinte binaire (OSHash / ED2K) ou d'ID explicite (`[tmdbid-12345]`). Si $S_{\text{hash}} = 1$, le score total est immédiatement fixé à $1.0$ (court-circuit du pipeline).
* $s_{\text{title}} \in [0, 1]$ : Similarité trigramme (`pg_trgm`) + distance de Levenshtein pondérée par le SLM entre le titre extrait et les titres officiels/alternatifs.
* $s_{\text{year}} \in [0, 1]$ : Correspondance de l'année ($1.0$ si exacte, $0.8$ si $\pm 1\text{ an}$ à cause des décalages entre sortie festival et sortie salle, $0$ sinon).
* $s_{\text{duration}} \in [0, 1]$ : Fonction gaussienne de l'écart entre la durée réelle du fichier ($D_{\text{file}}$) et la durée TMDB ($D_{\text{tmdb}}$) :
  $$s_{\text{duration}} = \exp\left(-\frac{(D_{\text{file}} - D_{\text{tmdb}})^2}{2\sigma^2}\right)$$
* $s_{\text{sub}} \in [0, 1]$ : Taux de recouvrement des entités nommées (personnages/lieux) extraites des sous-titres avec le casting officiel de l'œuvre sur TMDB.

### Règles de décision du Scanner :
* **$S_{\text{total}} \ge 0.90$ :** Validation et indexation automatique silencieuse.
* **$0.65 \le S_{\text{total}} < 0.90$ :** Indexation provisoire + déclenchement automatique du **Niveau 5 (Analyse des sous-titres)** pour lever le doute + marquage `"À vérifier"` dans le tableau de bord administrateur.
* **$S_{\text{total}} < 0.65$ :** Le fichier reste visible et lisible dans l'interface sous son nom brut (Philosophie Kyoo : *aucun fichier ne doit jamais être caché ou inaccessible*), avec une bannière invitant à un *Match Manuel* en un clic (qui alimentera la base communautaire).

---

## 4. La Convention Ultime de Structuration et de Nommage (Rétrocompatible à 100 %)

Bien que Kyoo et cette architecture Next-Gen soient conçus pour lire des fichiers en vrac, **adopter une convention de nommage déterministe** présente un avantage décisif : votre bibliothèque devient **universelle**, 100 % instantanée (0 requête d'ambiguïté), et compatible simultanément avec **Kyoo, Jellyfin, Plex, Kodi et la suite `*arr` (Sonarr/Radarr/Bazarr)**.

### A. Le Standard pour les Films
L'injection de l'identifiant unique entre accolades ou crochets garantit un **court-circuit immédiat au Niveau 1** (zéro erreur possible, même sur des titres d'un seul caractère ou des homonymes parfaits) :

```text
/Médias
  └── /Films
        └── Nom du Film (Année) [tmdbid-XXXX]
              ├── Nom du Film (Année) [Edition-Director's Cut] [1080p Remux HEVC TrueHD] [tmdbid-XXXX].mkv
              ├── Nom du Film (Année) [Edition-Theatrical] [2160p WEB-DL DV HDR10] [tmdbid-XXXX].mkv
              └── /Extras
                    └── Making of-behindthescenes.mkv
```
* **Exemples concrets :**
  * `Dune (1984) [tmdbid-841]/Dune (1984) [1080p BluRay x265] [tmdbid-841].mkv`
  * `Dune (2021) [tmdbid-438631]/Dune (2021) [2160p Remux HDR] [tmdbid-438631].mkv`

### B. Le Standard pour les Séries TV Classiques
```text
/Médias
  └── /Séries
        └── Nom de la Série (Année de début) [tmdbid-XXXX]
              ├── /Season 00 (ou /Specials)
              │     └── Nom de la Série (Année) - S00E01 - Titre du Spécial.mkv
              ├── /Season 01
              │     ├── Nom de la Série (Année) - S01E01 - Titre de l'épisode [1080p WEB-DL].mkv
              │     └── Nom de la Série (Année) - S01E02-E03 - Épisode Double.mkv
```

### C. Le Standard Hybride pour les Animes (Compatible Fansub + Media Centers)
Pour les animes, conserver à la fois le couple `SXXEXX`, le numéro absolu `XXX` et le **CRC32** entre crochets permet à **tous** les moteurs (Kyoo, AniDB, Plex/Shoko, Jellyfin) de fonctionner à la perfection :

```text
/Médias
  └── /Animes
        └── Jujutsu Kaisen (2020) [tmdbid-95479] [anidb-15275]
              ├── /Season 01
              │     └── [SubsPlease] Jujutsu Kaisen - S01E01 - 001 - Ryomen Sukuna [1080p] [F4A8B2C1].mkv
              └── /Season 02
                    └── [Erai-raws] Jujutsu Kaisen - S02E05 - 029 - Premature Death [1080p] [E5A29910].mkv
```

### D. Gestion des Éditions Multiples, Bonus et Pistes Externes
| Cas de figure | Syntaxe normalisée recommandée | Comportement du Scanner Idéal |
| :--- | :--- | :--- |
| **Versions / Éditions multiples** | `[Edition-Director's Cut]`, `[Edition-Extended]`, `[Edition-Uncensored]` | Regroupe les fichiers sous une seule fiche média avec un sélecteur de version dans le lecteur vidéo. |
| **Épisodes fusionnés** | `S01E01-E02` ou `S01E01-E03` | Crée les entrées pour les épisodes 1, 2 et 3 en base et lie les chapitres MKV pour permettre de sauter directement à l'épisode 2 dans le même fichier. |
| **Fichiers coupés en plusieurs parties** | `pt1`, `pt2`, `cd1`, `cd2` | Fusionne virtuellement la lecture dans une playlist HLS continue sans coupure visible. |
| **Bonus locaux (Extras)** | Suffixes `-trailer`, `-behindthescenes`, `-deleted`, `-interview`, `-featurette` ou sous-dossier `/Extras` | Rattachés à la fiche du film ou de la saison correspondante sans polluer la grille principale de la bibliothèque. |
| **Sous-titres externes** | `Nom_Exact_Du_Fichier.fr.forced.ass` ou `.en.sdh.srt` | Associés dynamiquement avec détection des drapeaux : `forced` (forcé), `sdh` (malentendants), `default`. |

---

## 5. Schéma de Base de Données & Stockage des Métadonnées (PostgreSQL)

L'une des meilleures idées de Kyoo v5 — qu'il faut conserver et enrichir — est l'utilisation de **PostgreSQL** avec support natif du **multilinguisme par JSONB** et de la **recherche floue par trigrammes (`pg_trgm`)** combinée à la **recherche vectorielle (`pgvector`)**.

### A. Architecture Relationnelle Découplée (4 Couches)
1. **Entité `Work / Show / Movie` (Œuvre Abstraite) :** Contient les identifiants externes (`tmdb_id`, `imdb_id`, `tvdb_id`, `anidb_id`, `mal_id`), la date de sortie, les genres, les studios et le statut.
2. **Entité `Translation` (Métadonnées Localisées en JSONB) :** Stocke les titres, synopsis, slogans, posters et logos **dans toutes les langues disponibles simultanément**.
   * *Avantage :* L'utilisateur A (interface en français) voit *« Le Voyage de Chihiro »* avec l'affiche française, tandis que l'utilisateur B (interface en anglais) voit *« Spirited Away »* sur le même serveur, au même instant, sans re-scraper.
3. **Entité `Episode / Entry` (Unité Narrative) :** Contient le numéro de saison, le numéro d'épisode, le numéro absolu, mais aussi **les ordres alternatifs** (`air_order`, `dvd_order`, `absolute_order`, `anime_arc_order`).
4. **Entité `MediaFile` (Fichier Physique sur Disque) :** Contient le `filepath`, la taille, le `oshash`, le `ed2k_hash`, la durée exacte, les pistes vidéo/audio/sous-titres extraites par `ffprobe`, les marqueurs temporels (`intro_start`, `intro_end`, `credits_start`), et le `confidence_score`.

### B. Stratégie de Cache Local et Sobriété Réseau (`NFO` & `Sidecar Assets`)
Pour ne jamais dépendre de la disponibilité des serveurs de TMDB en cas de réinstallation complète du serveur :
* **Export silencieux de fichiers `.nfo` (ou `.kyoo.json`) :** Dès qu'un média est identifié avec un score $\ge 0.95$, le serveur peut optionnellement écrire un petit fichier caché `.mediana.json` à côté du fichier vidéo (ou dans un dossier de sauvegarde dédié) contenant les IDs validés et les timestamps des génériques.
* **Priorité des Assets Graphiques :**
  1. Images locales présentes dans le dossier (`poster.jpg`, `backdrop.jpg`, `logo.png`).
  2. **TMDB** & **Fanart.tv** (pour les `ClearLogo` transparents en haute définition et les arrière-plans 4K sans texte).
  3. **TVDB** & **AniList** (en fallback pour les visuels d'épisodes d'animes).
* **Conversion automatique en WebP / AVIF :** Toutes les affiches téléchargées sont converties et déclinées en 3 résolutions (`blurhash` de 30 octets pour le chargement instantané, miniature `400px` en AVIF/WebP pour les grilles, et original `4K` pour les écrans TV).

---

## 6. Synthèse : Checklist d'Implémentation du Scanner Parfait

Si vous configurez un écosystème média aujourd'hui ou développez un plugin/contributeur pour Kyoo, voici l'ordre de priorité des briques technologiques :

| Priorité | Composant Technique | Outil / Bibliothèque Open-Source | Gain de Fiabilité |
| :--- | :--- | :--- | :--- |
| **P0 (Socle)** | Surveillance temps réel du disque | `notify` (Rust) / `watchdog` (`inotify` Python) | Détection en $< 10\text{ ms}$ à la fin du téléchargement |
| **P0 (Socle)** | Parsing lexical + Mapping Anime | `GuessIt` + `Fribb/anime-lists` + `TheXEM` | Résout $90\%$ des fichiers en vrac et animes |
| **P1 (Quick Win)** | Empreinte binaire rapide | Algorithme `OpenSubtitles Hash` (64KB head/tail) + `CRC32` | Identification à $100\%$ des fichiers renommés |
| **P1 (Quick Win)** | Inspection conteneur & durée | `ffprobe` (JSON output) | Élimine les collisions Films vs Séries et lit les tags MKV |
| **P2 (Avancé)** | Analyse sémantique des sous-titres | Extraction `ffmpeg` + NER léger (`spaCy` ou Regex de casting) | Résout les homonymes US/UK et l'ordre DVD vs TV |
| **P3 (État de l'art)** | SLM Local de secours & Audio Fingerprint | `Llama.cpp` / `ONNX` (Modèle 0.5B) + `Chromaprint` | Résout les acronymes obscurs + Saut d'intro automatique |