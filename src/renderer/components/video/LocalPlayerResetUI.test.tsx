import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { LocalPlayerResetUI } from './LocalPlayerResetUI';
import { Video } from '../../types';

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockLocation = { state: { sourceId: 'test-source', sourceTitle: 'Test Source' } };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

// Mock logging
vi.mock('../../lib/logging', () => ({
  logVerbose: vi.fn(),
}));

// Mock video data for testing
const mockLocalVideo: Video = {
  id: 'test-local-id',
  type: 'local',
  title: 'Test Local Video',
  thumbnail: 'file://thumbnail.jpg',
  duration: 180,
  url: 'file://downloaded-video.mp4',
};

const mockDownloadedYouTubeVideo: Video & { navigationContext?: any } = {
  id: 'test-youtube-id',
  type: 'local',
  title: 'Downloaded YouTube Video',
  thumbnail: 'file://thumbnail.jpg',
  duration: 300,
  url: 'file://downloaded-youtube-video.mp4',
  navigationContext: {
    sourceId: 'youtube-channel-123',
    sourceTitle: 'Test YouTube Channel'
  }
};

const mockYouTubeVideo: Video = {
  id: 'test-video-id',
  type: 'youtube',
  title: 'Test YouTube Video',
  thumbnail: 'https://example.com/thumbnail.jpg',
  duration: 300,
  url: 'https://youtube.com/watch?v=test-video-id',
  sourceType: 'youtube_channel',
  sourceId: 'test-channel',
  sourceTitle: 'Test Channel',
};

const mockDownloadedVideoInfo = {
  videoId: 'test-youtube-id',
  title: 'Downloaded YouTube Video',
  filePath: 'file://downloaded-youtube-video.mp4',
  sourceType: 'youtube_channel',
  sourceId: 'youtube-channel-123',
  channelTitle: 'Test YouTube Channel',
  downloadedAt: '2023-01-01T00:00:00Z',
  duration: 300,
  thumbnail: 'file://thumbnail.jpg'
};

