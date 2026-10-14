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
---

## 🛑 41. Requêtes Client avec Chemins Relatifs en Environnement Multi-Ports (404 Not Found & 401 Unauthorized)

* **Problème / Symptôme :** Clic sur "Enrichir les métadonnées" dans la console d'administration générant l'erreur console : `api/admin/library/refresh:1 Failed to load resource: the server responded with a status of 404 (Not Found)`.
* **Conséquences :** Échec silencieux de l'enrichissement TVmaze / Wikipedia, sentiment de régression et confusion côté administrateur.
* **Causes Racines :**
  - **Appel fetch Brut avec Chemin Relatif :** Exécuter `fetch('/api/admin/library/refresh', { ... })` directement dans un composant React Native / Expo Web. Lorsque l'application est consultée sur le port de dev Expo (8081), la requête frappe le serveur Expo Web bundler au lieu du serveur API backend (port 3000), renvoyant immédiatement un code HTTP 404.
  - **Omission des En-têtes d'Authentification :** L'appel brut omettait `getAuthHeaders()`, privant la requête du token JWT administrateur et risquant de provoquer un refus 401 Unauthorized même en cas de reverse-proxy.
* **Bonnes Pratiques de Remédiation :**
  - **Centralisation Systématique dans les Services d'API :** Proscrire les `fetch` bruts disséminés dans les composants UI. Centraliser tous les appels d'administration dans `adminApi.ts` ou `api.ts`.
  - **Préfixage Automatique de l'URL de Base et En-têtes Sécurisés :** Utiliser systématiquement `${getApiBaseUrl()}` combiné avec `getAuthHeaders()` (ex: fonction unifiée `triggerLibraryRefresh()`), assurant le ciblage absolu du port backend et l'injection inviolable du token de session.

---

## 🛑 42. Utilisation Fragile d'IntersectionObserver Bloquant les Boucles de Polling en Conteneurs Scrollables

* **Problème / Symptôme :** La discussion de forum synchronisée / asynchrone cessait de recevoir les nouveaux messages et ne rafraîchissait plus les séances en cours.
* **Conséquences :** Rupture de la communication temps réel entre utilisateurs, sentiment d'application buggée ou figée.
* **Causes Racines :**
  - **Conditionnement du Polling à un IntersectionObserver sur Composant Imbriqué :** Dans `MediaForumSection.tsx`, le déclenchement de `setInterval` était conditionné à `isVisible`. Sur le Web avec React Native Web, lorsque le composant est imbriqué dans un `<ScrollView>` ou lors du chargement initial de la vue, l'élément peut renvoyer un état `isIntersecting = false` non restauré, détruisant le timer et coupant définitivement toute synchronisation.
  - **Dépendances Inconsistantes de Callbacks :** `loadData` dépendait de l'état `activeSession`, entraînant des réinstanciations répétées et des réinitialisations anarchiques de l'observateur.
* **Bonnes Pratiques de Remédiation :**
  - **Cycle de Vie Déterministe pour la Synchronisation :** Pour les fonctionnalités de discussion et de live-room où l'utilisateur s'attend à une réactivité immédiate, maintenir une boucle de rafraîchissement périodique (2.5s) basée purement sur le montage/démontage du composant (`useEffect` avec `clearInterval` au unmount).
  - **Mise à Jour Optimiste Côté Client :** Dès la soumission d'un message par l'utilisateur, insérer immédiatement une copie optimiste dans le state local avant même la réponse réseau, éliminant tout sentiment de latence.

---

## 🛑 43. Rupture de Contexte par Ouverture d'Onglets Externes pour les Vocaux (`Linking.openURL`)

