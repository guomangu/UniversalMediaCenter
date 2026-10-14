* **Mauvaise Pratique :** Verrouiller les libellés sur une seule ligne pour simplifier l'alignement vertical sans adapter le gabarit de la carte.
* **Bonne Pratique :**
  - Définir `numberOfLines={2}` avec `lineHeight: 18` et `minHeight: 36` sur le titre pour autoriser le retour à la ligne tout en conservant un alignement horizontal parfait des cartes voisines.

---

## 🛑 18. Écrasement Inconditionnel de la Variable d'Environnement de l'API par la Détection Dynamique Client (`window.location`)

* **Problème / Symptôme :** Le frontend ignore la variable d'environnement `EXPO_PUBLIC_API_URL` configurée dans le fichier `.env` (ex: `https://api.cool.sweaw.com`) et tente d'appeler `/api/...` directement sur le domaine du client web (`https://cool.sweaw.com`), provoquant des erreurs 404.
* **Conséquences :** Impossibilité de séparer l'hébergement du frontend web et du backend API distant.
* **Mauvaise Pratique :** Prioriser aveuglément `window.location` dès que le code s'exécute dans un navigateur, rendant inopérante la configuration d'environnement.
* **Bonne Pratique :**
  - Accorder la priorité absolue à `process.env.EXPO_PUBLIC_API_URL` dans `apiConfig.ts`.
  - N'utiliser la détection dynamique d'hôte local (`window.location`) qu'en tant que fallback de commodité si aucune variable d'environnement n'est renseignée.

---

## 🛑 19. Captation Abusive des Flèches Directionnelles pour le Volume Bloquant la Navigation Télécommande

* **Problème / Symptôme :** Associer les touches `ArrowUp` et `ArrowDown` au contrôle du volume sonore dans le lecteur vidéo (`usePlayerControls`), et capturer `ArrowLeft` et `ArrowRight` sans vérifier l'élément ayant le focus.
* **Conséquences :** L'utilisateur télécommande/manette ne peut plus circuler entre les boutons du lecteur ("Fermer", "Pause", "Audio", "Sous-titres", "Caster"), car le moindre appui sur une flèche modifie le volume ou saute dans la vidéo au lieu de déplacer le focus.
* **Mauvaise Pratique :** Détourner les flèches haut/bas pour le volume sonore et bloquer arbitrairement la navigation spatiale 2D dans le lecteur.
* **Bonne Pratique :**
  - Laisser les flèches haut/bas libres pour la navigation spatiale de bouton en bouton (le volume restant dévolu aux touches matérielles de la télécommande ou à la barre de cast).
  - Conditionner le seek vidéo (`ArrowLeft` / `ArrowRight`) à la sélection explicite de l'élément vidéo (`document.activeElement === video`). Lorsque le focus est sur la barre de contrôle, les flèches gauche/droite naviguent normalement d'un bouton à l'autre.

---

## 🛑 20. Fallback Automatique sur l'Administrateur dans le Middleware d'Authentification & Headers Fixes

* **Problème / Symptôme :** En l'absence d'en-tête d'authentification ou pour tout visiteur anonyme, le middleware assignait par défaut le premier compte trouvé en base (le compte administrateur). De plus, les requêtes admin utilisaient un ID admin codé en dur (`X-User-Id: 'admin-id'`).
* **Conséquences :** Tout visiteur anonyme ou utilisateur standard (ex: profil enfant) héritait silencieusement des droits administrateur, voyait le bouton `⚙️ Admin` et pouvait modifier la configuration du serveur.
* **Mauvaise Pratique :** Présumer qu'une requête sans identifiant provient de l'administrateur, ou coder en dur des identifiants dans le code client.
* **Bonne Pratique :**
  - Assigner strictement `c.set('user', null)` (session invité sans droits) pour toute requête sans jeton valide.
  - Émettre des jetons de session signés HMAC-SHA256 (`token.ts`) lors du login, persistés dynamiquement dans `authStore.ts` (`Authorization: Bearer <token>`).
  - Conditionner l'affichage du bouton `⚙️ Admin` et l'accès à la route `/admin` à `currentUser?.isAdmin === true`.
