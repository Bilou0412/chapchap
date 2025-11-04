import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';

const socketMock = {
  emit: vi.fn(),
  on: vi.fn(),
  disconnect: vi.fn()
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => socketMock)
}));

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('../api/client', () => ({
  createApiClient: vi.fn((userId) => {
    if (!userId) {
      return {
        post: postMock
      };
    }
    return {
      get: getMock,
      post: postMock
    };
  }),
  getApiBaseUrl: vi.fn(() => 'http://localhost:4000')
}));

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    getMock.mockReset();
    postMock.mockReset();
    socketMock.emit.mockClear();
    socketMock.on.mockClear();
    socketMock.disconnect.mockClear();
  });

  it('renders registration flow when no identity is stored', () => {
    render(<App />);
    expect(screen.getByText('Créez votre profil ChapChap')).toBeInTheDocument();
  });

  it('loads player profile and displays wallet when identity exists', async () => {
    localStorage.setItem('chapchap_identity', JSON.stringify({ id: 'user-1', nickname: 'Alice' }));
    getMock.mockImplementation((url) => {
      if (url === '/api/me') {
        return Promise.resolve({
          data: {
            user: { id: 'user-1', nickname: 'Alice', coins: 150, riot: null },
            transactions: []
          }
        });
      }
      if (url === '/api/bet/active') {
        return Promise.resolve({ data: { bets: [] } });
      }
      return Promise.resolve({ data: {} });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Solde')).toBeInTheDocument();
    });
    expect(screen.getByText('150 coins')).toBeInTheDocument();
  });

  it('submits nickname and stores identity', async () => {
    postMock.mockResolvedValueOnce({ data: { user: { id: 'u-1', nickname: 'PlayerOne' } } });
    getMock.mockResolvedValue({
      data: {
        user: { id: 'u-1', nickname: 'PlayerOne', coins: 0, riot: null },
        transactions: [],
        activeBet: null,
        bets: []
      }
    });
    render(<App />);
    const input = screen.getByPlaceholderText('Votre pseudo LAN');
    await userEvent.type(input, 'PlayerOne');
    const button = screen.getByRole('button', { name: 'Créer mon profil' });
    await userEvent.click(button);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/api/auth/guest', { nickname: 'PlayerOne' });
    });
    const stored = JSON.parse(localStorage.getItem('chapchap_identity'));
    expect(stored.nickname).toBe('PlayerOne');
  });
});
