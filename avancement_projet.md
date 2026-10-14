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

### 🌐 Centralisation & Priorité Environnementale de l'API (`apiConfig.ts`)
- [x] **Priorité absolue à `EXPO_PUBLIC_API_URL` depuis `.env` :**
  - Prise en compte immédiate de l'hôte API distant configuré (ex: `https://api.cool.sweaw.com`).
  - Élimination des requêtes 404 relatives envoyées sur le nom d'hôte du frontend web.
  - Détection dynamique locale conservée comme fallback transparent si aucune variable d'environnement n'est spécifiée.

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
