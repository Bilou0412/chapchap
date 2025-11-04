import React, { useState } from 'react';
import { useSession } from './session/SessionProvider.jsx';
import './App.css';

const formatTime = (seconds) => {
  const safeValue = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeValue / 60)
    .toString()
    .padStart(2, '0');
  const secs = (safeValue % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
};

export default function App() {
  const { session, startSession, joinSession, registerClick, resetSession } = useSession();
  const [joinValue, setJoinValue] = useState('');
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      await startSession();
    } catch (error) {
      console.error(error);
    } finally {
      setStarting(false);
    }
  };

  const handleJoin = (event) => {
    event.preventDefault();
    if (!joinValue.trim()) return;
    joinSession(joinValue.trim());
  };

  const handleReset = () => {
    resetSession();
    setJoinValue('');
  };

  const isRunning = session.status === 'running';
  const isFinished = session.status === 'finished';

  return (
    <div className="app">
      <header className="app__header">
        <h1>Minute Click Challenge</h1>
        <p>Start a new session or join one using its identifier to play together.</p>
      </header>

      <section className="app__controls">
        <button onClick={handleStart} disabled={starting || isRunning} className="primary">
          {isRunning ? 'Session running' : 'Start'}
        </button>
        <form onSubmit={handleJoin} className="join-form">
          <input
            type="text"
            placeholder="Session ID"
            value={joinValue}
            onChange={(event) => setJoinValue(event.target.value)}
          />
          <button type="submit">Join</button>
        </form>
        <button onClick={handleReset} className="secondary">Reset</button>
      </section>

      {session.error && <div className="alert">{session.error}</div>}

      <section className="app__status">
        <div className="status-card">
          <span className="label">Time remaining</span>
          <span className="value" data-testid="time-remaining">
            {formatTime(session.remainingSeconds)}
          </span>
        </div>
        <div className="status-card">
          <span className="label">Total clicks</span>
          <span className="value" data-testid="total-clicks">{session.clicks}</span>
        </div>
        <div className="status-card">
          <span className="label">Session ID</span>
          <span className="value value--mono">{session.sessionId || 'No session yet'}</span>
        </div>
      </section>

      <button className="click-button" onClick={registerClick} disabled={!isRunning}>
        Click!
      </button>

      {isFinished && (
        <div className="result">
          <h2>Time&apos;s up!</h2>
          <p>You clicked {session.clicks} times in a minute.</p>
        </div>
      )}
    </div>
  );
}
