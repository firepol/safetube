import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PlayerRouter } from './PlayerRouter';
import { loadPlayerConfig } from '../services/playerConfig';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import * as Tooltip from '@radix-ui/react-tooltip';

// Mock the services
vi.mock('../services/playerConfig');
vi.mock('../services/youtubeIframe');

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

// Mock the useFavoriteStatus hook
const mockIsFavorite = vi.fn().mockReturnValue(false);
const mockRefreshFavorites = vi.fn();

vi.mock('../hooks/useFavoriteStatus', () => ({
  useFavoriteStatus: () => ({
    isFavorite: mockIsFavorite,
    refreshFavorites: mockRefreshFavorites,
  }),
}));

// Mock FavoritesService
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

// Mock the electron API
const mockElectron = {
  getVideoData: vi.fn(),
  getPlayerConfig: vi.fn(),
  getTimeLimits: vi.fn(),
  getTimeTrackingState: vi.fn().mockResolvedValue({
    timeRemaining: 1800,
    timeLimitToday: 3600,
    timeUsedToday: 1800,
    isLimitReached: false
  }),
  recordVideoWatching: vi.fn().mockResolvedValue({ success: true }),
  getLocalFile: vi.fn().mockResolvedValue('file:///test/video.mp4'),
  getDlnaFile: vi.fn().mockResolvedValue('http://test/dlna.mp4'),
  getVideoStreams: vi.fn().mockResolvedValue({
    videoStreams: [
      { url: 'https://test/video.mp4', quality: '720p', mimeType: 'video/mp4' }
    ],
    audioTracks: []
  }),
  favoritesGetAll: vi.fn().mockResolvedValue({ data: [] }),
  favoritesToggle: vi.fn(),
};

// Mock window.electron
Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true,
});

// Helper to render with required providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <Tooltip.Provider>
      {ui}
    </Tooltip.Provider>
  );
};

describe('PlayerRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.electron
    (window as any).electron = mockElectron;
  });

  it('should route YouTube videos to YouTube player when iframe config is set', async () => {
    // Mock config
    (loadPlayerConfig as any).mockResolvedValue({
      youtubePlayerType: 'iframe',
      perVideoOverrides: {}
    });

    // Mock video data
    mockElectron.getVideoData.mockResolvedValue({
      id: 'test-youtube',
      type: 'youtube',
      title: 'Test YouTube Video'
    });

    // Mock time limits
    mockElectron.getTimeLimits.mockResolvedValue({
      daily: 3600,
      weekly: 25200
    });

    renderWithProviders(
      <MemoryRouter initialEntries={['/player/test-youtube']}>
        <Routes>
          <Route path="/player/:id" element={<PlayerRouter />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(loadPlayerConfig).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockElectron.getVideoData).toHaveBeenCalledWith('test-youtube', null);
    });
  });

  it('should route non-YouTube videos to MediaSource player', async () => {
    // Mock config
    (loadPlayerConfig as any).mockResolvedValue({
      youtubePlayerType: 'iframe',
      perVideoOverrides: {}
    });

    // Mock video data for local video
    mockElectron.getVideoData.mockResolvedValue({
      id: 'test-local',
      type: 'local',
      title: 'Test Local Video',
      video: 'test-video.mp4',
      audio: 'test-audio.mp3'
    });

    // Mock time limits
    mockElectron.getTimeLimits.mockResolvedValue({
      daily: 3600,
      weekly: 25200
    });

    renderWithProviders(
      <MemoryRouter initialEntries={['/player/test-local']}>
        <Routes>
          <Route path="/player/:id" element={<PlayerRouter />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(loadPlayerConfig).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockElectron.getVideoData).toHaveBeenCalledWith('test-local', null);
    });
  });

  it('should handle missing video data gracefully', async () => {
    // Mock getVideoData to return null (no video found)
    mockElectron.getVideoData.mockResolvedValue(null);

    renderWithProviders(
      <MemoryRouter initialEntries={['/player/missing-video']}>
        <Routes>
          <Route path="/player/:id" element={<PlayerRouter />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the error to be displayed
    await waitFor(() => {
      expect(screen.getByText('Video not found')).toBeInTheDocument();
    });

    // loadPlayerConfig is called even when there's no video data
    // because the component doesn't check for null video before proceeding
    expect(loadPlayerConfig).toHaveBeenCalled();
  });
}); 