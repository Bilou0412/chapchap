const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const createError = require('http-errors');
const { DataStore, sanitizeUser, sanitizeBet } = require('./dataStore');
const { RiotService } = require('./riotService');
const { BetService } = require('./betService');
const { RewardService } = require('./rewardService');

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '';
const BET_CHECK_INTERVAL_MS = Number(process.env.BET_CHECK_INTERVAL_MS || 120000);

const allowedOrigins = CLIENT_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAllOrigins = allowedOrigins.includes('*') || allowedOrigins.length === 0;

const originValidator = (origin, callback) => {
  if (allowAllOrigins || !origin || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(createError(403, 'Origin not allowed by CORS'));
  }
};

const app = express();
app.use(express.json());
app.use(cors(allowAllOrigins ? { origin: true, credentials: true } : { origin: originValidator, credentials: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: allowAllOrigins
    ? { origin: true, credentials: true }
    : {
        origin: allowedOrigins,
        credentials: true
      }
});

const store = new DataStore();
const riotService = new RiotService({});
const betService = new BetService({ store, riotService });
const rewardService = new RewardService({ store });

function requireUser(req, res, next) {
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ message: 'Identifiant utilisateur manquant (x-user-id).' });
    return;
  }
  const user = store.getUserById(userId);
  if (!user) {
    res.status(404).json({ message: 'Utilisateur introuvable.' });
    return;
  }
  req.user = user;
  next();
}

function handleAsync(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.post(
  '/api/auth/guest',
  handleAsync((req, res) => {
    const { nickname } = req.body || {};
    if (!nickname || !nickname.trim()) {
      res.status(400).json({ message: 'Le pseudo est obligatoire.' });
      return;
    }
    if (store.findUserByNickname(nickname)) {
      res.status(409).json({ message: 'Ce pseudo est déjà utilisé.' });
      return;
    }
    const user = store.createUser(nickname);
    res.status(201).json({ user });
  })
);

app.get(
  '/api/me',
  requireUser,
  handleAsync((req, res) => {
    const user = sanitizeUser(store.getUserInternal(req.user.id));
    const transactions = store
      .listTransactionsForUser(req.user.id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const activeBet = store.getActiveBetForUser(req.user.id);
    res.json({ user, transactions, activeBet: sanitizeBet(activeBet) });
  })
);

app.post(
  '/api/reward',
  requireUser,
  handleAsync((req, res) => {
    const { token } = req.body || {};
    const transaction = rewardService.grantReward(req.user.id, { token });
    res.status(201).json({ transaction, balance: store.getUserById(req.user.id).coins });
  })
);

app.post(
  '/api/coins/spend',
  requireUser,
  handleAsync((req, res) => {
    const { amount, reason } = req.body || {};
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      res.status(400).json({ message: 'Montant invalide.' });
      return;
    }
    const transaction = store.adjustCoins(req.user.id, -value, 'spend', { reason });
    res.status(201).json({ transaction, balance: store.getUserById(req.user.id).coins });
  })
);

app.post(
  '/api/riot/link',
  requireUser,
  handleAsync(async (req, res) => {
    const { summonerName, region } = req.body || {};
    if (!summonerName || !region) {
      res.status(400).json({ message: 'Le pseudo LoL et la région sont requis.' });
      return;
    }
    const summoner = await riotService.fetchSummonerByName({ summonerName, region });
    const riotProfile = {
      puuid: summoner.puuid,
      summonerId: summoner.id,
      summonerName: summoner.name,
      accountId: summoner.accountId,
      region
    };
    const user = store.updateUser(req.user.id, { riot: riotProfile });
    res.json({ user });
  })
);

app.get(
  '/api/bet/active',
  handleAsync((req, res) => {
    res.json({ bets: betService.listBets() });
  })
);

app.post(
  '/api/bet/create',
  requireUser,
  handleAsync(async (req, res) => {
    const { opponentNickname, amount } = req.body || {};
    if (!opponentNickname) {
      res.status(400).json({ message: "Le pseudo de l'adversaire est requis." });
      return;
    }
    const opponent = store.findUserByNickname(opponentNickname);
    if (!opponent) {
      res.status(404).json({ message: 'Adversaire introuvable.' });
      return;
    }
    if (opponent.id === req.user.id) {
      res.status(400).json({ message: 'Impossible de parier contre soi-même.' });
      return;
    }
    const bet = await betService.createBet({ creator: req.user, opponent, amount });
    res.status(201).json({ bet });
  })
);

app.post(
  '/api/bet/accept',
  requireUser,
  handleAsync(async (req, res) => {
    const { betId } = req.body || {};
    if (!betId) {
      res.status(400).json({ message: 'Identifiant du pari requis.' });
      return;
    }
    const bet = await betService.acceptBet({ betId, user: req.user });
    res.json({ bet });
  })
);

app.post(
  '/api/bet/check',
  handleAsync(async (req, res) => {
    const updates = await betService.checkActiveBets();
    res.json({ updates });
  })
);

app.use((err, req, res, next) => {
  // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Erreur interne du serveur.' });
});

io.on('connection', (socket) => {
  socket.emit('bets:update', betService.listBets());

  socket.on('register', ({ userId }) => {
    if (!userId) {
      socket.emit('user:error', { message: 'Identifiant utilisateur requis.' });
      return;
    }
    const user = store.getUserById(userId);
    if (!user) {
      socket.emit('user:error', { message: 'Utilisateur introuvable.' });
      return;
    }
    socket.data.userId = userId;
    socket.join(`user:${userId}`);
    socket.emit('user:update', user);
  });
});

store.on('userUpdated', (user) => {
  io.to(`user:${user.id}`).emit('user:update', user);
});

store.on('transactionCreated', (transaction) => {
  io.to(`user:${transaction.userId}`).emit('coins:transaction', transaction);
});

store.on('betCreated', (bet) => {
  io.emit('bet:created', bet);
  io.emit('bets:update', betService.listBets());
});

store.on('betUpdated', (bet) => {
  io.emit('bet:update', bet);
  io.emit('bets:update', betService.listBets());
});

betService.on('betResolved', (bet) => {
  io.emit('bet:result', bet);
});

betService.on('betRefunded', (bet) => {
  io.emit('bet:refunded', bet);
});

betService.on('betCheckFailed', ({ betId, error }) => {
  console.error(`Bet check failed for ${betId}: ${error}`); // eslint-disable-line no-console
});

if (BET_CHECK_INTERVAL_MS > 0) {
  setInterval(() => {
    betService.checkActiveBets().catch((error) => {
      console.error('Bet check error:', error); // eslint-disable-line no-console
    });
  }, BET_CHECK_INTERVAL_MS);
}

server.listen(PORT, HOST, () => {
  console.log(`Server listening on ${HOST}:${PORT}`); // eslint-disable-line no-console
});
