---

## 🛑 39. Confusion Hiérarchique des Séries/Saisons, Faux Extras Contaminants et Vol de Vidéos par les NFO de Saisons

* **Problème / Symptôme :** Suite à un scan universel, des séries se retrouvaient mélangées : Soul Eater (51 épisodes) ne contenait plus qu'un seul épisode tandis que Bleach en affichait 440 (ayant englouti les épisodes de Soul Eater, Angel Beats et Lain) ; les saisons disparaissaient (les épisodes d'Utopia devenant des bonus inaccessibles dans la liste principale) ; et des noeuds fantômes "Saison 1" de type `SEASON` volaient le fichier vidéo du premier épisode.
* **Conséquences :** Expérience utilisateur chaotique, épisodes introuvables sur la fiche de leur série respective, doublons de médias sans fin et perte de la navigation naturelle par saison.
* **Causes Racines & Anti-Patterns Identifiés :**
  - **Recherche de Parent par LIKE Préfixe sans Slash de Délimitation :** Utiliser `like(nfoFilePath, ${parentShowDir}%)` où `parentShowDir` correspondait au dossier racine des bibliothèques (`/Animes` ou `/Series`). En SQL, tout show situé sous ce dossier matchait le premier résultat venu, absorbant ainsi les épisodes de toutes les séries voisines.
  - **Vol de Vidéo Adjacent par les NFO Non-Jouables (`tvshow.nfo` et `season.nfo`) :** Dans `detectAdjacentFiles()`, attribuer la première vidéo trouvée dans le répertoire à un fichier `.nfo` sans vérifier son type. Un `season.nfo` ou `tvshow.nfo` se retrouvait lié à la vidéo de l'épisode 1, créant un noeud `SEASON` concurrent de l'épisode réel.
  - **Contamination des Extras par Test de Chemin Global :** Tester `regex.test(fullPath)` avec des mots-clés comme `extras|bonus|featurettes` sur le chemin absolu au lieu du sous-dossier direct. Si le dossier de la série contenait `+ Extras` dans son titre de release (ex: `Utopia (2013) Season 1-2 S01-S02 + Extras`), **100% des épisodes de la série étaient marqués comme des bonus (`isExtra = true`)**, les faisant disparaître de la grille principale d'épisodes.
  - **Collisions d'Index d'Ordre Entre Saisons :** Utiliser un `orderIndex = episodeNumber` brut sans offset de saison, conduisant à des collisions directes (`S01E01` et `S02E01` ayant tous deux `orderIndex = 1`).
* **Bonnes Pratiques de Remédiation :**
  - **Résolution Déterministe de la Racine de Série (`hierarchyResolver.ts`) :** Remonter l'arborescence depuis le fichier jusqu'à trouver un `tvshow.nfo` physique ou la racine de catégorie (`Animes/`, `Series/`). Le dossier trouvé est le conteneur unique et inviolable de la série.
  - **Adoption avec Slash Terminal Strict :** Tout rattachement ou requête de descendance doit formellement inclure le séparateur de dossier : `like(path, ${showDir}/%)`. Impossible pour une série d'adopter un fichier extérieur.
  - **Exclusion Formelle des Vidéos pour `tvshow.nfo` et `season.nfo` :** `mediaFileDetector.ts` ne doit attribuer un `videoFilePath` qu'aux NFOs d'épisodes ou de films avec correspondance stricte de nom de base (`base === nfoBase`).
  - **Détection des Extras sur les Sous-Dossiers Relatifs Délimités (`folderGrouper.ts`) :** Tester uniquement les dossiers immédiats (`/(?:^|\/)(?:featurettes|extras|bonus|deleted scenes)(?:$|\/)/i.test(relPath)`), jamais le chemin absolu.
  - **Index d'Ordre Unifié Multi-Saisons :** Pour les saisons supérieures à 1, appliquer rigoureusement `orderIndex = season * 1000 + episode` afin de garantir un tri unifié sans aucune collision.
  - **Moteur de Réconciliation Automatique (`hierarchyRepair.ts`) :** Déclenché automatiquement en 3ème passe de scan et disponible via l'endpoint admin `POST /api/admin/scan/rebuild-hierarchy` et l'interface pour remettre instantanément d'équerre l'arborescence complète sans altérer les fichiers sur disque.

