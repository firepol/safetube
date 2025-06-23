import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VideoPlayer } from '../components/VideoPlayer';
import { Video } from '../types';
import { act } from 'react-dom/test-utils';

// Mock video data
const mockVideo: Video = {
  id: '3',
  title: 'Star Trek: Lower Decks S04E01',
  thumbnail: 'https://picsum.photos/320/180',
  url: 'http://192.168.68.51:8200/MediaItems/573.mkv',
  duration: 1500, // 25 minutes in seconds
  type: 'dlna',
  server: '192.168.68.51',
  port: 8200,
  path: '/MediaItems/573.mkv'
};

function mockVideoElement() {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined)
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: vi.fn()
  });
  let _src = '';
  Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    configurable: true,
    get() { return _src; },
    set(val) { _src = val; }
  });
}

describe('VideoPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVideoElement();
  });

  it('renders video player with DLNA video', async () => {
    render(<VideoPlayer video={mockVideo} />);
    // Check if video title is rendered
    expect(screen.getByText(mockVideo.title)).toBeInTheDocument();
    // The video element should not have src until play is clicked
    const videoElement = await screen.findByTestId('video-player');
    expect(videoElement).toBeInTheDocument();
    expect(videoElement).not.toHaveAttribute('src', mockVideo.url);
    // Click play and check src
    const playButton = screen.getByRole('button', { name: /play/i });
    await act(async () => {
      fireEvent.click(playButton);
    });
    await waitFor(() => {
      expect(window.electron.getDlnaFile).toHaveBeenCalledWith(
        '192.168.68.51',
        8200,
        '/MediaItems/573.mkv'
      );
    });
    // After play, src should be set
    expect((videoElement as HTMLVideoElement).src).toBe('http://mockserver:8200/MediaItems/573.mkv');
  });

  it('shows pause button after play is clicked', async () => {
    render(<VideoPlayer video={mockVideo} />);
    const playButton = screen.getByRole('button', { name: /play/i });
    await act(async () => {
      fireEvent.click(playButton);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
    });
  });

  it('shows play button after pause event', async () => {
    render(<VideoPlayer video={mockVideo} />);
    const playButton = screen.getByRole('button', { name: /play/i });
    await act(async () => {
      fireEvent.click(playButton);
    });
    // Simulate pause event
    const videoElement = await screen.findByTestId('video-player');
    fireEvent.pause(videoElement);
    // Play button should be visible again
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    });
  });
}); 