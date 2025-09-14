import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideoCardBase } from './VideoCardBase';
import * as Tooltip from '@radix-ui/react-tooltip';
import { MemoryRouter } from 'react-router-dom';
import { VideoErrorType } from '../../../shared/videoErrorHandling';

describe('VideoCardBase', () => {
  const mockVideo = {
    id: 'yt-test',
    thumbnail: 'https://example.com/thumb.jpg',
    title: 'Test Video',
    duration: 125, // 2:05
    resumeAt: 60, // 1:00
    watched: true,
    type: 'youtube' as const,
    progress: 50,
  };

  const renderWithProvider = (ui: React.ReactElement) =>
    render(
      <MemoryRouter>
        <Tooltip.Provider>{ui}</Tooltip.Provider>
      </MemoryRouter>
    );

  it('renders video card with all information', () => {
    const { } = renderWithProvider(<VideoCardBase {...mockVideo} />);
    
    // Check title
    expect(screen.getByText('Test Video')).toBeInTheDocument();
    
    // Check duration
    expect(screen.getByText('2:05')).toBeInTheDocument();
    
    // Check type
    expect(screen.getByText('youtube')).toBeInTheDocument();
    
    // Check thumbnail
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/thumb.jpg');
    expect(img).toHaveAttribute('alt', 'Test Video');
  });

  it('shows resume overlay on hover when resumeAt is set', () => {
    renderWithProvider(<VideoCardBase {...mockVideo} />);
    const resumeElements = screen.getAllByText(/Resume at 1:00/);
    expect(resumeElements.length).toBeGreaterThan(0);
  });

  it('does not show resume overlay when resumeAt is null', () => {
    renderWithProvider(<VideoCardBase {...mockVideo} resumeAt={null} />);
    expect(screen.queryByText(/Resume at/)).not.toBeInTheDocument();
  });

  it('shows progress bar when video is watched', () => {
    renderWithProvider(<VideoCardBase {...mockVideo} />);
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBeGreaterThan(0);
    expect(progressBars[0]).toHaveStyle({ width: '50%' });
  });

  it('does not show progress bar when video is not watched', () => {
    renderWithProvider(<VideoCardBase {...mockVideo} watched={false} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('formats duration correctly for videos over an hour', () => {
    renderWithProvider(<VideoCardBase {...mockVideo} duration={3665} />); // 1:01:05
    expect(screen.getByText('1:01:05')).toBeInTheDocument();
  });

  it('renders fallback video card with error indicator', () => {
    const mockErrorInfo = {
      type: VideoErrorType.DELETED,
      message: 'Video has been deleted',
      retryable: false,
      videoId: 'test-video',
      timestamp: '2023-01-01T00:00:00.000Z'
    };

    renderWithProvider(
      <VideoCardBase
        id="test-video"
        thumbnail="/placeholder-thumbnail.svg"
        title="Video test-video (Unavailable)"
        duration={0}
        type="youtube"
        isAvailable={false}
        isFallback={true}
        errorInfo={mockErrorInfo}
      />
    );

    expect(screen.getByText('Video test-video')).toBeInTheDocument();
    expect(screen.getByText('Video Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Open in browser')).toBeInTheDocument();
    expect(screen.getByText('Click to open in YouTube')).toBeInTheDocument();
    expect(screen.getByText('Deleted')).toBeInTheDocument();
  });

  it('renders fallback video card without error info', () => {
    renderWithProvider(
      <VideoCardBase
        id="test-video"
        thumbnail="/placeholder-thumbnail.svg"
        title="Video test-video (Unavailable)"
        duration={0}
        type="youtube"
        isAvailable={false}
        isFallback={true}
      />
    );

    expect(screen.getByText('Video test-video')).toBeInTheDocument();
    expect(screen.getByText('Video Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Open in browser')).toBeInTheDocument();
    expect(screen.getByText('Click to open in YouTube')).toBeInTheDocument();
    // Should not show error indicator when no errorInfo provided
    expect(screen.queryByText('Deleted')).not.toBeInTheDocument();
  });
}); 