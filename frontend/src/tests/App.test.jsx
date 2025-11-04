import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';
import { SessionProvider } from '../context/SessionContext.jsx';

class MockSocket {
  constructor() {
    this.handlers = {};
    this.emitted = [];
    this.clicks = 0;
  }

  on(event, handler) {
    this.handlers[event] = handler;
    if (event === 'connect') {
      setTimeout(() => handler(), 0);
    }
  }

  emit(event, payload) {
    this.emitted.push({ event, payload });
    if (event === 'joinSession') {
      setTimeout(() => {
        this.handlers['session:update']?.({
          id: payload.sessionId,
          clicks: this.clicks,
          status: 'running',
          remainingMs: 60000,
          durationMs: 60000
        });
      }, 0);
    }

    if (event === 'click') {
      this.clicks += 1;
      setTimeout(() => {
        this.handlers['session:update']?.({
          id: payload.sessionId,
          clicks: this.clicks,
          status: 'running',
          remainingMs: 60000,
          durationMs: 60000
        });
      }, 0);
    }
  }

  disconnect() {}
}

const socketFactory = () => new MockSocket();

describe('App', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sessionId: 'test-session', durationSeconds: 60 })
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('increments counter when clicking during session', async () => {
    const user = userEvent.setup();

    render(
      <SessionProvider apiBaseUrl="http://localhost:4000" socketFactory={socketFactory}>
        <App />
      </SessionProvider>
    );

    await user.click(screen.getByText('Start'));

    await waitFor(() => expect(screen.getByTestId('session-id').textContent).toContain('test-session'));

    const clickButton = await screen.findByTestId('click-button');

    await user.click(clickButton);

    await waitFor(() => expect(screen.getByTestId('click-count').textContent).toBe('1'));
  });
});
