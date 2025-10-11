import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { KidScreen } from './KidScreen';
import { MemoryRouter } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

// Mock console.error to suppress error messages during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

// Mock RateLimitContext for tests
const MockRateLimitContext = createContext<any>(undefined);

const MockRateLimitProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [lastFetched, setLastFetched] = useState<string>();

  const showWarning = useCallback((lastFetched?: string) => {
    setIsVisible(true);
    if (lastFetched) {
      setLastFetched(lastFetched);
    }
  }, []);

  const hideWarning = useCallback(() => {
    setIsVisible(false);
  }, []);

  return (
    <MockRateLimitContext.Provider value={{ showWarning, hideWarning, isVisible, lastFetched }}>
      {children}
    </MockRateLimitContext.Provider>
  );
};

// Mock WishlistContext
const mockWishlistContext = {
  wishlistData: {
    pending: [],
    approved: [],
    denied: []
  },
  wishlistCounts: {
    pending: 0,
    approved: 0,
    denied: 0
  },
  isLoading: false,
  error: null,
  removeFromWishlist: vi.fn(),
  refreshWishlist: vi.fn(),
  isInWishlist: vi.fn()
};

vi.mock('../contexts/WishlistContext', () => ({
  useWishlist: () => mockWishlistContext
}));

// Mock the useRateLimit hook
vi.mock('../App', () => ({
  useRateLimit: () => {
    const context = useContext(MockRateLimitContext);
    if (!context) {
      throw new Error('useRateLimit must be used within a RateLimitProvider');
    }
    return context;
  }
}));

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

// Initialize window.electron globally before tests run
const mockElectronFunctions = {
  getTimeTrackingState: vi.fn().mockResolvedValue({
    timeRemaining: 1800,
    timeLimitToday: 3600,
    timeUsedToday: 1800,
    isLimitReached: false
  }),
  getTimeLimits: vi.fn().mockResolvedValue({
    warningThresholdMinutes: 3,
    countdownWarningSeconds: 60
  }),
  loadVideosFromSources: vi.fn().mockResolvedValue({
    videosBySource: [
      {
        id: 'sample-source-1',
        title: 'Sample Source 1',
        type: 'youtube_channel',
        videos: [
          {
            id: 'video-1',
            title: 'The Top 10 Goals of May | Top Goals | Serie A 2024/25',
            thumbnail: 'test-thumbnail-1.jpg',
            duration: '00:05:30'
          },
          {
            id: 'video-2',
            title: 'Venturino scores',
            thumbnail: 'test-thumbnail-2.jpg',
            duration: '00:03:45'
          }
        ],
        videoCount: 2
      }
    ],
    debug: []
  })
};

// Set global window.electron
global.window.electron = mockElectronFunctions as any;

beforeEach(() => {
  // Reset mocks while keeping the structure
  mockElectronFunctions.getTimeTrackingState.mockResolvedValue({
    timeRemaining: 1800,
    timeLimitToday: 3600,
    timeUsedToday: 1800,
    isLimitReached: false
  });
  mockElectronFunctions.getTimeLimits.mockResolvedValue({
    warningThresholdMinutes: 3,
    countdownWarningSeconds: 60
  });
  mockElectronFunctions.loadVideosFromSources.mockResolvedValue({
    videosBySource: [
      {
        id: 'sample-source-1',
        title: 'Sample Source 1',
        type: 'youtube_channel',
        videos: [
          {
            id: 'video-1',
            title: 'The Top 10 Goals of May | Top Goals | Serie A 2024/25',
            thumbnail: 'test-thumbnail-1.jpg',
            duration: '00:05:30'
          },
          {
            id: 'video-2',
            title: 'Venturino scores',
            thumbnail: 'test-thumbnail-2.jpg',
            duration: '00:03:45'
          }
        ],
        videoCount: 2
      }
    ],
    debug: []
  });
  mockNavigate.mockReset();
});

const renderWithProvider = (component: React.ReactNode) => {
  return render(
    <MockRateLimitProvider>
      <MemoryRouter>
        <Tooltip.Provider>
          {component}
        </Tooltip.Provider>
      </MemoryRouter>
    </MockRateLimitProvider>
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
      // Check for sources instead of individual videos
      expect(screen.getByText('Sample Source 1')).toBeInTheDocument();
      expect(screen.getByText('YouTube Channel')).toBeInTheDocument();
      expect(screen.getByText(/2 videos/)).toBeInTheDocument();
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
    mockElectronFunctions.getTimeTrackingState.mockResolvedValue({
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
    mockElectronFunctions.getTimeTrackingState.mockResolvedValue({
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