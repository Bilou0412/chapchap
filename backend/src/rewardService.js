const DEFAULT_REWARD_AMOUNT = 50;

class RewardService {
  constructor({ store, rewardAmount = DEFAULT_REWARD_AMOUNT, expectedToken = process.env.REWARD_TOKEN || 'demo-token' }) {
    this.store = store;
    this.rewardAmount = rewardAmount;
    this.expectedToken = expectedToken;
  }

  validateToken(token) {
    return Boolean(token) && token === this.expectedToken;
  }

  grantReward(userId, { token }) {
    if (!this.validateToken(token)) {
      const error = new Error('Jeton de récompense invalide.');
      error.status = 403;
      throw error;
    }
    return this.store.adjustCoins(userId, this.rewardAmount, 'reward', { source: 'ad' });
  }
}

module.exports = {
  RewardService,
  DEFAULT_REWARD_AMOUNT
};
