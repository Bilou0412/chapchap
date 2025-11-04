const axios = require('axios');

const REGION_HOSTS = {
  br1: 'americas',
  eun1: 'europe',
  euw1: 'europe',
  jp1: 'asia',
  kr: 'asia',
  la1: 'americas',
  la2: 'americas',
  na1: 'americas',
  oc1: 'sea',
  tr1: 'europe',
  ru: 'europe'
};

class RiotService {
  constructor({ apiKey, httpClient = axios.create() } = {}) {
    this.apiKey = apiKey || process.env.RIOT_API_KEY || '';
    this.http = httpClient;
  }

  getRegionalHost(region) {
    const normalized = (region || '').toLowerCase();
    return REGION_HOSTS[normalized] || REGION_HOSTS.euw1;
  }

  async fetchSummonerByName({ summonerName, region }) {
    if (!summonerName || !region) {
      throw new Error('Summoner name and region are required');
    }
    const host = `${region}.api.riotgames.com`;
    const url = `https://${host}/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`;
    const response = await this.http.get(url, this.buildHeaders());
    return response.data;
  }

  async getRecentMatches(puuid, region, count = 10) {
    if (!puuid) {
      throw new Error('puuid is required');
    }
    const routing = this.getRegionalHost(region);
    const url = `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids`;
    const response = await this.http.get(url, {
      ...this.buildHeaders(),
      params: { start: 0, count }
    });
    return response.data;
  }

  async getMatchDetails(matchId, region) {
    if (!matchId) {
      throw new Error('matchId is required');
    }
    const routing = this.getRegionalHost(region);
    const url = `https://${routing}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
    const response = await this.http.get(url, this.buildHeaders());
    return response.data;
  }

  getMatchOutcome(matchData, puuid) {
    if (!matchData || !matchData.info || !Array.isArray(matchData.info.participants)) {
      throw new Error('Invalid match data');
    }
    const participant = matchData.info.participants.find((p) => p.puuid === puuid);
    if (!participant) {
      return 'unknown';
    }
    return participant.win ? 'win' : 'loss';
  }

  buildHeaders() {
    if (!this.apiKey) {
      return {};
    }
    return {
      headers: {
        'X-Riot-Token': this.apiKey
      }
    };
  }
}

module.exports = {
  RiotService
};
