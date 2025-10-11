import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { YouTubePlayerPage } from './YouTubePlayerPage';
import { FavoritesService } from '../services/favoritesService';

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
  isInWishlist: vi.fn().mockReturnValue({ inWishlist: false })
};

vi.mock('../contexts/WishlistContext', () => ({
  useWishlist: () => mockWishlistContext
}));

// Mock the electron window object
const mockElectron = {
  getVideoData: vi.fn(),
  getTimeTrackingState: vi.fn(),
  getTimeLimits: vi.fn(),
  recordVideoWatching: vi.fn(),
  favoritesToggle: vi.fn(),
  favoritesGetAll: vi.fn(),
};

Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true,
});

// Mock the YouTube iframe player
vi.mock('../services/youtubeIframe', () => ({
  YouTubeIframePlayer: vi.fn().mockImplementation(() => ({
    mount: vi.fn(),
    destroy: vi.fn(),
  })),
}));

// Mock the useFavoriteStatus hook
const mockIsFavorite = vi.fn().mockReturnValue(false);
const mockRefreshFavorites = vi.fn();

const mockUseFavoriteStatus = {
  isFavorite: mockIsFavorite,
  refreshFavorites: mockRefreshFavorites,
};

vi.mock('../hooks/useFavoriteStatus', () => ({
  useFavoriteStatus: () => mockUseFavoriteStatus,
}));

// Mock FavoritesService (used by handleFavoriteToggle)
vi.mock('../services/favoritesService', () => ({
  FavoritesService: {
    toggleFavorite: vi.fn().mockResolvedValue({
      favorite: {
        videoId: 'test-video-id',
        dateAdded: new Date().toISOString(),
        sourceType: 'youtube',
        sourceId: 'test-source',
        title: 'Test Video',
        thumbnail: 'https://example.com/thumbnail.jpg',
        duration: 300,
      },
      isFavorite: true,
    }),
  },
}));

// Mock audio warning service
vi.mock('../services/audioWarning', () => ({
  audioWarningService: {
    checkAudioWarnings: vi.fn(),
    initialize: vi.fn(),
    resetState: vi.fn(),
    destroy: vi.fn(),
  },
}));

// Mock the download hook
vi.mock('../hooks/useDownload', () => ({
  useDownload: () => ({
    downloadStatus: { status: 'idle' },
    isDownloading: false,
    checkDownloadStatus: vi.fn(),
    handleStartDownload: vi.fn(),
    handleCancelDownload: vi.fn(),
    handleResetDownload: vi.fn(),
  }),
}));

// Mock logger
vi.mock('../lib/logging', () => ({
  logVerbose: vi.fn(),
}));

// Mock react-router-dom to return our test video ID
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'test-video-id' }),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ state: null, pathname: '/youtube-player/test-video-id' }),
  };
});

const mockVideo = {
  id: 'test-video-id',
  title: 'Test Video',
  url: 'https://youtube.com/watch?v=test-video-id',
  type: 'youtube' as const,
  thumbnail: 'https://example.com/thumbnail.jpg',
  duration: 300,
  resumeAt: 0,
};

describe('YouTubePlayerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockElectron.getVideoData.mockResolvedValue(mockVideo);
    mockElectron.getTimeTrackingState.mockResolvedValue({
      timeRemaining: 3600,
      isLimitReached: false,
    });
    mockElectron.getTimeLimits.mockResolvedValue({
      countdownWarningSeconds: 60,
      audioWarningSeconds: 10,
      useSystemBeep: true,
    });

    // Reset mock functions
    mockIsFavorite.mockReturnValue(false);
    mockRefreshFavorites.mockClear();
    mockWishlistContext.isInWishlist.mockReturnValue({ inWishlist: false });
  });


  const renderComponent = () => {
    return render(
      <Tooltip.Provider>
        <MemoryRouter>
          <YouTubePlayerPage />
        </MemoryRouter>
      </Tooltip.Provider>
    );
  };

  const waitForVideoToLoad = async () => {
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Video' })).toBeInTheDocument();
    }, { timeout: 5000 });
  };

  it('should render FavoriteButton when video is loaded', async () => {
    renderComponent();

    await waitForVideoToLoad();

    await waitFor(() => {
      expect(screen.getByTestId('favorite-button')).toBeInTheDocument();
    });
  });

  it('should handle favorite toggle correctly', async () => {
    renderComponent();

    await waitForVideoToLoad();

    await waitFor(() => {
      expect(screen.getByTestId('favorite-button')).toBeInTheDocument();
    });

    const favoriteButton = screen.getByTestId('favorite-button');
    fireEvent.click(favoriteButton);

    await waitFor(() => {
      expect(FavoritesService.toggleFavorite).toHaveBeenCalledWith(
        'test-video-id',
        'youtube', // video.sourceId || 'youtube'
        'youtube',
        'Test Video',
        'https://example.com/thumbnail.jpg',
        300,
        expect.any(String)
      );
    });
  });

  it('should display FavoriteButton with correct props', async () => {
    renderComponent();

    await waitForVideoToLoad();

    await waitFor(() => {
      expect(screen.getByTestId('favorite-button')).toBeInTheDocument();
    });

    const favoriteButton = screen.getByTestId('favorite-button');

    // Check that the button has the correct aria-label
    expect(favoriteButton).toHaveAttribute('aria-label', 'Add to favorites');

    // Check that the star icon is displayed (no text label in compact mode)
    expect(favoriteButton).toHaveTextContent('☆');
  });

  it('should handle keyboard shortcut (F key) to toggle favorite', async () => {
    renderComponent();

    await waitForVideoToLoad();

    await waitFor(() => {
      expect(screen.getByTestId('favorite-button')).toBeInTheDocument();
    });

    // Simulate F key press
    fireEvent.keyDown(document, { key: 'f', code: 'KeyF' });

    await waitFor(() => {
      expect(FavoritesService.toggleFavorite).toHaveBeenCalled();
    });
  });

  it('should not trigger favorite toggle with F key when typing in input field', async () => {
    renderComponent();

    await waitForVideoToLoad();

    await waitFor(() => {
      expect(screen.getByTestId('favorite-button')).toBeInTheDocument();
    });

    // Create a mock input element and focus it
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Simulate F key press while input is focused
    fireEvent.keyDown(input, { key: 'f', code: 'KeyF' });

    // Wait a bit to ensure no toggle was triggered
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(FavoritesService.toggleFavorite).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('should display keyboard shortcut hint', async () => {
    renderComponent();

    await waitForVideoToLoad();

    await waitFor(() => {
      // Check for the keyboard shortcut hint text (using regex for flexibility)
      expect(screen.getByText(/Press/)).toBeInTheDocument();
      expect(screen.getByText(/to toggle favorite/)).toBeInTheDocument();

      // Find the kbd element directly
      const kbdElement = document.querySelector('kbd');
      expect(kbdElement).toBeTruthy();
      expect(kbdElement?.textContent).toBe('F');
    });
  });

  it('should handle missing video data gracefully', async () => {
    mockElectron.getVideoData.mockResolvedValue(null);

    renderComponent();

    // Should not crash and FavoriteButton should not be rendered
    await waitFor(() => {
      expect(screen.queryByTestId('favorite-button')).not.toBeInTheDocument();
    });
  });
});