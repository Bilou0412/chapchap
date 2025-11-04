import React, { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import App from '../App.jsx';
import { SessionContext } from '../session/SessionProvider.jsx';

describe('App', () => {
  const MockProvider = ({ children }) => {
    const [session, setSession] = useState({
      sessionId: 'test-session',
      clicks: 0,
      remainingSeconds: 60,
      status: 'running',
      startedAt: Date.now(),
      endsAt: Date.now() + 60000,
      endedAt: null,
      error: null,
    });

    const value = {
      session,
      startSession: vi.fn(),
      joinSession: vi.fn(),
      resetSession: vi.fn(),
      registerClick: () =>
        setSession((prev) => ({
          ...prev,
          clicks: prev.clicks + 1,
        })),
    };

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
  };

  it('increments the counter when clicking the button', async () => {
    const user = userEvent.setup();
    render(
      <MockProvider>
        <App />
      </MockProvider>
    );

    const clickButton = screen.getByRole('button', { name: /click!/i });
    const counter = within(screen.getByText(/total clicks/i).closest('.status-card'));

    expect(counter.getByText('0')).toBeInTheDocument();
    await user.click(clickButton);
    expect(counter.getByText('1')).toBeInTheDocument();
  });
});