* **Problème / Symptôme :** Cliquer sur un message vocal dans le forum ouvrait un nouvel onglet de navigateur blanc affichant le lecteur média natif du navigateur, déconnectant l'utilisateur de sa conversation.
* **Conséquences :** Expérience utilisateur dégradée, arrêt forcé de la lecture des autres messages et perte du contexte du forum.
* **Causes Racines :** Utilisation simpliste de `Linking.openURL(fullUrl)` pour les médias de type `'AUDIO'`.
* **Bonnes Pratiques de Remédiation :**
  - **Lecteur Audio Intégré In-Place ([`InlineAudioPlayer.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/InlineAudioPlayer.tsx)) :** Encapsulation d'une instance HTML5 Audio / Web Audio au sein même de la bulle de discussion, dotée d'un bouton Play/Pause (`▶` / `⏸`), d'un compteur de temps dynamique et d'une jauge de progression.
  - **Gestion Globale de l'Exclusivité Audio :** Maintien d'une référence statique globale garantissant que le lancement d'un nouveau vocal met automatiquement en pause le vocal précédent, évitant toute cacophonie.

---

## 🛑 44. Omission du Heartbeat de Visionnage Solo et Affichage Intempestif de Compteurs à Zéro

* **Problème / Symptôme :** Les utilisateurs regardant un média de façon autonome n'étaient pas comptabilisés comme étant "en séance", et les cartes affichaient des badges vides ou trompeurs.
* **Conséquences :** Impression d'une plateforme déserte alors que des membres visionnent des épisodes, et pollution visuelle causée par l'affichage de libellés "0 en séance".
* **Causes Racines :**
  - **Absence de Heartbeat sur la Lecture Solo :** Le lecteur vidéo ne signalait la présence de l'utilisateur que si une session formelle multi-spectateurs existait au préalable en base de données.
  - **Omission de la Propagation Hiérarchique :** Si un utilisateur regardait l'épisode 3 d'une série, seul l'ID de l'épisode était noté, laissant la carte principale de la série avec un compteur nul sur l'accueil.
  - **Absence de Seuil Minimal d'Affichage :** Rendu du composant badge sans vérifier que `activeSession.count >= 1`.
* **Bonnes Pratiques de Remédiation :**
  - **Heartbeat de Progression Universel ([`media.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/media.ts) & [`presenceStore.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/presenceStore.ts)) :** Émission régulière de `POST /api/media/:id/progress` dès qu'un média est en cours de lecture, maintenant un registre en mémoire des spectateurs actifs avec expiration glissante (25s) et nettoyage au démontage (`leavePlayback`).
  - **Agrégation Montante Automatique :** Tout visionnage d'un épisode crédite également la série parente (`parentId`), assurant que la vignette de la série reflète l'activité globale.
  - **Règle Stricte Zéro-Séance ([`MediaCard.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/MediaCard.tsx)) :** Conditionner l'affichage à `Boolean(activeSession && activeSession.count >= 1)`. Ne jamais afficher "0 en séance".

---

## 🛑 45. Présomption du Format de Résultat Drizzle ORM avec Postgres.js (`(res as any).rows` vs `Array.isArray(res)`)

* **Problème / Symptôme :** Disparition totale des métadonnées (casting, réalisateurs, codecs, notes, pays, studios, identifiants) sur la page `/media/:id`, toutes les zones de tags retournant un tableau vide (`HERO: 0, PILLS: 0, ACCORDION: 0`).
* **Conséquences :** Fiche média dépouillée, sections de caractéristiques invisibles et perte de navigation croisée par artiste.
* **Causes Racines :**
  - **Hypothèse erronée sur `db.execute(sql...)` :** Présumer que l’exécution SQL renvoie un objet `{ rows: [...] }` comme le driver `pg` classique. Dans `postgres.js` utilisé par Drizzle, le résultat retourné est directement un tableau `Array`. Ainsi, `(linkedTags as any).rows || []` valait `undefined || [] = []`, ignorant l'intégralité des 101 tags stockés en base de données.
* **Bonnes Pratiques de Remédiation :**
  - **Extraction Polymorphique Résiliente :** Utiliser systématiquement `const rows = Array.isArray(result) ? result : (result as any).rows || [];`.
  - **Double Mappage Clés/Zones :** Alimenter à la fois la nomenclature standard (`HERO_BADGE`, `PRIMARY_PILL`, `PERSON_CAROUSEL`, `TECHNICAL_DRAWER`) et les alias historiques (`HERO`, `PILLS`, `ACCORDION`), en injectant simultanément les propriétés en `camelCase` et `snake_case` (`value_text` et `value`, `attr_code` et `attributeCode`).

---

## 🛑 46. Découpage en Tranches MediaRecorder sans En-tête EBML (`start(timeslice)`) Causant la Coupure Définitive du Son après 2.5s

* **Problème / Symptôme :** Les appels vocaux directs fonctionnaient pendant les premières secondes, puis aucun son ne passait plus entre les participants.
* **Conséquences :** Fonctionnalité d'appel direct inutilisable, silence radio après le premier fragment.
* **Causes Racines :**
  - **Omission de l'En-tête EBML sur les Chunks Suivants :** Lorsque `MediaRecorder.start(2500)` est utilisé dans les navigateurs Chrome/Chromium, seul le premier blob émis par `ondataavailable` contient l'en-tête du conteneur WebM (EBML Header). Tous les fragments ultérieurs sont des tranches brutes sans en-tête. Côté récepteur, `new Audio(data:audio/webm;base64,...)` échoue silencieusement au demuxage sur tous les fragments à partir du 2ème car ils ne sont pas des conteneurs WebM complets autonomes.
  - **Absence de File d'Attente Séquentielle :** La réception directe créait une instance `Audio` par fragment sans séquencement, provoquant des superpositions ou des rejets de lecture simultanée.
* **Bonnes Pratiques de Remédiation :**
  - **Génération Déterministe de Fragments Autonomes :** Démarrer l'enregistreur sans paramètre de découpage, et appeler explicitement `recorder.stop()` à la fin de chaque intervalle (2.5s) avant de réinstancier le fragment suivant. La fermeture du recorder garantit que chaque fragment produit est un fichier WebM/Opus complet, valide et autonome doté de son propre en-tête.
  - **Queue de Lecture Audio Séquentielle (`audioQueueRef`) :** Enfiler les fragments reçus dans une file d'attente jouée séquentiellement via l'événement `onended`, garantissant une restitution vocale fluide, continue et ininterrompue.
