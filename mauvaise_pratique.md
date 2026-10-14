# Registre des Mauvaises Pratiques & Pièges Détectés — Plateforme iWorker

Ce document capitalise les erreurs majeures rencontrées au cours du développement de l'application iWorker. Il sert de mémoire technique collective pour permettre aux développeurs et agents IA d'éviter de reproduire ces écueils.

---

## 🛑 1. Dépassement de la contrainte des 100 lignes par fichier

* **Problème / Symptôme :** Fichiers géants (200-500 lignes) mélangeant contrôleurs, requêtes SQL, validation, gestion des erreurs et rendu UI.
* **Conséquences :** Fenêtre de contexte saturée pour les LLMs, risque élevé d'hallucination ou de modifications destructives non ciblées, tests unitaires complexes.
* **Mauvaise Pratique :** Implémenter un nouveau composant ou endpoint en empilant toute la logique dans un seul fichier "fourre-tout".
* **Bonne Pratique :** 
  - Découper strictement en sous-modules à responsabilité unique (SRP) : `types.ts`, `service.ts`, `controller.ts`, sous-composants UI.
  - Chaque fichier doit strictement faire **moins de 100 lignes**.

---

## 🛑 2. Oubli du polymorphisme prestataire (Utilisateur vs Équipe)

* **Problème / Symptôme :** Création de panier échouant avec erreur de clé étrangère PostgreSQL (`violates foreign key constraint users_id_fkey`) lorsqu'un panier était créé pour une vitrine d'équipe (`targetType: 'team'`).
* **Conséquences :** Blocage complet du bouton `+ Panier` sur les profils collectifs / équipes.
* **Mauvaise Pratique :** Présumer qu'un prestataire est toujours un `user` et forcer l'insertion dans un champ `target_user_id` lié à la table `users`.
* **Bonne Pratique :**
  - Utiliser un typage explicite (`provider_type: 'user' | 'team'`, `provider_id: UUID`) ou deux clés étrangères optionnelles (`user_id`, `team_id`) avec une contrainte de cohérence `CHECK ((user_id IS NOT NULL AND team_id IS NULL) OR (team_id IS NOT NULL AND user_id IS NULL))`.
  - Toujours adapter les jointures de la discussion et du panier au type de cible.

---

## 🛑 3. Création non-idempotente des discussions & paniers

* **Problème / Symptôme :** Chaque clic sur « Ajouter au panier » ou actualisation créait une nouvelle discussion et un nouveau panier brouillon orphelin en base de données.
* **Conséquences :** Multiplication des fils de discussion vides pour une même commande, confusion totale côté client et prestataire.
* **Mauvaise Pratique :** Appeler un `INSERT` aveugle sans rechercher au préalable s'il existe déjà un panier actif ou brouillon pour ce couple acheteur/prestataire.
* **Bonne Pratique :**
  - Mettre en œuvre une logique d'upsert ou de recherche idempotente : rechercher un panier `DRAFT` existant pour l'acheteur et le prestataire.
  - S'il existe, lui rattacher les nouvelles lignes de compétences de manière idempotente (ignorer les doublons via `ON CONFLICT DO NOTHING`).
  - N'activer la discussion (`status: 'ACTIVE'`) que lors de la soumission définitive.

---

## 🛑 4. Suppression en cascade naïve des comptes utilisateurs (`ON DELETE CASCADE`)

* **Problème / Symptôme :** La suppression d'un utilisateur supprimait en cascade ses discussions, ses messages et l'historique des commandes passées avec d'autres utilisateurs.
* **Conséquences :** Perte de preuves commerciales, écrans de chat brisés chez les interlocuteurs, violation de traçabilité légale.
* **Mauvaise Pratique :** Poser des contraintes `ON DELETE CASCADE` aveugles sur les tables transactionnelles (`discussions`, `messages`, `baskets`).
* **Bonne Pratique :**
  - Mettre en place un soft-delete ou une anonymisation transactionnelle : marquer `account_status = 'DELETED'`, effacer les données personnelles (avatar, bio, téléphone, mot de passe), mais conserver les messages sous l'expéditeur « Compte supprimé ».
  - Pour les paniers passés, conserver un snapshot immuable (titre, tarif, description) indépendant du profil supprimé.

---

## 🛑 5. Erreurs silencieuses et masquage des échecs (Fail Silent)

