---

## 🛑 36. Piégeage dans les Formulaires Textuels en Navigation Clavier / Télécommande (Absence d'Échappatoire `Escape` / `Retour`)

* **Problème / Symptôme :** Une fois le focus entré dans un champ textuel (`TextInput`), l'utilisateur clavier ou télécommande se retrouvait piégé : appuyer sur la touche Échap (`Escape`) ou sur la touche Retour (`Backspace` / `Retour arrière` sur champ vide ou bouton Retour télécommande) ne permettait pas de quitter le formulaire ou laissait le focus dans un état orphelin (`document.body`) sans repère visuel. Seul un clic souris permettait de sortir du champ.
* **Conséquences :** Rupture critique de la navigation spatiale sur Smart TV, manette ou clavier physique ; impossibilité de valider, annuler ou poursuivre la navigation sur le reste de la page.
* **Mauvaise Pratique :** Écouter les événements clavier en mode bouillonnement classique (`bubble`) où les composants d'entrée peuvent intercepter l'événement, omettre `Backspace` et les keyCodes télécommandes spécifiques (Samsung 10009, WebOS 461), et appeler un simple `blur()` sans transférer le focus vers un candidat interactif adjacent.
* **Bonne Pratique :**
  - **Écoute en Mode Capture (`{ capture: true }`) :** Enregistrer le gestionnaire global `keydown` en phase de capture pour intercepter `Escape`, `Backspace` et les touches Retour avant toute capture locale par le navigateur ou le framework.
  - **Détection Exhaustive des Touches de Sortie :** Traiter `Escape`, `BrowserBack`, `GoBack`, `Back`, les keyCodes télécommandes TV (27, 8, 10009, 461, 4), ainsi que `Backspace` lorsque le champ est vide (`value.trim() === ''`) ou combiné avec `Alt/Ctrl`.
  - **Transfert Automatique de Focus (`exitInputFocus`) :** À la sortie du champ, identifier le meilleur candidat interactif adjacent (bouton d'action, bouton suivant ou fermer) et lui assigner immédiatement le focus avec défilement fluide (`scrollIntoView`), garantissant un repère visuel immédiat pour continuer la navigation.
  - **Support Manette Gamepad :** Connecter le bouton B / Cercle (index 1) du gamepad pour déclencher instantanément `exitInputFocus` lorsque le focus se trouve dans un champ de saisie.

---

## 🛑 37. Absence de Confinement Télécommande dans les Popups/Modales & Vol de Focus par le Backdrop

* **Problème / Symptôme :** Lors de l'ouverture d'un popup ou d'une modale (confirmation de suppression, création d'utilisateur, notation/repost, édition de profil, menus de pistes audio / sous-titres), les touches directionnelles de la télécommande continuaient à naviguer derrière la modale sur la page d'arrière-plan, ou ciblaient le fond d'écran plein écran (`styles.backdrop`) qui recevait le focus par défaut en tant que `<Pressable>` avec `tabindex="0"`. De plus, les boutons d'onglets de l'admin et du profil manquaient de `focusable={true}`.
* **Conséquences :** L'utilisateur télécommande ne pouvait pas atteindre les boutons "Confirmer", "Annuler" ou les options à l'intérieur de la modale. Un appui sur Retour ou Échap fermait la page entière au lieu de fermer la modale.
* **Mauvaise Pratique :** Ne pas isoler la portée (`scope`) des candidats de navigation spatiale lors de l'apparition d'un dialogue modale, laisser le backdrop être focusable, et ne pas attribuer automatiquement le focus au premier élément de la modale.
* **Bonne Pratique :**
  - **Confinement Spacial Dynamique (`getActiveModal`) :** Détecter la modale active via `[data-modal-container="true"]` ou `[role="dialog"]` et restreindre la liste des candidats de navigation spatiale exclusivement aux descendants de cette modale.
  - **Neutralisation du Backdrop :** Définir systématiquement `focusable={false}` et `data-modal-backdrop="true"` sur le composant `<Pressable>` du voile noir, et filtrer tout conteneur occupant plus de 95% de la fenêtre.
  - **Auto-Focus à l'Ouverture :** Dès que `visible` passe à `true`, déclencher un timer de 50 à 60ms pour cibler immédiatement le bouton de fermeture, d'annulation ou le premier champ de saisie (`btnRef.current?.focus()`).
  - **Interception de Sortie Dédiée (`[data-modal-close="true"]`) :** Lier les touches `Escape` et `Retour` télécommande au déclenchement de l'action du bouton `[data-modal-close="true"]` de la modale en cours, sans propager l'événement à l'historique du navigateur (`window.history.back()`).

