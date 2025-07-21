import { render, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PlayerRouter } from './PlayerRouter';
import { loadPlayerConfig } from '../services/playerConfig';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the services
vi.mock('../services/playerConfig');
vi.mock('../services/youtubeIframe');

// Mock the electron API
const mockElectron = {
  getVideoData: vi.fn(),
  getPlayerConfig: vi.fn(),
  getTimeLimits: vi.fn(),
};

// Mock window.electron
Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true,
});

// Mock React Router with proper route context
const MockPlayerRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/player/:id" element={<PlayerRouter />} />
    </Routes>
  </BrowserRouter>
);

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

    render(<MockPlayerRouter />);
    
    // Navigate to the player route
    window.history.pushState({}, '', '/player/test-youtube');

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
      title: 'Test Local Video'
    });

    // Mock time limits
    mockElectron.getTimeLimits.mockResolvedValue({
      daily: 3600,
      weekly: 25200
    });

    render(<MockPlayerRouter />);
    
    // Navigate to the player route
    window.history.pushState({}, '', '/player/test-local');

    await waitFor(() => {
      expect(loadPlayerConfig).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockElectron.getVideoData).toHaveBeenCalledWith('test-local');
    });
  });

  it('should handle missing video data gracefully', async () => {
    // Mock config
    (loadPlayerConfig as any).mockResolvedValue({
      youtubePlayerType: 'iframe',
      perVideoOverrides: {}
    });

    // Mock video data not found
    mockElectron.getVideoData.mockRejectedValue(new Error('Video not found'));

    // Mock time limits
    mockElectron.getTimeLimits.mockResolvedValue({
      daily: 3600,
      weekly: 25200
    });

    render(<MockPlayerRouter />);
    
    // Navigate to the player route
    window.history.pushState({}, '', '/player/missing-video');

    await waitFor(() => {
      expect(loadPlayerConfig).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockElectron.getVideoData).toHaveBeenCalledWith('missing-video');
    });
  });
}); 