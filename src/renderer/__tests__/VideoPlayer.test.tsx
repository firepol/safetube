import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VideoPlayer } from '../components/VideoPlayer';
import { Video } from '../types';
import { act } from 'react-dom/test-utils';

// Mock video data
const mockVideo: Video = {
  id: '3',
  title: 'Star Trek: Lower Decks S04E01',
  description: 'Star Trek: Lower Decks Season 4 Episode 1',
  thumbnailUrl: 'https://picsum.photos/320/180',
  videoUrl: 'http://192.168.68.51:8200/MediaItems/573.mkv',
  duration: '25:00',
  type: 'dlna'
};

describe('VideoPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders video player with DLNA video', async () => {
    render(<VideoPlayer video={mockVideo} />);
    // Check if video title is rendered
    expect(screen.getByText(mockVideo.title)).toBeInTheDocument();
    // Check if video description is rendered
    expect(screen.getByText(mockVideo.description)).toBeInTheDocument();
    // The video element should not have src until play is clicked
    const videoElement = screen.getByTestId('video-player');
    expect(videoElement).toBeInTheDocument();
    expect(videoElement).not.toHaveAttribute('src', mockVideo.videoUrl);
    // Click play and check src
    const playButton = screen.getByRole('button', { name: /play/i });
    await act(async () => {
      fireEvent.click(playButton);
    });
    expect(window.electron.getDlnaFile).toHaveBeenCalledWith(
      '192.168.68.51',
      8200,
      '/MediaItems/573.mkv'
    );
    // After play, src should be set
    expect(videoElement).toHaveAttribute('src', 'http://mockserver:8200/MediaItems/573.mkv');
  });

  it('handles play button click for DLNA video', async () => {
    render(<VideoPlayer video={mockVideo} />);
    const playButton = screen.getByRole('button', { name: /play/i });
    await act(async () => {
      fireEvent.click(playButton);
    });
    expect(window.electron.getDlnaFile).toHaveBeenCalledWith(
      '192.168.68.51',
      8200,
      '/MediaItems/573.mkv'
    );
  });

  it('hides play button after play is clicked', async () => {
    render(<VideoPlayer video={mockVideo} />);
    const playButton = screen.getByRole('button', { name: /play/i });
    await act(async () => {
      fireEvent.click(playButton);
    });
    // After play, play button should not be in the document
    expect(screen.queryByRole('button', { name: /play/i })).toBeNull();
  });

  it('shows play button after pause event', async () => {
    render(<VideoPlayer video={mockVideo} />);
    const playButton = screen.getByRole('button', { name: /play/i });
    await act(async () => {
      fireEvent.click(playButton);
    });
    // Simulate pause event
    const videoElement = screen.getByTestId('video-player');
    fireEvent.pause(videoElement);
    // Play button should be visible again
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
  });
}); 