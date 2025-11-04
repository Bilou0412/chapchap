import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./socket.js', () => {
  const listeners = {};
  const socket = {
    on: vi.fn((event, callback) => {
      listeners[event] = callback;
    }),
    off: vi.fn((event) => {
      delete listeners[event];
    }),
    emit: vi.fn(),
    disconnect: vi.fn()
  };

  return {
    createSocket: vi.fn(() => socket),
    __socket: socket,
    __listeners: listeners
  };
});

import App from './App.jsx';
import { __listeners, __socket } from './socket.js';

describe('App', () => {
  beforeEach(() => {
    global.fetch = vi.fn((url, options = {}) => {
      if (url.includes('/session/') && url.endsWith('/result')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ sessionId: 'abc', clicks: 1, finishedAt: Date.now() })
        });
      }

      if (url.includes('/session') && options.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            sessionId: 'abc',
            status: 'running',
            clicks: 0,
            remainingMs: 60000
          })
        });
      }

      if (url.includes('/stats/history')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ sessions: [] })
        });
      }

      return Promise.resolve({ ok: false, json: async () => ({}) });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('updates the displayed counter when clicks are sent', async () => {
    const user = userEvent.setup();
    render(<App />);

    const startButton = await screen.findByRole('button', { name: /start/i });
    await user.click(startButton);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/session'),
      expect.objectContaining({ method: 'POST' })
    );

    __listeners['session:update']?.({
      sessionId: 'abc',
      status: 'running',
      clicks: 0,
      remainingMs: 60000
    });

    const clickButton = await screen.findByRole('button', { name: /click!/i });
    await user.click(clickButton);

    expect(__socket.emit).toHaveBeenCalledWith('session:click', { sessionId: 'abc' });

    __listeners['session:update']?.({
      sessionId: 'abc',
      status: 'running',
      clicks: 1,
      remainingMs: 59000
    });

    await waitFor(() => {
      expect(screen.getByText(/Total de clics : 1/)).toBeInTheDocument();
    });
  });
});
