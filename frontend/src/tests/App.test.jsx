import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';
import { SessionProvider } from '../context/SessionContext.jsx';

class MockSocket {
  constructor(roomTemplate) {
    this.handlers = {};
    this.roomTemplate = roomTemplate;
    this.currentRoomId = null;
    this.clicks = 0;
    this.currentPlayers = roomTemplate.players || [];
  }

  on(event, handler) {
    this.handlers[event] = handler;
    if (event === 'connect') {
      setTimeout(() => {
        handler();
        const roomsHandler = this.handlers['rooms:update'];
        if (roomsHandler) {
          roomsHandler([this.createRoomPayload({})]);
        }
      }, 0);
    }
  }

  emit(event, payload) {
    if (event === 'joinRoom') {
      this.currentRoomId = payload.roomId;
      this.currentPlayers = [{ id: 'socket-1', name: payload.name }];
      const room = this.createRoomPayload({ players: this.currentPlayers });
      setTimeout(() => {
        this.handlers['room:joined']?.(room);
        this.handlers['room:update']?.(room);
      }, 0);
    }

    if (event === 'click') {
      this.clicks += 1;
      const room = this.createRoomPayload({
        status: 'running',
        clicks: this.clicks,
        remainingMs: 60000,
        players: this.currentPlayers
      });
      setTimeout(() => {
        this.handlers['room:update']?.(room);
      }, 0);
    }
  }

  createRoomPayload(overrides) {
    return { ...this.roomTemplate, players: this.currentPlayers, ...overrides };
  }

  disconnect() {}
}

describe('App', () => {
  const roomTemplate = {
    id: 'room-1',
    name: 'Salon test',
    status: 'waiting',
    durationMs: 60000,
    remainingMs: 60000,
    clicks: 0,
    players: []
  };

  beforeEach(() => {
    global.fetch = vi.fn((url, options) => {
      if (url.endsWith('/rooms') && (!options || options.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([roomTemplate])
        });
      }

      if (url.endsWith('/rooms/room-1/start')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...roomTemplate,
              status: 'running',
              players: [{ id: 'socket-1', name: 'Alice' }]
            })
        });
      }

      if (url.endsWith('/rooms/room-1/reset')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(roomTemplate)
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows joining a room and increasing the click counter', async () => {
    const user = userEvent.setup();
    const socketFactory = () => new MockSocket(roomTemplate);

    render(
      <SessionProvider apiBaseUrl="http://localhost:4000" socketFactory={socketFactory}>
        <App />
      </SessionProvider>
    );

    await screen.findByText('Salons disponibles');

    await user.type(screen.getByPlaceholderText('Entrez votre pseudo'), 'Alice');
    await user.click(screen.getByText('Enregistrer'));

    await user.click(screen.getByRole('button', { name: 'Rejoindre' }));

    await waitFor(() => expect(screen.getByText('Joueurs')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Start' }));

    const clickButton = await screen.findByTestId('click-button');
    await user.click(clickButton);

    await waitFor(() => expect(screen.getByTestId('click-count').textContent).toBe('1'));
  });
});
