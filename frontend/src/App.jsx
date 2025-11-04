import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from './context/SessionContext.jsx';
import './styles/App.scss';

function formatTime(remainingMs) {
  const totalSeconds = Math.max(0, Math.floor((remainingMs || 0) / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function App() {
  const {
    rooms,
    activeRoom,
    playerName,
    setPlayerName,
    createRoom,
    joinRoom,
    leaveRoom,
    startSession,
    resetSession,
    recordClick,
    error,
    isConnected
  } = useSession();

  const [nameInput, setNameInput] = useState(playerName);
  const [roomName, setRoomName] = useState('');

  useEffect(() => {
    setNameInput(playerName);
  }, [playerName]);

  const isRunning = activeRoom?.status === 'running';
  const isFinished = activeRoom?.status === 'finished';
  const timeRemaining = useMemo(() => formatTime(activeRoom?.remainingMs), [activeRoom?.remainingMs]);
  const currentClicks = activeRoom?.clicks ?? 0;

  const handleSaveName = (event) => {
    event.preventDefault();
    if (!nameInput?.trim()) return;
    setPlayerName(nameInput);
  };

  const handleCreateRoom = async (event) => {
    event.preventDefault();
    try {
      await createRoom(roomName.trim());
      setRoomName('');
    } catch (err) {
      // handled by context error state
      console.error(err); // eslint-disable-line no-console
    }
  };

  const handleJoinRoom = (roomId) => {
    joinRoom(roomId).catch((err) => {
      console.error(err); // eslint-disable-line no-console
    });
  };

  const handleStart = () => {
    startSession().catch((err) => {
      console.error(err); // eslint-disable-line no-console
    });
  };

  const handleReset = () => {
    resetSession().catch((err) => {
      console.error(err); // eslint-disable-line no-console
    });
  };

  const connectionLabel = isConnected ? 'Connecté' : 'Hors ligne';

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>Minute Click Challenge</h1>
          <p>
            Créez un salon, invitez vos amis sur le réseau local et lancez une session de 60 secondes pour cliquer le plus vite
            possible.
          </p>
        </div>
        <div className={`app__status-indicator app__status-indicator--${isConnected ? 'online' : 'offline'}`}>
          <span className="dot" />
          <span>{connectionLabel}</span>
        </div>
      </header>

      <main className="app__main">
        <section className="card card--identity">
          <h2>Votre pseudo</h2>
          <form className="form-inline" onSubmit={handleSaveName}>
            <input
              className="input"
              type="text"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder="Entrez votre pseudo"
            />
            <button type="submit" className="btn" disabled={!nameInput?.trim()}>
              Enregistrer
            </button>
          </form>
          {playerName ? <p className="helper">Pseudo actuel : {playerName}</p> : <p className="helper">Choisissez un pseudo pour rejoindre un salon.</p>}
        </section>

        <section className="card card--rooms">
          <div className="card__header">
            <h2>Salons disponibles</h2>
            <small>Rejoignez un salon ou créez-en un nouveau.</small>
          </div>
          <div className="rooms-list" data-testid="rooms-list">
            {rooms.length === 0 ? (
              <p className="empty">Aucun salon pour l'instant. Créez-en un !</p>
            ) : (
              rooms.map((room) => (
                <article key={room.id} className={`room ${activeRoom?.id === room.id ? 'room--active' : ''}`}>
                  <div className="room__main">
                    <h3>{room.name}</h3>
                    <div className="room__meta">
                      <span>{room.players.length} joueur(s)</span>
                      <span>Status : {room.status}</span>
                    </div>
                  </div>
                  <div className="room__actions">
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => handleJoinRoom(room.id)}
                      disabled={!playerName?.trim()}
                    >
                      Rejoindre
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
          <form className="form-inline" onSubmit={handleCreateRoom}>
            <input
              className="input"
              type="text"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder="Nom du salon"
            />
            <button type="submit" className="btn btn--primary" disabled={!roomName.trim()}>
              Créer un salon
            </button>
          </form>
        </section>

        <section className="card card--session">
          <div className="card__header">
            <h2>Session en cours</h2>
            <small>Rejoignez un salon puis lancez la partie.</small>
          </div>
          {activeRoom ? (
            <div className="session">
              <div className="session__info">
                <h3>{activeRoom.name}</h3>
                <div className="session__stats">
                  <div className="stat">
                    <span className="stat__label">Temps restant</span>
                    <span className="stat__value">{timeRemaining}</span>
                  </div>
                  <div className="stat">
                    <span className="stat__label">Clics</span>
                    <span className="stat__value" data-testid="click-count">
                      {currentClicks}
                    </span>
                  </div>
                </div>
              </div>

              <div className="session__players">
                <h4>Joueurs</h4>
                <ul>
                  {activeRoom.players.map((player) => (
                    <li key={player.id}>{player.name}</li>
                  ))}
                </ul>
              </div>

              <div className="session__actions">
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
                <button type="button" className="btn" onClick={handleReset} disabled={isRunning}>
                  Reset
                </button>
                <button type="button" className="btn btn--ghost" onClick={leaveRoom}>
                  Quitter le salon
                </button>
              </div>

              <div className="session__messages">
                {isFinished && (
                  <p className="info info--success">
                    Session terminée ! Score final : <strong>{currentClicks}</strong> clics.
                  </p>
                )}
                {error && <p className="info info--error">{error}</p>}
              </div>
            </div>
          ) : (
            <p className="empty">Rejoignez un salon pour voir les détails de la session.</p>
          )}
        </section>
      </main>

      <footer className="app__footer">
        <small>
          Astuce LAN : partagez l'adresse IP du serveur (ex. http://192.168.0.10:5173) et assurez-vous que le backend autorise
          cette origine via la variable d'environnement <code>CLIENT_ORIGIN</code>.
        </small>
      </footer>
    </div>
  );
}
