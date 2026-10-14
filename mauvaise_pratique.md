# Guide des Bonnes et Mauvaises Pratiques d'Architecture & Développement

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

---

## 🛑 28. Auto-Suppression Accidentelle du Compte Administrateur & Absence de Modale de Confirmation

* **Problème / Symptôme :** L'administrateur pouvait supprimer par inadvertance son propre compte ou un compte actif sans confirmation explicite, se verrouillant ainsi l'accès complet à la plateforme.
* **Conséquences :** Perte irrémédiable de privilèges administratifs et blocage complet de l'espace d'administration.
* **Mauvaise Pratique :** Permettre la suppression d'un compte utilisateur en un seul clic sans dialogue de sécurité préalable ni vérification d'auto-suppression.
* **Bonne Pratique :**
  - Bloquer explicitement la suppression de son propre compte connecté tant côté backend que frontend.
  - Afficher systématiquement une modale modale d'alerte avec confirmation explicite avant toute action destructrice (`AdminConfirmModal.tsx`).
  - Définir des scripts de secours idempotents pour restaurer immédiatement le compte administrateur racine en cas d'accident.

---

## 🛑 29. Dépendance Aveugle aux Flux IPTV Pirates & Proxying Défensif

* **Problème / Symptôme :** L'ingestion brute de playlists IPTV publiques contenant des serveurs pirates ou éphémères (ex: `145.239.5.177`) provoque des erreurs 403 `deny_backend` ou 502 Bad Gateway répétées, ainsi que des blocages de sécurité Mixed Content (requête HTTP non chiffrée depuis une application HTTPS).
* **Conséquences :** Échecs de lecture, blocages CORS et dégradation de la confiance utilisateur lors du zapping.
* **Mauvaise Pratique :** Rediriger aveuglément les requêtes clients via des redirections `HTTP 302` vers des URLs externes non vérifiées ou périmées.
* **Bonne Pratique :**
  - **Blacklistage Proactif à l'Ingestion :** Filtrer systématiquement les domaines et IPs obsolètes ou connus pour bannir les requêtes tierces (`BLOCKED_STREAM_PATTERNS`).
  - **Proxying HLS Défensif :** Relayer les flux vidéo via un proxy applicatif backend (`liveProxyService.ts`) avec User-Agent multimédia conforme (VLC/FFmpeg), réécriture dynamique des URLs relatives de segments `.ts` / `.m3u8` et injection d'en-têtes CORS universels (`*`).
  - **Remplacement Émulateur Transparent :** Fournir des flux de remplacement stables et certifiés (ex: flux officiels France Télévisions, Arte, LCI) lors de la détection de serveurs sources défaillants.

---

## 🛑 30. Piégeage des Touches Télécommande dans les Inputs Textuels & Boutons d'Action Factices

* **Problème / Symptôme :** Dans les zones de texte (`TextInput` de forums ou formulaires), le focus télécommande restait coincé à l'intérieur du champ textuel, les flèches directionnelles tentant de naviguer entre les caractères au lieu de permettre la sortie vers le reste de l'écran. De plus, les boutons d'ajout d'images ou pièces jointes étaient factices (`alert("Envoi factice")`).
* **Conséquences :** Frustration majeure pour les utilisateurs sur Smart TV ou manette, et impossibilité de partager de vrais fichiers dans la communauté.
* **Mauvaise Pratique :** Laisser les événements de touches directionnelles être capturés sans échappatoire, et laisser des fonctionnalités d'interface incomplètes ou factices.
* **Bonne Pratique :**
  - **Échappatoire Directionnelle & Bouton Stop Dédié :** Autoriser la sortie immédiate du champ sur les flèches haut/bas, et intégrer un bouton dédié `⏹ Stop` focusable à la télécommande permettant de quitter instantanément le mode saisie.
  - **Téléversement Réel et Modulaire :** Connecter les sélecteurs de pièces jointes à une API de stockage dédiée (`POST /api/forum/upload`), acceptant photos, vidéos, documents et GIFs réels avec barre de progression et visualisation native.

---

## 🛑 31. Suralimentation de la Balise HTML5 `<video src>` en Parallèle de `Hls.attachMedia()`

