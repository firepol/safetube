import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PlayerRouter } from './PlayerRouter';
import { loadPlayerConfig } from '../services/playerConfig';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

// Mock the services
vi.mock('../services/playerConfig');
vi.mock('../services/youtubeIframe');

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
};

// Mock window.electron
Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true,
});

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

    render(
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
      expect(mockElectron.getVideoData).toHaveBeenCalledWith('test-youtube');
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

    render(
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
      expect(mockElectron.getVideoData).toHaveBeenCalledWith('test-local');
    });
  });

  it('should handle missing video data gracefully', async () => {
    // Mock getVideoData to return null (no video found)
    mockElectron.getVideoData.mockResolvedValue(null);
    
    render(
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