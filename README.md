# ChapChap — League Bets System

Plateforme LAN complète permettant aux joueurs de League of Legends de gagner des coins via des publicités reward, de miser ces coins
sur leurs propres matchs et de laisser le backend vérifier automatiquement les résultats via l’API Riot Games.

## Architecture

```
chapchap/
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── betService.js
│   │   ├── dataStore.js
│   │   ├── rewardService.js
│   │   ├── riotService.js
│   │   └── server.js
│   └── tests/
│       └── betService.test.js
├── frontend/
│   ├── package.json
│   ├── index.html
│   ├── src/
│   │   ├── api/client.js
│   │   ├── App.jsx
│   │   ├── main.jsx
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

- Authentification légère : chaque joueur choisit un pseudo unique stocké localement.
- Système de coins : récompense (+50) après visionnage d’une publicité (token simulé), dépenses automatiques lors des paris, transactions loguées.
- Liaison Riot Games : association d’un pseudo LoL, récupération du `puuid` et suivi automatique des matchs via l’API Match-V5.
- Duels de paris : création/acceptation entre deux joueurs, pot commun, vérification automatique toutes les 2 minutes (et à la demande) via Riot API.
- Gestion des résultats : victoire, égalité (remboursement), expiration après 1h (remboursement), cooldown de 5 min entre deux paris.
- Notifications temps réel : Socket.IO diffuse les mises à jour de coins et l’état des paris à tous les clients connectés.
- Interface React moderne : onglet “Paris LoL”, onglet “Profil”, suivi du solde, historique des transactions et CTA “🎥 Regarder une pub”.
- Compatible LAN : serveur Express lié sur `0.0.0.0`, configuration CORS multi-origine et frontend détectant automatiquement l’URL API.

## Pré-requis

- Node.js >= 18
- npm >= 9
- Clé API Riot Games (facultatif en développement : les appels réels échoueront sans clé)

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

Ouvrez ensuite http://localhost:5173. Sans `VITE_API_BASE_URL`, l’UI tente de contacter le même host sur le port 4000.

### Utilisation LAN

1. Sur la machine serveur, lancez le backend (`npm run dev`) après avoir défini `CLIENT_ORIGIN` avec les URL autorisées
   (séparées par des virgules, utilisez `*` sur un réseau de confiance pour tout autoriser) et `REWARD_TOKEN` si vous souhaitez
   changer le jeton de pub.
2. Démarrez le frontend en précisant `VITE_API_BASE_URL` avec l’IP LAN du serveur (ex. `http://192.168.0.42:4000`).
3. Les autres machines accèdent au frontend via l’IP LAN (`http://192.168.0.42:5173`) et l’application détecte automatiquement
   l’adresse du backend pour le WebSocket.

## Workflow utilisateur

1. Choisir un pseudo unique via l’interface (création d’un compte invité).
2. Regarder des pubs reward pour gagner des coins (simulation 10s + vérification token).
3. Lier son compte Riot (pseudo + région) pour permettre la vérification des matchs.
4. Créer un pari en indiquant l’adversaire (pseudo ChapChap) et la mise.
5. L’adversaire accepte le pari, les deux mises sont débitées et un cooldown de 5 minutes s’applique.
6. Les joueurs jouent leur prochain match League of Legends.
7. Le backend vérifie périodiquement les matchs récents des deux PUUID :
   - Victoire → le gagnant touche la totalité du pot, transaction `win` + `loss` enregistrées.
   - Égalité → remboursement intégral (`draw`).
   - Aucune partie détectée après 1h → remboursement automatique (`refunded`).
8. Les résultats et transactions sont diffusés en direct via Socket.IO.

## API Backend

Toutes les requêtes authentifiées exigent l’en-tête `x-user-id` (valeur renvoyée par `/api/auth/guest`).

- `POST /api/auth/guest` `{ nickname }` → crée un utilisateur invité.
- `GET /api/me` → renvoie le profil + transactions + pari actif.
- `POST /api/reward` `{ token }` → crédite 50 coins après vérification du token.
- `POST /api/coins/spend` `{ amount, reason? }` → débite manuellement des coins.
- `POST /api/riot/link` `{ summonerName, region }` → associe un compte Riot.
- `GET /api/bet/active` → liste complète des paris (tous statuts).
- `POST /api/bet/create` `{ opponentNickname, amount }` → crée un pari et débite la mise du créateur.
- `POST /api/bet/accept` `{ betId }` → accepte un pari en attente et démarre la fenêtre de vérification.
- `POST /api/bet/check` → force une vérification immédiate des paris en cours.

### Événements Socket.IO

Client → serveur :

- `register` `{ userId }` → associe la socket au joueur.

Serveur → client :

- `user:update` → nouveau profil/solde après transaction.
- `coins:transaction` → transaction individuelle ajoutée à l’historique.
- `bets:update` → liste synchronisée de tous les paris.
- `bet:created` / `bet:update` → notifications temps réel sur les paris.
- `bet:result` → résultat final d’un pari.
- `bet:refunded` → remboursement faute de match.

## Tests

### Backend

```bash
cd backend
npm test
```

Les tests unitaires vérifient la résolution automatique (`win`) et le remboursement (`expired`) des paris via un RiotService mocké.

### Frontend

```bash
cd frontend
npm test
```

Les tests Vitest/RTL couvrent la création de profil, l’affichage du portefeuille et la soumission du pseudo.

## Docker

Lancer l’ensemble via Docker Compose :

```bash
docker-compose up --build
```

- Backend exposé par défaut sur `http://localhost:4000` (configurable via variables d’environnement).
- Frontend servi par Nginx sur `http://localhost:5173`.

Pensez à transmettre les variables `CLIENT_ORIGIN`, `VITE_API_BASE_URL`, `REWARD_TOKEN` et `RIOT_API_KEY` dans vos fichiers `.env` ou
via la ligne de commande pour une utilisation LAN.

## Points d’extension

- **Persistance** : brancher une base (MongoDB/Postgres) et remplacer `DataStore` par un dépôt persistant.
- **Auth forte** : intégrer OAuth ou JWT pour sécuriser les paris et gérer plusieurs appareils.
- **Analytics** : générer des statistiques de paris, classements, historique de victoires.
- **Vraies pubs** : connecter AdMob ou un autre fournisseur et sécuriser la validation serveur.
- **Interface mobile** : transformer l’UI React en PWA ou en application mobile avec React Native.

## Sécurité & bonnes pratiques

- CORS configurables par variable d’environnement (`CLIENT_ORIGIN`).
- Vérification stricte du token reward côté serveur (`REWARD_TOKEN`).
- Cooldown de 5 minutes et pari unique actif par joueur pour éviter l’abus.
- Détection d’expiration après 1h avec remboursement automatique.
- Logs de transactions pour audit et traçabilité.