---

## 🛑 38. Écrasement des Titres Réels d'Épisodes, Détection Erronée des Numéros Absolus et Prolifération EAV (Le Problème des Doublons 'ep2s01' sur Bleach)

* **Problème / Symptôme :** Sur un anime structuré en arcs narratifs avec numérotation absolue (comme Bleach avec 366 épisodes et 4 films répartis dans `01- Soul Society`, `02- The Bount`, etc.), la fiche média affichait 3 fois l'étiquette `"ep2s01"`, les titres réels des épisodes étaient effacés au profit d'un libellé générique `Bleach - S01E02`, les épisodes au-delà du 150ème étaient coupés, et la table de jointure EAV (`node_eav_links`) accumulait plus de 450 000 lignes dupliquées.
* **Conséquences :** Impossibilité pour l'utilisateur de distinguer les épisodes, perte des titres originaux créatifs de chaque épisode, déconnexion des films par rapport à la série, et ralentissement sévère de la base de données.
* **Mauvaise Pratique :**
  - Écraser aveuglément le titre réel d'un épisode avec un format standard `Show - SxxExx` lorsque le NFO contient `<showtitle>`.
  - Faire une confiance exclusive aux balises `<episode>2</episode>` et `<season>1</season>` générées par des scrapers obsolètes, au lieu de parser le numéro absolu explicite (`Bleach - 102 - ...`) présent dans le nom de fichier.
  - Limiter la route d'API à `limit: 150` sur les enfants d'un média sans pagination ni chargement complet pour les séries longues.
  - Poser une contrainte SQL `UNIQUE (node_id, value_id, context_role)` où `context_role` peut être `NULL` : en SQL standard (PostgreSQL), `NULL != NULL`, ce qui permet l'insertion infinie de doublons à chaque cycle de scan.
* **Bonne Pratique :**
  - **Préservation Intégrale des Titres Réels (Loi n°1 : Zéro Perte de Données) :** Conserver systématiquement le titre narratif distinct de l'épisode (`Le dernier Quincy ! L'explosion du pouvoir`), en ne le préfixant jamais de force avec un générique `Show - SxxExx`.
  - **Résolution Hybride NFO + Système de Fichiers :** Extraire les numéros absolus d'épisodes depuis le nom de fichier (`Bleach - 102 -> absoluteEpisodeNumber = 102`) et prioriser ce numéro absolu sur les numéros relatifs corrompus (`episode = 2`).
  - **Détection des Arcs et Sous-dossiers Spéciaux :** Parser les dossiers comme `01- Soul Society`, `02- The Bount`, et classifier les sous-dossiers `Films/` en type `MOVIE` avec tag `FILM 1`, `FILM 2` sans polluer la numérotation des épisodes d'anime.
  - **Index d'Unicité avec `COALESCE` sur EAV :** Créer un index unique `CREATE UNIQUE INDEX idx_node_val_role_coalesce ON node_eav_links (node_id, value_id, COALESCE(context_role, ''))` pour garantir une déduplication parfaite et immuable.
  - **Enrichissement Complet Supérieur à Kyoo :** Taguer l'intégralité des dimensions : équipe de réalisation (`director`), scénaristes et auteurs originaux (`writer`), compositeurs musicaux (`composer`), producteurs (`producer`), casting avec rôles et photos de profil locales/TMDB (`actor`), spécifications techniques complètes issues de `<streamdetails>` (qualité vidéo, codecs vidéo/audio, canaux, format d'image, sous-titres) et classifications CSA / Hero badges (`certification`).
  - **Navigation par Onglets d'Arcs / Saisons :** Fournir une barre d'onglets ergonomique en haut de la grille d'épisodes (`[Tous] [01 • Soul Society] [02 • The Bount] ... [Films & Spéciaux]`) avec vignettes 16:9, durée et badges distincts.
