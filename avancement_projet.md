# État d'Avancement du Projet : Universal Media Stack (UMS)

Dernière mise à jour : 14 Octobre 2026

---

## 🟢 1. Fonctionnalités Réalisées & Validées

### 📡 Système de Cast, Progression & Télécommande Réseau Universel
- [x] **Contrôle de la Progression Temporelle par Télécommande / Manette / Clavier (`usePlayerControls.ts`, `useTvNavigation.ts`) :**
  - **Recul / Avance rapide :** Touche `Flèche Gauche` (recul de 10s) et `Flèche Droite` (avance de 10s) avec toasts visuels réactifs (`⏪ -10s`, `⏩ +10s`).
  - **Bouton Play / Pause :** Touche `Espace`, touche `MediaPlayPause` ou bouton A / X de manette.
  - **Contrôle du volume :** Touche `Flèche Haut` (+10%) et `Flèche Bas` (-10%) avec feedback en pourcentage.
  - **Scrubbing tactile / clic direct :** La barre de progression dans la télécommande `CastControlBar` est entièrement interactive et permet de sauter à n'importe quel point temporel d'un simple clic.
  - **Pilotage réseau distant :** Les touches du contrôleur envoient directement les ordres `SEEK`, `PLAY`, `PAUSE` à l'écran cible casté.
- [x] **Reprise Instantanée au Changement de Qualité ou de Langue (`VideoPlayerView.tsx`, `player/[id].tsx`) :**
  - Maintien rigoureux du timestamp exact lors de la bascule de langue audio ou de qualité via `savedPosRef` et `initialTime`.
  - Protection contre la réinitialisation de `savedTimeRef` à 0 lors du rechargement de la source par le navigateur (`loadstart`).
  - Restauration immédiate dès le déclenchement des événements `loadedmetadata` et `canplay`.
- [x] **Barre de Progression 100% Complète & Seekable en Qualité Non-Automatique (`mediaStream.ts`) :**
  - Suppression du pipe ffmpeg fragmenté non indexé au profit d'un streaming HTTP 206 Partial Content (Byte-Range) systématique avec en-têtes `Content-Range`, `Accept-Ranges: bytes` et `Content-Length`.
  - Durée totale (`duration`) immédiatement reconnue par le lecteur HTML5 : finie la barre qui grandit petit à petit.
  - Navigation instantanée vers n'importe quelle minute de la vidéo sans lag ni réencodage inutile sur réseau local.
- [x] **Registre Réseau et Découverte Bidirectionnelle (`backend/src/cast/`) :**
  - Enregistrement des appareils (`/api/cast/register`, `/api/cast/devices`, `/api/cast/device/:id`).
  - Heartbeat live avec transmission d'état complète (titre en cours, position temporelle, durée totale, statut lecture/pause, volume, mute, pistes audio/sous-titres).
  - File d'attente de commandes découplée (`/api/cast/command`, `/api/cast/poll/:deviceId`) pour un contrôle à distance sans latence.
- [x] **Barre de Contrôle Flottante & Télécommande Globale (`CastControlBar.tsx`, `castState.ts`) :**
  - Affichage permanent de l'état du lecteur distant (nom de l'écran, titre, timecode précis `mm:ss / mm:ss`, barre de progression synchronisée).
  - Contrôles directs : Recul rapide (-10s), Lecture / Pause, Avance rapide (+30s), Muet / Volume, Arrêt de la diffusion.
  - Persistance globale sur toutes les pages de l'application via le layout racine (`_layout.tsx`).
- [x] **Gestionnaire d'Appareils & Personnalisation (`CastModal.tsx`, `castService.ts`) :**
  - Détection automatique des écrans UMS du réseau local avec affichage du statut en temps réel (🟢 En lecture vs ⚪ En veille).
  - Renommage à la volée de son propre appareil ("TV Salon", "PC Bureau", "Mobile").
  - Mode double action : "Caster" (lancer le média sur l'écran cible) ou "Contrôler" (télécommande sans perturber le média en cours).
  - Bouton direct "📡 Diffuser" intégré sur la fiche détail média (`/media/[id]`).
- [x] **Récepteur Intégré dans le Lecteur Vidéo (`useCastReceiver.ts`, `player/[id].tsx`) :**
  - Synchronisation automatique de la lecture, de la mise en pause, de la recherche temporelle (seek), du volume, des pistes audio et des sous-titres sur réception de commandes réseau.

### 🎮 Navigation Télévision, Télécommande & Manette (Spatial Navigation)
- [x] **Moteur de navigation spatiale 2D universel (`useTvNavigation.ts`) :**
  - Actif sur toutes les pages du site via le layout racine (`_layout.tsx`).
  - Détection automatique et calcul géométrique vectoriel de distance entre éléments interactifs.
  - Prise en charge des touches de télécommande / clavier (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Enter`, `Select`, `Escape`, `BrowserBack`).
  - Prise en charge des manettes de jeu via l'API standard Gamepad (croix directionnelle D-Pad, stick analogique gauche, bouton A pour valider, bouton B pour retour).
- [x] **Défilement automatique dans le viewport :**
  - `scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })` appliqué au focus, garantissant que les listes horizontales de médias et les sections verticales défilent automatiquement quand le curseur avance.
- [x] **Indicateur visuel haute visibilité TV (`global.css`) :**
  - Contour indigo dynamique (`outline: 3px solid #818cf8`), halo lumineux (`box-shadow`) et zoom subtil (`scale(1.04)`) sur tout élément sélectionné.

