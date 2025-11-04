# Minute Click Challenge

Application full-stack pour compter le nombre de clics effectués pendant une minute. Elle se compose d'un backend Node.js/Express utilisant Socket.IO pour la communication temps réel et d'un frontend React (Vite) affichant le compteur en direct.

## Fonctionnalités principales

- Création d'une session de 60 secondes avec identifiant unique.
- Clics enregistrés côté serveur pour garantir l'intégrité des scores.
- Diffusion temps réel du nombre de clics et du temps restant via WebSocket (Socket.IO).
- Interface responsive : bouton « Click! », affichage du temps restant, compteur total et identifiant de session à partager.
- Possibilité de rejoindre une session existante à partir de son identifiant.
- Historique en mémoire des dernières sessions terminées (endpoint `GET /stats/recent`).
- Tests unitaires côté backend (Jest) et tests UI côté frontend (React Testing Library + Vitest).

## Arborescence

```
.
├── client/                # Frontend React + Vite
│   ├── src/
│   │   ├── App.jsx        # Composant principal de l'interface
│   │   ├── session/       # Contexte et logique de connexion Socket.IO
│   │   └── __tests__/     # Tests React Testing Library
│   └── Dockerfile         # Image de build + serveur statique
├── server/                # Backend Express + Socket.IO
│   ├── src/
│   │   ├── server.js      # Initialisation HTTP, routes REST et Socket.IO
│   │   └── sessionManager.js # Gestion des sessions, timer et compteur
│   ├── tests/             # Tests Jest
│   └── Dockerfile         # Image Node.js pour le serveur
├── docker-compose.yml     # Lancement coordonné front + back
└── README.md
```

## Pré-requis

- Node.js 18+
- npm 9+
- (Optionnel) Docker et Docker Compose

## Installation & lancement en développement

### Backend

```bash
cd server
npm install
npm run dev
```

Le serveur écoute par défaut sur `http://localhost:4000`.

### Frontend

Dans un autre terminal :

```bash
cd client
npm install
npm run dev -- --host 0.0.0.0
```

L'interface est accessible sur `http://localhost:5173`. Assurez-vous que la variable d'environnement `VITE_API_URL` pointe vers l'API backend (par défaut `http://localhost:4000`).

## Tests

### Backend (Jest)

```bash
cd server
npm test
```

Les tests vérifient la création d'une session, l'incrément des clics et le blocage du compteur à la fin de la minute.

### Frontend (Vitest + React Testing Library)

```bash
cd client
npm test
```

Le test simule un clic utilisateur et vérifie que le compteur affiché augmente.

## Build de production

### Backend

```bash
cd server
npm install --production
npm start
```

### Frontend

```bash
cd client
npm install
npm run build
npm run preview
```

`npm run preview` lance un serveur statique (port 4173) afin de tester le bundle.

## Lancement via Docker

Construisez et lancez les services :

```bash
docker-compose up --build
```

- Frontend disponible sur [http://localhost:3000](http://localhost:3000)
- Backend disponible sur [http://localhost:4000](http://localhost:4000)

## API REST

- `POST /session` : démarre une nouvelle session de 60 secondes et renvoie ses métadonnées (`sessionId`, `status`, `remainingSeconds`, etc.).
- `GET /session/:id/result` : retourne le score final quand la session est terminée (code 202 si elle est toujours en cours, 404 si inconnue).
- `GET /stats/recent` : liste les dernières sessions complétées (en mémoire).

## Extension possibles

- **Stockage persistant** : remplacer la mémoire par Redis ou une base de données pour conserver l'historique.
- **Authentification** : associer un utilisateur à chaque session pour suivre les performances individuelles.
- **Analytics** : tracer la cadence des clics et exporter les données.
- **Déploiement cloud** : ajouter des fichiers de configuration pour déployer sur Fly.io, Render, Railway, etc.

## Sécurité et bonnes pratiques

- Les clics sont validés côté serveur uniquement.
- CORS limité via la variable d'environnement `CLIENT_ORIGIN` pour le backend.
- Possibilité d'ajouter un rate limiting (non inclus) selon les besoins.

Bon jeu !
