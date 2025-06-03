import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideoGrid } from './VideoGrid';
import { VideoCardBaseProps } from '../video/VideoCardBase';
import * as Tooltip from '@radix-ui/react-tooltip';

describe('VideoGrid', () => {
  const mockVideos: VideoCardBaseProps[] = [
    {
      thumbnail: 'https://example.com/thumb1.jpg',
      title: 'YouTube Video 1',
      duration: 120,
      resumeAt: null,
      watched: false,
      type: 'youtube',
      progress: 0,
    },
    {
      thumbnail: 'https://example.com/thumb2.jpg',
      title: 'DLNA Video 1',
      duration: 180,
      resumeAt: 60,
      watched: true,
      type: 'dlna',
      progress: 50,
    },
    {
      thumbnail: 'https://example.com/thumb3.jpg',
      title: 'Local Video 1',
      duration: 240,
      resumeAt: null,
      watched: false,
      type: 'local',
      progress: 0,
    },
  ];

  const renderWithProvider = (ui: React.ReactElement) =>
    render(<Tooltip.Provider>{ui}</Tooltip.Provider>);

  it('renders videos grouped by type', () => {
    renderWithProvider(<VideoGrid videos={mockVideos} />);
    
    // Check if type headers are rendered
    const headers = screen.getAllByRole('heading', { level: 2 });
    expect(headers).toHaveLength(3);
    expect(headers[0]).toHaveTextContent('youtube');
    expect(headers[1]).toHaveTextContent('dlna');
    expect(headers[2]).toHaveTextContent('local');
    
    // Check if all videos are rendered
    expect(screen.getByText('YouTube Video 1')).toBeInTheDocument();
    expect(screen.getByText('DLNA Video 1')).toBeInTheDocument();
    expect(screen.getByText('Local Video 1')).toBeInTheDocument();
  });

  it('renders videos without grouping when groupByType is false', () => {
    renderWithProvider(<VideoGrid videos={mockVideos} groupByType={false} />);
    
    // Check that type headers are not rendered
    const headers = screen.queryAllByRole('heading', { level: 2 });
    expect(headers).toHaveLength(0);
    
    // Check if all videos are still rendered
    expect(screen.getByText('YouTube Video 1')).toBeInTheDocument();
    expect(screen.getByText('DLNA Video 1')).toBeInTheDocument();
    expect(screen.getByText('Local Video 1')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = renderWithProvider(
      <VideoGrid videos={mockVideos} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
}); 