---

## 🛑 40. Entrelacement Inter-Saisons (S01E01, S02E01, S01E02...), Badges Bruts "2001" et Omission des Nomenclatures d'Anime (R1, R2, Cour, Part)

* **Problème / Symptôme :** Sur les séries multi-saisons comme Code Geass (Saison 1 "R1" et Saison 2 "R2"), les épisodes s'affichaient entrelacés de façon alternée (`S01E01`, `S02E01`, `S01E02`, `S02E02`...), tandis que les badges de la saison 2 affichaient un libellé brut `"2001, 2002"` au lieu de `"S02 • EP 01, S02 • EP 02"`.
* **Conséquences :** Confusion majeure pour le visionnage continu, rupture de la chronologie narrative et perte de lisibilité sur les cartes d'épisodes.
* **Causes Racines :**
  - **Court-circuit de la Détection de Saison par `absoluteOrderIndex` :** Dans `mediaHierarchy.ts`, le test `if (c.absoluteOrderIndex > 0) episode = c.absoluteOrderIndex;` était évalué avant l'analyse regex de la saison. Comme `c.absoluteOrderIndex` valait 1 pour `S01E01` et 1 pour `S02E01`, le bloc regex extrayant `S01` et `S02` n'était jamais atteint. Les deux saisons restaient affectées au groupe par défaut `'Épisodes'` et le tri par numéro d'épisode `episode - episode` alternait les deux saisons !
  - **Omission des Nomenclatures Alternées dans les Sous-Dossiers :** Des dossiers titrés `Code Geass R1 (2006)` ou `Code Geass R2 (2008)` n'étaient pas reconnus par les regex cherchant uniquement `Season` ou `Saison`.
  - **Fallback Brut sur `orderIndex >= 1000` :** Dans `seasonEpisodeHelper.ts` et `media.ts`, un `orderIndex` de 2001 (encodage conventionnel `season * 1000 + episode`) était converti aveuglément en `EP 2001` ou `2001` au lieu d'être décodé arithmétiquement en `Saison 2, Épisode 1` (`Math.floor(val / 1000)` et `val % 1000`).
* **Bonnes Pratiques de Remédiation :**
  - **Priorité Absolue au Découpage SxxExx & Dossiers Dédiés :** Extraire prioritairement la saison et l'épisode via `/S(\d+)[\s._-]*E(\d+)/i` sur le titre ou le chemin physique, puis tester les nomenclatures `R1`/`R2`, `Part 1`/`Part 2`, `Cour 1`/`Cour 2`, `Picture Drama` et arcs narratifs.
  - **Décodage Arithmétique Universel des Index $\ge 1000$ :** Tout `orderIndex >= 1000` doit être systématiquement décodé en `season = Math.floor(orderIndex / 1000)` et `episode = orderIndex % 1000` pour produire automatiquement `displayBadge: S02 • EP 01` et `seasonEpisodeTag: S02E01`.
  - **Tri Hiérarchique à 4 Clés :** Au sein de chaque section, trier impérativement selon `season ASC` $\rightarrow$ `episode ASC` $\rightarrow$ `orderIndex ASC` $\rightarrow$ `fsSortKey ASC`. Même dans une vue agrégée "Tous", l'intégralité de la Saison 1 précède impérativement la Saison 2, interdisant mathématiquement tout entrelacement.

---

## 🛑 39. Confusion Hiérarchique des Séries/Saisons, Faux Extras Contaminants et Vol de Vidéos par les NFO de Saisons

