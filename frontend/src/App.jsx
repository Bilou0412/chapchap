import React, { useMemo, useState } from 'react';
import { useSession } from './context/SessionContext.jsx';
import './styles/App.scss';

function formatTime(remainingMs) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function App() {
  const { session, startSession, joinSession, recordClick, reset, error, isConnected } = useSession();
  const [joinId, setJoinId] = useState('');

  const isRunning = session?.status === 'running';
  const hasSession = Boolean(session?.id);
  const clicks = session?.clicks ?? 0;
  const timeRemaining = useMemo(() => formatTime(session?.remainingMs ?? 60000), [session?.remainingMs]);

  const handleStart = async () => {
    try {
      await startSession();
      setJoinId('');
    } catch (err) {
      console.error(err); // eslint-disable-line no-console
    }
  };

  const handleReset = () => {
    reset();
  };

  const handleJoin = async (event) => {
    event.preventDefault();
    if (!joinId.trim()) return;
    try {
      await joinSession(joinId.trim());
      setJoinId('');
    } catch (err) {
      console.error(err); // eslint-disable-line no-console
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>Minute Click Challenge</h1>
        <p>Appuyez sur « Start » pour démarrer une session de 60 secondes ou rejoignez une session existante.</p>
      </header>
      <main className="app__main">
        <div className="app__status">
          <div className="status-card">
            <span className="status-card__label">Temps restant</span>
            <span className="status-card__value">{hasSession ? timeRemaining : '00:00'}</span>
          </div>
          <div className="status-card">
            <span className="status-card__label">Clics</span>
            <span className="status-card__value" data-testid="click-count">{clicks}</span>
          </div>
        </div>

        <form className="app__join" onSubmit={handleJoin}>
          <label htmlFor="joinId" className="app__join-label">
            Rejoindre une session existante
          </label>
          <div className="app__join-controls">
            <input
              id="joinId"
              type="text"
              placeholder="Session ID"
              value={joinId}
              onChange={(event) => setJoinId(event.target.value)}
              className="input"
            />
            <button type="submit" className="btn" disabled={!joinId.trim()}>
              Join
            </button>
          </div>
        </form>

        <div className="app__actions">
          <button type="button" className="btn btn--primary" onClick={handleStart} disabled={isRunning}>
            Start
          </button>
          <button
            type="button"
            className="btn btn--accent"
            onClick={recordClick}
            disabled={!isRunning}
            data-testid="click-button"
          >
            Click!
          </button>
          <button type="button" className="btn" onClick={handleReset} disabled={!hasSession || isRunning}>
            Reset
          </button>
        </div>

        <div className="app__info">
          {!isConnected && hasSession && <p className="info info--warning">Connexion temps réel en attente…</p>}
          {session?.status === 'finished' && (
            <p className="info info--success">
              Session terminée ! Score final : <strong>{session.clicks}</strong> clics.
            </p>
          )}
          {error && <p className="info info--error">{error}</p>}
        </div>
      </main>
      <footer className="app__footer">
        <small>Multi-utilisateur : partagez l'identifiant de session pour collaborer en temps réel.</small>
        {session?.id && (
          <small className="session-id" data-testid="session-id">Session ID : {session.id}</small>
        )}
      </footer>
    </div>
  );
}
