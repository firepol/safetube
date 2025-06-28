import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { KidScreen } from './KidScreen';
import { MemoryRouter } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';

// Mock console.error to suppress error messages during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

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
    }),
    getTimeLimits: vi.fn().mockResolvedValue({
      warningThresholdMinutes: 3,
      countdownWarningSeconds: 60
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
      // Should show time display in new format with TimeIndicator
      const timeIndicator = screen.getByTestId('time-indicator-root');
      expect(timeIndicator).toBeInTheDocument();
      // Check that it shows time in the new format
      expect(within(timeIndicator).getAllByText(/30:00/).length).toBeGreaterThan(0);
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
      // Look for the time indicator with the new structure
      const timeIndicator = screen.getByTestId('time-indicator-root');
      expect(timeIndicator).toBeInTheDocument();
      // Check that the time shows 58:00 / 60:00 in orange (2 minutes remaining with 3-minute warning threshold)
      const timeElement = within(timeIndicator).getByText(/58:00/);
      expect(timeElement).toHaveClass('text-orange-600');
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