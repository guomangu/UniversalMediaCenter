
* **Problème / Symptôme :** Configurer un chemin absolu personnalisé comme `MEDIA_CHAOS_ROOT=/home/tele/Vidéos/drive` dans `.env` sans adapter les volumes de `compose.yaml`. Sur Bazzite / Fedora Atomic, `/home` est un lien symbolique vers `/var/home`.
* **Conséquences :** Le conteneur ne trouve aucun fichier (`ENOENT`), et l'application démarre avec un catalogue complètement vide.
* **Mauvaise Pratique :** Monter uniquement `./media:/media` dans `compose.yaml` en supposant que tous les utilisateurs rangeront leurs fichiers dans ce dossier relatif.
* **Bonne Pratique :**
  - Monter à la fois le chemin physique canonique (`/var/home/...`) et le lien utilisateur (`/home/...`) dans le conteneur (`ro,z`).
  - Permettre la résolution transparente des chemins absolus inscrits dans les fichiers `.nfo` préexistants.

---

## 🛑 12. Dépendance Aveugle à Inotify (`chokidar.watch`) sans Crawler Récursif au Boot

* **Problème / Symptôme :** Compter uniquement sur `chokidar.watch(path.join(dir, '**/*.nfo'))` pour détecter les fichiers médias au démarrage d'un conteneur Podman/Docker.
* **Conséquences :** Les conteneurs rootless ou les montages bind profonds (> 10 000 fichiers) ignorent silencieusement les fichiers existants au boot, laissant la base de données à zéro enregistrement.
* **Mauvaise Pratique :** Espérer que les événements inotify se déclencheront sur des fichiers immobiles déjà présents sur le disque avant le lancement du conteneur.
* **Bonne Pratique :**
  - Déployer un crawler récursif d'initialisation (`bootScanner.ts`) qui parcourt récursivement `MEDIA_CHAOS_ROOT` dès le démarrage.
  - Traiter chaque fichier `.nfo` trouvé de façon asynchrone et idempotente (vérification SHA-256).

---

## 🛑 13. Chemins de Fichiers Locaux Bruts dans les Retours d'API

* **Problème / Symptôme :** L'API renvoie des chemins bruts du disque hôte (ex: `posterPath: "/var/home/tele/Vidéos/.../folder.jpg"`) dans le JSON consommé par le frontend Web ou mobile.
* **Conséquences :** Les navigateurs web refusent d'accéder aux URI locales `file:///` pour des raisons de sécurité, rendant les cartes médias sans artwork.
* **Mauvaise Pratique :** Servir directement les chaînes de chemins du système de fichiers aux composants UI clients.
* **Bonne Pratique :**
  - Transformer les chemins d'artworks locaux en routes HTTP sécurisées (`/api/media/:id/poster`, `/api/media/:id/fanart`).
  - Utiliser un utilitaire de résolution (`resolveImageUrl`) côté client pour préfixer avec `EXPO_PUBLIC_API_URL` si nécessaire.

---

## 🛑 14. Placement de Fichiers Non-Routes dans le Dossier `src/app/` d'Expo Router

* **Problème / Symptôme :** Placer des fichiers de styles ou d'utilitaires (ex: `PlayerScreen.styles.ts`) directement dans `frontend/src/app/player/`.
* **Conséquences :** Expo Router interprète le fichier comme une page web et tente de charger une route (`/player/PlayerScreen.styles`). Faute d'export React par défaut (`export default`), Expo Router émet l'erreur `Route "...styles.ts" is missing the required default export` et bloque ou désactive silencieusement l'ensemble de la navigation (`router.push` sans effet).
* **Mauvaise Pratique :** Ranger des fichiers TypeScript de styles, constantes ou types à côté des écrans dans `src/app/`.
* **Bonne Pratique :**
  - Réserver exclusivement `src/app/` aux composants d'écrans et layouts exportant par défaut un composant React.
  - Déplacer tous les fichiers de styles et sous-composants dans `src/components/` ou `src/constants/`.
  - Utiliser le composant `<Link href="..." asChild>` d'Expo Router pour garantir un rendu d'ancre HTML native `<a href="...">` fiable sur le Web.

---

## 🛑 15. Absence de Support HTTP Range (`206 Partial Content`) pour le Streaming Vidéo

* **Problème / Symptôme :** Servir un fichier vidéo volumineux en flux complet (200 OK) sans prendre en compte l'en-tête `Range: bytes=start-end`.
* **Conséquences :** Les navigateurs web refusent de lire la vidéo ou se figent, et l'utilisateur ne peut pas avancer (seek) dans la barre de progression temporelle.
* **Mauvaise Pratique :** Servir la vidéo avec un simple `fs.readFile` intégral en réponse HTTP 200.
* **Bonne Pratique :**
  - Implémenter le parsing de `Range` (`mediaStream.ts`), renvoyer le statut HTTP `206 Partial Content`, les en-têtes `Content-Range`, `Content-Length` et `Accept-Ranges: bytes`.
  - Pipeliner via `Readable.toWeb(fs.createReadStream(filePath, { start, end }))` pour une consommation mémoire constante quel que soit le poids du média.

---

## 🛑 16. Vue d'Exploration Vide sans Saisie de Recherche

* **Problème / Symptôme :** L'onglet "Explorer" affichait `Catalogue (0)` dès lors qu'aucun terme de recherche n'était saisi par l'utilisateur.
* **Conséquences :** Sentiment de bibliothèque vide ou de bug d'indexation, dégradation forte de l'UX.
* **Mauvaise Pratique :** Conditionner l'ensemble du rendu de l'écran d'exploration aux résultats d'un moteur de recherche texte nécessitant au moins 2 caractères.
* **Bonne Pratique :**
  - Fournir un endpoint de métriques (`/api/media/stats`) restituant les compteurs par catégorie (Films, Séries, Épisodes, TV), les top genres et les derniers ajouts.
  - Basculer élégamment entre les statistiques / nouveautés au repos et les résultats filtrés lors d'une saisie.

---

## 🛑 17. Troncature Agressive des Titres de Médias sans Retour à la Ligne

* **Problème / Symptôme :** Utiliser `numberOfLines={1}` sur les cartes médias, coupant brutalement les titres longs en ellipses illisibles (ex: `"La Flamme - S01E..."`).
* **Conséquences :** Impossibilité pour l'utilisateur de distinguer les épisodes d'une même saison ou les titres de sagas complètes.
* **Mauvaise Pratique :** Verrouiller les libellés sur une seule ligne pour simplifier l'alignement vertical sans adapter le gabarit de la carte.
* **Bonne Pratique :**
  - Définir `numberOfLines={2}` avec `lineHeight: 18` et `minHeight: 36` sur le titre pour autoriser le retour à la ligne tout en conservant un alignement horizontal parfait des cartes voisines.
