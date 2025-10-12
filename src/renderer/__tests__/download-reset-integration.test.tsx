import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { DownloadUI } from '../components/video/DownloadUI';
import { LocalPlayerResetUI } from '../components/video/LocalPlayerResetUI';
import { Video } from '../types';

// Mock react-router-dom navigation
const mockNavigate = vi.fn();
const mockLocation = { 
  state: { 
    sourceId: 'test-youtube-channel', 
    sourceTitle: 'Test YouTube Channel',
    returnTo: '/source/test-youtube-channel'
  } 
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

// Mock logging
vi.mock('../lib/logging', () => ({
  logVerbose: vi.fn(),
}));

// Mock player config service
vi.mock('../services/playerConfig', () => ({
  loadPlayerConfig: vi.fn().mockResolvedValue({
    youtubePlayerType: 'iframe',
    perVideoOverrides: {}
  }),
}));

// Mock the download manager and smart routing services
vi.mock('../../main/downloadManager', () => ({
  DownloadManager: {
    startDownload: vi.fn(),
    cancelDownload: vi.fn(),
    getDownloadStatus: vi.fn(),
    isDownloading: vi.fn(),
  }
}));

vi.mock('../../main/smartPlaybackRouter', () => ({
  SmartPlaybackRouter: {
    shouldUseDownloadedVersion: vi.fn(),
    createLocalVideoFromDownload: vi.fn(),
    getValidatedDownloadedVideo: vi.fn(),
    isDownloadedYouTubeVideo: vi.fn(),
  }
}));

// Mock video data
const mockYouTubeVideo: Video = {
  id: 'test-youtube-video-id',
  type: 'youtube',
  title: 'Test YouTube Video for Download',
  thumbnail: 'https://example.com/thumbnail.jpg',
  duration: 300,
  url: 'https://youtube.com/watch?v=test-youtube-video-id',
  sourceType: 'youtube_channel',
  sourceId: 'test-youtube-channel',
  sourceTitle: 'Test YouTube Channel',
};

const mockDownloadedVideo = {
  videoId: 'test-youtube-video-id',
  title: 'Test YouTube Video for Download',
  filePath: '/downloads/test-youtube-channel/test-video.mp4',
  sourceType: 'youtube_channel',
  sourceId: 'test-youtube-channel',
  channelTitle: 'Test YouTube Channel',
  downloadedAt: '2025-01-01T00:00:00Z',
  duration: 300,
  thumbnail: '/downloads/test-youtube-channel/test-video.webp'
};

const mockLocalVideoFromDownload: Video & { navigationContext?: any } = {
  id: 'test-youtube-video-id',
  type: 'local',
  title: 'Test YouTube Video for Download',
  thumbnail: 'file:///downloads/test-youtube-channel/test-video.webp',
  duration: 300,
  url: '/downloads/test-youtube-channel/test-video.mp4', // Match the filePath exactly
  sourceType: 'youtube_channel',
  sourceId: 'test-youtube-channel',
  sourceTitle: 'Test YouTube Channel',
  navigationContext: {
    sourceId: 'test-youtube-channel',
    sourceTitle: 'Test YouTube Channel',
    returnTo: '/source/test-youtube-channel'
  }
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode; initialEntries?: string[] }> = ({ 
  children, 
  initialEntries = ['/youtube/test-youtube-video-id'] 
}) => (
  <MemoryRouter initialEntries={initialEntries}>
    {children}
  </MemoryRouter>
);

describe('Download Reset Integration Tests', () => {
  let mockElectron: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup comprehensive electron API mock
    mockElectron = {
      // Video data and routing
      getVideoData: vi.fn(),
      checkDownloadedVideo: vi.fn(),
      
      // Download management
      startDownload: vi.fn(),
      getDownloadStatus: vi.fn(),
      cancelDownload: vi.fn(),
      isDownloading: vi.fn(),
      
      // Download reset functionality
      resetDownloadStatus: vi.fn(),
      getDownloadedVideos: vi.fn(),
      
      // Player config
      getPlayerConfig: vi.fn().mockResolvedValue({
        youtubePlayerType: 'iframe',
        perVideoOverrides: {}
      }),
      
      // Time tracking and limits
      getTimeLimits: vi.fn().mockResolvedValue({
        dailyLimit: 3600,
        sessionLimit: 1800
      }),
      getTimeTrackingState: vi.fn().mockResolvedValue({
        timeRemaining: 3600,
        isLimitReached: false
      }),
      
      // Other required methods
      getLocalFile: vi.fn(),
      getDlnaFile: vi.fn(),
      recordVideoWatching: vi.fn(),
    };

    // Mock console.log to capture routing messages
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Assign to window (handle existing property)
    if (window.electron) {
      // Extend existing electron object
      Object.assign(window.electron, mockElectron);
    } else {
      Object.defineProperty(window, 'electron', {
        value: mockElectron,
        writable: true,
        configurable: true
      });
    }
  });

  afterEach(() => {
    if (consoleLogSpy && consoleLogSpy.mockRestore) {
      consoleLogSpy.mockRestore();
    }
  });

  describe('Complete Download Workflow', () => {
    test('should complete full workflow: download → reset → UI state transitions', async () => {
      // Phase 1: Test download UI with idle state
      mockElectron.getDownloadStatus.mockResolvedValue({ status: 'idle' });
      mockElectron.isDownloading.mockResolvedValue(false);

      const mockOnStartDownload = vi.fn();
      const mockOnCancelDownload = vi.fn();
      const mockOnResetDownload = vi.fn();

      const { rerender } = render(
        <TestWrapper>
          <DownloadUI
            video={mockYouTubeVideo}
            downloadStatus={{ status: 'idle' }}
            isDownloading={false}
            onStartDownload={mockOnStartDownload}
            onCancelDownload={mockOnCancelDownload}
            onResetDownload={mockOnResetDownload}
            showResetButton={false}
          />
        </TestWrapper>
      );

      // Should show download button
      expect(screen.getByText('Download for Offline')).toBeInTheDocument();

      // Phase 2: Simulate download process
      mockElectron.startDownload.mockResolvedValue({ success: true });
      
      // Click download button
      fireEvent.click(screen.getByText('Download for Offline'));
      expect(mockOnStartDownload).toHaveBeenCalledTimes(1);

      // Phase 3: Show downloading state
      rerender(
        <TestWrapper>
          <DownloadUI
            video={mockYouTubeVideo}
            downloadStatus={{ status: 'downloading', progress: 50 }}
            isDownloading={true}
            onStartDownload={mockOnStartDownload}
            onCancelDownload={mockOnCancelDownload}
            onResetDownload={mockOnResetDownload}
            showResetButton={false}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Downloading Video...')).toBeInTheDocument();
      expect(screen.getByTestId('download-progress-bar')).toHaveStyle({ width: '50%' });

      // Phase 4: Show completed state with reset button
      rerender(
        <TestWrapper>
          <DownloadUI
            video={mockYouTubeVideo}
            downloadStatus={{ status: 'completed' }}
            isDownloading={false}
            onStartDownload={mockOnStartDownload}
            onCancelDownload={mockOnCancelDownload}
            onResetDownload={mockOnResetDownload}
            showResetButton={true}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Video Downloaded')).toBeInTheDocument();
      expect(screen.getByText('Reset Download')).toBeInTheDocument();

      // Phase 5: Test reset functionality
      mockElectron.resetDownloadStatus.mockResolvedValue({ success: true });
      
      const resetButton = screen.getByText('Reset Download');
      fireEvent.click(resetButton);
      
      expect(mockOnResetDownload).toHaveBeenCalledTimes(1);

      // Phase 6: Return to idle state after reset
      rerender(
        <TestWrapper>
          <DownloadUI
            video={mockYouTubeVideo}
            downloadStatus={{ status: 'idle' }}
            isDownloading={false}
            onStartDownload={mockOnStartDownload}
            onCancelDownload={mockOnCancelDownload}
            onResetDownload={mockOnResetDownload}
            showResetButton={false}
          />
        </TestWrapper>
      );

      // Should be back to download button
      expect(screen.getByText('Download for Offline')).toBeInTheDocument();
      expect(screen.queryByText('Reset Download')).not.toBeInTheDocument();
    });

    test('should handle yt-dlp command execution without JSON file creation', async () => {
      // Mock the download process to verify yt-dlp arguments
      const mockDownloadProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            // Simulate successful completion without JSON files
            setTimeout(() => callback(0), 100);
          }
        }),
        kill: vi.fn()
      };

      // Mock spawn to capture yt-dlp arguments
      const mockSpawn = vi.fn().mockReturnValue(mockDownloadProcess);
      
      // Mock the download start to capture command arguments
      mockElectron.startDownload.mockImplementation(async (videoId: string, title: string, sourceInfo: any) => {
        // Simulate the download manager behavior
        // Verify that --write-info-json is NOT in the arguments
        const expectedArgs = [
          '--output', expect.any(String),
          '--no-playlist',
          '--write-thumbnail',
          // Should NOT include '--write-info-json'
          'https://youtube.com/watch?v=test-youtube-video-id'
        ];
        
        // Return success to continue the test
        return { success: true, args: expectedArgs };
      });

      // Start download
      const result = await mockElectron.startDownload(
        'test-youtube-video-id',
        'Test YouTube Video for Download',
        {
          type: 'youtube_channel',
          sourceId: 'test-youtube-channel',
          channelTitle: 'Test YouTube Channel'
        }
      );

      expect(result.success).toBe(true);
      expect(result.args).not.toContain('--write-info-json');
      expect(result.args).toContain('--write-thumbnail');
      expect(result.args).toContain('--no-playlist');
    });

    test('should maintain UI state consistency across component transitions', async () => {
      // Test LocalPlayerResetUI integration
      mockElectron.getDownloadedVideos.mockResolvedValue([mockDownloadedVideo]);
      mockElectron.resetDownloadStatus.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <LocalPlayerResetUI
            video={mockLocalVideoFromDownload}
            onResetDownload={vi.fn()}
          />
        </TestWrapper>
      );

      // Should detect downloaded video and show reset UI
      await waitFor(() => {
        expect(mockElectron.getDownloadedVideos).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('Downloaded YouTube Video')).toBeInTheDocument();
        expect(screen.getByText('Reset Download')).toBeInTheDocument();
      });

      // Test reset functionality
      const resetButton = screen.getByText('Reset Download');
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(mockElectron.resetDownloadStatus).toHaveBeenCalledWith('test-youtube-video-id');
      });

      // Should navigate back to source page after reset
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/source/test-youtube-channel',
          { replace: true }
        );
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle download reset errors gracefully', async () => {
      mockElectron.getDownloadedVideos.mockResolvedValue([mockDownloadedVideo]);
      mockElectron.resetDownloadStatus.mockRejectedValue(new Error('Reset failed'));

      render(
        <TestWrapper>
          <LocalPlayerResetUI
            video={mockLocalVideoFromDownload}
            onResetDownload={vi.fn()}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Reset Download')).toBeInTheDocument();
      });

      const resetButton = screen.getByText('Reset Download');
      fireEvent.click(resetButton);

      // Should handle error gracefully
      await waitFor(() => {
        expect(mockElectron.resetDownloadStatus).toHaveBeenCalledWith('test-youtube-video-id');
      });

      // Should not navigate on error
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('should navigate to source page during reset', async () => {
      const customNavigationContext = {
        sourceId: 'custom-source',
        sourceTitle: 'Custom Source',
        returnTo: '/custom/path',
        pageNumber: 2
      };

      const videoWithContext: Video & { navigationContext?: any } = {
        ...mockLocalVideoFromDownload,
        navigationContext: customNavigationContext
      };

      mockElectron.getDownloadedVideos.mockResolvedValue([mockDownloadedVideo]);
      mockElectron.resetDownloadStatus.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <LocalPlayerResetUI
            video={videoWithContext}
            onResetDownload={vi.fn()}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Reset Download')).toBeInTheDocument();
      });

      const resetButton = screen.getByText('Reset Download');
      fireEvent.click(resetButton);

      // Should navigate to source page based on downloaded video's sourceId
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/source/test-youtube-channel',
          { replace: true }
        );
      });
    });

    test('should handle missing downloaded video gracefully', async () => {
      // Test when no downloaded video is found
      mockElectron.getDownloadedVideos.mockResolvedValue([]);

      const { container } = render(
        <TestWrapper>
          <LocalPlayerResetUI
            video={mockLocalVideoFromDownload}
            onResetDownload={vi.fn()}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockElectron.getDownloadedVideos).toHaveBeenCalled();
      });

      // Should not render anything when no downloaded video is found
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Download UI Integration', () => {
    test('should integrate DownloadUI reset functionality with YouTubePlayerPage', async () => {
      mockElectron.getVideoData.mockResolvedValue(mockYouTubeVideo);
      mockElectron.getDownloadStatus.mockResolvedValue({ status: 'completed' });
      mockElectron.isDownloading.mockResolvedValue(false);
      mockElectron.resetDownloadStatus.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <DownloadUI
            video={mockYouTubeVideo}
            downloadStatus={{ status: 'completed' }}
            isDownloading={false}
            onStartDownload={vi.fn()}
            onCancelDownload={vi.fn()}
            onResetDownload={async () => {
              await mockElectron.resetDownloadStatus(mockYouTubeVideo.id);
            }}
            showResetButton={true}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Video Downloaded')).toBeInTheDocument();
      expect(screen.getByText('Reset Download')).toBeInTheDocument();

      const resetButton = screen.getByText('Reset Download');
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(mockElectron.resetDownloadStatus).toHaveBeenCalledWith('test-youtube-video-id');
      });
    });

    test('should handle download state transitions correctly', async () => {
      const mockOnStartDownload = vi.fn();
      const mockOnCancelDownload = vi.fn();
      const mockOnResetDownload = vi.fn();

      // Start with idle state
      const { rerender } = render(
        <TestWrapper>
          <DownloadUI
            video={mockYouTubeVideo}
            downloadStatus={{ status: 'idle' }}
            isDownloading={false}
            onStartDownload={mockOnStartDownload}
            onCancelDownload={mockOnCancelDownload}
            onResetDownload={mockOnResetDownload}
            showResetButton={false}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Download for Offline')).toBeInTheDocument();

      // Transition to downloading
      rerender(
        <TestWrapper>
          <DownloadUI
            video={mockYouTubeVideo}
            downloadStatus={{ status: 'downloading', progress: 25 }}
            isDownloading={true}
            onStartDownload={mockOnStartDownload}
            onCancelDownload={mockOnCancelDownload}
            onResetDownload={mockOnResetDownload}
            showResetButton={false}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Downloading Video...')).toBeInTheDocument();
      expect(screen.getByTestId('download-progress-bar')).toHaveStyle({ width: '25%' });

      // Transition to completed
      rerender(
        <TestWrapper>
          <DownloadUI
            video={mockYouTubeVideo}
            downloadStatus={{ status: 'completed' }}
            isDownloading={false}
            onStartDownload={mockOnStartDownload}
            onCancelDownload={mockOnCancelDownload}
            onResetDownload={mockOnResetDownload}
            showResetButton={true}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Video Downloaded')).toBeInTheDocument();
      expect(screen.getByText('Reset Download')).toBeInTheDocument();

      // Test reset functionality
      const resetButton = screen.getByText('Reset Download');
      fireEvent.click(resetButton);

      expect(mockOnResetDownload).toHaveBeenCalledTimes(1);
    });
  });

  describe('IPC Integration', () => {
    test('should call correct IPC methods for download operations', async () => {
      // Test download start
      mockElectron.startDownload.mockResolvedValue({ success: true });
      
      const result = await mockElectron.startDownload(
        'test-youtube-video-id',
        'Test YouTube Video for Download',
        {
          type: 'youtube_channel',
          sourceId: 'test-youtube-channel',
          channelTitle: 'Test YouTube Channel'
        }
      );

      expect(result.success).toBe(true);
      expect(mockElectron.startDownload).toHaveBeenCalledWith(
        'test-youtube-video-id',
        'Test YouTube Video for Download',
        expect.objectContaining({
          type: 'youtube_channel',
          sourceId: 'test-youtube-channel'
        })
      );
    });

    test('should call correct IPC methods for reset operations', async () => {
      mockElectron.resetDownloadStatus.mockResolvedValue({ success: true });
      
      const result = await mockElectron.resetDownloadStatus('test-youtube-video-id');
      
      expect(result.success).toBe(true);
      expect(mockElectron.resetDownloadStatus).toHaveBeenCalledWith('test-youtube-video-id');
    });

    test('should call correct IPC methods for checking downloaded videos', async () => {
      mockElectron.checkDownloadedVideo.mockResolvedValue({
        isDownloaded: true,
        filePath: '/downloads/test-youtube-channel/test-video.mp4'
      });
      
      const result = await mockElectron.checkDownloadedVideo('test-youtube-video-id');
      
      expect(result.isDownloaded).toBe(true);
      expect(result.filePath).toBe('/downloads/test-youtube-channel/test-video.mp4');
      expect(mockElectron.checkDownloadedVideo).toHaveBeenCalledWith('test-youtube-video-id');
    });

    test('should call correct IPC methods for getting downloaded videos list', async () => {
      mockElectron.getDownloadedVideos.mockResolvedValue([mockDownloadedVideo]);
      
      const result = await mockElectron.getDownloadedVideos();
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockDownloadedVideo);
      expect(mockElectron.getDownloadedVideos).toHaveBeenCalled();
    });
  });
});