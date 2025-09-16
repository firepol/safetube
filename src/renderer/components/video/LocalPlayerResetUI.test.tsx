import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LocalPlayerResetUI } from './LocalPlayerResetUI';
import { Video } from '../../types';

// Mock the navigate function
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock electron API
const mockElectron = {
  getDownloadedVideos: vi.fn(),
  resetDownloadStatus: vi.fn(),
};

Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true,
});

// Mock logging
vi.mock('../../lib/logging', () => ({
  logVerbose: vi.fn(),
}));

describe('LocalPlayerResetUI', () => {
  const mockLocalVideo: Video = {
    id: 'local-video-1',
    type: 'local',
    title: 'Test Local Video',
    url: '/path/to/downloaded/video.mp4',
    thumbnail: '/path/to/thumbnail.jpg',
    duration: 300,
  };

  const mockYouTubeVideo: Video = {
    id: 'youtube-video-1',
    type: 'youtube',
    title: 'Test YouTube Video',
    url: 'https://youtube.com/watch?v=test',
    thumbnail: '/path/to/thumbnail.jpg',
    duration: 300,
  };

  const mockDownloadedVideos = [
    {
      videoId: 'test-youtube-id',
      title: 'Test Downloaded Video',
      filePath: '/path/to/downloaded/video.mp4',
      sourceType: 'youtube_channel',
      sourceId: 'test-source',
    },
    {
      videoId: 'another-video-id',
      title: 'Another Downloaded Video',
      filePath: '/path/to/another/video.mp4',
      sourceType: 'youtube_playlist',
      sourceId: 'test-playlist',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectron.getDownloadedVideos.mockResolvedValue(mockDownloadedVideos);
    mockElectron.resetDownloadStatus.mockResolvedValue(undefined);
  });

  const renderComponent = (video: Video | null, onResetDownload?: () => void) => {
    return render(
      <BrowserRouter>
        <LocalPlayerResetUI video={video} onResetDownload={onResetDownload} />
      </BrowserRouter>
    );
  };

  it('should not render anything for non-local videos', async () => {
    renderComponent(mockYouTubeVideo);

    await waitFor(() => {
      expect(screen.queryByText('Downloaded YouTube Video')).not.toBeInTheDocument();
    });
  });

  it('should not render anything for null video', async () => {
    renderComponent(null);

    await waitFor(() => {
      expect(screen.queryByText('Downloaded YouTube Video')).not.toBeInTheDocument();
    });
  });

  it('should not render anything for local videos that are not downloaded YouTube videos', async () => {
    const nonDownloadedVideo: Video = {
      ...mockLocalVideo,
      url: '/path/to/regular/local/video.mp4',
    };

    renderComponent(nonDownloadedVideo);

    await waitFor(() => {
      expect(mockElectron.getDownloadedVideos).toHaveBeenCalled();
      expect(screen.queryByText('Downloaded YouTube Video')).not.toBeInTheDocument();
    });
  });

  it('should render reset UI for downloaded YouTube videos', async () => {
    renderComponent(mockLocalVideo);

    await waitFor(() => {
      expect(screen.getByText('Downloaded YouTube Video')).toBeInTheDocument();
      expect(screen.getByText('This is a downloaded version of a YouTube video. You can reset to play from YouTube instead.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reset Download' })).toBeInTheDocument();
    });
  });

  it('should call resetDownloadStatus and navigate when reset button is clicked', async () => {
    const mockOnResetDownload = vi.fn();
    renderComponent(mockLocalVideo, mockOnResetDownload);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reset Download' })).toBeInTheDocument();
    });

    const resetButton = screen.getByRole('button', { name: 'Reset Download' });
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(mockElectron.resetDownloadStatus).toHaveBeenCalledWith('test-youtube-id');
      expect(mockOnResetDownload).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/youtube/test-youtube-id');
    });
  });

  it('should show loading state while resetting', async () => {
    // Make resetDownloadStatus take some time
    mockElectron.resetDownloadStatus.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );

    renderComponent(mockLocalVideo);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reset Download' })).toBeInTheDocument();
    });

    const resetButton = screen.getByRole('button', { name: 'Reset Download' });
    fireEvent.click(resetButton);

    // Should show loading state
    expect(screen.getByRole('button', { name: 'Resetting...' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resetting...' })).toBeDisabled();

    // Wait for reset to complete
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  it('should handle errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockElectron.resetDownloadStatus.mockRejectedValue(new Error('Reset failed'));

    renderComponent(mockLocalVideo);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reset Download' })).toBeInTheDocument();
    });

    const resetButton = screen.getByRole('button', { name: 'Reset Download' });
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[LocalPlayerResetUI] Error resetting download:',
        expect.any(Error)
      );
    });

    // Should not navigate on error
    expect(mockNavigate).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('should handle getDownloadedVideos error gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockElectron.getDownloadedVideos.mockRejectedValue(new Error('Failed to get downloaded videos'));

    renderComponent(mockLocalVideo);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[LocalPlayerResetUI] Error checking downloaded videos:',
        expect.any(Error)
      );
      expect(screen.queryByText('Downloaded YouTube Video')).not.toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it('should work without onResetDownload callback', async () => {
    renderComponent(mockLocalVideo); // No callback provided

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reset Download' })).toBeInTheDocument();
    });

    const resetButton = screen.getByRole('button', { name: 'Reset Download' });
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(mockElectron.resetDownloadStatus).toHaveBeenCalledWith('test-youtube-id');
      expect(mockNavigate).toHaveBeenCalledWith('/youtube/test-youtube-id');
    });
  });
});