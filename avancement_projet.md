### 🎬 Streaming Vidéo & Lecteur HTML5 (`routes/mediaStream.ts`, `player/[id].tsx`)
- [x] Streaming HTTP Range (206 Partial Content) fluide pour MKV, MP4, WebM et IPTV.
- [x] Lecteur vidéo universel avec contrôles et saut d'intro (+85s).
- [x] **Agencement non-obstructif des boutons du lecteur :** Repositionnement flottant de *Passer l'Introduction* (`bottom: 84`) pour ne plus masquer la barre de progression, le plein écran ou le volume.
- [x] **Sélecteur de Qualité Vidéo (`PlayerQualityModal.tsx`) :** Modal de sélection de flux (Auto Direct Play, 1080p FHD, 720p HD, 480p SD).
- [x] **Sélecteur de Sous-titres (`PlayerSubtitleModal.tsx`) :** Choix des pistes audio/sous-titres (Désactivé, Français complet, Français forcé, English).
- [x] **Fonctionnalités de Partage (`PlayerShareModal.tsx`) :** Partage natif via Web Share API, copie instantanée du lien direct dans le presse-papier et passerelle vers le salon Forum WhatsApp du média.
- [x] **Assainissement du rechargement à la volée :** Pagination dynamique basée sur le flag serveur `hasMore` garantissant le chargement fiable de tout média absent au chargement initial.

---

## 🟡 2. Chantiers Suivants (Par Ordre de Priorité)

1. **Intégration du Transcodeur Matériel (`ums_transcoder`) :** Détection automatique des formats vidéo non supportés nativement (HEVC 10-bit, audio DTS) et bascule vers VAAPI / NVENC à la volée.
2. **Reconnaissance Temporelle & Chapitrage Automatique :** Détection d'intro pour alimenter `chaptersJson`.
3. **Téléchargement Hors-Ligne & Profils Multi-Utilisateurs :** Synchronisation locale de fichiers multimédias.