* **Problème / Symptôme :** Suite à un scan universel, des séries se retrouvaient mélangées : Soul Eater (51 épisodes) ne contenait plus qu'un seul épisode tandis que Bleach en affichait 440 (ayant englouti les épisodes de Soul Eater, Angel Beats et Lain) ; les saisons disparaissaient (les épisodes d'Utopia devenant des bonus inaccessibles dans la liste principale) ; et des noeuds fantômes "Saison 1" de type `SEASON` volaient le fichier vidéo du premier épisode.
* **Conséquences :** Expérience utilisateur chaotique, épisodes introuvables sur la fiche de leur série respective, doublons de médias sans fin et perte de la navigation naturelle par saison.
* **Causes Racines & Anti-Patterns Identifiés :**
  - **Recherche de Parent par LIKE Préfixe sans Slash de Délimitation :** Utiliser `like(nfoFilePath, ${parentShowDir}%)` où `parentShowDir` correspondait au dossier racine des bibliothèques (`/Animes` ou `/Series`). En SQL, tout show situé sous ce dossier matchait le premier résultat venu, absorbant ainsi les épisodes de toutes les séries voisines.
  - **Vol de Vidéo Adjacent par les NFO Non-Jouables (`tvshow.nfo` et `season.nfo`) :** Dans `detectAdjacentFiles()`, attribuer la première vidéo trouvée dans le répertoire à un fichier `.nfo` sans vérifier son type. Un `season.nfo` ou `tvshow.nfo` se retrouvait lié à la vidéo de l'épisode 1, créant un noeud `SEASON` concurrent de l'épisode réel.
  - **Contamination des Extras par Test de Chemin Global :** Tester `regex.test(fullPath)` avec des mots-clés comme `extras|bonus|featurettes` sur le chemin absolu au lieu du sous-dossier direct. Si le dossier de la série contenait `+ Extras` dans son titre de release (ex: `Utopia (2013) Season 1-2 S01-S02 + Extras`), **100% des épisodes de la série étaient marqués comme des bonus (`isExtra = true`)**, les faisant disparaître de la grille principale d'épisodes.
  - **Collisions d'Index d'Ordre Entre Saisons :** Utiliser un `orderIndex = episodeNumber` brut sans offset de saison, conduisant à des collisions directes (`S01E01` et `S02E01` ayant tous deux `orderIndex = 1`).
* **Bonnes Pratiques de Remédiation :**
  - **Résolution Déterministe de la Racine de Série (`hierarchyResolver.ts`) :** Remonter l'arborescence depuis le fichier jusqu'à trouver un `tvshow.nfo` physique ou la racine de catégorie (`Animes/`, `Series/`). Le dossier trouvé est le conteneur unique et inviolable de la série.
  - **Adoption avec Slash Terminal Strict :** Tout rattachement ou requête de descendance doit formellement inclure le séparateur de dossier : `like(path, ${showDir}/%)`. Impossible pour une série d'adopter un fichier extérieur.
  - **Exclusion Formelle des Vidéos pour `tvshow.nfo` et `season.nfo` :** `mediaFileDetector.ts` ne doit attribuer un `videoFilePath` qu'aux NFOs d'épisodes ou de films avec correspondance stricte de nom de base (`base === nfoBase`).
  - **Détection des Extras sur les Sous-Dossiers Relatifs Délimités (`folderGrouper.ts`) :** Tester uniquement les dossiers immédiats (`/(?:^|\/)(?:featurettes|extras|bonus|deleted scenes)(?:$|\/)/i.test(relPath)`), jamais le chemin absolu.
  - **Index d'Ordre Unifié Multi-Saisons :** Pour les saisons supérieures à 1, appliquer rigoureusement `orderIndex = season * 1000 + episode` afin de garantir un tri unifié sans aucune collision.
  - **Moteur de Réconciliation Automatique (`hierarchyRepair.ts`) :** Déclenché automatiquement en 3ème passe de scan et disponible via l'endpoint admin `POST /api/admin/scan/rebuild-hierarchy` et l'interface pour remettre instantanément d'équerre l'arborescence complète sans altérer les fichiers sur disque.
