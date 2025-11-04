# Minute Click Challenge

Application full-stack (React + Express + Socket.IO) permettant de compter en temps réel le nombre de clics réalisés en 60 secondes.

## Structure du projet

```
.
├── backend
│   ├── src
│   │   ├── server.js          # Serveur Express + Socket.IO
│   │   └── sessionManager.js  # Gestion des sessions, timer et clics
│   ├── tests
│   │   └── sessionManager.test.js
│   ├── package.json
│   └── jest.config.js
├── frontend
│   ├── src
│   │   ├── App.jsx            # Interface principale React
│   │   ├── App.test.jsx       # Test RTL vérifiant l'incrémentation
│   │   ├── main.jsx
│   │   ├── socket.js          # Factory Socket.IO client
│   │   └── styles.css
│   ├── package.json
│   ├── vite.config.js
│   └── vitest.setup.js
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
└── README.md
```

## Installation

### Pré-requis
- Node.js 18+
- npm ou yarn

### Backend
```bash
cd backend
npm install
npm run dev
```
Le serveur écoute sur [http://localhost:4000](http://localhost:4000).

### Frontend
```bash
cd frontend
npm install
npm run dev
```
L'application est accessible sur [http://localhost:5173](http://localhost:5173).

Le frontend communique avec le backend via WebSocket (`socket.io`) et REST. Par défaut, l'URL de l'API est `http://localhost:4000`. Vous pouvez la surcharger avec la variable d'environnement `VITE_API_URL` côté frontend et `CLIENT_ORIGIN` côté backend.

## Fonctionnement
1. L'utilisateur clique sur « Start » pour démarrer une session de 60 secondes.
2. Le backend crée une session, lance un timer et renvoie l'identifiant unique.
3. Chaque clic sur « Click! » émet un évènement WebSocket `session:click` vers le serveur.
4. Le serveur compte les clics, publie les mises à jour (`session:update`) et stoppe automatiquement la session après 60 s (`session:finished`).
5. Le frontend met à jour l'UI en temps réel et permet un `Reset` lorsque la session est terminée.
6. Les sessions terminées sont conservées en mémoire et exposées via `/stats/history`.

## Tests

### Backend
```bash
cd backend
npm test
```
Test de la logique de session (timing et comptage) avec Jest.

### Frontend
```bash
cd frontend
npm test
```
Test React Testing Library + Vitest qui vérifie que le compteur affiché augmente après un clic (via une mise à jour du serveur simulée).

## Docker

### Construction individuelle
```bash
# Backend
docker build -t click-counter-backend -f Dockerfile.backend .
# Frontend
docker build -t click-counter-frontend -f Dockerfile.frontend .
```

### docker-compose
```bash
docker-compose up --build
```
- Backend exposé sur le port `4000`
- Frontend exposé sur le port `5173`

## Points d'extension
- **Persistance** : brancher un stockage (Redis, base SQL) en implémentant un nouveau store pour `SessionManager`.
- **Authentification** : protéger l'accès aux sessions, permettre des tableaux de scores par utilisateur.
- **Analytics** : stocker les résultats et produire des statistiques (moyenne, meilleurs scores, etc.).
- **Scalabilité** : utiliser un adaptateur Socket.IO (Redis, NATS) pour gérer plusieurs instances de serveur.
- **Observabilité** : exposer des métriques Prometheus et des logs structurés.

## API
- `POST /session` : crée une nouvelle session et retourne l'état initial.
- `GET /session/:id/result` : renvoie le résultat d'une session terminée.
- `GET /stats/history` : liste des sessions terminées (en mémoire).

## Sécurité & bonnes pratiques
- Comptage des clics côté serveur uniquement.
- Sessions identifiées par UUID, timer strict côté serveur.
- Nettoyage des timers via `shutdown()` pour éviter les fuites mémoire (utilisé dans les tests et réutilisable pour des scripts d'arrêt).

Bon clic !
