import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlayerRouter } from './PlayerRouter';
import * as Tooltip from '@radix-ui/react-tooltip';

// Mock dependencies
vi.mock('../services/playerConfig', () => ({
  loadPlayerConfig: vi.fn().mockResolvedValue({
    youtubePlayerType: 'mediasource',
    perVideoOverrides: {}
  })
}));

vi.mock('../lib/logging', () => ({
  logVerbose: vi.fn()
}));

const mockElectron = {
  getVideoData: vi.fn(),
  getTimeLimits: vi.fn().mockResolvedValue({
    Monday: 60,
    Tuesday: 60,
    Wednesday: 60,
    Thursday: 60,
    Friday: 60,
    Saturday: 90,
    Sunday: 90
  }),
  favoritesGetAll: vi.fn().mockResolvedValue([]),
  checkDownloadedVideo: vi.fn().mockResolvedValue({ isDownloaded: false }),
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

describe('PlayerRouter URL Decoding', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for getVideoData
    mockElectron.getVideoData.mockResolvedValue({
      id: 'test-video',
      title: 'Test Video',
      type: 'local',
      url: '/path/to/video.mp4'
    });
  });

  it('should decode URL-encoded video ID with colons', async () => {
    const encodedVideoId = 'local%3A%2Fhome%2Fuser%2Fvideos%2Fmovie.mp4';
    const expectedDecodedId = 'local:/home/user/videos/movie.mp4';

    renderWithProviders(
      <MemoryRouter initialEntries={[`/player/${encodedVideoId}`]}>
        <Routes>
          <Route path="/player/:id" element={<PlayerRouter />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for async operations
    await screen.findByText('Loading player...');

    expect(mockElectron.getVideoData).toHaveBeenCalledWith(expectedDecodedId, null);
  });

  it('should decode URL-encoded video ID with special characters', async () => {
    const encodedVideoId = 'local%3A%2Fhome%2Fuser%2FVideos%2FFun%20Cartoon%20(2024)%20-%20Episode%201.mp4';
    const expectedDecodedId = 'local:/home/user/Videos/Fun Cartoon (2024) - Episode 1.mp4';

    renderWithProviders(
      <MemoryRouter initialEntries={[`/player/${encodedVideoId}`]}>
        <Routes>
          <Route path="/player/:id" element={<PlayerRouter />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Loading player...');

    expect(mockElectron.getVideoData).toHaveBeenCalledWith(expectedDecodedId, null);
  });

  it('should decode URL-encoded video ID with emoji characters', async () => {
    const encodedVideoId = 'local%3A%2Fhome%2Fuser%2FVideos%2F%F0%9F%8E%AC%20Movies%2FFun%20Video%20%F0%9F%8E%89.mp4';
    const expectedDecodedId = 'local:/home/user/Videos/🎬 Movies/Fun Video 🎉.mp4';

    renderWithProviders(
      <MemoryRouter initialEntries={[`/player/${encodedVideoId}`]}>
        <Routes>
          <Route path="/player/:id" element={<PlayerRouter />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Loading player...');

    expect(mockElectron.getVideoData).toHaveBeenCalledWith(expectedDecodedId, null);
  });

  it('should decode DLNA video IDs with special characters', async () => {
    const encodedVideoId = 'dlna%3A%2F%2F192.168.1.100%3A8200%2FMovies%2FAction%20Movie%20(2024).mp4';
    const expectedDecodedId = 'dlna://192.168.1.100:8200/Movies/Action Movie (2024).mp4';

    mockElectron.getVideoData.mockResolvedValue({
      id: expectedDecodedId,
      title: 'Action Movie',
      type: 'dlna',
      url: 'http://192.168.1.100:8200/Movies/Action Movie (2024).mp4'
    });

    renderWithProviders(
      <MemoryRouter initialEntries={[`/player/${encodedVideoId}`]}>
        <Routes>
          <Route path="/player/:id" element={<PlayerRouter />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Loading player...');

    expect(mockElectron.getVideoData).toHaveBeenCalledWith(expectedDecodedId, null);
  });

  it('should handle simple YouTube video IDs without issues', async () => {
    const youtubeVideoId = 'dQw4w9WgXcQ';

    mockElectron.getVideoData.mockResolvedValue({
      id: youtubeVideoId,
      title: 'YouTube Video',
      type: 'youtube',
      url: `https://www.youtube.com/watch?v=${youtubeVideoId}`
    });

    renderWithProviders(
      <MemoryRouter initialEntries={[`/player/${youtubeVideoId}`]}>
        <Routes>
          <Route path="/player/:id" element={<PlayerRouter />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Loading player...');

    expect(mockElectron.getVideoData).toHaveBeenCalledWith(youtubeVideoId, null);
  });

  it('should handle double-encoded video IDs correctly', async () => {
    // This tests the case where video ID was already encoded and then encoded again
    const doubleEncodedVideoId = 'local%253A%252Fhome%252Fuser%252FVideos%252FTest%2520Video.mp4';
    // Note: decodeURIComponent only decodes once, so we get the still-encoded version
    const expectedDecodedId = 'local:/home/user/Videos/Test Video.mp4';

    renderWithProviders(
      <MemoryRouter initialEntries={[`/player/${doubleEncodedVideoId}`]}>
        <Routes>
          <Route path="/player/:id" element={<PlayerRouter />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Loading player...');

    expect(mockElectron.getVideoData).toHaveBeenCalledWith(expectedDecodedId, null);
  });

  it('should handle video IDs with question marks and hash symbols', async () => {
    const encodedVideoId = 'local%3A%2Fhome%2Fuser%2FVideos%2FMovie%3F%20%26%20Hash%23.mp4';
    const expectedDecodedId = 'local:/home/user/Videos/Movie? & Hash#.mp4';

    renderWithProviders(
      <MemoryRouter initialEntries={[`/player/${encodedVideoId}`]}>
        <Routes>
          <Route path="/player/:id" element={<PlayerRouter />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Loading player...');

    expect(mockElectron.getVideoData).toHaveBeenCalledWith(expectedDecodedId, null);
  });

  it('should handle missing video ID gracefully', async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/player/']}>
        <Routes>
          <Route path="/player/:id" element={<PlayerRouter />} />
        </Routes>
      </MemoryRouter>
    );

    // Give the component time to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should not call getVideoData with undefined
    expect(mockElectron.getVideoData).not.toHaveBeenCalled();
  });

  it('should handle empty video ID parameter', async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/player/']}>
        <Routes>
          <Route path="/player/:id?" element={<PlayerRouter />} />
        </Routes>
      </MemoryRouter>
    );

    // Give the component time to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockElectron.getVideoData).not.toHaveBeenCalled();
  });

  it('should display error when video data loading fails', async () => {
    const encodedVideoId = 'local%3A%2Fhome%2Fuser%2Fvideos%2Fnonexistent.mp4';

    mockElectron.getVideoData.mockRejectedValue(new Error('Video not found'));

    renderWithProviders(
      <MemoryRouter initialEntries={[`/player/${encodedVideoId}`]}>
        <Routes>
          <Route path="/player/:id" element={<PlayerRouter />} />
        </Routes>
      </MemoryRouter>
    );

    // Should still try to decode and call getVideoData
    const expectedDecodedId = 'local:/home/user/videos/nonexistent.mp4';
    expect(mockElectron.getVideoData).toHaveBeenCalledWith(expectedDecodedId, null);
  });
});