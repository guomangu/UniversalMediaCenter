# Frontend (React Native + Expo)

L'application frontend est conçue avec **Expo** et **React Native** (Web, iOS, Android).
L'approche "File-Based" s'applique grâce à **Expo Router** (dossier `src/app/`).

## 🚀 Démarrer l'application

```bash
npm install
npm run start
```

## 🌐 Ports & Accès Réseau (LAN vs Localhost)

- **Accès Recommandé (Gateway Caddy unifié) :**  
  `http://localhost:8080/` ou `http://192.168.1.93:8080/`  
  *Unifie le frontend Expo, l'API Hono (/api/*) et les artworks sur un port unique sans soucis CORS ni ports multiples.*
- **Accès Développeur Expo direct :**  
  `http://localhost:8081/` ou `http://192.168.1.93:8081/`  
  *Résolution automatique de l'hôte API via `src/services/apiConfig.ts`.*

### ⚠️ Note importante pour les Proxies / VPN (NekoBox, Sing-box, etc.)
Si un proxy système ou VPN local est activé sur la machine, assurez-vous d'ajouter `192.168.1.0/24` ou `192.168.1.93` dans les règles de contournement (**Bypass / Exclusion Directe**) du proxy pour éviter une erreur **HTTP 502 Bad Gateway** provenant du serveur proxy externe.
