import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { createApiClient, getApiBaseUrl } from './api/client';
import './styles/App.scss';

const REGIONS = [
  { value: 'euw1', label: 'EU West' },
  { value: 'eun1', label: 'EU Nordic & East' },
  { value: 'na1', label: 'North America' },
  { value: 'kr', label: 'Korea' },
  { value: 'br1', label: 'Brazil' },
  { value: 'la1', label: 'Latin America North' },
  { value: 'la2', label: 'Latin America South' },
  { value: 'oc1', label: 'Oceania' },
  { value: 'tr1', label: 'Turkey' },
  { value: 'ru', label: 'Russia' },
  { value: 'jp1', label: 'Japan' }
];

const AD_COUNTDOWN_SECONDS = 10;

function sortTransactions(transactions) {
  return [...transactions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function sortBets(bets) {
  return [...bets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export default function App() {
  const [storedIdentity, setStoredIdentity] = useState(() => {
    try {
      const raw = localStorage.getItem('chapchap_identity');
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('Failed to parse stored identity', error); // eslint-disable-line no-console
      return null;
    }
  });

  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [bets, setBets] = useState([]);
  const [activeTab, setActiveTab] = useState('bets');
  const [globalMessage, setGlobalMessage] = useState(null);

  const [nicknameInput, setNicknameInput] = useState(storedIdentity?.nickname || '');
  const [isRegistering, setIsRegistering] = useState(false);

  const [summonerName, setSummonerName] = useState('');
  const [region, setRegion] = useState('euw1');
  const [isLinking, setIsLinking] = useState(false);

  const [opponentNickname, setOpponentNickname] = useState('');
  const [betAmount, setBetAmount] = useState(50);
  const [betLoading, setBetLoading] = useState(false);

  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(0);

  const [isCheckingBets, setIsCheckingBets] = useState(false);

  const api = useMemo(() => {
    if (!storedIdentity?.id) {
      return null;
    }
    return createApiClient(storedIdentity.id);
  }, [storedIdentity]);

  useEffect(() => {
    if (!globalMessage) {
      return undefined;
    }
    const timeout = setTimeout(() => setGlobalMessage(null), 5000);
    return () => clearTimeout(timeout);
  }, [globalMessage]);

  useEffect(() => {
    if (!storedIdentity?.id) {
      setUser(null);
      setTransactions([]);
      return;
    }

    let cancelled = false;
    api
      .get('/api/me')
      .then((response) => {
        if (cancelled) return;
        setUser(response.data.user);
        setTransactions(sortTransactions(response.data.transactions));
      })
      .catch((error) => {
        console.error('Failed to fetch user profile', error); // eslint-disable-line no-console
        setGlobalMessage({ type: 'error', text: "Impossible de récupérer le profil." });
      });

    return () => {
      cancelled = true;
    };
  }, [api, storedIdentity]);

  useEffect(() => {
    if (!storedIdentity?.id) {
      return;
    }
    const socket = io(getApiBaseUrl(), {
      transports: ['websocket']
    });
    socket.emit('register', { userId: storedIdentity.id });
    socket.on('user:update', (payload) => {
      setUser(payload);
    });
    socket.on('coins:transaction', (transaction) => {
      setTransactions((previous) => sortTransactions([transaction, ...previous]));
    });
    socket.on('bets:update', (payload) => {
      setBets(sortBets(payload));
    });
    socket.on('bet:result', (payload) => {
      setBets((previous) => {
        const exists = previous.some((bet) => bet.id === payload.id);
        const next = exists
          ? previous.map((bet) => (bet.id === payload.id ? payload : bet))
          : [...previous, payload];
        return sortBets(next);
      });
      setGlobalMessage({ type: 'success', text: "Un pari vient d'être résolu automatiquement." });
    });
    socket.on('bet:refunded', (payload) => {
      setBets((previous) => {
        const exists = previous.some((bet) => bet.id === payload.id);
        const next = exists
          ? previous.map((bet) => (bet.id === payload.id ? payload : bet))
          : [...previous, payload];
        return sortBets(next);
      });
      setGlobalMessage({ type: 'info', text: "Un pari a été remboursé faute de match." });
    });
    return () => {
      socket.disconnect();
    };
  }, [storedIdentity]);

  useEffect(() => {
    if (!api) {
      return;
    }
    api
      .get('/api/bet/active')
      .then((response) => setBets(sortBets(response.data.bets)))
      .catch((error) => {
        console.error('Failed to load bets', error); // eslint-disable-line no-console
      });
  }, [api]);

  useEffect(() => {
    if (!isWatchingAd) {
      return;
    }
    if (adCountdown > 0) {
      const timeout = setTimeout(() => {
        setAdCountdown((value) => Math.max(0, value - 1));
      }, 1000);
      return () => clearTimeout(timeout);
    }
    if (adCountdown === 0) {
      api
        .post('/api/reward', { token: 'demo-token' })
        .then(() => {
          setGlobalMessage({ type: 'success', text: '+50 coins ajoutés à votre solde !' });
        })
        .catch((error) => {
          console.error('Reward failed', error); // eslint-disable-line no-console
          setGlobalMessage({ type: 'error', text: 'Impossible de valider la récompense.' });
        })
        .finally(() => {
          setIsWatchingAd(false);
        });
    }
  }, [adCountdown, api, isWatchingAd]);

  const handleRegister = async (event) => {
    event.preventDefault();
    if (!nicknameInput.trim()) {
      setGlobalMessage({ type: 'error', text: 'Choisissez un pseudo pour continuer.' });
      return;
    }
    setIsRegistering(true);
    try {
      const response = await createApiClient().post('/api/auth/guest', { nickname: nicknameInput.trim() });
      const identity = { id: response.data.user.id, nickname: response.data.user.nickname };
      localStorage.setItem('chapchap_identity', JSON.stringify(identity));
      setStoredIdentity(identity);
      setGlobalMessage({ type: 'success', text: 'Profil créé avec succès !' });
    } catch (error) {
      console.error('Registration failed', error); // eslint-disable-line no-console
      const message = error.response?.data?.message || "Impossible de créer ce pseudo.";
      setGlobalMessage({ type: 'error', text: message });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleLinkRiot = async (event) => {
    event.preventDefault();
    if (!api) {
      return;
    }
    if (!summonerName.trim()) {
      setGlobalMessage({ type: 'error', text: 'Indiquez un pseudo League of Legends.' });
      return;
    }
    setIsLinking(true);
    try {
      const response = await api.post('/api/riot/link', { summonerName: summonerName.trim(), region });
      setUser(response.data.user);
      setGlobalMessage({ type: 'success', text: 'Compte Riot lié avec succès.' });
    } catch (error) {
      console.error('Link failed', error); // eslint-disable-line no-console
      const message = error.response?.data?.message || "Impossible de lier ce compte Riot.";
      setGlobalMessage({ type: 'error', text: message });
    } finally {
      setIsLinking(false);
    }
  };

  const handleWatchAd = () => {
    if (!api || isWatchingAd) {
      return;
    }
    setAdCountdown(AD_COUNTDOWN_SECONDS);
    setIsWatchingAd(true);
  };

  const handleCreateBet = async (event) => {
    event.preventDefault();
    if (!api) {
      return;
    }
    const normalizedNickname = opponentNickname.trim();
    if (!normalizedNickname) {
      setGlobalMessage({ type: 'error', text: "Le pseudo de l'adversaire est requis." });
      return;
    }
    const wager = Number(betAmount);
    if (!Number.isFinite(wager) || wager <= 0) {
      setGlobalMessage({ type: 'error', text: 'Montant invalide.' });
      return;
    }
    setBetLoading(true);
    try {
      await api.post('/api/bet/create', {
        opponentNickname: normalizedNickname,
        amount: wager
      });
      setOpponentNickname('');
      setGlobalMessage({ type: 'success', text: 'Pari créé, en attente de validation.' });
    } catch (error) {
      console.error('Create bet failed', error); // eslint-disable-line no-console
      const message = error.response?.data?.message || 'Impossible de créer ce pari.';
      setGlobalMessage({ type: 'error', text: message });
    } finally {
      setBetLoading(false);
    }
  };

  const handleAcceptBet = async (betId) => {
    if (!api) {
      return;
    }
    setBetLoading(true);
    try {
      await api.post('/api/bet/accept', { betId });
      setGlobalMessage({ type: 'success', text: 'Pari accepté, jouez votre prochain match !' });
    } catch (error) {
      console.error('Accept bet failed', error); // eslint-disable-line no-console
      const message = error.response?.data?.message || 'Impossible de rejoindre ce pari.';
      setGlobalMessage({ type: 'error', text: message });
    } finally {
      setBetLoading(false);
    }
  };

  const handleManualCheck = async () => {
    if (!api) {
      return;
    }
    setIsCheckingBets(true);
    try {
      const response = await api.post('/api/bet/check');
      if ((response.data.updates || []).length === 0) {
        setGlobalMessage({ type: 'info', text: 'Aucun nouveau résultat pour le moment.' });
      }
    } catch (error) {
      console.error('Manual bet check failed', error); // eslint-disable-line no-console
      setGlobalMessage({ type: 'error', text: 'Erreur lors de la vérification des paris.' });
    } finally {
      setIsCheckingBets(false);
    }
  };

  const waitingBets = bets.filter((bet) => bet.status === 'waiting');
  const playingBets = bets.filter((bet) => bet.status === 'playing');
  const finishedBets = bets.filter((bet) => bet.status === 'finished' || bet.status === 'expired');

  const canCreateBet = Boolean(user?.riot?.puuid);
  const canWatchAd = Boolean(api) && !isWatchingAd;

  return (
    <div className="app">
      <header className="app__header">
        <div className="brand">
          <h1>ChapChap — League Bets</h1>
          <p>Pariez vos coins sur vos victoires League of Legends et laissez le serveur vérifier automatiquement les résultats.</p>
        </div>
        {user && (
          <div className="wallet">
            <span className="wallet__label">Solde</span>
            <span className="wallet__amount">{user.coins ?? 0} coins</span>
            <button type="button" className="btn btn--ghost" onClick={handleWatchAd} disabled={!canWatchAd}>
              {isWatchingAd ? `🎥 Pub (${adCountdown}s)` : '🎥 Regarder une pub (+50)'}
            </button>
          </div>
        )}
      </header>

      {globalMessage && (
        <div className={`alert alert--${globalMessage.type}`} role="status">
          {globalMessage.text}
        </div>
      )}

      {!storedIdentity?.id ? (
        <section className="card card--center">
          <h2>Créez votre profil ChapChap</h2>
          <p>Choisissez un pseudo unique pour rejoindre la plateforme de paris.</p>
          <form className="form" onSubmit={handleRegister}>
            <label className="form__label" htmlFor="nickname">
              Pseudo
            </label>
            <input
              id="nickname"
              className="input"
              value={nicknameInput}
              onChange={(event) => setNicknameInput(event.target.value)}
              placeholder="Votre pseudo LAN"
            />
            <button type="submit" className="btn btn--primary" disabled={isRegistering}>
              {isRegistering ? 'Création…' : 'Créer mon profil'}
            </button>
          </form>
        </section>
      ) : (
        <main className="layout">
          <aside className="sidebar">
            <button
              type="button"
              className={`tab ${activeTab === 'bets' ? 'tab--active' : ''}`}
              onClick={() => setActiveTab('bets')}
            >
              ⚔️ Paris LoL
            </button>
            <button
              type="button"
              className={`tab ${activeTab === 'profile' ? 'tab--active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              👤 Mon profil
            </button>
          </aside>

          <section className="content">
            {activeTab === 'profile' && (
              <div className="panel">
                <h2>Profil joueur</h2>
                <div className="panel__section">
                  <h3>Informations générales</h3>
                  <dl className="definition">
                    <div>
                      <dt>Pseudo</dt>
                      <dd>{user?.nickname}</dd>
                    </div>
                    <div>
                      <dt>Coins</dt>
                      <dd>{user?.coins ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Compte Riot</dt>
                      <dd>{user?.riot?.summonerName ? `${user.riot.summonerName} (${user.riot.region})` : 'Non lié'}</dd>
                    </div>
                    <div>
                      <dt>Cooldown</dt>
                      <dd>
                        {user?.cooldownEndsAt
                          ? `Prochain pari possible à ${new Date(user.cooldownEndsAt).toLocaleTimeString()}`
                          : 'Disponible'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="panel__section">
                  <h3>Lier mon compte Riot</h3>
                  <form className="form form--inline" onSubmit={handleLinkRiot}>
                    <input
                      className="input"
                      placeholder="Pseudo Riot exact"
                      value={summonerName}
                      onChange={(event) => setSummonerName(event.target.value)}
                    />
                    <select className="input" value={region} onChange={(event) => setRegion(event.target.value)}>
                      {REGIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="btn btn--primary" disabled={isLinking}>
                      {isLinking ? 'Lien…' : 'Lier mon compte'}
                    </button>
                  </form>
                  <p className="helper">
                    Vos paris seront suivis automatiquement grâce à l&apos;API Riot Games. Assurez-vous que votre pseudo est exact.
                  </p>
                </div>

                <div className="panel__section">
                  <h3>Historique des transactions</h3>
                  {transactions.length === 0 ? (
                    <p className="empty">Aucune transaction pour le moment.</p>
                  ) : (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Montant</th>
                          <th>Solde</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((transaction) => (
                          <tr key={transaction.id}>
                            <td>{new Date(transaction.timestamp).toLocaleString()}</td>
                            <td>{transaction.type}</td>
                            <td>{transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount}</td>
                            <td>{transaction.balanceAfter}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'bets' && (
              <div className="panel">
                <div className="panel__section">
                  <h2>Créer un pari LoL</h2>
                  <form className="form" onSubmit={handleCreateBet}>
                    <label className="form__label" htmlFor="opponent">
                      Pseudo de l&apos;adversaire
                    </label>
                    <input
                      id="opponent"
                      className="input"
                      placeholder="Pseudo ChapChap de votre adversaire"
                      value={opponentNickname}
                      onChange={(event) => setOpponentNickname(event.target.value)}
                      disabled={!canCreateBet}
                    />
                    <label className="form__label" htmlFor="amount">
                      Mise (coins)
                    </label>
                    <input
                      id="amount"
                      type="number"
                      min="1"
                      className="input"
                      value={betAmount}
                      onChange={(event) => setBetAmount(event.target.value)}
                      disabled={!canCreateBet}
                    />
                    {!canCreateBet && (
                      <p className="helper helper--warning">
                        Liez votre compte Riot pour pouvoir parier.
                      </p>
                    )}
                    <button type="submit" className="btn btn--primary" disabled={!canCreateBet || betLoading}>
                      {betLoading ? 'Validation…' : 'Créer le pari'}
                    </button>
                  </form>
                </div>

                <div className="panel__section">
                  <div className="panel__header">
                    <h3>Paris en attente</h3>
                    <button type="button" className="btn btn--ghost" onClick={handleManualCheck} disabled={isCheckingBets}>
                      {isCheckingBets ? 'Vérification…' : '🔄 Rafraîchir'}
                    </button>
                  </div>
                  {waitingBets.length === 0 ? (
                    <p className="empty">Aucun pari en attente.</p>
                  ) : (
                    <ul className="bet-list">
                      {waitingBets.map((bet) => (
                        <li key={bet.id} className="bet-card">
                          <div>
                            <strong>{bet.playerA.nickname}</strong> défie <strong>{bet.playerB.nickname}</strong>
                          </div>
                          <div className="bet-card__meta">
                            <span>Mise : {bet.playerA.bet} coins</span>
                            <span>Créé le {new Date(bet.createdAt).toLocaleString()}</span>
                          </div>
                          {user?.id === bet.playerB.userId && (
                            <button
                              type="button"
                              className="btn btn--accent"
                              onClick={() => handleAcceptBet(bet.id)}
                              disabled={betLoading}
                            >
                              Accepter le pari
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="panel__section">
                  <h3>Paris en cours</h3>
                  {playingBets.length === 0 ? (
                    <p className="empty">Aucun pari en cours.</p>
                  ) : (
                    <ul className="bet-list">
                      {playingBets.map((bet) => (
                        <li key={bet.id} className="bet-card bet-card--active">
                          <div>
                            Match en attente : <strong>{bet.playerA.nickname}</strong> vs <strong>{bet.playerB.nickname}</strong>
                          </div>
                          <div className="bet-card__meta">
                            <span>Pot total : {bet.totalPool} coins</span>
                            <span>Début : {new Date(bet.startedAt).toLocaleString()}</span>
                            <span>Expiration : {bet.expiresAt ? new Date(bet.expiresAt).toLocaleTimeString() : '—'}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="panel__section">
                  <h3>Historique des paris</h3>
                  {finishedBets.length === 0 ? (
                    <p className="empty">Aucun résultat de pari pour le moment.</p>
                  ) : (
                    <ul className="bet-list">
                      {finishedBets.map((bet) => (
                        <li key={bet.id} className="bet-card bet-card--finished">
                          <div>
                            {bet.status === 'expired' && bet.outcome === 'refunded' ? (
                              <span>Pari remboursé — aucun match détecté.</span>
                            ) : (
                              <span>
                                Match {bet.matchId || 'inconnu'} :{' '}
                                {bet.outcome === 'draw'
                                  ? 'égalité, chacun récupère sa mise.'
                                  : bet.winner === user?.id
                                  ? 'Vous avez gagné !'
                                  : 'Défaite.'}
                              </span>
                            )}
                          </div>
                          <div className="bet-card__meta">
                            <span>
                              {bet.playerA.nickname} vs {bet.playerB.nickname}
                            </span>
                            <span>Pot : {bet.totalPool} coins</span>
                            <span>Terminé le {bet.completedAt ? new Date(bet.completedAt).toLocaleString() : '—'}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
