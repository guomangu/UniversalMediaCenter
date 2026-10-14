  - Pour les nœuds `EPISODE` et `SEASON`, remonter d'abord chercher le titre propre du parent `SHOW` dans la base de données locale avant d'interroger le web.
  - Définir des timeouts stricts (`AbortSignal.timeout(6000)`) et un délai inter-requêtes (200ms) pour respecter les quotas.

---

## 🛑 24. Découverte Cast Limitée aux Seuls Clients Internes (Smart TV Invisibles)

* **Problème / Symptôme :** La fonctionnalité de Cast reposait uniquement sur un registre en mémoire et un polling interne HTTP/WebSocket UMS, ne découvrant que les fenêtres de navigateur actives exécutant l'application. La Smart TV connectée au réseau (Google TV, Chromecast, Android TV, Smart TV Samsung/LG) n'apparaissait pas dans la modale de Cast.
* **Conséquences :** Impossibilité de diffuser directement sur sa télévision comme le fait l'application YouTube.
* **Mauvaise Pratique :** Tenter de réimplémenter entièrement la découverte mDNS / SSDP / DIAL en pur code applicatif web sans exploiter les APIs de projection matérielles du navigateur.
* **Bonne Pratique :**
  - Intégrer l'API W3C Remote Playback (`video.remote.prompt()`) et le Google Cast SDK standard (`cast_sender.js`).
  - Proposer un bouton pro "Caster sur ma Télévision" qui réveille le dialogue natif du navigateur, offrant la parité parfaite avec YouTube pour la détection et la diffusion fluide vers toutes les Smart TVs du réseau local.

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
