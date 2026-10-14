# **The Universal Stack**

**AI-Native. File-Based. Spatial by Design.**

L'architecture de référence pour les applications modernes. Déployez une plateforme sans compromis sur le Web, iOS et Android à partir d'une seule base de code. Propulsée par un moteur géospatial avancé et une modélisation de données d'une flexibilité absolue.

## **⚡️ La Promesse : Zéro Frictions, Performance Maximale**

Nous avons éliminé la complexité pour ne garder que l'essentiel : une stack Full-TypeScript, de la base de données jusqu'à l'interface utilisateur, orchestrée par un routage unifié.

### **1\. Interface Universelle**

Une expérience native sur chaque écran, construite sur **React Native** et **Expo**.

* **Routage File-Based :** Géré par Expo Router. Une architecture d'URL unifiée pour le Web (SEO-ready avec SSR) et des Deep Links transparents sur mobile.  
* **Write Once, Run Anywhere :** Lancez votre environnement Web, simulateurs iOS ou Android d'une seule commande.

### **2\. Typage Absolu de Bout en Bout**

Oubliez les ruptures de contrat entre le client et le serveur.

* **Backend Véloce :** API motorisée par **Hono (TypeScript)**, conçue pour la rapidité et la modularité.  
* **ORM Déclaratif :** **Drizzle ORM** assure une modélisation pure en TypeScript et une synchronisation parfaite des types jusqu'au frontend, sans génération de code intermédiaire.

### **3\. Intelligence Géospatiale & Flexibilité Métier**

Une fondation de données prête pour la complexité du monde réel, propulsée par **PostgreSQL 16** et **PostGIS**.

* **Spatial by Default :** Typage spatial natif et indexation (GIST) pour des calculs de proximité instantanés.  
* **Modélisation Polymorphique (EAV) :** Rattachez dynamiquement des attributs à n'importe quelle entité.  
* **Machine à États Intégrée :** Historique immuable et audit trail natif pour chaque objet.  
* **Structures Récursives :** Hiérarchies infinies modélisées nativement en SQL.

### **4\. Sécurité Invisible**

Une approche qui protège vos utilisateurs sans les ralentir.

* **Frictionless Auth :** Authentification par Magic Links ou codes PIN. Pas de mots de passe complexes à retenir.  
* **Sécurité Renforcée :** Hachage cryptographique (Argon2/Bcrypt), sessions par cookies HttpOnly, protection anti-DDoS et Rate-limiting strict couplé à l'empreinte IP.

## **🛠 L'Écosystème Technologique**

| Couche | Technologie | Rôle |
| :---- | :---- | :---- |
| **Frontend** | Expo / React Native | Rendu natif universel (Web, iOS, Android) |
| **Routage** | Expo Router | File-based routing, SSR, Deep Linking |
| **Backend API** | Hono (TypeScript) | Logique métier performante et typée |
| **ORM** | Drizzle ORM | Mapping relationnel, types partagés |
| **Base de données** | PostgreSQL 16 | Persistance relationnelle robuste |
| **Moteur Spatial** | PostGIS | Calculs géographiques et indexation |

## **🚀 Déploiement : L'Infrastructure as Code**

L'ensemble du cycle de vie de l'application est automatisé, du développement au déploiement en production.

### **Cloud Compilation (EAS)**

Générez vos binaires natifs sans jamais ouvrir Xcode ou Android Studio.

\# Déploiement Android (Play Store)  
eas build \--platform android \--profile production

\# Déploiement iOS (App Store / TestFlight)  
eas build \--platform ios \--profile production

### **Backend Conteneurisé**

Toute l'infrastructure serveur, la base de données et les volumes géospatiaux sont isolés et pilotés par un fichier compose.yaml central.

\# Lancement de l'infrastructure complète  
docker compose up \--build \-d

*Conçu pour l'échelle. Bâti pour la vitesse.*