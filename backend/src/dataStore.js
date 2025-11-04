const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

function sanitizeUser(user) {
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    nickname: user.nickname,
    coins: user.coins,
    riot: user.riot,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastBetAt: user.lastBetAt,
    cooldownEndsAt: user.cooldownEndsAt
  };
}

function sanitizeBet(bet) {
  if (!bet) {
    return null;
  }
  return {
    id: bet.id,
    status: bet.status,
    createdAt: bet.createdAt,
    startedAt: bet.startedAt,
    completedAt: bet.completedAt,
    expiresAt: bet.expiresAt,
    totalPool: bet.totalPool,
    matchId: bet.matchId,
    winner: bet.winner,
    outcome: bet.outcome,
    playerA: {
      userId: bet.playerA.userId,
      nickname: bet.playerA.nickname,
      bet: bet.playerA.bet
    },
    playerB: {
      userId: bet.playerB.userId,
      nickname: bet.playerB.nickname,
      bet: bet.playerB.bet
    }
  };
}

class DataStore extends EventEmitter {
  constructor() {
    super();
    this.users = new Map();
    this.bets = new Map();
    this.transactions = [];
  }

  createUser(nickname) {
    const trimmed = (nickname || '').trim();
    if (!trimmed) {
      throw new Error('Nickname is required');
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const user = {
      id,
      nickname: trimmed,
      coins: 0,
      riot: null,
      createdAt: now,
      updatedAt: now,
      lastBetAt: null,
      cooldownEndsAt: null
    };

    this.users.set(id, user);
    this.emit('userCreated', sanitizeUser(user));
    return sanitizeUser(user);
  }

  getUserById(id) {
    const user = this.users.get(id);
    return sanitizeUser(user);
  }

  getUserInternal(id) {
    return this.users.get(id) || null;
  }

  findUserByNickname(nickname) {
    const target = (nickname || '').trim().toLowerCase();
    if (!target) {
      return null;
    }
    for (const user of this.users.values()) {
      if (user.nickname.toLowerCase() === target) {
        return sanitizeUser(user);
      }
    }
    return null;
  }

  updateUser(id, patch) {
    const user = this.users.get(id);
    if (!user) {
      throw new Error('User not found');
    }
    Object.assign(user, patch, { updatedAt: new Date().toISOString() });
    this.emit('userUpdated', sanitizeUser(user));
    return sanitizeUser(user);
  }

  adjustCoins(userId, amount, type, meta = {}) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const newBalance = user.coins + amount;
    if (newBalance < 0) {
      throw new Error('Insufficient coins');
    }

    user.coins = newBalance;
    user.updatedAt = new Date().toISOString();

    const transaction = {
      id: uuidv4(),
      userId,
      type,
      amount,
      balanceAfter: newBalance,
      timestamp: new Date().toISOString(),
      meta
    };

    this.transactions.push(transaction);
    this.emit('userUpdated', sanitizeUser(user));
    this.emit('transactionCreated', transaction);
    return transaction;
  }

  listTransactionsForUser(userId) {
    return this.transactions.filter((tx) => tx.userId === userId);
  }

  addBet(bet) {
    this.bets.set(bet.id, bet);
    this.emit('betCreated', sanitizeBet(bet));
    return sanitizeBet(bet);
  }

  updateBet(betId, patch) {
    const bet = this.bets.get(betId);
    if (!bet) {
      throw new Error('Bet not found');
    }
    Object.assign(bet, patch);
    this.emit('betUpdated', sanitizeBet(bet));
    return sanitizeBet(bet);
  }

  getBet(betId) {
    return this.bets.get(betId) || null;
  }

  listBets(filterFn = null) {
    const bets = Array.from(this.bets.values());
    return filterFn ? bets.filter(filterFn) : bets;
  }

  listSanitizedBets(filterFn = null) {
    return this.listBets(filterFn).map((bet) => sanitizeBet(bet));
  }

  getActiveBetForUser(userId) {
    return this.listBets(
      (bet) =>
        (bet.playerA.userId === userId || bet.playerB.userId === userId) &&
        (bet.status === 'waiting' || bet.status === 'playing')
    )[0] || null;
  }
}

module.exports = {
  DataStore,
  sanitizeUser,
  sanitizeBet
};