* **Problème / Symptôme :** Attribuer simultanément la prop `src={streamUrl}` à la balise DOM `<video>` tout en initialisant HLS.js (`hls.loadSource` et `hls.attachMedia`) sur les navigateurs web (Chrome, Firefox, Edge).
* **Conséquences :** Le moteur multimédia natif du navigateur tente de parser le flux `.m3u8` comme une vidéo binaire brute, échoue immédiatement et déclenche une erreur DOM `onError` en parallèle de HLS.js, créant des doubles requêtes et un état d'erreur erroné.
* **Mauvaise Pratique :** Laisser `src={streamUrl}` actif quand HLS.js orchestre le streaming via MediaSource Extensions (MSE).
* **Bonne Pratique :**
  - Détecter le mode HLS (`isHlsMode = Hls.isSupported() && !canPlayNativeHls`).
  - Positionner `src={isHlsMode ? undefined : streamUrl}` pour déléguer l'injection des segments exclusivement à HLS.js.

---

## 🛑 32. Rafale de Requêtes de Polling Cast & Erreurs CORS / Cloudflare 521

* **Problème / Symptôme :** Exécuter un polling trop agressif (1500ms) sans gestion d'échec sur `/api/cast/poll/:deviceId`. Lors des redémarrages de l'API ou sous coupure réseau, la passerelle Cloudflare renvoie un code HTTP 521 et le navigateur affiche une erreur CORS bloquante.
* **Conséquences :** Saturation des journaux réseau du navigateur et messages d'erreurs intempestifs.
* **Mauvaise Pratique :** Effectuer des requêtes `fetch` répétitives dans un `setInterval` sans attrapage d'erreur défensif (`.catch(() => null)`) et avec un rythme trop élevé.
* **Bonne Pratique :**
  - Espacer les cycles de rafraîchissement (3000-4000ms).
  - Traiter défensivement les erreurs réseau pour ignorer silencieusement les micro-coupures de service.
  - Définir des en-têtes CORS globaux permissifs (`Access-Control-Allow-Origin: *`) sur tous les routeurs de synchronisation d'appareils distants.

---

## 🛑 33. Désynchronisation Rôle/Pack & Rétractation Incohérente des Droits Administrateur

* **Problème / Symptôme :** Avoir des boutons distincts pour "Admin / Membre" d'un côté et "Pack de profil" de l'autre permettait de créer des états discordants (ex: un utilisateur sous le pack Administrateur mais avec `isAdmin: false`, ou avec des restrictions de tags/dossiers paradoxales). De plus, un administrateur pouvait tenter de retirer le statut admin ou de brider le type de compte `ADMINISTRATEUR`.
* **Conséquences :** Brèches logiques de sécurité, restrictions contradictoires appliquées par erreur à un administrateur et désorientation ergonomique.
* **Mauvaise Pratique :** Séparer artificiellement le rôle administratif du modèle de pack de permissions, et permettre la modification restrictive du type Administrateur de base.
* **Bonne Pratique :**
  - **Bouton Unique Unifié :** Fusionner la sélection du rôle et du pack dans un seul bouton d'action cyclique sur chaque compte (`👑 Administrateur`, `👤 Membre`, `👶 Enfant`, etc.) avec coloration contextuelle immédiate.
  - **Inviolabilité du Pack Administrateur :** Verrouiller obligatoirement `isAdmin: true`, les téléchargements, l'accès TV et interdire toute restriction (tags bloqués, dossiers exclus, plafond d'âge CSA) pour le type `ADMINISTRATEUR` tant côté backend (`profileTypesRoutes.ts`, `userAdminRoutes.ts`, `access.ts`) que frontend (`AdminProfileTypesTab.tsx`, `AdminUserRow.tsx`).

---

## 🛑 34. Enchaînement Automatique Naïf sur `orderIndex > 0` & Rupture de Saga/Saison (Binge-Watching)

