# Bonnes Pratiques pour le Développement d'Agents IA Autonomes — Plateforme Coolove & The Universal Media Stack

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

---

## 11. Gestion des Médias In-Place, Multi-Roots & Montages Conteneurs (Zéro-Déplacement & OS Immuables)
La gestion de bibliothèques multimédias volumineuses sur des systèmes modernes (Bazzite, Fedora Atomic, NAS) exige des règles strictes pour garantir une réactivité instantanée sans jamais altérer les fichiers de l'utilisateur :

*   **Zéro déplacement physique de médias :** Les dossiers multimédias réels (`MEDIA_CHAOS_ROOT`) ne doivent jamais être renommés, déplacés ou altérés. Le système lit in-place et stocke l'indexation, les métadonnées et les relations EAV uniquement dans PostgreSQL.
*   **Support des OS Immuables et Liens Symboliques (Bazzite/Fedora) :** Sur les systèmes avec `/home` symlinké vers `/var/home`, `compose.yaml` doit obligatoirement binder à la fois les chemins canoniques physiques (`/var/home/...`) et les chemins d'accès utilisateur (`/home/...`). Cela garantit que les références absolues inscrites dans les fichiers `.nfo` préexistants résolvent sans erreur `ENOENT`.
*   **Scanner récursif au démarrage (Boot Scan) vs Inotify :** Dans les conteneurs (particulièrement en Rootless Podman), la surveillance inotify pure (`chokidar.watch`) ne garantit pas la découverte synchrone des milliers de fichiers déjà existants sur disque au boot. Un crawler récursif d'initialisation (`bootScanner.ts`) doit obligatoirement s'exécuter de façon asynchrone au lancement pour ingérer instantanément la bibliothèque existante sans bloquer le démarrage de l'API.
*   **Proxy d'Artworks & Sécurité Navigateur :** Les navigateurs web refusent formellement d'afficher des chemins de fichiers locaux (`file:///` ou `/var/home/...`). Le backend doit systématiquement exposer un endpoint dédié (`/api/media/:id/poster`, `/api/media/:id/fanart`) servant les fichiers images avec les en-têtes HTTP appropriés (`Content-Type: image/jpeg`, `Cache-Control: public, max-age=86400, immutable`).
*   **Tolérance Server-Driven UI aux topologies de bibliothèques hétérogènes :** Les requêtes des rails d'accueil (`uiRails`) ne doivent jamais présumer qu'une bibliothèque ne contient que des films (`MOVIE`) ou des séries (`SHOW`). Elles doivent inclure ou basculer élégamment vers les épisodes (`EPISODE`) ou collections existantes pour garantir qu'aucun écran d'accueil ne reste vide lors d'une première ingestion.

---

