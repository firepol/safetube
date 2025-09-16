import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { PlayerRouter } from '../PlayerRouter';

// Mock the electron API
const mockElectron = {
  getVideoData: vi.fn(),
  getPlayerConfig: vi.fn(),
  checkDownloadedVideo: vi.fn(),
};

// Mock window.electron
Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true,
});

// Mock the PlayerPage and YouTubePlayerPage components
vi.mock('../PlayerPage', () => ({
  PlayerPage: () => <div data-testid="player-page">PlayerPage</div>,
}));

vi.mock('../YouTubePlayerPage', () => ({
  YouTubePlayerPage: () => <div data-testid="youtube-player-page">YouTubePlayerPage</div>,
}));

// Mock the player config service
vi.mock('../../services/playerConfig', () => ({
  loadPlayerConfig: vi.fn().mockResolvedValue({
    youtubePlayerType: 'iframe',
    perVideoOverrides: {},
  }),
}));

describe('PlayerRouter Smart Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset console.log mock
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  test('should route YouTube video to local player when downloaded version exists', async () => {
    const videoId = 'test-youtube-video-id';
    const mockYouTubeVideo = {
      id: videoId,
      type: 'youtube',
      title: 'Test YouTube Video',
      thumbnail: 'https://example.com/thumb.jpg',
      duration: 300,
    };

    const mockDownloadedCheck = {
      isDownloaded: true,
      filePath: '/path/to/downloaded/video.mp4',
      downloadedVideo: {
        videoId: videoId,
        title: 'Test YouTube Video',
        filePath: '/path/to/downloaded/video.mp4',
        thumbnail: '/path/to/thumbnail.jpg',
        duration: 300,
        sourceId: 'test-channel',
        sourceType: 'youtube_channel',
        channelTitle: 'Test Channel',
        downloadedAt: new Date().toISOString(),
      },
      isAccessible: true,
    };

    mockElectron.getVideoData.mockResolvedValue(mockYouTubeVideo);
    mockElectron.checkDownloadedVideo.mockResolvedValue(mockDownloadedCheck);

    render(
      <MemoryRouter initialEntries={[`/player/${encodeURIComponent(videoId)}`]}>
        <Routes>
          <Route path="/player/:id" element={<PlayerRouter />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the component to load and make routing decisions
    await waitFor(() => {
      expect(screen.getByTestId('player-page')).toBeInTheDocument();
    });

    // Verify that checkDownloadedVideo was called
    expect(mockElectron.checkDownloadedVideo).toHaveBeenCalledWith(videoId);

    // Verify that console.log was called with the expected message
    expect(console.log).toHaveBeenCalledWith(
      `[PlayerRouter] Playing downloaded version instead of YouTube for video: ${videoId}`
    );

    // Verify that PlayerPage is rendered (not YouTubePlayerPage)
    expect(screen.getByTestId('player-page')).toBeInTheDocument();
    expect(screen.queryByTestId('youtube-player-page')).not.toBeInTheDocument();
  });

  test('should route YouTube video to YouTube player when no downloaded version exists', async () => {
    const videoId = 'test-youtube-video-id-2';
    const mockYouTubeVideo = {
      id: videoId,
      type: 'youtube',
      title: 'Test YouTube Video 2',
      thumbnail: 'https://example.com/thumb2.jpg',
      duration: 400,
    };

    const mockDownloadedCheck = {
      isDownloaded: false,
      filePath: null,
      downloadedVideo: null,
      isAccessible: false,
    };

    mockElectron.getVideoData.mockResolvedValue(mockYouTubeVideo);
    mockElectron.checkDownloadedVideo.mockResolvedValue(mockDownloadedCheck);

    render(
      <MemoryRouter initialEntries={[`/player/${encodeURIComponent(videoId)}`]}>
        <Routes>
          <Route path="/player/:id" element={<PlayerRouter />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the component to load and make routing decisions
    await waitFor(() => {
      expect(screen.getByTestId('youtube-player-page')).toBeInTheDocument();
    });

    // Verify that checkDownloadedVideo was called
    expect(mockElectron.checkDownloadedVideo).toHaveBeenCalledWith(videoId);

    // Verify that console.log was NOT called with the downloaded version message
    expect(console.log).not.toHaveBeenCalledWith(
      expect.stringContaining('Playing downloaded version instead of YouTube')
    );

    // Verify that YouTubePlayerPage is rendered (not PlayerPage)
    expect(screen.getByTestId('youtube-player-page')).toBeInTheDocument();
    expect(screen.queryByTestId('player-page')).not.toBeInTheDocument();
  });

  test('should not check for downloaded version for non-YouTube videos', async () => {
    const videoId = 'local-video-id';
    const mockLocalVideo = {
      id: videoId,
      type: 'local',
      title: 'Test Local Video',
      thumbnail: '/path/to/local/thumb.jpg',
      duration: 600,
      url: '/path/to/local/video.mp4',
    };

    mockElectron.getVideoData.mockResolvedValue(mockLocalVideo);

    render(
      <MemoryRouter initialEntries={[`/player/${encodeURIComponent(videoId)}`]}>
        <Routes>
          <Route path="/player/:id" element={<PlayerRouter />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the component to load and make routing decisions
    await waitFor(() => {
      expect(screen.getByTestId('player-page')).toBeInTheDocument();
    });

    // Verify that checkDownloadedVideo was NOT called for local videos
    expect(mockElectron.checkDownloadedVideo).not.toHaveBeenCalled();

    // Verify that PlayerPage is rendered for local video
    expect(screen.getByTestId('player-page')).toBeInTheDocument();
    expect(screen.queryByTestId('youtube-player-page')).not.toBeInTheDocument();
  });
});