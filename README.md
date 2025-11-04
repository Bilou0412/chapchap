# Minute Click Challenge

Application full-stack React + Node.js permettant de lancer des défis de clics d'une minute en réseau local. Les joueurs choisissent
un pseudo, rejoignent un salon et partagent un compteur synchronisé en temps réel via Socket.IO.

## Architecture

```
chapchap/
├── backend/           # Serveur Express + Socket.IO
│   ├── src/
│   │   ├── roomManager.js
│   │   └── server.js
│   └── tests/
│       └── roomManager.test.js
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
├── docker-compose.yml
├── backend/Dockerfile
├── frontend/Dockerfile
└── README.md
```

## Fonctionnalités principales

- Serveur Socket.IO écoutant sur `0.0.0.0` pour accepter les connexions LAN.
- Gestion de salons (rooms) : liste en temps réel, création, jointure, départ.
- Pseudo obligatoire pour apparaître dans le salon et pendant la partie.
- Compteur de clics et timer synchronisés côté serveur (60 s par défaut).
- Redémarrage instantané d'une nouvelle minute lorsque le salon est prêt.
- Interface responsive et état de connexion WebSocket visible.

## Pré-requis

- Node.js >= 18
- npm >= 9

## Installation locale

Dans deux terminaux distincts :

```bash
# Backend
cd backend
npm install
CLIENT_ORIGIN="http://localhost:5173" npm run dev
```

```bash
# Frontend
cd frontend
npm install
VITE_API_BASE_URL="http://localhost:4000" npm run dev
```

Ouvrez ensuite http://localhost:5173.

### Utilisation en réseau local

1. Sur la machine serveur, exécuter le backend avec `CLIENT_ORIGIN` contenant les origines autorisées (plusieurs valeurs
   séparées par des virgules, par exemple `http://localhost:5173,http://192.168.1.10:5173`). Utilisez `*` pour autoriser
   temporairement toutes les origines sur un réseau de confiance.
2. Sur le frontend, définissez `VITE_API_BASE_URL` sur l'adresse IP du serveur (`http://192.168.1.10:4000` par exemple) avant
   `npm run dev` ou lors du build.
3. Les autres machines ouvrent `http://192.168.1.10:5173` (ou le port exposé) et rejoignent les salons visibles.

## Workflow côté utilisateur

1. Choisir un pseudo puis l'enregistrer.
2. Créer un salon ou rejoindre un salon existant.
3. Lancer la session (« Start ») pour démarrer le compte à rebours de 60 secondes.
4. Cliquer sur « Click! » autant que possible : chaque clic est compté par le serveur et renvoyé aux clients en temps réel.
5. À la fin de la minute, le score final est affiché et la session passe en état « finished ». Utiliser « Reset » pour revenir en
   attente ou relancer directement un nouveau round.

## API Backend

- `GET /rooms` : liste des salons et de leur état.
- `POST /rooms` : crée un salon (`{ name?, durationMs? }`).
- `GET /rooms/:id` : détails d'un salon spécifique.
- `POST /rooms/:id/start` : démarre une session de 60 s (réinitialise le compteur).
- `POST /rooms/:id/reset` : repasse le salon en attente sans démarrer le timer.
- `GET /rooms/:id/result` : renvoie `{ status: 'finished', clicks, durationMs }` quand la session est terminée (`202` sinon).

### Événements Socket.IO

Client → serveur :

- `joinRoom` `{ roomId, name }`
- `leaveRoom`
- `startSession` `{ roomId? }` *(optionnel si vous utilisez les endpoints REST)*
- `resetSession` `{ roomId? }`
- `click` `{ roomId? }`

Serveur → client :

- `rooms:update` (liste complète des salons)
- `room:joined` (confirmation et état du salon pour le client)
- `room:update` (état courant du salon)
- `room:finished` (notification de fin de minute)
- `room:left` (confirmation de sortie)
- `room:error` (message d'erreur utilisateur)

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

Lancer les deux services (nginx pour le frontend + backend Express) :

```bash
docker-compose up --build
```

Par défaut :

- Backend exposé sur `http://localhost:4000`
- Frontend exposé sur `http://localhost:5173`

Pour une utilisation LAN, modifiez `docker-compose.yml` ou vos variables d'environnement afin que :

- `CLIENT_ORIGIN` référence les adresses IP/ports des clients autorisés (ex. `http://192.168.1.10:5173`).
- `VITE_API_BASE_URL` pointe vers l'URL du backend accessible depuis le LAN.

## Points d'extension

- **Persistance** : brancher un stockage Redis/PostgreSQL pour conserver l'historique des salons et scores.
- **Auth** : ajouter une authentification pour personnaliser les salons ou restreindre l'accès.
- **Analytics** : exposer des statistiques historiques, un classement des meilleurs clics, etc.
- **Durées configurables** : permettre aux créateurs de salon de définir la durée de la session.

## Sécurité de base

- Les clics sont validés et comptés uniquement côté serveur.
- Les origines autorisées pour CORS/WebSocket sont configurables via `CLIENT_ORIGIN` (support des valeurs multiples et de `*`).
- Les données salon/joueur restent en mémoire pour faciliter l'évolution vers un stockage persistant.
