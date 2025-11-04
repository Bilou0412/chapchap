const { jest } = require('@jest/globals');
const { DataStore } = require('../src/dataStore');
const { BetService, BET_STATUS, OUTCOME } = require('../src/betService');

function createMockRiotService({
  matches = [],
  matchDetails = {},
  outcomes = {}
} = {}) {
  return {
    getRecentMatches: jest.fn(async (puuid) => matches[puuid] || []),
    getMatchDetails: jest.fn(async (matchId) => matchDetails[matchId]),
    getMatchOutcome: jest.fn((match, puuid) => outcomes[`${match.metadata.matchId}:${puuid}`])
  };
}

describe('BetService', () => {
  let store;
  beforeEach(() => {
    store = new DataStore();
  });

  test('resolves a bet when a shared match is found', async () => {
    const playerA = store.createUser('Alice');
    const playerB = store.createUser('Bob');

    store.updateUser(playerA.id, {
      riot: { puuid: 'pa', region: 'euw1' }
    });
    store.updateUser(playerB.id, {
      riot: { puuid: 'pb', region: 'euw1' }
    });

    store.adjustCoins(playerA.id, 200, 'reward');
    store.adjustCoins(playerB.id, 200, 'reward');

    const mockService = createMockRiotService({
      matches: {
        pa: ['match-1'],
        pb: ['match-1']
      },
      matchDetails: {
        'match-1': {
          metadata: { matchId: 'match-1' },
          info: { participants: [] }
        }
      },
      outcomes: {
        'match-1:pa': 'win',
        'match-1:pb': 'loss'
      }
    });

    const betService = new BetService({ store, riotService: mockService });
    const bet = await betService.createBet({ creator: store.getUserById(playerA.id), opponent: store.getUserById(playerB.id), amount: 50 });
    await betService.acceptBet({ betId: bet.id, user: store.getUserById(playerB.id) });

    const updates = await betService.checkActiveBets();
    expect(updates).toHaveLength(1);
    const updatedBet = updates[0];
    expect(updatedBet.status).toBe(BET_STATUS.FINISHED);
    expect(updatedBet.outcome).toBe(OUTCOME.PLAYER_A);
    expect(store.getUserById(playerA.id).coins).toBeGreaterThan(store.getUserById(playerB.id).coins);
  });

  test('refunds bet when expired', async () => {
    const playerA = store.createUser('Alice');
    const playerB = store.createUser('Bob');

    store.updateUser(playerA.id, {
      riot: { puuid: 'pa', region: 'euw1' }
    });
    store.updateUser(playerB.id, {
      riot: { puuid: 'pb', region: 'euw1' }
    });

    store.adjustCoins(playerA.id, 200, 'reward');
    store.adjustCoins(playerB.id, 200, 'reward');

    const mockService = createMockRiotService({ matches: { pa: [], pb: [] } });
    const betService = new BetService({ store, riotService: mockService });

    const bet = await betService.createBet({ creator: store.getUserById(playerA.id), opponent: store.getUserById(playerB.id), amount: 50 });
    const accepted = await betService.acceptBet({ betId: bet.id, user: store.getUserById(playerB.id) });
    const internalBet = store.getBet(accepted.id);
    internalBet.expiresAt = new Date(Date.now() - 1000).toISOString();

    await betService.checkActiveBets();
    const result = betService.getBet(bet.id);
    expect(result.status).toBe(BET_STATUS.EXPIRED);
    expect(result.outcome).toBe(OUTCOME.REFUNDED);
  });
});
