import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { DownloadUI } from './DownloadUI';
import { Video } from '../../types';

// Mock video data for testing
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

const mockLocalVideo: Video = {
  id: 'test-local-id',
  type: 'local',
  title: 'Test Local Video',
  thumbnail: 'file://thumbnail.jpg',
  duration: 180,
  url: 'file://video.mp4',
};

describe('DownloadUI', () => {
  const mockOnStartDownload = vi.fn();
  const mockOnCancelDownload = vi.fn();
  const mockOnResetDownload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders nothing for non-YouTube videos', () => {
    const { container } = render(
      <DownloadUI
        video={mockLocalVideo}
        downloadStatus={{ status: 'idle' }}
        isDownloading={false}
        onStartDownload={mockOnStartDownload}
        onCancelDownload={mockOnCancelDownload}
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when video is null', () => {
    const { container } = render(
      <DownloadUI
        video={null}
        downloadStatus={{ status: 'idle' }}
        isDownloading={false}
        onStartDownload={mockOnStartDownload}
        onCancelDownload={mockOnCancelDownload}
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  test('renders idle state correctly', () => {
    render(
      <DownloadUI
        video={mockYouTubeVideo}
        downloadStatus={{ status: 'idle' }}
        isDownloading={false}
        onStartDownload={mockOnStartDownload}
        onCancelDownload={mockOnCancelDownload}
      />
    );
    
    expect(screen.getByText('Download for Offline')).toBeInTheDocument();
    expect(screen.getByText('Download this video to watch without internet connection')).toBeInTheDocument();
  });

  test('calls onStartDownload when download button is clicked', () => {
    render(
      <DownloadUI
        video={mockYouTubeVideo}
        downloadStatus={{ status: 'idle' }}
        isDownloading={false}
        onStartDownload={mockOnStartDownload}
        onCancelDownload={mockOnCancelDownload}
      />
    );
    
    const downloadButton = screen.getByText('Download for Offline');
    fireEvent.click(downloadButton);
    
    expect(mockOnStartDownload).toHaveBeenCalledTimes(1);
  });

  test('renders downloading state with progress', () => {
    render(
      <DownloadUI
        video={mockYouTubeVideo}
        downloadStatus={{ status: 'downloading', progress: 45 }}
        isDownloading={true}
        onStartDownload={mockOnStartDownload}
        onCancelDownload={mockOnCancelDownload}
      />
    );
    
    expect(screen.getByText('Downloading Video...')).toBeInTheDocument();
    expect(screen.getByText('Downloading video for offline viewing. This may take several minutes.')).toBeInTheDocument();
    expect(screen.getByText('Cancel Download')).toBeInTheDocument();
    
    // Check progress bar
    const progressBar = screen.getByTestId('download-progress-bar');
    expect(progressBar).toHaveStyle({ width: '45%' });
  });

  test('calls onCancelDownload when cancel button is clicked', () => {
    render(
      <DownloadUI
        video={mockYouTubeVideo}
        downloadStatus={{ status: 'downloading', progress: 30 }}
        isDownloading={true}
        onStartDownload={mockOnStartDownload}
        onCancelDownload={mockOnCancelDownload}
      />
    );
    
    const cancelButton = screen.getByText('Cancel Download');
    fireEvent.click(cancelButton);
    
    expect(mockOnCancelDownload).toHaveBeenCalledTimes(1);
  });

  test('renders completed state correctly', () => {
    render(
      <DownloadUI
        video={mockYouTubeVideo}
        downloadStatus={{ status: 'completed' }}
        isDownloading={false}
        onStartDownload={mockOnStartDownload}
        onCancelDownload={mockOnCancelDownload}
      />
    );
    
    expect(screen.getByText('Video Downloaded')).toBeInTheDocument();
    expect(screen.getByText('This video is available offline in your Downloaded folder')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  test('renders failed state with error message', () => {
    const errorMessage = 'Network connection failed';
    render(
      <DownloadUI
        video={mockYouTubeVideo}
        downloadStatus={{ status: 'failed', error: errorMessage }}
        isDownloading={false}
        onStartDownload={mockOnStartDownload}
        onCancelDownload={mockOnCancelDownload}
      />
    );
    
    expect(screen.getByText('Download Failed')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByText('Try Download Again')).toBeInTheDocument();
  });

  test('renders failed state with default error message', () => {
    render(
      <DownloadUI
        video={mockYouTubeVideo}
        downloadStatus={{ status: 'failed' }}
        isDownloading={false}
        onStartDownload={mockOnStartDownload}
        onCancelDownload={mockOnCancelDownload}
      />
    );
    
    expect(screen.getByText('Download Failed')).toBeInTheDocument();
    expect(screen.getByText('An error occurred during download')).toBeInTheDocument();
  });

  test('calls onStartDownload when retry button is clicked in failed state', () => {
    render(
      <DownloadUI
        video={mockYouTubeVideo}
        downloadStatus={{ status: 'failed', error: 'Test error' }}
        isDownloading={false}
        onStartDownload={mockOnStartDownload}
        onCancelDownload={mockOnCancelDownload}
      />
    );
    
    const retryButton = screen.getByText('Try Download Again');
    fireEvent.click(retryButton);
    
    expect(mockOnStartDownload).toHaveBeenCalledTimes(1);
  });

  test('disables download button when isDownloading is true', () => {
    render(
      <DownloadUI
        video={mockYouTubeVideo}
        downloadStatus={{ status: 'idle' }}
        isDownloading={true}
        onStartDownload={mockOnStartDownload}
        onCancelDownload={mockOnCancelDownload}
      />
    );
    
    const downloadButton = screen.getByText('Downloading...');
    expect(downloadButton).toBeDisabled();
  });

  test('does not show reset button in completed state when showResetButton is false', () => {
    render(
      <DownloadUI
        video={mockYouTubeVideo}
        downloadStatus={{ status: 'completed' }}
        isDownloading={false}
        onStartDownload={mockOnStartDownload}
        onCancelDownload={mockOnCancelDownload}
        showResetButton={false}
      />
    );
    
    expect(screen.getByText('Video Downloaded')).toBeInTheDocument();
    expect(screen.queryByText('Reset Download')).not.toBeInTheDocument();
  });

  test('does not show reset button in completed state when onResetDownload is not provided', () => {
    render(
      <DownloadUI
        video={mockYouTubeVideo}
        downloadStatus={{ status: 'completed' }}
        isDownloading={false}
        onStartDownload={mockOnStartDownload}
        onCancelDownload={mockOnCancelDownload}
        showResetButton={true}
      />
    );
    
    expect(screen.getByText('Video Downloaded')).toBeInTheDocument();
    expect(screen.queryByText('Reset Download')).not.toBeInTheDocument();
  });

  test('shows reset button in completed state when showResetButton is true and onResetDownload is provided', () => {
    render(
      <DownloadUI
        video={mockYouTubeVideo}
        downloadStatus={{ status: 'completed' }}
        isDownloading={false}
        onStartDownload={mockOnStartDownload}
        onCancelDownload={mockOnCancelDownload}
        onResetDownload={mockOnResetDownload}
        showResetButton={true}
      />
    );
    
    expect(screen.getByText('Video Downloaded')).toBeInTheDocument();
    expect(screen.getByText('Reset Download')).toBeInTheDocument();
  });

  test('calls onResetDownload when reset button is clicked', () => {
    render(
      <DownloadUI
        video={mockYouTubeVideo}
        downloadStatus={{ status: 'completed' }}
        isDownloading={false}
        onStartDownload={mockOnStartDownload}
        onCancelDownload={mockOnCancelDownload}
        onResetDownload={mockOnResetDownload}
        showResetButton={true}
      />
    );
    
    const resetButton = screen.getByText('Reset Download');
    fireEvent.click(resetButton);
    
    expect(mockOnResetDownload).toHaveBeenCalledTimes(1);
  });

  test('does not show reset button in non-completed states', () => {
    const statuses = ['idle', 'downloading', 'failed'] as const;
    
    statuses.forEach(status => {
      const { unmount } = render(
        <DownloadUI
          video={mockYouTubeVideo}
          downloadStatus={{ status }}
          isDownloading={false}
          onStartDownload={mockOnStartDownload}
          onCancelDownload={mockOnCancelDownload}
          onResetDownload={mockOnResetDownload}
          showResetButton={true}
        />
      );
      
      expect(screen.queryByText('Reset Download')).not.toBeInTheDocument();
      unmount();
    });
  });
});