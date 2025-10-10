import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { VideoCardBase } from './VideoCardBase';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('VideoCardBase URL Encoding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to render VideoCardBase with required providers
  const renderVideoCard = (props: any) => {
    return render(
      <Tooltip.Provider>
        <MemoryRouter>
          <VideoCardBase {...props} />
        </MemoryRouter>
      </Tooltip.Provider>
    );
  };

  it('should URL encode video IDs with colons when navigating', () => {
    const videoId = 'local:/home/user/videos/movie.mp4';

    renderVideoCard({
      id: videoId,
      thumbnail: "/test-thumbnail.jpg",
      title: "Test Movie",
      duration: 120,
      type: "local"
    });

    // Click the thumbnail to navigate
    const thumbnail = screen.getByAltText('Test Movie');
    const thumbnailContainer = thumbnail.closest('.cursor-pointer');
    fireEvent.click(thumbnailContainer!);

    expect(mockNavigate).toHaveBeenCalledWith('/player/local%3A%2Fhome%2Fuser%2Fvideos%2Fmovie.mp4');
  });

  it('should URL encode video IDs with special characters when navigating', () => {
    const videoId = 'local:/home/user/Videos/Fun Cartoon (2024) - Episode 1.mp4';

    renderVideoCard({
      id: videoId,
      thumbnail: "/test-thumbnail.jpg",
      title: "Fun Cartoon Episode",
      duration: 120,
      type: "local"
    });

    // Click the thumbnail to navigate
    const thumbnail = screen.getByAltText('Fun Cartoon Episode');
    const thumbnailContainer = thumbnail.closest('.cursor-pointer');
    fireEvent.click(thumbnailContainer!);

    expect(mockNavigate).toHaveBeenCalledWith('/player/local%3A%2Fhome%2Fuser%2FVideos%2FFun%20Cartoon%20(2024)%20-%20Episode%201.mp4');
  });

  it('should URL encode video IDs with emoji characters when navigating', () => {
    const videoId = 'local:/home/user/Videos/🎬 Movies/Fun Video 🎉.mp4';

    renderVideoCard({
      id: videoId,
      thumbnail: "/test-thumbnail.jpg",
      title: "Fun Video with Emojis",
      duration: 120,
      type: "local"
    });

    // Click the thumbnail to navigate
    const thumbnail = screen.getByAltText('Fun Video with Emojis');
    const thumbnailContainer = thumbnail.closest('.cursor-pointer');
    fireEvent.click(thumbnailContainer!);

    expect(mockNavigate).toHaveBeenCalledWith('/player/local%3A%2Fhome%2Fuser%2FVideos%2F%F0%9F%8E%AC%20Movies%2FFun%20Video%20%F0%9F%8E%89.mp4');
  });

  it('should URL encode DLNA video IDs with special characters', () => {
    const videoId = 'dlna://192.168.1.100:8200/Movies/Action Movie (2024).mp4';

    renderVideoCard({
      id: videoId,
      thumbnail: "/test-thumbnail.jpg",
      title: "Action Movie",
      duration: 120,
      type: "dlna"
    });

    // Click the thumbnail to navigate
    const thumbnail = screen.getByAltText('Action Movie');
    const thumbnailContainer = thumbnail.closest('.cursor-pointer');
    fireEvent.click(thumbnailContainer!);

    expect(mockNavigate).toHaveBeenCalledWith('/player/dlna%3A%2F%2F192.168.1.100%3A8200%2FMovies%2FAction%20Movie%20(2024).mp4');
  });

  it('should not URL encode simple YouTube video IDs', () => {
    const videoId = 'dQw4w9WgXcQ';

    renderVideoCard({
      id: videoId,
      thumbnail: "/test-thumbnail.jpg",
      title: "YouTube Video",
      duration: 120,
      type: "youtube"
    });

    // Click the thumbnail to navigate
    const thumbnail = screen.getByAltText('YouTube Video');
    const thumbnailContainer = thumbnail.closest('.cursor-pointer');
    fireEvent.click(thumbnailContainer!);

    expect(mockNavigate).toHaveBeenCalledWith('/player/dQw4w9WgXcQ');
  });

  it('should handle video IDs with percent signs correctly', () => {
    const videoId = 'local:/home/user/Videos/Test%20Video.mp4';

    renderVideoCard({
      id: videoId,
      thumbnail: "/test-thumbnail.jpg",
      title: "Test Video",
      duration: 120,
      type: "local"
    });

    // Click the thumbnail to navigate
    const thumbnail = screen.getByAltText('Test Video');
    const thumbnailContainer = thumbnail.closest('.cursor-pointer');
    fireEvent.click(thumbnailContainer!);

    expect(mockNavigate).toHaveBeenCalledWith('/player/local%3A%2Fhome%2Fuser%2FVideos%2FTest%2520Video.mp4');
  });

  it('should handle video IDs with question marks and hash symbols', () => {
    const videoId = 'local:/home/user/Videos/Movie? & Hash#.mp4';

    renderVideoCard({
      id: videoId,
      thumbnail: "/test-thumbnail.jpg",
      title: "Movie with Special Chars",
      duration: 120,
      type: "local"
    });

    // Click the thumbnail to navigate
    const thumbnail = screen.getByAltText('Movie with Special Chars');
    const thumbnailContainer = thumbnail.closest('.cursor-pointer');
    fireEvent.click(thumbnailContainer!);

    expect(mockNavigate).toHaveBeenCalledWith('/player/local%3A%2Fhome%2Fuser%2FVideos%2FMovie%3F%20%26%20Hash%23.mp4');
  });

  it('should use custom click handler when provided instead of default navigation', () => {
    const customClickHandler = vi.fn();
    const videoId = 'local:/home/user/videos/movie.mp4';

    renderVideoCard({
      id: videoId,
      thumbnail: "/test-thumbnail.jpg",
      title: "Custom Handler Test",
      duration: 120,
      type: "local",
      onVideoClick: customClickHandler
    });

    // Click the thumbnail to trigger custom handler
    const thumbnail = screen.getByAltText('Custom Handler Test');
    const thumbnailContainer = thumbnail.closest('.cursor-pointer');
    fireEvent.click(thumbnailContainer!);

    expect(customClickHandler).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not navigate for fallback videos', () => {
    const videoId = 'dQw4w9WgXcQ';

    renderVideoCard({
      id: videoId,
      thumbnail: "/test-thumbnail.jpg",
      title: "Unavailable Video",
      duration: 120,
      type: "youtube",
      isFallback: true
    });

    // For fallback videos, the card should not be clickable
    // Check that the thumbnail container doesn't have cursor-pointer class
    const thumbnail = screen.queryByAltText('Unavailable Video');
    expect(thumbnail).not.toBeInTheDocument(); // Fallback videos don't show the normal thumbnail

    // Should show fallback UI
    expect(screen.getByText('Video Unavailable')).toBeInTheDocument();

    // Navigate should not be called for fallback videos
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});