### 🎯 Synchronisation Bidirectionnelle `param.yaml` & Administration
- [x] Fichier central `param.yaml` synchronisé dynamiquement avec validation Zod (`paramSchema.ts`).
- [x] Chiffrement sécurisé du mot de passe admin via Argon2id.
- [x] Hot-reload automatique sur modification directe du fichier par un agent IA ou administrateur.
- [x] Gestion des inscriptions à la volée (`registerOnTheFly`) et du mode sur invitation uniquement (`invitationOnly`).
- [x] Interface d'administration modulaire `/admin` avec gestion des utilisateurs et des paramètres du site.
- [x] **En-tête unifié persistant sur `/admin` :** Intégration de `SiteHeader` sur la page d'administration garantissant l'accès permanent au logo, retour à l'accueil, sélection de profil et navigation.

### 🌐 Menu Navigation à 2 Niveaux & Recherche Assainie
- [x] **En-tête à deux étages (`SiteHeader.tsx`) :**
  - **1er étage (supérieur) :** Logo UMS à gauche, boutons de profil (`+ Profil`) et d'administration (`⚙️ Admin`) à droite.
  - **2ème étage (inférieur) :** Raccourcis de catégories avec bouton `🏠 Haut` et défilement horizontal fluide (`showsHorizontalScrollIndicator={false}`) occupant 100% de la largeur sans aucun rognage sur le bord de l'écran.
- [x] **Masquage des tags et catégories vides lors de la recherche (`TagCard.tsx`, `CategorySection.tsx`) :**
  - Lors d'une recherche depuis la page d'accueil, aucun tag avec 0 média n'est affiché.
  - Suppression des cartes vides parasites ("Aucun média trouvé pour ce filtre") au profit d'un affichage ciblé et instantané.
  - Masquage automatique des catégories entières ne comportant aucun résultat pour la recherche courante.

### 🗂️ Taxonomie, Cartes & Navigation Hiérarchique
- [x] **Structure d'accueil catégorisée :** Catégories verticales > Tags verticaux (Cards) > Médias en défilement horizontal.
- [x] **Transmission des tags aux groupes de médias :**
  - Les tags des médias liés sont transmis au groupe parent (`SHOW`, `COLLECTION`).
  - Aucun tag n'est vide sur la page d'accueil : les groupes apparaissent sous chaque tag partagé par leurs épisodes ou films liés.
- [x] **Tri prioritaire des tags par quantité (`count DESC`) :**
  - Toutes les catégories ordonnent leurs tags par volume de médias liés décroissant.
- [x] **Films de cette suite avec affiches & fallbacks (`MediaChildrenRow.tsx`) :**
  - Sur `/media/[id]`, chaque film d'une saga ou épisode d'une série affiche sa vignette/affiche dédiée avec fallback automatique.
- [x] **Genres & Thématiques avec Médias Liés (`MediaGenreSection.tsx`, `mediaRelated.ts`) :**
  - Sur `/media/[id]`, affichage vertical de chaque tag de genre/thème avec défilement horizontal des autres médias partageant ce tag (exclusion du groupe actuel).
- [x] **Pagination dynamique & à la volée :**
  - Limite de 5 tags par catégorie avec bouton "+10 tags".
  - Limite de 15 médias par tag avec bouton "+10 médias" basé sur `hasMore`.

### 🎬 Streaming Vidéo, Pistes Audio & Qualité Dynamique (`mediaStream.ts`, `mediaTracks.ts`, `player/[id].tsx`, `VideoPlayerView.tsx`)
- [x] **Barre de progression complète & Direct Play conservés lors du changement d'audio :**
  - Lors du choix d'une autre langue audio (ex: Japonais), le flux vidéo d'origine est conservé sans réencodage (`-c copy`) dans un conteneur en cache rapide (`/tmp/ums_cache`).
  - Le fichier résultant est diffusé en HTTP 206 Partial Content (Byte-Range) avec `Content-Range` et `Content-Length` complets : la barre de progression reste 100% complète et le seeking instantané est opérationnel à n'importe quel moment de la vidéo.
  - Maintien du curseur temporel (`currentTime`) : le changement de langue ne remet pas la vidéo au début.
- [x] **Passer l'Introduction Précis & Auto-Hide Inactivité 5s :**
  - Extraction des chapitres réels par `ffprobe` pour obtenir la fin exacte de l'intro (ex: 90.04s pour Bleach). Le bouton saute au temps précis calculé et non à un saut arbitraire (`+= 85s`).
  - Disparition automatique dès que la lecture dépasse la fin de l'intro ou en cas de saut temporel en dehors de la plage d'introduction.
  - Temporisateur d'inactivité de 5 secondes : le bouton se masque si la souris ne bouge plus pendant 5s, et réapparaît dès le moindre mouvement.
- [x] **Sous-Titres Réels Garantis :**
  - Extraction à la volée des sous-titres texte réels embarqués ou externes (`.srt`/`.vtt`), synchronisation WebVTT et affichage textuel instantané.

### 💬 Forum WhatsApp Universel Multimédia (`/forum/[topic]`)
- [x] **Universal Clickable Text :** Tous les textes (titres, tags, catégories, overviews) ouvrent leur salon de forum dédié.
- [x] **Messagerie style WhatsApp :** Bulles de messages, citations/réponses (`replyTo`), images, vidéos, audios, documents et liens.
- [x] Persistance PostgreSQL avec indexation optimisée sur `topic_slug`.

---

## 🟡 2. Diagnostic & Bonnes Pratiques Réseau / Accès Local

1. **Accès Local :**
   - Accès privilégié et testé sur `localhost:8080` (Gateway Caddy) ou `localhost:3000` (API Backend).
2. **Accès via IP Locale (`http://192.168.1.93:8080/`) :**
   - Toujours spécifier le port de la passerelle (:8080).
   - En présence de tunnels VPN ou proxies applicatifs (ex: NekoBox), ajouter `192.168.1.0/24` dans la liste de contournement/bypass du proxy.
