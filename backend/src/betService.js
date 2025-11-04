const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const { sanitizeBet } = require('./dataStore');

const BET_STATUS = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished',
  EXPIRED: 'expired'
};

const OUTCOME = {
  PLAYER_A: 'playerA',
  PLAYER_B: 'playerB',
  DRAW: 'draw',
  REFUNDED: 'refunded'
};

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

class BetService extends EventEmitter {
  constructor({ store, riotService }) {
    super();
    this.store = store;
    this.riotService = riotService;
  }

  listBets() {
    return this.store.listSanitizedBets();
  }

  getBet(betId) {
    const bet = this.store.getBet(betId);
    return bet ? sanitizeBet(bet) : null;
  }

  assertUserReady(user) {
    if (!user) {
      throw new Error('User introuvable');
    }
    if (!user.riot || !user.riot.puuid) {
      throw new Error('Le joueur doit lier son compte Riot avant de parier.');
    }
  }

  ensureCooldown(user) {
    if (!user.cooldownEndsAt) {
      return;
    }
    const now = Date.now();
    if (new Date(user.cooldownEndsAt).getTime() > now) {
      throw new Error('Ce joueur est encore en cooldown avant un nouveau pari.');
    }
  }

  ensureNoActiveBet(userId) {
    const active = this.store.getActiveBetForUser(userId);
    if (active) {
      throw new Error("Ce joueur participe déjà à un pari en attente ou en cours.");
    }
  }

  async createBet({ creator, opponent, amount }) {
    this.assertUserReady(creator);
    this.assertUserReady(opponent);
    this.ensureCooldown(creator);
    this.ensureCooldown(opponent);
    this.ensureNoActiveBet(creator.id);
    this.ensureNoActiveBet(opponent.id);

    const wager = Number(amount);
    if (!Number.isFinite(wager) || wager <= 0) {
      throw new Error('Montant invalide.');
    }

    if (creator.coins < wager) {
      throw new Error("Solde insuffisant pour créer ce pari.");
    }

    if (opponent.coins < wager) {
      throw new Error("L'adversaire n'a pas assez de coins pour ce pari.");
    }

    this.store.adjustCoins(creator.id, -wager, 'bet', { betAction: 'create' });

    const now = new Date();
    const bet = {
      id: uuidv4(),
      status: BET_STATUS.WAITING,
      createdAt: now.toISOString(),
      startedAt: null,
      completedAt: null,
      expiresAt: null,
      totalPool: wager,
      matchId: null,
      winner: null,
      outcome: null,
      playerA: {
        userId: creator.id,
        nickname: creator.nickname,
        bet: wager,
        riot: creator.riot,
        baselineMatches: [],
        processedMatches: []
      },
      playerB: {
        userId: opponent.id,
        nickname: opponent.nickname,
        bet: wager,
        riot: opponent.riot,
        baselineMatches: [],
        processedMatches: []
      }
    };

    this.store.addBet(bet);
    this.emit('betCreated', sanitizeBet(bet));
    return sanitizeBet(bet);
  }

  async acceptBet({ betId, user }) {
    const bet = this.store.getBet(betId);
    if (!bet) {
      throw new Error('Pari introuvable.');
    }
    if (bet.status !== BET_STATUS.WAITING) {
      throw new Error('Ce pari n\'est plus disponible.');
    }

    if (bet.playerB.userId !== user.id) {
      throw new Error('Seul le joueur ciblé peut accepter ce pari.');
    }

    this.assertUserReady(user);
    this.ensureCooldown(user);
    this.ensureNoActiveBet(user.id);

    if (user.coins < bet.playerB.bet) {
      throw new Error('Solde insuffisant pour accepter ce pari.');
    }

    this.store.adjustCoins(user.id, -bet.playerB.bet, 'bet', { betAction: 'accept', betId: bet.id });

    const now = new Date();
    bet.status = BET_STATUS.PLAYING;
    bet.startedAt = now.toISOString();
    bet.expiresAt = new Date(now.getTime() + ONE_HOUR_MS).toISOString();
    bet.totalPool = bet.playerA.bet + bet.playerB.bet;

    try {
      bet.playerA.baselineMatches = await this.riotService.getRecentMatches(
        bet.playerA.riot.puuid,
        bet.playerA.riot.region
      );
      bet.playerB.baselineMatches = await this.riotService.getRecentMatches(
        bet.playerB.riot.puuid,
        bet.playerB.riot.region
      );
    } catch (error) {
      throw new Error("Échec de la récupération des matchs Riot. Vérifiez la clé API.");
    }

    this.store.updateBet(bet.id, bet);
    this.emit('betAccepted', sanitizeBet(bet));
    return sanitizeBet(bet);
  }

  async checkActiveBets() {
    const bets = this.store.listBets((bet) => bet.status === BET_STATUS.PLAYING);
    const updates = [];
    for (const bet of bets) {
      try {
        const result = await this.evaluateBet(bet);
        if (result) {
          updates.push(result);
        }
      } catch (error) {
        this.emit('betCheckFailed', { betId: bet.id, error: error.message });
      }
    }
    return updates;
  }