* **Problème / Symptôme :** Blocs `catch (err) { /* noop */ }` ou simples `console.error` qui masquent un échec 401 Unauthorized ou une erreur de validation 400.
* **Conséquences :** Boutons d'action UI qui restent bloqués en état de chargement sans aucun message d'explication pour l'utilisateur.
* **Mauvaise Pratique :** Masquer les erreurs API pour éviter un crash écran sans fournir de feedback ou d'état de repli.
* **Bonne Pratique :**
  - Définir une classe d'erreur structurée (`ApiError` avec code HTTP et message descriptif).
  - Fournir un retour visuel systématique (bannière rouge, toast d'erreur, message explicite) et réinitialiser l'état `loading` dans un bloc `finally`.

---

## 🛑 6. Appels externes répétés sans persistance en base de données

* **Problème / Symptôme :** Requêter l'API externe (géocodage Photon, référentiel de compétences, aperçu Open Graph) à chaque frappe de touche ou à chaque chargement de page.
* **Conséquences :** Risque de bannissement par rate-limiting des API publiques, latence réseau élevée, indisponibilité totale en cas de coupure de l'API externe.
* **Mauvaise Pratique :** Traiter les API externes comme des services de calcul direct sans mémoire locale.
* **Bonne Pratique :**
  - Mettre en cache persisté dans PostgreSQL (`external_api_cache`, `official_skills_catalog`) tout appel externe réussi.
  - Vérifier en premier lieu la base locale : si la requête ou les compétences associées sont déjà en cache, servir les données locales sans consommer de requête réseau externe.
  - Alimenter la base de données de manière incrémentale et itérative au fil des recherches.

---

## 🛑 7. Conflits de modifications unilatérales sur les devis / paniers

* **Problème / Symptôme :** Une partie modifie le contenu d'un devis déjà accepté sans le consentement de l'autre partie.
* **Conséquences :** Litiges sur le périmètre des compétences ou les tarifs négociés.
* **Mauvaise Pratique :** Permettre un `UPDATE` direct des lignes de panier dès qu'un des deux participants soumet une modification.
* **Bonne Pratique :**
  - Machine à états avec propositions de révision (`basket_changes`) : toute modification génère une proposition.
  - Le panier principal n'est actualisé que lorsque **les deux parties** (acheteur et prestataire) ont validé explicitement la révision.

---

## 🛑 8. Crashs en environnement déconnecté (Offline Unawareness)

* **Problème / Symptôme :** L'application tente des appels réseau immédiats sans vérifier la connectivité ou plante dès qu'une requête échoue sans connexion.
* **Conséquences :** Écran blanc ou perte des données saisies par le travailleur sur le terrain.
* **Mauvaise Pratique :** Dépendre exclusivement d'une connectivité permanente.
* **Bonne Pratique :**
  - Couche de persistance locale (`AsyncStorage` / cache local), détection de l'état réseau (`useNetworkState`), et mise en file d'attente des paniers et modifications jusqu'au retour de la connexion.
  - Bus d'événements réactif (`emitEntityChanged`) pour invalider et rafraîchir les vues dès la reprise réseau.

---

## 🛑 9. Formulaires géants monolithiques et absence de déclencheur contextuel

* **Problème / Symptôme :** Formulaires statiques affichant d'un bloc 8 à 15 champs obligatoires sur l'écran, effrayant et décourageant l'utilisateur (charge cognitive excessive, non TDAH-friendly).
* **Conséquences :** Taux d'abandon massif lors de l'onboarding et de la saisie de compétences ou profils.
* **Mauvaise Pratique :** Afficher un formulaire géant ouvert en permanence au milieu de la vue.
* **Bonne Pratique :**
  - Complétion progressive : un bouton contextuel (ex: `+ Ajouter`, `Compléter`) ouvre une bulle ciblée à l'endroit exact de l'information.
  - Limiter strictement à **1 ou 2 champs par interaction** (les plus importants d'abord), avec des placeholders évocateurs.

---

## 🛑 10. Coins droits anxiogènes, saturation visuelle et zones destructives au premier plan

* **Problème / Symptôme :** Éléments d'interface avec coins droits aigus (`borderRadius: 0`), contrastes extrêmes (blanc pur aveuglant ou noir complet) et boutons de suppression destructifs exposés au premier plan.
* **Conséquences :** Tension inconsciente de l'utilisateur, peur du clic, fatigue visuelle et sentiment d'interface agressive.
* **Mauvaise Pratique :** Exposer la section de suppression de compte en permanence et utiliser des angles droits sans arrondis.
* **Bonne Pratique :**
  - Respecter la charte [`bon_ux_ui.md`](file:///home/gamo/Documents/iworker/bon_ux_ui.md) : arrondis doux systématiques (12px à 24px), glassmorphisme feutré et nuancé.
  - Dissimuler les zones sensibles sous un bouton accordéon discret qui ne se déploie que sous le déclencheur sur intention explicite.
