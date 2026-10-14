---

## 🛑 25. Appels de Fonctions Asynchrones Non-Défensives dans les Timers Périodiques (`setInterval` & HMR)

* **Problème / Symptôme :** Lorsqu'un hook (`useCastReceiver`) lance un intervalle périodique (`setInterval`) appelant des fonctions importées d'un service (`sendCastHeartbeat`), le rechargement à chaud Metro (Fast Refresh / HMR) ou une session préexistante peut tenter d'exécuter la fonction avant que l'export ne soit résolu en mémoire, levant l'erreur `Uncaught TypeError: (0, ...).sendCastHeartbeat is not a function`.
* **Conséquences :** Crash de la console ou bandeau d'erreur rouge dans le lecteur vidéo lors d'une mise à jour de code à chaud.
* **Mauvaise Pratique :** Présumer qu'une fonction de service importée est invariablement disponible dans un timer asynchrone lors des cycles de rechargement à chaud.
* **Bonne Pratique :**
  - Sécuriser les appels dans les timers périodiques par un garde de type (`if (typeof fn === 'function') fn(...)`).
  - Nettoyer systématiquement les intervalles dans le cleanup d'effet (`return () => clearInterval(...)`).

---

## 🛑 26. Piégeage des Touches Télécommande dans les Inputs de Recherche et Modales Non-Navigables

* **Problème / Symptôme :** Dès que le focus entrait dans une barre de recherche (`TextInput`), les touches directionnelles étaient complètement ignorées (`return`), piégeant l'utilisateur télécommande dans le champ sans pouvoir descendre vers les résultats ou remonter vers la barre d'onglets. De plus, les boutons des menus du lecteur ("Partager", "Cast", "Audio", "ST", "Qualité") et leurs modales n'avaient pas d'attributs `focusable={true}` et n'étaient pas isolés lors de l'ouverture de la modale.
* **Conséquences :** Impossible de piloter les menus du lecteur vidéo et les listes déroulantes de recherche à la télécommande ou à la manette.
* **Mauvaise Pratique :** Bloquer globalement la navigation spatiale dans tous les `input`, et omettre `focusable={true}` / le confinement de focus dans les modales contextuelles.
* **Bonne Pratique :**
  - Autoriser `ArrowDown` pour descendre immédiatement du champ de recherche vers les résultats/filtres, `ArrowUp` pour remonter vers l'en-tête, et `Escape / Back` pour désactiver le focus (`blur()`).
  - Marquer les boutons de modales avec `focusable={true}` et cantonner automatiquement la navigation spatiale à l'intérieur de la modale active (`[data-modal-container="true"]`).
  - Associer la touche Retour de la télécommande à la fermeture de la modale ouverte (`[data-modal-close="true"]`) au lieu de déclencher un retour arrière d'historique web.

---

## 🛑 27. Blocage 401 sur les Flux TV en Direct (IPTV) & Route `/api/auth/config` Manquante

* **Problème / Symptôme :** Le lancement d'une chaîne TV en direct (`node_type = 'LIVE_CHANNEL'`) renvoyait `HTTP 401 Unauthorized` sur `/api/media/:id/stream` en l'absence de session utilisateur complète, et la console affichait une erreur `404 Not Found` sur `/api/auth/config`.
* **Conséquences :** Écran noir lors du zapping TV en direct et échec de récupération de la configuration publique du serveur lors du chargement initial de l'espace admin.
* **Mauvaise Pratique :** Appliquer les contrôles de sécurité des fichiers médias confidentiels (`checkMediaAccess`) aux flux IPTV publics externes (`streamUrl`), et définir une route d'API dans un routeur secondaire non monté sur le serveur principal.
* **Bonne Pratique :**
  - Autoriser immédiatement la diffusion des chaînes TV en direct (`LIVE_CHANNEL`) avec en-têtes CORS (`Access-Control-Allow-Origin: *`) et redirection 302 sans exiger de jeton de fichier privé.
  - Monter systématiquement les routes de configuration publique (`/api/auth/config`) directement dans le routeur principal `authRouter`.
  - Synchroniser automatiquement l'état de session client (`syncSessionWithServer`) avec le serveur PostgreSQL (`/api/auth/me`) pour actualiser instantanément le rôle `isAdmin: true` sans obliger l'utilisateur à se déconnecter manuellement.