## 12. Architecture Sociale Symétrique, Présence Temps Réel & Séances Synchronisées (YouTube-Grade)
Le développement de fonctionnalités interactives multi-utilisateurs (Favoris, Amis, Séances synchronisées Watch Party, Fil d'avis et Salons) exige une cohérence stricte entre les modèles de données relationnels et la réactivité du frontend :

*   **Bidirectionnalité et Déterminisme Relationnel :** Les relations sociales (amitiés, discussions privées 1-on-1) ne doivent jamais présumer que l'utilisateur courant est l'expéditeur initial.
    *   Toute requête d'amitié ou de feed d'amis doit obligatoirement interroger de façon symétrique `or(eq(userId, sessionUser.id), eq(friendId, sessionUser.id))` et identifier dynamiquement le correspondant.
    *   Les salons de discussion directe doivent générer un identifiant canonique trié lexicographiquement : `dm-${[u1, u2].sort().join('-')}` garantissant que les deux participants rejoignent rigoureusement le même fil.
*   **Dépouillement Défensif des Réponses JSON & Mise à Jour Optimiste :**
    *   Le client frontend ne doit jamais présumer d'une enveloppe rigide (`data.favorites` vs tableau direct `data`). Utiliser systématiquement `Array.isArray(data) ? data : (data.items || [])`.
    *   Les actions utilisateur (ajout/retrait de favori, upvote, publication d'avis) doivent immédiatement mettre à jour l'interface locale (UI optimiste) et synchroniser le cache mémoire avant même la fin de la requête réseau.
*   **Contrôle d'Accès Souverain sur les Salons Privés (`canAccessPrivateTopic`) :**
    *   Aucun utilisateur ne peut écouter un flux vocal, poster ou lire des messages dans un canal privé (`private-user-*` ou `dm-*`) sans validation d'une amitié mutuellement acceptée.
*   **Heartbeats Légers & Clôture Déterministe des Séances Partagées :**
    *   Les sessions collectives (Watch Party) maintiennent leur fraîcheur via des heartbeats réguliers (fenêtre de 25 secondes) sans surcharger la base de données.
    *   Toute séance abandonnée par son hôte ou inactive est automatiquement purgée afin d'éviter tout encombrement des listes publiques.
*   **Upsert Idempotent pour les Avis et Critiques :**
    *   La notation et la rédaction d'avis sur un média doivent toujours utiliser une logique d'upsert (`INSERT ... ON CONFLICT DO UPDATE`), permettant à un spectateur d'ajuster son appréciation sans générer de doublons polluants.

---

## 13. Fiabilité des Contrôles Multimédia, Défilement Isolé & Robustesse Événementielle Web
Pour assurer une réactivité instantanée et éliminer tout gel de navigation ou désynchronisation du lecteur :

*   **Vérité Réactive d'État pour les Bascules Play/Pause :**
    *   Ne jamais déduire la prochaine action du lecteur à partir de propriétés DOM asynchrones volatiles (`video.paused`).
    *   La commande de bascule doit toujours s'appuyer sur la négation de l'état réactif unifié `!isPlaying`, avec mise à jour immédiate du store (`playerStore.setPlaying(nextPlay, true, true)`) avant l'appel à `v.play()` / `v.pause()`.
    *   Gérer les blocages d'autoplay des navigateurs via un rattrapage muet automatique en cas de rejet `NotAllowedError`.
*   **Double Écouteur React Native / Web Natif (`onPress` + `onClick`) :**
    *   Sur React Native Web, les composants `Pressable` situés dans des conteneurs à défilement peuvent voir leur `onPress` annulé par le PanResponder en cas de micro-mouvement de souris ou trackpad (1 à 2 pixels de jitter).
    *   Toujours attacher un écouteur DOM natif `{...(Platform.OS === 'web' ? { onClick: (e) => { e.stopPropagation(); handleAction(); } } : {})}` sur les boutons interactifs critiques (barre d'en-tête, filtres, commandes de lecture, boutons du mini-lecteur).
    *   Appliquer systématiquement `pointerEvents="none"` sur les enfants textuels ou icônes afin que le conteneur cliquable reçoive directement 100% des événements de souris.
*   **Défilement Horizontal Strictement Isolé :**
    *   Ne jamais invoquer `scrollIntoView()` sur des sous-éléments d'un en-tête horizontal au sein d'une page défilable verticalement : cette méthode propage un défilement animé global qui verrouille le ScrollResponder et neutralise les clics.
    *   Cibler exclusivement le nœud DOM du conteneur horizontal via `scrollEl.scrollTo({ left: targetOffset, behavior: 'smooth' })`.
*   **Débouncing Systématique des Actions Toggles (`lastToggleTimeRef < 300ms`) :**
    *   Sur React Native Web, les éléments interactifs dotés d'un double écouteur `onPress` + `onClick` déclenchent les deux gestionnaires séquentiellement lors d'un même clic.
    *   Pour toute fonction de bascule d'état (Play/Pause, Déplier/Replier, Plein écran, Sauts de progression), toujours appliquer un verrou temporel (`now - lastTime < 300ms`) afin d'ignorer la seconde invocation et éliminer les annulations instantanées (`AbortError`).
*   **Autonomie Totale du Mini-Lecteur Replié & Relais Cast en Arrière-Plan :**
    *   Le repli du lecteur doit mettre le flux en pause automatique propre pour respecter l'ergonomie multi-tâche, mais permettre sa reprise immédiate (`▶`) sans ré-agrandir et sur n'importe quelle page du site.
    *   La boucle de battement de cœur racine (`_layout.tsx`) doit relayer l'état complet du média (`activeMedia`) pour que les télécommandes Cast puissent continuer à piloter le flux (`PLAY`, `PAUSE`, `SEEK`, `VOLUME`, `MUTE`) même quand l'utilisateur explore d'autres pages.
    *   Préserver l'instance HLS et l'attachement du flux (`prevStreamUrlRef`) lors des re-renders et navigations pour éliminer toute réinitialisation de buffer.
*   **Période de Grâce Souveraine Locale (4s) & Mutex Non-Destructif (`pendingReport`) :**
    *   Dans `accountSyncService.ts`, ne jamais rejeter une action utilisateur (`isAction: true`) si une synchronisation est en vol : empiler la charge utile dans `pendingReport` et l'expédier aussitôt.
    *   Sanctuariser les interactions utilisateur directes via `recordUserAction()` : pendant 4000ms (`isWithinUserGracePeriod()`), le terminal local est le maître absolu et toute synchronisation descendante distante voulant écraser l'état ou forcer la pause est formellement bloquée.
    *   Dans `<video onPause={...}>`, ignorer systématiquement les événements de pause résiduels ou transitoires du DOM si l'utilisateur a cliqué sur Lecture dans les 1200ms précédentes ou si `activeMedia.isPlaying` est vrai.
    *   Piloter directement le DOM (`video[data-player-div-video="true"].play()`) depuis `playerStore.setPlaying` pour garantir un lancement instantané sans dépendre des cycles de rendu React.
*   **Élimination Universelle des Pièges de Focus DOM & Conformité WAI-ARIA (`aria-hidden` & écrans inactifs) :**
    *   Sur React Native Web, les éléments interactifs (`Pressable` dotés de `focusable={true}`) acquièrent le focus DOM du navigateur. Si l'utilisateur clique sur un bouton de navigation ou de réduction et que l'écran précédent est masqué par React Navigation (`style="display: none;" aria-hidden="true"`), Chromium bloque `aria-hidden` (`Blocked aria-hidden on an element because its descendant retained focus`) et gèle le responder system de React Native Web, neutralisant les clics sur le reste de la page.
    *   Déployer dans le `RootLayout` (`_layout.tsx`) une sentinelle réactive couplée à `usePathname()` et un `MutationObserver` : si `document.activeElement` se retrouve à un instant quelconque sous un conteneur avec `[aria-hidden="true"]` ou `[style*="display: none"]`, forcer immédiatement son floutage (`(el as HTMLElement).blur()`) et restituer le focus à `document.body`.
    *   Dans tous les gestionnaires de transition d'état du lecteur (`handleCollapse`, `handleExpand`, `handleClose`, `handleTogglePlay`), appeler systématiquement `(document.activeElement as HTMLElement)?.blur()` avant d'altérer l'état ou d'engager une navigation.
    *   Privilégier l'ouverture directe du lecteur persistant in-place (`playerStore.openMedia({ ..., expand: true })`) depuis les fiches de détail (`media/[id].tsx`) plutôt que des allers-retours de routage vers des écrans vides (`/player/[id]`).
*   **Sanctuarisation des Sauts de Catégories & ScrollToTop :**
    *   Dans les gestionnaires de saut (`handleJumpToCategory`, `handleScrollToTop`), toujours libérer immédiatement les verrous de restauration (`isRestoringScroll = false`, `scrollRestoredRef = true`) pour empêcher tout snap-back lors du chargement différé des médias.
    *   S'assurer que les fonctions de défilement gèrent `y = 0` (`Math.max(0, y)`) sans garde bloquante `if (y <= 0) return;`.

## 14. Architecture de Synchronisation Multi-Écrans par Ordres Séquentiels (`orderSeq`), Souveraineté Serveur & Isolation des Événements Passifs DOM

*   **Souveraineté des Ordres Utilisateur Explicites (`orderSeq`, `actionTimestamp`, `originDeviceId`) :**
    *   La synchronisation multi-écrans doit obligatoirement suivre le modèle : **`Appareil 1 ou 2 interagissant avec le player → Serveur → Appareils 1 et 2 synchronisés recevant le nouvel ordre`**.
    *   Le serveur est l'unique source de vérité. Chaque interaction utilisateur (Play, Pause, Seek, Open Media, Audio, Sous-titres) incrémente un numéro d'ordre monotone (`orderSeq++`), horodate l'action (`actionTimestamp`) et enregistre l'appareil émetteur (`originDeviceId`).
    *   Les battements passifs réguliers (`isAction: false`) de progression de lecture sont formellement interdits de modifier l'état de lecture (`isPlaying`) ou de contredire un ordre utilisateur récent (< 3.5s).
*   **Éradication de la Boucle d'Écho DOM (`onPlay` / `onPause`) :**
    *   Les écouteurs natifs `<video onPlay={...} onPause={...}>` ne doivent **JAMAIS** ré-émettre de message de synchronisation réseau (`shouldBroadcast = false`) à moins que l'événement ne provienne directement d'un clic utilisateur explicite (`userInitiatedActionRef.current === 'PLAY'` ou `'PAUSE'`).
    *   Lorsqu'un lecteur suiveur applique un ordre reçu du serveur (`syncPlayingFromRemote`, buffer, ou relance), les événements DOM émis par le décodeur vidéo du navigateur sont considérés comme des réactions passives locales et ne doivent sous aucun prétexte être renvoyés au serveur.
*   **Identifiant Unique par Instance/Session/Onglet (`getLocalPlaybackDeviceId`) :**
    *   Ne jamais se baser uniquement sur un `deviceId` stocké en `localStorage` pour la synchronisation de lecture, car deux fenêtres ou onglets ouverts sur la même machine partageraient le même identifiant et se prendraient mutuellement pour le Leader.
    *   Combiner l'identifiant matériel avec un jeton de session d'onglet (`sessionStorage`) : `${baseDeviceId}_${tabId}`. Deux fenêtres sur le même PC ont des identifiants distincts et se synchronisent parfaitement.
*   **Canal Local Instantané (`BroadcastChannel`) & Polling Réactif (850ms) :**
    *   Utiliser `BroadcastChannel(ums_playback_sync_channel)` pour propager les ordres en 0 ms entre fenêtres et onglets locaux d'un même navigateur.
    *   Adopter un polling dynamique sous 850ms pour une synchronisation réseau fluide et quasi-instantanée sur tout le réseau LAN ou distant.
*   **Tolérance de Dérive Temporelle Fluide (Time Calculation) :**
    *   Calculer la position théorique attendue : `expectedPosition = positionSeconds + (isPlaying ? (now - updatedAt)/1000 : 0)`.
    *   Ne jamais déclencher de micro-seek saccadé si l'écart est inférieur à 2.5 secondes. Ne recaler la vidéo que sur une dérive avérée avec temporisation (cooldown de 2 secondes), assurant une lecture continue sans saccades ni coupures de buffer.

## 15. Continuité Absolue de Lecture au Repli/Dépli, Conteneurs DOM Invariants & Synchronisation Exclusivement Événementielle (Zéro Polling Agressif & Zéro Auto-Synchronisation)

*   **Conteneur Vidéo DOM Invariant (`player_video_container`) :**
    *   Ne **JAMAIS** envelopper un élément multimédia persistant (`<video>`) dans un composant dont les propriétés d'accessibilité (`accessibilityRole`), de focus (`focusable`) ou d'interactions tactiles (`onPress`) changent dynamiquement selon l'état d'affichage (ex: replié vs déplié).
    *   Sous React Native Web, altérer `accessibilityRole="button"` vs `undefined` modifie le tag HTML généré (`<button>` vs `<div>`), ce qui force React à détruire et recréer la balise `<video>` à chaque bascule, anéantissant le buffer et réinitialisant la lecture à 0.
    *   Toujours utiliser un conteneur `<View>` statique et invariant, et déléguer les clics tactiles à un composant frère transparent (`<Pressable style={StyleSheet.absoluteFill}>`) superposé uniquement en mode replié.
*   **Continuité Ininterrompue de Lecture au Repli et Dépli (Zero-Cut Autonomous Player) :**
    *   La lecture d'un média ne doit **JAMAIS** être coupée lorsque l'utilisateur réduit le lecteur cinéma (« ▼ Réduire »), le ré-agrandit (« Agrandir ») ou navigue entre les différentes pages du site (`/`, `/media/[id]`, `/explore`, `/tv`).
    *   L'instance DOM `<video>` doit rester unique, vivante et continue pendant toute la session.
*   **Filtrage des Pauses Asynchrones DOM Transitoires :**
    *   Les changements de layout CSS brusques (passage de plein écran 100vw à miniature 58px) ou les navigations inter-écrans provoquent parfois l'émission d'un événement `pause` natif par Chromium.
    *   Dans l'écouteur `onPause`, vérifier systématiquement l'intention de l'utilisateur : si `activeMedia.isPlaying` est vrai et qu'aucune action explicite de pause n'a été demandée (`userInitiatedActionRef.current !== 'PAUSE'`), ignorer la pause transitoire et relancer immédiatement la lecture (`v.play().catch(...)`).
*   **Synchronisation Réseau Exclusivement Événementielle (Zéro Polling Agressif) :**
    *   Bannir impérativement les boucles de polling réseau continues (ex: 850ms) qui saturent les terminaux et écrasent l'état du lecteur.
    *   La synchronisation doit être strictement déclenchée par les **CHANGEMENTS RÉELS** :
        1. Actions utilisateur immédiates (Play, Pause, Seek, Audio, Sous-titres, Volume, Mute, Ouverture, Clôture).
        2. Changements de progression par palier de 5 secondes de lecture naturelle (dans `playerStore.updatePosition`).
        3. Entre onglets du même navigateur : diffusion locale instantanée à 0 ms via `BroadcastChannel`.
*   **Règle Absolue d'Exclusion Locale : Aucune Synchronisation Distante avec son Propre Appareil :**
    *   Un terminal local ne doit sous aucun prétexte appliquer un ordre ou un état distant issu de son propre identifiant d'appareil (`remote.originDeviceId === myDeviceId || remote.deviceId === myDeviceId || isSelf`).
    *   L'appareil local étant le créateur de sa propre progression, il s'ignore lui-même dans les flux de synchronisation descendante et ne s'écrase jamais.

## 16. Ergonomie Modale 'Diffuser & Télécommande' : Partitionnement Écrans Connectés / Déconnectés, Déconnexion Directe In-Place & Noms Réels Universels

*   **Partitionnement Visuel Strict : "Mes écrans connectés" vs "Mes écrans déconnectés" :**
    *   Ne jamais lister tous les terminaux sous un en-tête unique générique sans séparer les états de synchronisation.
    *   Structurer la modale en deux sections étanches :
        - `🟢 Mes écrans connectés (${count})` : regroupe les appareils du compte en ligne et synchronisés (`isOnline && syncGroupId !== 'standalone'`), les cibles Cast actives et la télévision en cours de diffusion.
        - `⚪ Mes écrans déconnectés (${count})` : regroupe les terminaux en mode indépendant (`syncGroupId === 'standalone'`), les écrans hors ligne, et les téléviseurs ou récepteurs Cast disponibles sur le réseau local.
*   **Bouton de Déconnexion Direct In-Place (`[Déconnecter]`) :**
    *   Chaque ligne d'écran connecté doit intégrer un bouton d'action directe `[Déconnecter]` qui bascule instantanément l'appareil en mode indépendant (`setDeviceSyncGroup(dev.deviceId, 'standalone')`) ou interrompt la session de diffusion Cast (`disconnectCastTotally(false)`).
    *   La liste se met à jour instantanément en mémoire sans nécessiter de rechargement complet de page.
    *   Symétriquement, chaque écran déconnecté dispose d'un bouton `[Synchroniser]` pour réintégrer le groupe de diffusion en un clic (`setDeviceSyncGroup(dev.deviceId, 'default')`).
*   **Suppression du Bouton Isolé & Intégration Dynamique de la TV :**
    *   Éliminer les boutons orphelins hors-liste tels que *"Caster sur ma Télévision"*.
    *   Intégrer les récepteurs TV détectés (Google Cast SDK, Smart TV DLNA, Apple AirPlay) directement dans la taxonomie des écrans :
        - En attente / veille $ightarrow$ dans *"Mes écrans déconnectés"* avec actions `[Diffuser]` et `[Connecter]`.
        - En diffusion active $ightarrow$ dans *"Mes écrans connectés"* avec action `[Déconnecter]`.
*   **Détection et Affichage des Noms Réels (`getRealDeviceDisplayName`) :**
    *   Bannir les libellés anonymes (*"Navigateur Web"*, *"Linux"*, *"Appareil Connecté"*).
    *   Identifier précisément le navigateur et l'environnement matériel à partir du User-Agent : ex. `Google Chrome (Linux)`, `Apple Safari (iPhone)`, `Samsung Smart TV (Tizen)`, `LG Smart TV (webOS)`, etc.
    *   Combiner le titre réel avec un sous-titre contextualisé (média en lecture, route actuelle ou statut de veille) et une icône représentative (`💻`, `📱`, `📺`).
