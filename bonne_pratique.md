# Bonnes Pratiques pour le Développement d'Agents IA Autonomes — Plateforme Coolove

Le développement d'agents IA autonomes nécessite une approche rigoureuse pour gérer le comportement non-déterministe des modèles de langage (LLM). Ce document constitue le **cœur central de référence** gouvernant l'architecture, la sécurité, l'observabilité, la résilience et les standards de conception du projet.

---

## 0. Document Cœur Central & Protocole d'Initialisation Obligatoire

> [!IMPORTANT]
> **Règle d'or de démarrage pour tout agent IA :**
> Avant d'écrire la moindre ligne de code, de concevoir une fonctionnalité ou d'exécuter un refactoring, **l'agent doit impérativement lire et intégrer les documents de référence situés à la racine du projet**. Citer `bonne_pratique.md` suffit à convoquer l'ensemble de cet écosystème documentaire obligatoire :
>
> 1. [**The Universal Stack (README)**](./README.md) : Thèse, modèle atomique, architecture AI-Native & roadmap fonctionnelle.
> 2. [**Documentation de la Stack Technique**](./stack_universelle.md) : Cartographie exacte des modules backend/frontend, schémas de données et endpoints exposés.
> 3. [**État d'Avancement du Projet**](./avancement_projet.md) : Suivi rigoureux des étapes achevées, des fonctionnalités déployées et des chantiers en cours.
> 4. [**Registre des Mauvaises Pratiques**](./mauvaise_pratique.md) : Mémoire collective des erreurs passées, pièges récurrents et anti-patterns formellement proscrits.
> 5. [**Charte d'Excellence Bon UX & UI**](./bon_ux_ui.md) : Règles strictes d'ergonomie, glassmorphisme doux, respiration TDAH-friendly, zéro angle aigu et formulaires progressifs.

---

## 1. Architecture Orientée Composants et Modularité
*   **Fichiers de 100 lignes maximum :** Le code doit être découpé en fonctions et modules courts. La concision force une responsabilité unique par fonction (SRP), ce qui facilite les tests unitaires et la lisibilité.
*   **Réutilisabilité atomique maximale :** Chaque composant (outils, prompts, logique de contrôle) doit être conçu pour être agnostique au cas d'usage spécifique afin de pouvoir être réutilisé dans différents workflows agentiques.
*   **Documentation par dossier :** Chaque répertoire logique doit contenir un fichier `README.md` (ou équivalent) expliquant son rôle, les dépendances de ses composants et comment les instancier.
*   **Code systématiquement commenté :** Les fonctions complexes, en particulier celles gérant les appels au LLM ou le traitement des données asynchrones, doivent inclure des docstrings claires expliquant les paramètres, les retours attendus et le but de la fonction.

---

## 2. Sécurité et Contrôle d'Exécution (Agent Loop)
La boucle d'exécution (Agent Loop) est le cœur de l'agent. Sans garde-fous, un agent peut s'enfermer dans des cycles coûteux ou destructeurs.

*   **Limites de boucles (Max Iterations) :** C'est le contrôle de sécurité le plus critique. Un agent confronté à une erreur peut s'entêter et tourner en boucle infinie (ex: utiliser un outil, échouer, réessayer exactement la même chose 50 fois). Définir un nombre maximum d'étapes (steps) ou de tours (turns) par tâche pour couper le processus (ex: `max_iterations = 10`).
*   **Timeouts stricts :** Fixer des limites de temps globales pour la tâche (wall-clock timeout) et des limites spécifiques pour chaque appel d'outil ou d'API. Si un outil dépasse le délai, l'agent doit recevoir une erreur explicite plutôt que de rester bloqué.
*   **Idempotence des actions :** Puisque l'agent risque d'appeler le même outil plusieurs fois par erreur ou lors de retries, vos fonctions doivent être exécutables en boucle sans casser le système ni dupliquer des données. 
    *   *Exemple :* Utiliser des requêtes de mise à jour/upsert au lieu de simples insertions. Vérifier l'état du système (ex: "ce fichier existe-t-il déjà ?") avant d'exécuter une action.

---

## 3. Gestion des Erreurs et Robustesse
*   **Messages informatifs clairs :** Les erreurs, les états de chargement (loading) et les succès doivent générer des messages clairs et structurés. Ces messages ne sont pas seulement pour l'utilisateur, ils sont aussi le *feedback* que l'agent lit pour corriger son comportement.
*   **Contrôles d'exceptions granulaires :** Les fonctions doivent utiliser des blocs `try/catch` spécifiques. Si une API externe échoue, l'erreur renvoyée à l'agent doit être suffisamment descriptive pour qu'il comprenne *pourquoi* (ex: "Erreur 404 : L'utilisateur n'existe pas" au lieu de "Erreur système").
*   **Gestion de la mémoire et du contexte :** Le code doit inclure une stratégie pour tronquer ou résumer l'historique des actions afin d'éviter de saturer la fenêtre de contexte du modèle (Token limits) au fil des itérations.

---

## 4. Double Contrôle et Validation Front-End & Back-End (Sécurité & Fiabilité Maximale)
La robustesse d'une application distribuée repose sur la non-complaisance : aucun niveau ne doit faire aveuglément confiance à l'autre.

*   **Contrôle Front-End (UX & Immédiateté) :** 
    *   Validation en temps réel des formulaires, des types et des formats (formats PIN, coordonnées WGS 84, bornage des distances et montants positifs).
    *   Plafonnement préventif des listes (ex: `.slice(0, 200)` pour éviter tout crash mémoire ou surcharge de rendu).
    *   Feedback visuel instantané et bienveillant informant l'utilisateur avant même la soumission réseau.
*   **Contrôle Back-End (Sécurité Inviolable & Intégrité) :**
    *   Vérification stricte et indépendante de toutes les entrées (`lib/validation.ts`, Drizzle schema, rate-limiters, hachage timing-safe).
    *   Plafonnement serveur obligatoire (ex: `limit = Math.min(rawLimit, 200)` et `LIMIT 200` SQL).
    *   Même si une requête contourne l'interface cliente (script malveillant, appel API direct), le backend garantit une étanchéité totale et refuse toute donnée invalide.

---

## 5. Économie des APIs Externes & Enrichissement Perpétuel de la Base de Données
Pour préserver les quotas, éliminer les coûts récurrents et garantir une réactivité instantanée, tout appel vers un service tiers doit enrichir le patrimoine de données interne.

*   **Zéro requête externe superflue :** Tout résultat obtenu via une API externe (géocodage Photon/OpenStreetMap, référentiel officiel de compétences ESCO/ROME, extraction d'aperçus Open Graph) doit être **immédiatement persisté en base de données** (`external_api_cache`, `official_skills_catalog`, coordonnées persistées).
*   **Filtrage préalable en base locale :** Avant tout appel sortant, le système interroge d'abord la base de données locale. Si l'information est présente, elle est servie immédiatement sans solliciter le réseau externe.
*   **Enrichissement itératif continu :** Chaque recherche ou complétion utilisateur non encore répertoriée interroge le service externe, stocke le résultat propre et normalisé, transformant la base locale en un référentiel autonome de plus en plus riche et performant au fil du temps.

---

## 6. Référencement Universel (SEO) & URLs Sémantiques Lisibles par les Humains
Toute ressource publique doit être trouvable, intelligible et indexable sans ambiguïté.

*   **Référencement exhaustif de chaque page :**
    *   Toutes les pages publiques (accueil, profils utilisateurs, profils d'équipes, réalisations) doivent comporter les balises Open Graph indispensables (`og:title`, `og:description`, `og:image`, `og:url`).
    *   Balisage sémantique structuré Schema.org / JSON-LD (`Person`, `Organization`, `Service`) pour une compréhension immédiate par les moteurs de recherche.
    *   Alimentation dynamique du sitemap standardisé (`GET /api/sitemap.xml`) recensant l'intégralité des profils et compétences actives.
*   **URLs lisibles par des humains & optimisées SEO :**
    *   Bannir les URLs opaques ou exclusivement composées d'identifiants aléatoires incompréhensibles.
    *   Les adresses web doivent être descriptives, claires et signifiantes pour un visiteur humain tout en renforçant les mots-clés de référencement (ex: `/u/:id-nom-competence-ville` ou `/u/:slug`).
    *   Un utilisateur doit pouvoir deviner le contenu de la page rien qu'en lisant son URL.

---

## 7. Portabilité et Conteneurisation (Dossier Autonome)
L'environnement de travail doit être pensé comme un **dossier portable et complètement autonome**.

*   **Tout-en-un à la racine :** Tout ce qui est nécessaire pour exécuter le projet (code source, scripts de démarrage comme `start.sh`, orchestration Docker/Podman, fichiers de base de données locale) doit se trouver dans ce dossier unique. Aucun composant système global complexe ne doit être requis en dehors des moteurs de conteneurs standards.
*   **Dépendances embarquées :** Privilégier les installations locales de dépendances plutôt que globales, afin de s'assurer qu'un autre développeur (ou un agent IA) puisse cloner le dossier et lancer le projet instantanément sans conflit d'environnement.
*   **Rangement par domaine :** Le dossier de travail doit être rigoureusement organisé (ex: `frontend/`, `backend/`, `database/`) pour qu'une IA ou un humain puisse naviguer et identifier immédiatement où se trouve chaque module du système.

---

## 8. Synchronisation Documentaire & Suivi de Session
À chaque session de développement, il est **obligatoire** de maintenir à jour les documents de référence :

*   **Mise à jour de `stack_universelle.md` :** Doit impérativement être synchronisé avec l'arborescence réelle des fichiers, les nouveaux composants backend/frontend, les schémas Drizzle et les endpoints exposés.
*   **Mise à jour de `avancement_projet.md` :** Doit lister précisément les étapes et sous-fonctionnalités déjà développées ainsi que les étapes restantes à réaliser selon la roadmap du Whitepaper.

---

## 9. Capitalisation des Erreurs : Document `mauvaise_pratique.md`
Tout développement d'envergure confronte les agents IA à des pièges récurrents (conflits de schémas, cascades destructives, appels API non mis en cache, erreurs silencieuses).

*   **Tenue obligatoire du registre :** Le document [`mauvaise_pratique.md`](./mauvaise_pratique.md) à la racine recense chaque erreur majeure survenue, sa cause racine, l'anti-pattern à proscrire et la bonne pratique de remédiation adoptée.
*   **Consultation préventive :** Tout agent IA intervenant sur le projet doit consulter ce registre avant d'entamer une refonte ou d'ajouter une brique sensible (authentification, transactions, appels externes, synchronisation hors-ligne).
*   **Enrichissement systématique :** Dès qu'un bogue subtil, un goulet d'étranglement ou une régression est résolu, l'agent doit formaliser le cas dans `mauvaise_pratique.md` pour éviter sa réapparition par d'autres agents.

---

## 10. Standards d'Excellence UX et UI ("Bon UX et UI")
Tout composant ou interface conçu par un agent IA doit impérativement respecter la charte d'expérience utilisateur détaillée dans [`bon_ux_ui.md`](./bon_ux_ui.md) :

*   **Priorités spatiales strictes :** Plus un élément est prioritaire pour l'utilisateur, plus il est placé haut, devant et mis en valeur visuellement. Sans même lire, l'utilisateur doit repérer la priorité immédiate et le bouton d'action clé.
*   **Proximité des actions & Boutons "Tag" :**
    *   Boutons d'ajout, modification ou suppression **collés à la valeur cible** (effet repère immédiat).
    *   Format petit tag/pilule discret (`borderRadius: 14` à `20`), jamais d'icône orpheline ou de gros pavé perturbateur.
    *   **Regroupement cohérent :** Actions de modification et de suppression réunies dans la même bulle contextuelle pour économiser l'attention (TDAH-friendly).
*   **Glassmorphisme doux & contrastes nuancés :**
    *   Fond glassmorphe translucide avec bordures subtiles.
    *   Ni blanc pur aveuglant (`#ffffff`), ni noir complet agressif (`#000000`). Nuancer toujours les teintes vers un sombre adouci (ardoise bleutée) ou un clair feutré.
*   **Interface respirante, groupée en Cards (TDAH-friendly) :**
    *   Aérer généreusement avec du padding et des marges.
    *   Grouper impérativement les informations associées dans des **cards visuelles** pour structurer l'espace et apaiser la charge cognitive.
*   **Arrondis systématiques (Zéro angle aigu) :**
    *   Bannir les coins droits qui créent une sensation inconsciente d'insécurité (`borderRadius` systématique de 12px à 24px pour inputs, boutons et cartes).
*   **Formulaires progressifs par bulles contextuelles :**
    *   Bannir les formulaires géants intimidants.
    *   Procéder par itérations progressives : créer la donnée maîtresse en premier, puis enrichir.
    *   Pas de formulaires pré-affichés encombrants : utiliser un bouton d'action placé près de la zone concernée qui ouvre une bulle/modale de complétion ciblée.
    *   **Maximum 2 champs à la fois**, avec des placeholders évocateurs et des labels discrets ou contextuels.
*   **Dissimulation des zones destructives ou marginales :**
    *   Les blocs comme « Supprimer le compte » ne doivent jamais monopoliser l'attention.
    *   Ils doivent être dissimulés par défaut sous un bouton sobre (accordéon contextuel qui s'ouvre sous le bouton).