  async evaluateBet(bet) {
    const now = Date.now();
    const expiresAt = bet.expiresAt ? new Date(bet.expiresAt).getTime() : null;

    const [playerAMatches, playerBMatches] = await Promise.all([
      this.riotService.getRecentMatches(bet.playerA.riot.puuid, bet.playerA.riot.region),
      this.riotService.getRecentMatches(bet.playerB.riot.puuid, bet.playerB.riot.region)
    ]);

    const newMatches = playerAMatches
      .filter((matchId) => !bet.playerA.baselineMatches.includes(matchId))
      .filter((matchId) => playerBMatches.includes(matchId))
      .filter((matchId) => !bet.playerA.processedMatches.includes(matchId));

    if (newMatches.length === 0) {
      if (expiresAt && expiresAt < now) {
        return this.refundBet(bet, 'Aucun match trouvé dans la fenêtre impartie.');
      }
      return null;
    }

    const matchId = newMatches[0];
    const matchData = await this.riotService.getMatchDetails(matchId, bet.playerA.riot.region);
    const outcomeA = this.riotService.getMatchOutcome(matchData, bet.playerA.riot.puuid);
    const outcomeB = this.riotService.getMatchOutcome(matchData, bet.playerB.riot.puuid);

    bet.playerA.processedMatches.push(matchId);
    bet.playerB.processedMatches.push(matchId);

    if (outcomeA === 'unknown' || outcomeB === 'unknown') {
      return null;
    }

    if (outcomeA === outcomeB) {
      return this.drawBet(bet, matchId);
    }

    const winner = outcomeA === 'win' ? OUTCOME.PLAYER_A : OUTCOME.PLAYER_B;
    return this.resolveBet(bet, matchId, winner);
  }

  drawBet(bet, matchId) {
    bet.status = BET_STATUS.FINISHED;
    bet.completedAt = new Date().toISOString();
    bet.matchId = matchId;
    bet.outcome = OUTCOME.DRAW;
    this.store.adjustCoins(bet.playerA.userId, bet.playerA.bet, 'refund', { betId: bet.id, reason: 'draw' });
    this.store.adjustCoins(bet.playerB.userId, bet.playerB.bet, 'refund', { betId: bet.id, reason: 'draw' });
    this.applyCooldown(bet.playerA.userId);
    this.applyCooldown(bet.playerB.userId);
    this.store.updateBet(bet.id, bet);
    this.emit('betResolved', sanitizeBet(bet));
    return sanitizeBet(bet);
  }

  resolveBet(bet, matchId, winnerOutcome) {
    bet.status = BET_STATUS.FINISHED;
    bet.completedAt = new Date().toISOString();
    bet.matchId = matchId;
    bet.outcome = winnerOutcome;
    bet.winner = winnerOutcome === OUTCOME.PLAYER_A ? bet.playerA.userId : bet.playerB.userId;

    if (winnerOutcome === OUTCOME.PLAYER_A) {
      this.store.adjustCoins(bet.playerA.userId, bet.totalPool, 'win', { betId: bet.id, matchId });
      this.store.adjustCoins(bet.playerB.userId, 0, 'loss', { betId: bet.id, matchId });
    } else {
      this.store.adjustCoins(bet.playerB.userId, bet.totalPool, 'win', { betId: bet.id, matchId });
      this.store.adjustCoins(bet.playerA.userId, 0, 'loss', { betId: bet.id, matchId });
    }

    this.applyCooldown(bet.playerA.userId);
    this.applyCooldown(bet.playerB.userId);

    this.store.updateBet(bet.id, bet);
    this.emit('betResolved', sanitizeBet(bet));
    return sanitizeBet(bet);
  }

  refundBet(bet, reason) {
    bet.status = BET_STATUS.EXPIRED;
    bet.completedAt = new Date().toISOString();
    bet.outcome = OUTCOME.REFUNDED;
    bet.winner = null;
    this.store.adjustCoins(bet.playerA.userId, bet.playerA.bet, 'refund', { betId: bet.id, reason });
    this.store.adjustCoins(bet.playerB.userId, bet.playerB.bet, 'refund', { betId: bet.id, reason });
    this.applyCooldown(bet.playerA.userId);
    this.applyCooldown(bet.playerB.userId);
    this.store.updateBet(bet.id, bet);
    this.emit('betRefunded', sanitizeBet(bet));
    return sanitizeBet(bet);
  }

  applyCooldown(userId) {
    const user = this.store.getUserInternal(userId);
    if (!user) {
      return;
    }
    const now = Date.now();
    user.lastBetAt = new Date(now).toISOString();
    user.cooldownEndsAt = new Date(now + FIVE_MINUTES_MS).toISOString();
    this.store.updateUser(userId, {});
  }
}

module.exports = {
  BetService,
  BET_STATUS,
  OUTCOME
};
