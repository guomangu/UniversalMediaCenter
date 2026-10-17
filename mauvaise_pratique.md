---

## 🛑 101. Centrage Flexbox Sauvage & Roggnement des Modales Multi-Options (`PlayerMenuModal`, `PlayerAudioModal`, etc.)

* **Problème / Symptôme :** Le menu des options du player ou les fenêtres modales de réglages ne sont plus centrés au milieu de l'écran, poussant leur en-tête (titre, bouton de fermeture ✕) et leurs premières options hors-champ au-dessus du haut de la fenêtre ou sous le bas de l'écran. L'utilisateur ne peut ni voir l'intégralité du menu ni faire défiler vers le haut pour fermer la fenêtre.
* **Conséquences :**
  - Blocage UX majeur : impossible de fermer la modale au clavier/souris sans recharger la page ou taper Échap.
  - Options critiques coupées (ex: mode micro, plein écran, sous-titres) sur ordinateurs portables, tablettes ou fenêtres redimensionnées.
* **Causes Racines :**
  - **Dépassement en Espace Coordonné Négatif :** Un conteneur flex avec `justifyContent: 'center'` dont l'enfant dépasse la hauteur du viewport place le centre de l'élément à 50% de la hauteur. La moitié supérieure déborde alors en coordonnées négatives (`top < 0`), hors du viewport. En CSS/Flexbox standard, le scroll vers le haut en coordonnées négatives est impossible.
  - **Inopérance des Hauteurs en Pourcentage (`maxHeight: '85%'`) :** Dans React Native Web, un `maxHeight` en pourcentage sur un enfant flex dont le parent n'a pas de hauteur explicite en px ou vh est ignoré (résolu en `auto`).
  - **Refus de Rétrécissement du `ScrollView` :** Un `<ScrollView>` sans `flexShrink: 1` refuse de rétrécir et conserve toute sa hauteur intrinsèque (~540px), forçant la modale à exploser son conteneur.
* **Bonnes Pratiques de Remédiation :**
  - **Overlay Fixé et Sanctuarisé (`PlayerMenuModal.tsx`) :**
    - Positionner l'overlay en `position: 'fixed'` sur le Web avec `top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', zIndex: 99999`.
    - Activer `overflowY: 'auto'` sur l'overlay pour garantir un défilement de secours si le viewport est minuscule.
  - **Plafonnement Strict en Hauteur d'Écran (`min(86vh, 540px)`) :**
    - Remplacer les pourcentages flous par `maxHeight: (Platform.OS === 'web' ? 'min(86vh, 540px)' : '85%') as any`.
    - Appliquer `alignSelf: 'center'` et `margin: 'auto'` sur le Web pour un centrage géométrique parfait et sans débordement négatif.
  - **Rétrécissement Intérieur Automatique du Défilement :**
    - Configurer le `ScrollView` avec `flexGrow: 0, flexShrink: 1` et `showsVerticalScrollIndicator={true}` pour que l'en-tête reste toujours fixé et visible en haut pendant que les items défilent fluidement à l'intérieur.
