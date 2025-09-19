import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { YouTubePlayerPage } from './YouTubePlayerPage';
import { FavoritesService } from '../services/favoritesService';

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

// Mock the favorites service
vi.mock('../services/favoritesService', () => ({
  FavoritesService: {
    isFavorite: vi.fn(),
    toggleFavorite: vi.fn(),
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

    vi.mocked(FavoritesService.isFavorite).mockResolvedValue(false);
    vi.mocked(FavoritesService.toggleFavorite).mockResolvedValue({
      favorite: {
        videoId: 'test-video-id',
        dateAdded: new Date().toISOString(),
        sourceType: 'youtube',
        title: 'Test Video',
        thumbnail: 'https://example.com/thumbnail.jpg',
        duration: 300,
      },
      isFavorite: true,
    });
  });


  const renderComponent = () => {
    return render(<YouTubePlayerPage />);
  };

  const waitForVideoToLoad = async () => {
    await waitFor(() => {
      expect(screen.getByText('Test Video')).toBeInTheDocument();
    }, { timeout: 5000 });
  };

  it('should render FavoriteButton when video is loaded', async () => {
    renderComponent();

    await waitForVideoToLoad();

    await waitFor(() => {
      expect(screen.getByTestId('favorite-button')).toBeInTheDocument();
    });
  });

  it('should load initial favorite status when video loads', async () => {
    renderComponent();

    await waitForVideoToLoad();

    await waitFor(() => {
      expect(FavoritesService.isFavorite).toHaveBeenCalledWith('test-video-id', 'youtube');
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
        'https://youtube.com/watch?v=test-video-id',
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

    // Check that the label is shown
    expect(screen.getByText('Add')).toBeInTheDocument();
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

  it('should display correct video metadata in FavoriteButton', async () => {
    renderComponent();

    await waitForVideoToLoad();

    await waitFor(() => {
      expect(screen.getByTestId('favorite-button')).toBeInTheDocument();
    });

    // Check that the favorite button was initialized with correct video data
    expect(FavoritesService.isFavorite).toHaveBeenCalledWith('test-video-id', 'youtube');
  });

  it('should handle favorite status updates correctly', async () => {
    // Mock initial favorite status as true
    vi.mocked(FavoritesService.isFavorite).mockResolvedValue(true);

    renderComponent();

    await waitForVideoToLoad();

    await waitFor(() => {
      expect(screen.getByTestId('favorite-button')).toBeInTheDocument();
    });

    // Button should show "Remove" when already favorited
    await waitFor(() => {
      expect(screen.getByText('Remove')).toBeInTheDocument();
    });

    const favoriteButton = screen.getByTestId('favorite-button');
    expect(favoriteButton).toHaveAttribute('aria-label', 'Remove from favorites');
  });

  it('should display keyboard shortcut hint', async () => {
    renderComponent();

    await waitForVideoToLoad();

    await waitFor(() => {
      expect(screen.getByText('Press')).toBeInTheDocument();
      expect(screen.getByText('F')).toBeInTheDocument();
      expect(screen.getByText('to toggle favorite')).toBeInTheDocument();
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