import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { VideoCardBase } from './VideoCardBase';
import { VideoErrorType } from '../../../shared/videoErrorHandling';
import * as Tooltip from '@radix-ui/react-tooltip';

// Mock window.electron (not needed for external links but kept for consistency)
const mockElectron = {};

// Mock window.electron
Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true
});

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Wrapper component for tests
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <Tooltip.Provider>
      {children}
    </Tooltip.Provider>
  </BrowserRouter>
);

describe('VideoCardBase External Link Opening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should render fallback video as non-interactive card', () => {
    const props = {
      id: 'dQw4w9WgXcQ',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isAvailable: false,
      isFallback: true,
      errorInfo: {
        type: VideoErrorType.DELETED,
        message: 'Video has been deleted',
        retryable: false
      }
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    // Should show fallback UI without being clickable
    expect(screen.getByText('Video dQw4w9WgXcQ')).toBeInTheDocument();
    expect(screen.getByText('Video unavailable')).toBeInTheDocument();
    expect(screen.getByText('Deleted')).toBeInTheDocument();

    // Should not have any link elements
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    // Verify that navigate is not called
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('should navigate when clicking thumbnail of available video', () => {
    const props = {
      id: 'dQw4w9WgXcQ',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isAvailable: true,
      isFallback: false
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    // Find the thumbnail area and click it
    const thumbnailArea = screen.getByAltText('Test Video').closest('div');
    expect(thumbnailArea).toBeTruthy();
    fireEvent.click(thumbnailArea!);

    // Verify that navigate was called
    expect(mockNavigate).toHaveBeenCalledWith('/player/dQw4w9WgXcQ');
  });

  test('should display fallback UI for unavailable videos', () => {
    const props = {
      id: 'dQw4w9WgXcQ',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isAvailable: false,
      isFallback: true,
      errorInfo: {
        type: VideoErrorType.PRIVATE,
        message: 'Video is private',
        retryable: false
      }
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    // Check for fallback UI elements
    expect(screen.getByText('Video Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(screen.getByText('Video dQw4w9WgXcQ')).toBeInTheDocument();
    expect(screen.getByText('Video unavailable')).toBeInTheDocument();
  });

  test('should display correct error type indicators', () => {
    const testCases = [
      { type: VideoErrorType.DELETED, expectedText: 'Deleted' },
      { type: VideoErrorType.PRIVATE, expectedText: 'Private' },
      { type: VideoErrorType.RESTRICTED, expectedText: 'Restricted' },
      { type: VideoErrorType.API_ERROR, expectedText: 'Unavailable' }
    ];

    testCases.forEach(({ type, expectedText }) => {
      const props = {
        id: 'dQw4w9WgXcQ',
        thumbnail: 'test-thumbnail.jpg',
        title: 'Test Video',
        duration: 180,
        type: 'youtube' as const,
        isAvailable: false,
        isFallback: true,
        errorInfo: {
          type,
          message: 'Test error',
          retryable: false
        }
      };

      const { unmount } = render(
        <TestWrapper>
          <VideoCardBase {...props} />
        </TestWrapper>
      );

      expect(screen.getByText(expectedText)).toBeInTheDocument();
      
      unmount();
    });
  });

  test('should allow text selection on video titles', () => {
    const props = {
      id: 'dQw4w9WgXcQ',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video with Selectable Text',
      duration: 180,
      type: 'youtube' as const
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    // Should render title with selectable text class
    const titleElement = screen.getByText('Test Video with Selectable Text');
    expect(titleElement).toBeInTheDocument();
    expect(titleElement).toHaveClass('select-text');
  });

  test('should show watched checkmark overlay for watched videos', () => {
    const props = {
      id: 'dQw4w9WgXcQ',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      watched: true
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    // Check for the checkmark overlay
    const checkmark = screen.getByText('✓');
    expect(checkmark).toBeInTheDocument();
    expect(checkmark).toHaveClass('bg-green-500', 'text-white', 'rounded-full');
  });

  test('should not show watched checkmark for unwatched videos', () => {
    const props = {
      id: 'dQw4w9WgXcQ',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      watched: false
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    // Check that checkmark is not present
    const checkmark = screen.queryByText('✓');
    expect(checkmark).not.toBeInTheDocument();
  });

  test('should show violet background on type label for clicked videos', () => {
    const props = {
      id: 'dQw4w9WgXcQ',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isClicked: true
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    // Find the type label and check for violet background
    const typeLabel = screen.getByText('youtube');
    expect(typeLabel).toHaveClass('bg-violet-500', 'text-white', 'px-2', 'py-1', 'rounded');
  });

  test('should not show violet background for non-clicked videos', () => {
    const props = {
      id: 'dQw4w9WgXcQ',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isClicked: false
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    // Find the type label and check that violet background is not present
    const typeLabel = screen.getByText('youtube');
    expect(typeLabel).not.toHaveClass('bg-violet-500', 'text-white', 'px-2', 'py-1', 'rounded');
    expect(typeLabel).toHaveClass('text-muted-foreground');
  });

  test('should handle both watched and clicked states simultaneously', () => {
    const props = {
      id: 'dQw4w9WgXcQ',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      watched: true,
      isClicked: true
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    // Check for checkmark
    const checkmark = screen.getByText('✓');
    expect(checkmark).toBeInTheDocument();

    // Check for violet type label
    const typeLabel = screen.getByText('youtube');
    expect(typeLabel).toHaveClass('bg-violet-500', 'text-white', 'px-2', 'py-1', 'rounded');

    // Check for white faded overlay on watched videos
    const thumbnail = checkmark.closest('.relative');
    const overlay = thumbnail?.querySelector('.bg-white\\/40');
    expect(overlay).toBeInTheDocument();
  });
});

describe('VideoCardBase Wishlist Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should show wishlist button for unapproved source videos', () => {
    const props = {
      id: 'test-video-1',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isApprovedSource: false,
      showWishlistButton: true,
      channelName: 'Test Channel',
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    expect(screen.getByText('+ Add to Wishlist')).toBeInTheDocument();
    expect(screen.getByText('Test Channel')).toBeInTheDocument();
  });

  test('should not show wishlist button for approved source videos', () => {
    const props = {
      id: 'test-video-1',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isApprovedSource: true,
      showWishlistButton: true,
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    expect(screen.queryByText('+ Add to Wishlist')).not.toBeInTheDocument();
  });

  test('should show disabled wishlist button when video is already in wishlist', () => {
    const props = {
      id: 'test-video-1',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isApprovedSource: false,
      isInWishlist: true,
      wishlistStatus: 'pending' as const,
      showWishlistButton: true,
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    const wishlistButton = screen.getByText('Pending Approval');
    expect(wishlistButton).toBeInTheDocument();
    expect(wishlistButton).toBeDisabled();
  });

  test('should call onWishlistAdd when wishlist button is clicked', () => {
    const mockOnWishlistAdd = vi.fn();
    const props = {
      id: 'test-video-1',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isApprovedSource: false,
      showWishlistButton: true,
      onWishlistAdd: mockOnWishlistAdd,
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    const wishlistButton = screen.getByText('+ Add to Wishlist');
    fireEvent.click(wishlistButton);

    expect(mockOnWishlistAdd).toHaveBeenCalledWith(expect.objectContaining({
      id: 'test-video-1',
      title: 'Test Video',
    }));
  });

  test('should prevent video click when wishlist button is clicked', () => {
    const mockOnVideoClick = vi.fn();
    const mockOnWishlistAdd = vi.fn();
    const props = {
      id: 'test-video-1',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isApprovedSource: false,
      showWishlistButton: true,
      onVideoClick: mockOnVideoClick,
      onWishlistAdd: mockOnWishlistAdd,
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    const wishlistButton = screen.getByText('+ Add to Wishlist');
    fireEvent.click(wishlistButton);

    expect(mockOnWishlistAdd).toHaveBeenCalled();
    expect(mockOnVideoClick).not.toHaveBeenCalled();
  });

  test('should show "Needs Approval" badge for unapproved source videos', () => {
    const props = {
      id: 'test-video-1',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isApprovedSource: false,
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    expect(screen.getByText('Needs Approval')).toBeInTheDocument();
  });

  test('should show wishlist status badge when video is in wishlist', () => {
    const props = {
      id: 'test-video-1',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isApprovedSource: false,
      isInWishlist: true,
      wishlistStatus: 'approved' as const,
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  test('should show video details dialog for unapproved videos when clicked', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const props = {
      id: 'test-video-1',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isApprovedSource: false,
      channelName: 'Test Channel',
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    const thumbnail = screen.getByRole('img');
    fireEvent.click(thumbnail);

    // Should show video details dialog instead of navigating
    expect(screen.getByText('Video Details')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  test('should navigate to video player for approved source videos when clicked', () => {
    const props = {
      id: 'test-video-1',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isApprovedSource: true,
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    const thumbnail = screen.getByRole('img');
    fireEvent.click(thumbnail);

    expect(mockNavigate).toHaveBeenCalledWith('/player/test-video-1');
  });

  test('should show different wishlist button text based on status', () => {
    const testCases = [
      { status: 'pending' as const, expectedText: 'Pending Approval' },
      { status: 'approved' as const, expectedText: 'Approved' },
      { status: 'denied' as const, expectedText: 'Denied' },
    ];

    testCases.forEach(({ status, expectedText }) => {
      const { unmount } = render(
        <TestWrapper>
          <VideoCardBase
            id="test-video-1"
            thumbnail="test-thumbnail.jpg"
            title="Test Video"
            duration={180}
            type="youtube"
            isApprovedSource={false}
            isInWishlist={true}
            wishlistStatus={status}
            showWishlistButton={true}
          />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: expectedText })).toBeInTheDocument();
      unmount();
    });
  });
});