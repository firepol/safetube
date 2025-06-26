import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { KidScreen } from './KidScreen';
import { MemoryRouter } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';

// Shared mockNavigate for all tests
const mockNavigate = vi.fn();

// Always mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Mock window.electron
beforeEach(() => {
  window.electron = {
    getTimeTrackingState: vi.fn().mockResolvedValue({
      timeRemaining: 1800,
      timeLimitToday: 3600,
      timeUsedToday: 1800,
      isLimitReached: false
    })
  } as any;
  mockNavigate.mockReset();
});

const renderWithProvider = (component: React.ReactNode) => {
  return render(
    <MemoryRouter>
      <Tooltip.Provider>
        {component}
      </Tooltip.Provider>
    </MemoryRouter>
  );
};

describe('KidScreen', () => {
  it('renders the page title', async () => {
    renderWithProvider(<KidScreen />);
    await waitFor(() => {
      expect(screen.getByText('Kid-Friendly Videos')).toBeInTheDocument();
    });
  });

  it('renders all sample videos', async () => {
    renderWithProvider(<KidScreen />);
    await waitFor(() => {
      // Check for a few sample videos
      expect(screen.getByText('The Top 10 Goals of May | Top Goals | Serie A 2024/25')).toBeInTheDocument();
      expect(screen.getByText('Venturino scores')).toBeInTheDocument();
    });
  });

  it('displays time tracking information', async () => {
    renderWithProvider(<KidScreen />);
    
    await waitFor(() => {
      // Should show time display in format "X / Y [Z minutes left]"
      expect(screen.getByText(/30 \/ 60 \[30 minutes left\]/)).toBeInTheDocument();
    });
  });

  it('shows time in red when time is low', async () => {
    // Mock low time remaining (2 minutes)
    window.electron.getTimeTrackingState = vi.fn().mockResolvedValue({
      timeRemaining: 120,
      timeLimitToday: 3600,
      timeUsedToday: 3480,
      isLimitReached: false
    });

    renderWithProvider(<KidScreen />);
    
    await waitFor(() => {
      const timeDisplay = screen.getByText(/58 \/ 60 \[2 minutes left\]/);
      expect(timeDisplay).toHaveClass('text-red-600');
    });
  });

  it('redirects to time up page when limit is reached', async () => {
    // Mock time limit reached
    window.electron.getTimeTrackingState = vi.fn().mockResolvedValue({
      timeRemaining: 0,
      timeLimitToday: 3600,
      timeUsedToday: 3600,
      isLimitReached: true
    });

    renderWithProvider(<KidScreen />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/time-up');
    });
  });

  it('shows loading state initially', async () => {
    renderWithProvider(<KidScreen />);
    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });
}); 