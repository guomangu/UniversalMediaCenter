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
