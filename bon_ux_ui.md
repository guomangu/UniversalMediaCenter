# Charte d'Excellence "Bon UX et UI" — Plateforme iWorker

Ce document constitue le standard de conception d'expérience utilisateur (UX) et d'interface visuelle (UI) que **tout agent IA ou développeur doit obligatoirement respecter** lors de la création ou modification de composants et d'écrans.

---

## 1. Hiérarchie Visuelle & Alignement sur les Priorités Utilisateur

* **Règle d'or de la priorité spatiale :** Plus un élément est important pour l'utilisateur, plus il doit être situé haut, devant et mis en valeur visuellement (contraste, taille, élévation).
* **Compréhension instantanée sans lecture exhaustive :** Même sans lire le texte dans son intégralité, l'utilisateur doit immédiatement percevoir :
  1. Où il se trouve.
  2. Ce qui est le plus important sur la page.
  3. L'action principale à effectuer (Call to Action saillant).
* **Relégation des actions destructives ou rares :** Les zones à risque (ex: suppression de compte) ou les options secondaires ne doivent jamais encombrer le premier plan. Elles sont dissimulées par défaut sous un déclencheur sobre et se déploient contextuellement sous le bouton d'activation.

---

## 2. Proximité Immédiate des Actions & Boutons "Tag"

* **Collés à la valeur cible :** Les boutons de modification, de suppression ou d'ajout doivent être positionnés **au plus près de la valeur ou donnée cible** qu'ils concernent, pour que l'utilisateur se repère immédiatement sans quitter la donnée des yeux.
* **Format visuel en petit tag / pilule :**
  - Adopter une apparence discrète et élégante semblable à un tag ou badge arrondi (`borderRadius: 14` à `20`, padding compact).
  - Bannir les icônes orphelines éparpillées ou les blocs géants qui écrasent la donnée métier.
* **Regroupement cohérent (Économie cognitive & TDAH-Friendly) :**
  - Pour minimiser l'énergie demandée à l'utilisateur pour comprendre ce qu'il voit, rassembler les actions associées au sein d'une **même bulle ou modale contextuelle**.
  - *Exemple :* Grouper les formulaires de modification et la confirmation de suppression dans la même bulle ouverte au clic sur le tag d'action, au lieu de disperser de multiples boutons concurrents sur la ligne.

---

## 3. Style Visuel : Glassmorphisme Équilibré & Nuancé

* **Glassmorphisme subtil :** Arrière-plans translucides avec flou d'arrière-plan (`backdrop-filter: blur(12px)` / `rgba(...)`), bordures fines semi-transparentes pour délimiter les plans sans alourdir.
* **Ni trop sombre, ni trop clair (Éviter les extrêmes) :**
  - **Mode clair nuancé :** Ne pas utiliser de blanc pur agressif (`#ffffff` en fond d'écran plein). Préférer des tons doux comme le gris ardoise pâle (`#f1f5f9` / `#f8fafc`).
  - **Mode sombre nuancé :** Ne pas utiliser de noir absolu (`#000000` pur). Préférer des tons bleutés profonds et reposants (`#0f172a` / `#1e293b`).
  - Le contraste doit être doux pour les yeux, reposant lors d'utilisations prolongées.

---

## 4. Aération, Respiration & Design "TDAH-Friendly"

* **Interface aérée :** Espacements généreux (`Spacing.three`, `Spacing.four`), marges respiratoires entre les sections. L'interface ne doit jamais paraître étouffante ou saturée d'informations.
* **Regroupement systématique en Cards :**
  - Les informations connexes doivent être encapsulées dans des cartes visuelles unitaires.
  - La card optimise l'espace, délimite clairement le contexte mental et évite la dispersion cognitive.
* **Anti-surcharge cognitive (TDAH-Friendly) :**
  - Une seule intention principale par carte ou section.
  - Découpage visuel clair réduisant la fatigue décisionnelle.
  - Feedback immédiat et visible pour chaque interaction (loaders, coches vertes, micro-animations).

---

## 5. Règle Fondamentale des Arrondis (Zéro Coin Aigu)

* **Arrondis systématiques :** Les coins droits et pointus génèrent instinctivement de la tension et de l'inconfort visuel.
* **Standards de rayon de courbure (Border Radius) :**
  - **Cards & Conteneurs :** Arrondis doux de `16px` à `24px` (`borderRadius: 16` ou `20`).
  - **Boutons, Tags & Badges :** Arrondis généreux ou pilules (`borderRadius: 12` à `20`, ou `9999px` pour les pilules).
  - **Champs de saisie (Inputs) :** Arrondis confortables de `12px` à `16px`.
* **Interdiction stricte :** Aucun élément cliquable ou conteneur ne doit avoir des angles vifs à `0px` ou des découpes agressives (`4px` - `6px`).

---

## 6. Formulaires Progressifs & Bulles Contextuelles

* **Interdiction des formulaires géants et intimidants :** Ne jamais imposer un formulaire monolithique de 10 champs qui décourage l'utilisateur.
* **Complétion itérative par petites étapes :**
  - Procéder par mini-formulaires successifs ou par ajout progressif de blocs de données.
  - Créer **la donnée la plus importante en premier** (ex: le titre ou la compétence principale), puis proposer d'enrichir le reste si désiré.
* **Bouton contextuel ouvrant une bulle / modale locale :**
  - Au lieu d'afficher des formulaires vides en permanence sur la page, afficher un bouton sobre d'action en tag (ex: `+ Compléter`, `+ Ajouter`) directement dans la zone concernée.
  - Ce bouton ouvre une bulle contextuelle ou une modale ciblée à l'endroit précis où la donnée prendra place, permettant à l'utilisateur de rester parfaitement repéré dans l'espace.
* **Règle des 2 champs maximum :**
  - Un mini-formulaire unitaire ne doit pas demander plus de **1 à 2 champs à la fois** (ex: Titre + Valeur, ou Compétence + Niveau).
  - Les labels doivent être concis ou optionnels si le placeholder est clair et évocateur.
  - Chaque champ doit posséder un **placeholder cohérent et contextuel** guidant immédiatement la saisie (ex: `"Ex: Développeur React Native"`, `"Ex: 45 €/h"`).

---

## 7. Synthèse des Règles pour les Agents IA

1. **Priorités :** Élément crucial = en haut, contrasté et premier au focus.
2. **Proximité & Tags :** Boutons d'action collés à la valeur cible, look « petit tag », actions connexes regroupées dans la même bulle.
3. **Atmosphère :** Glassmorphisme doux, mode sombre/clair nuancé (pas d'extrêmes aveuglants).
4. **Respiration :** Espacements généreux, regrouper en cards, zéro encombrement mental.
5. **Formes :** Arrondis partout (`12px` - `24px`), proscrire absolument les angles droits et micro-arrondis raides (< 10px).
6. **Formulaires :** Déclencheurs contextuels près de la zone, max 2 champs par étape, placeholders évocateurs.
7. **Actions destructives :** Dissimulées par défaut sous un bouton dédié avec accordéon inférieur.
