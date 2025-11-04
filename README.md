# Minute Click Challenge

Application full-stack permettant de compter le nombre de clics réalisés pendant une minute, avec mise à jour temps réel via WebSocket.

## Architecture

```
chapchap/
├── backend/           # Serveur Express + Socket.IO
│   ├── src/
│   │   ├── server.js
│   │   └── sessionManager.js
│   └── tests/
│       └── sessionManager.test.js
├── frontend/          # Application React (Vite)
│   ├── index.html
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── context/SessionContext.jsx
│   │   ├── styles/
│   │   │   ├── App.scss
│   │   │   └── index.scss
│   │   └── tests/App.test.jsx
│   └── vite.config.js / vitest.config.js
├── docker-compose.yml
├── backend/Dockerfile
├── frontend/Dockerfile
└── README.md
```

## Pré-requis

- Node.js >= 18
- npm >= 9

## Installation

Dans deux terminaux distincts :

```bash
# Backend
cd backend
npm install
npm run dev
```

```bash
# Frontend
cd frontend
npm install
npm run dev
```

Le frontend est disponible sur http://localhost:5173 et se connecte par défaut au backend http://localhost:4000.

## Scripts disponibles

### Backend

- `npm run dev` : démarre le serveur Express avec rechargement via nodemon
- `npm start` : démarre le serveur en production
- `npm test` : exécute les tests Jest sur la logique de session

### Frontend

- `npm run dev` : lance Vite en mode développement
- `npm run build` : build de production
- `npm run preview` : prévisualise le build
- `npm test` : exécute les tests Vitest/React Testing Library

## Utilisation

1. Cliquer sur **Start** pour démarrer une nouvelle session de 60 secondes (créée côté serveur).
2. Partager l'identifiant affiché en bas de page afin que d'autres utilisateurs puissent rejoindre via le formulaire « Session ID ».
3. Cliquer sur **Click!** pour envoyer un événement de clic au serveur via WebSocket.
4. Les compteurs et le temps restant sont synchronisés en temps réel sur tous les clients connectés à la session.
5. Après 60 secondes, la session se termine. Le bouton **Click!** est désactivé et le score final reste affiché. Cliquer sur **Reset** pour préparer une nouvelle session.

## API Backend

- `POST /session` : crée une session et retourne `{ sessionId, durationSeconds }`
- `GET /session/:id` : renvoie l'état courant de la session
- `GET /session/:id/result` : renvoie le résultat final une fois la session terminée (202 si encore en cours)

### Événements Socket.IO

- Client → serveur :
  - `joinSession` (`{ sessionId }`)
  - `click` (`{ sessionId }`)
- Serveur → client :
  - `session:update` (état de la session)
  - `session:finished` (notification de fin)
  - `session:error` (erreur côté serveur)

## Tests

### Backend

```bash
cd backend
npm test
```

### Frontend

```bash
cd frontend
npm test
```

## Docker

Le projet inclut une configuration Docker pour lancer le frontend et le backend.

```bash
docker-compose up --build
```

- Backend disponible sur `http://localhost:4000`
- Frontend disponible sur `http://localhost:5173`

## Points d'extension

- **Persistance** : remplacer l'in-memory store par Redis ou une base de données pour conserver les scores.
- **Auth** : ajout d'une authentification pour suivre les scores utilisateurs.
- **Analytics** : historiser les sessions, exposer des statistiques globales.
- **Durée configurable** : permettre de choisir la durée côté client en paramètre de la session.

## Sécurité de base

- Les clics sont comptabilisés uniquement côté serveur.
- Les sockets sont limités au domaine frontend défini via `CLIENT_ORIGIN`.
- Les données envoyées sont minimalistes et validées côté serveur.
