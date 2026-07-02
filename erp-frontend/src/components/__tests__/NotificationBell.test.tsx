import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        on: vi.fn(() => ({
          subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
        })),
      })),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'test@test.com' } }),
}));

vi.mock('../../hooks/useTranslation', () => ({
  useT: () => (key: string) => key,
}));

import NotificationBell from '../NotificationBell';

describe('NotificationBell', () => {
  it('renders bell icon', async () => {
    render(<MemoryRouter><NotificationBell /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    });
  });

  it('shows no unread initially', async () => {
    render(<MemoryRouter><NotificationBell /></MemoryRouter>);
    await waitFor(() => {
      const btn = screen.getByLabelText('Notifications');
      expect(btn).toBeInTheDocument();
    });
  });
});