// Wrapper component for router context
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('LocalPlayerResetUI', () => {
  const mockOnResetDownload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default electron API mocks
    window.electron = {
      ...window.electron,
      getDownloadedVideos: vi.fn().mockResolvedValue([]),
      resetDownloadStatus: vi.fn().mockResolvedValue({ success: true }),
    };
  });

  test('renders nothing for non-local videos', async () => {
    const { container } = render(
      <TestWrapper>
        <LocalPlayerResetUI
          video={mockYouTubeVideo}
          onResetDownload={mockOnResetDownload}
        />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  test('renders nothing when video is null', async () => {
    const { container } = render(
      <TestWrapper>
        <LocalPlayerResetUI
          video={null}
          onResetDownload={mockOnResetDownload}
        />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  test('renders nothing for local videos that are not downloaded YouTube videos', async () => {
    window.electron.getDownloadedVideos = vi.fn().mockResolvedValue([]);
    
    const { container } = render(
      <TestWrapper>
        <LocalPlayerResetUI
          video={mockLocalVideo}
          onResetDownload={mockOnResetDownload}
        />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
    
    expect(window.electron.getDownloadedVideos).toHaveBeenCalledTimes(1);
  });

  test('detects downloaded YouTube video correctly', async () => {
    window.electron.getDownloadedVideos = vi.fn().mockResolvedValue([mockDownloadedVideoInfo]);
    
    render(
      <TestWrapper>
        <LocalPlayerResetUI
          video={mockDownloadedYouTubeVideo}
          onResetDownload={mockOnResetDownload}
        />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Downloaded YouTube Video')).toBeInTheDocument();
    });
    
    expect(screen.getByText('This is a downloaded version of a YouTube video. You can reset to play from YouTube instead.')).toBeInTheDocument();
    expect(screen.getByText('Reset Download')).toBeInTheDocument();
    expect(window.electron.getDownloadedVideos).toHaveBeenCalledTimes(1);
  });

  test('shows reset button for downloaded YouTube videos', async () => {
    window.electron.getDownloadedVideos = vi.fn().mockResolvedValue([mockDownloadedVideoInfo]);
    
    render(
      <TestWrapper>
        <LocalPlayerResetUI
          video={mockDownloadedYouTubeVideo}
          onResetDownload={mockOnResetDownload}
        />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Reset Download')).toBeInTheDocument();
    });
    
    const resetButton = screen.getByText('Reset Download');
    expect(resetButton).not.toBeDisabled();
    expect(resetButton).toHaveClass('bg-red-600', 'text-white');
  });

  test('calls resetDownloadStatus and navigates when reset button is clicked', async () => {
    window.electron.getDownloadedVideos = vi.fn().mockResolvedValue([mockDownloadedVideoInfo]);
    window.electron.resetDownloadStatus = vi.fn().mockResolvedValue({ success: true });
    
    render(
      <TestWrapper>
        <LocalPlayerResetUI
          video={mockDownloadedYouTubeVideo}
          onResetDownload={mockOnResetDownload}
        />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Reset Download')).toBeInTheDocument();
    });
    
    const resetButton = screen.getByText('Reset Download');
    fireEvent.click(resetButton);
    
    await waitFor(() => {
      expect(window.electron.resetDownloadStatus).toHaveBeenCalledWith('test-youtube-id');
    });
    
    expect(mockOnResetDownload).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      '/source/youtube-channel-123',
      { replace: true }
    );
  });

  test('preserves navigation context from video when available', async () => {
    const videoWithNavigationContext = {
      ...mockDownloadedYouTubeVideo,
      navigationContext: {
        sourceId: 'video-source-123',
        sourceTitle: 'Video Source Title',
        customData: 'test'
      }
    };
    
    window.electron.getDownloadedVideos = vi.fn().mockResolvedValue([mockDownloadedVideoInfo]);
    window.electron.resetDownloadStatus = vi.fn().mockResolvedValue({ success: true });
    
    render(
      <TestWrapper>
        <LocalPlayerResetUI
          video={videoWithNavigationContext}
          onResetDownload={mockOnResetDownload}
        />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Reset Download')).toBeInTheDocument();
    });
    
    const resetButton = screen.getByText('Reset Download');
    fireEvent.click(resetButton);
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/source/youtube-channel-123',
        { replace: true }
      );
    });
  });

  test('falls back to location state when video has no navigation context', async () => {
    window.electron.getDownloadedVideos = vi.fn().mockResolvedValue([mockDownloadedVideoInfo]);
    window.electron.resetDownloadStatus = vi.fn().mockResolvedValue({ success: true });
    
    const videoWithoutNavigationContext = {
      ...mockDownloadedYouTubeVideo,
      navigationContext: undefined
    };
    
    render(
      <TestWrapper>
        <LocalPlayerResetUI
          video={videoWithoutNavigationContext}
          onResetDownload={mockOnResetDownload}
        />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Reset Download')).toBeInTheDocument();
    });
    
    const resetButton = screen.getByText('Reset Download');
    fireEvent.click(resetButton);
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/source/youtube-channel-123',
        { replace: true }
      );
    });
  });

  test('shows loading state while resetting', async () => {
    window.electron.getDownloadedVideos = vi.fn().mockResolvedValue([mockDownloadedVideoInfo]);
    
    // Mock a slow reset operation
    let resolveReset: (value: any) => void;
    const resetPromise = new Promise(resolve => {
      resolveReset = resolve;
    });
    window.electron.resetDownloadStatus = vi.fn().mockReturnValue(resetPromise);
    
    render(
      <TestWrapper>
        <LocalPlayerResetUI
          video={mockDownloadedYouTubeVideo}
          onResetDownload={mockOnResetDownload}
        />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Reset Download')).toBeInTheDocument();
    });
    
    const resetButton = screen.getByText('Reset Download');
    fireEvent.click(resetButton);
    
    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Resetting...')).toBeInTheDocument();
    });
    
    const loadingButton = screen.getByText('Resetting...');
    expect(loadingButton).toBeDisabled();
    expect(loadingButton).toHaveClass('disabled:bg-gray-400', 'disabled:cursor-not-allowed');
    
    // Complete the reset
    resolveReset!({ success: true });
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  test('handles reset error gracefully', async () => {
    window.electron.getDownloadedVideos = vi.fn().mockResolvedValue([mockDownloadedVideoInfo]);
    window.electron.resetDownloadStatus = vi.fn().mockRejectedValue(new Error('Reset failed'));
    
    // Mock console.error to avoid test output noise
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <TestWrapper>
        <LocalPlayerResetUI
          video={mockDownloadedYouTubeVideo}
          onResetDownload={mockOnResetDownload}
        />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Reset Download')).toBeInTheDocument();
    });
    
    const resetButton = screen.getByText('Reset Download');
    fireEvent.click(resetButton);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('[LocalPlayerResetUI] Error resetting download:', expect.any(Error));
    });
    
    // Button should be enabled again after error
    await waitFor(() => {
      expect(screen.getByText('Reset Download')).not.toBeDisabled();
    });
    
    // Should not navigate on error
    expect(mockNavigate).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  test('handles getDownloadedVideos error gracefully', async () => {
    window.electron.getDownloadedVideos = vi.fn().mockRejectedValue(new Error('API error'));
    
    // Mock console.error to avoid test output noise
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const { container } = render(
      <TestWrapper>
        <LocalPlayerResetUI
          video={mockDownloadedYouTubeVideo}
          onResetDownload={mockOnResetDownload}
        />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('[LocalPlayerResetUI] Error checking downloaded videos:', expect.any(Error));
    });
    
    // Should render nothing when API fails
    expect(container.firstChild).toBeNull();
    
    consoleSpy.mockRestore();
  });

  test('works without onResetDownload callback', async () => {
    window.electron.getDownloadedVideos = vi.fn().mockResolvedValue([mockDownloadedVideoInfo]);
    window.electron.resetDownloadStatus = vi.fn().mockResolvedValue({ success: true });
    
    render(
      <TestWrapper>
        <LocalPlayerResetUI
          video={mockDownloadedYouTubeVideo}
        />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Reset Download')).toBeInTheDocument();
    });
    
    const resetButton = screen.getByText('Reset Download');
    fireEvent.click(resetButton);
    
    await waitFor(() => {
      expect(window.electron.resetDownloadStatus).toHaveBeenCalledWith('test-youtube-id');
    });
    
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('re-checks downloaded status when video URL changes', async () => {
    window.electron.getDownloadedVideos = vi.fn().mockResolvedValue([]);
    
    const { rerender } = render(
      <TestWrapper>
        <LocalPlayerResetUI
          video={mockLocalVideo}
          onResetDownload={mockOnResetDownload}
        />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(window.electron.getDownloadedVideos).toHaveBeenCalledTimes(1);
    });
    
    // Change video URL
    const updatedVideo = { ...mockLocalVideo, url: 'file://different-video.mp4' };
    
    rerender(
      <TestWrapper>
        <LocalPlayerResetUI
          video={updatedVideo}
          onResetDownload={mockOnResetDownload}
        />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(window.electron.getDownloadedVideos).toHaveBeenCalledTimes(2);
    });
  });
});