* **Problème / Symptôme :** Les films d'une franchise (`The Matrix Collection`, `Resident Evil Collection`) ou de nombreux épisodes de séries ont un `orderIndex = 0` dans la base de données. Une requête SQL ou ORM naïve cherchant `gt(orderIndex, current.orderIndex)` échoue invariablement (`0 > 0 = false`) et renvoie `null`. De plus, lorsqu'un épisode est le dernier de sa saison, ou le dernier épisode d'une série appartenant à une saga/univers partagé, la lecture s'arrête brutalement sur un écran noir.
* **Conséquences :** Expérience utilisateur décevante, absence de continuité type "Netflix" pour le binge-watching, et frustration de devoir revenir manuellement au catalogue pour lancer l'épisode ou le film suivant.
* **Mauvaise Pratique :** Limiter la recherche du média suivant à un simple filtre SQL `orderIndex > current.orderIndex` dans le dossier immédiat.
* **Bonne Pratique :**
  - **Ordonnancement Multi-Critères pour les Sagas :** Pour les films d'une même franchise ou collection, trier par score chronologique : `orderIndex` explicite > année de sortie (`releaseYear`, NFO, nom du dossier parent, pattern `(2002)`) > numéro d'opus / chiffres romains (`Part II`, `Vol 3`) > tri alphabétique naturel.
  - **Passage Automatique Inter-Saisons :** Si un épisode est le season finale de la saison `N`, localiser automatiquement la saison `N+1` de la série et renvoyer son premier épisode (`findFirstPlayableChild`).
  - **Enchaînement Inter-Séries dans une Saga :** Si le dernier épisode d'une série est atteint et que la série appartient à une saga parente (collection / franchise), basculer automatiquement sur l'épisode 1 de la série suivante dans l'ordre chronologique.
  - **Overlay Netflix Haute Visibilité :** Déclencher une bannière translucide avec compte à rebours 8s à 10s de la fin (`onNearEnd`), affichant le titre, le badge (`S02 • EP 01`, `Suite (2004)`), un bouton de lancement immédiat (`▶ Regarder maintenant`) et un bouton d'annulation (`✕ Annuler`), avec enchaînement transparent automatique à la fin du flux (`onEnded`).

---

## 🛑 35. Rétention de Focus sur Écran Masqué (`Blocked aria-hidden`) & Nœuds Texte Orphelins dans `<View>`

* **Problème / Symptôme :** 
  1. Lors du clic sur une chaîne IPTV ou de la navigation vers le lecteur plein écran (`/player/[id]`), le moteur de routage (React Navigation / Expo Router) met l'écran précédent (`/tv`) en sommeil en appliquant sur son conteneur DOM racine : `style="display: none;" aria-hidden="true"`. Cependant, l'élément cliqué ou précédemment ciblé (bouton d'action, carte de chaîne ou bouton du header) conserve le focus actif du navigateur (`document.activeElement`). Selon les spécifications W3C WAI-ARIA et les moteurs Chromium récents, appliquer `aria-hidden="true"` à un conteneur dont un descendant a conservé le focus crée un piège d'accessibilité (l'utilisateur de technologie d'assistance reste piégé dans un nœud invisible). Chromium bloque alors l'attribut avec l'alerte : `Blocked aria-hidden on an element because its descendant retained focus. The focus must not be hidden from assistive technology users. Avoid using aria-hidden on a focused element or its ancestor. Consider using the inert attribute instead`.
  2. Parallèlement, des sauts de ligne ou espaces d'indentation bruts (`\n      `) non encapsulés entre balises JSX dans des conteneurs React Native Web lèvent l'erreur : `Unexpected text node: \n      . A text node cannot be a child of a <View>`.
* **Conséquences :** 
  - Violations d'accessibilité WAI-ARIA / RGAA répétées dans la console du navigateur.
  - Piégeage fantôme du focus télécommande/clavier dans un écran invisible en arrière-plan au lieu de basculer sur le lecteur vidéo actif.
  - Erreurs d'assertion de rendu React Native Web en environnement de développement.
* **Mauvaise Pratique :** Laisser le focus DOM sur un élément interactif d'une vue mise en sommeil lors d'une transition d'écran, et laisser des retours à la ligne ou interpolations textuelles orphelines directement enfants d'un `<View>` sans balise `<Text>`.
* **Bonne Pratique :**
  - **Défocalisation / Libération Préalable du Focus (`blur()`) :** Lors de toute navigation ou ouverture de lecteur, libérer immédiatement le focus actif (`(document.activeElement as HTMLElement)?.blur()`) ou transférer explicitement le focus sur le lecteur vidéo cible (`videoRef.current?.focus()`).
  - **Isolation et Attribut `inert` :** Utiliser l'attribut HTML5 standard `inert` plutôt que `aria-hidden` sur les conteneurs d'écrans inactifs ou masquer les éléments non montés pour empêcher toute persistance de focus.
  - **Encapsulation Stricte dans `<Text>` :** Bannir les espaces bruts et veiller à ce que chaque chaîne de caractères, saut de ligne ou expression textuelle soit rigoureusement enveloppée dans un composant `<Text>` React Native.
