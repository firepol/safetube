import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { WishlistProvider, useWishlist } from '../WishlistContext';
import { WishlistItem, VideoData } from '../../../shared/types';

// Mock electron API
const mockElectron = {
  wishlistGetByStatus: vi.fn(),
  wishlistAdd: vi.fn(),
  wishlistRemove: vi.fn(),
  wishlistApprove: vi.fn(),
  wishlistDeny: vi.fn(),
  onWishlistUpdated: vi.fn(),
  offWishlistUpdated: vi.fn()
};

// Mock window.electron
Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true
});

// Test component that uses the wishlist context
const TestComponent: React.FC = () => {
  const {
    wishlistData,
    wishlistCounts,
    isLoading,
    error,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    getUnreadCount
  } = useWishlist();

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'loaded'}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <div data-testid="pending-count">{wishlistCounts.pending}</div>
      <div data-testid="approved-count">{wishlistCounts.approved}</div>
      <div data-testid="denied-count">{wishlistCounts.denied}</div>
      <div data-testid="total-count">{wishlistCounts.total}</div>
      <div data-testid="unread-count">{getUnreadCount()}</div>
      <div data-testid="is-in-wishlist">{isInWishlist('test-video-1').inWishlist ? 'yes' : 'no'}</div>
      <button
        data-testid="add-button"
        onClick={() => addToWishlist({
          id: 'test-video-1',
          title: 'Test Video',
          url: 'https://example.com/video',
          thumbnail: 'https://example.com/thumb.jpg',
          description: 'Test description',
          channelId: 'test-channel',
          channelName: 'Test Channel',
          duration: 120,
          publishedAt: '2024-01-01T00:00:00Z'
        })}
      >
        Add to Wishlist
      </button>
      <button
        data-testid="remove-button"
        onClick={() => removeFromWishlist('test-video-1')}
      >
        Remove from Wishlist
      </button>
    </div>
  );
};

describe('WishlistContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockElectron.wishlistGetByStatus.mockImplementation((status: string) => {
      const mockItems: Record<string, WishlistItem[]> = {
        pending: [
          {
            id: 1,
            video_id: 'pending-video-1',
            title: 'Pending Video 1',
            thumbnail: 'https://example.com/thumb1.jpg',
            description: 'Pending video description',
            channel_id: 'channel-1',
            channel_name: 'Channel 1',
            duration: 120,
            url: 'https://example.com/video1',
            status: 'pending' as const,
            requested_at: '2024-01-01T00:00:00Z',
            reviewed_at: null,
            reviewed_by: null,
            denial_reason: null,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        ],
        approved: [
          {
            id: 2,
            video_id: 'approved-video-1',
            title: 'Approved Video 1',
            thumbnail: 'https://example.com/thumb2.jpg',
            description: 'Approved video description',
            channel_id: 'channel-2',
            channel_name: 'Channel 2',
            duration: 180,
            url: 'https://example.com/video2',
            status: 'approved' as const,
            requested_at: '2024-01-01T00:00:00Z',
            reviewed_at: '2024-01-01T01:00:00Z',
            reviewed_by: 'parent',
            denial_reason: null,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T01:00:00Z'
          }
        ],
        denied: []
      };
      return Promise.resolve({ success: true, data: mockItems[status] || [] });
    });

    mockElectron.wishlistAdd.mockResolvedValue({ success: true });
    mockElectron.wishlistRemove.mockResolvedValue({ success: true });
    mockElectron.wishlistApprove.mockResolvedValue({ success: true });
    mockElectron.wishlistDeny.mockResolvedValue({ success: true });
    mockElectron.onWishlistUpdated.mockReturnValue(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should provide wishlist context', async () => {
    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    // Check counts
    expect(screen.getByTestId('pending-count')).toHaveTextContent('1');
    expect(screen.getByTestId('approved-count')).toHaveTextContent('1');
    expect(screen.getByTestId('denied-count')).toHaveTextContent('0');
    expect(screen.getByTestId('total-count')).toHaveTextContent('2');
  });

  it('should load wishlist data on mount', async () => {
    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    await waitFor(() => {
      expect(mockElectron.wishlistGetByStatus).toHaveBeenCalledWith('pending');
      expect(mockElectron.wishlistGetByStatus).toHaveBeenCalledWith('approved');
      expect(mockElectron.wishlistGetByStatus).toHaveBeenCalledWith('denied');
    });
  });

  it('should check if video is in wishlist', async () => {
    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    // Initially not in wishlist
    expect(screen.getByTestId('is-in-wishlist')).toHaveTextContent('no');
  });

  it('should add video to wishlist', async () => {
    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    // Click add button
    const addButton = screen.getByTestId('add-button');
    await act(async () => {
      addButton.click();
    });

    await waitFor(() => {
      expect(mockElectron.wishlistAdd).toHaveBeenCalledWith({
        id: 'test-video-1',
        title: 'Test Video',
        url: 'https://example.com/video',
        thumbnail: 'https://example.com/thumb.jpg',
        description: 'Test description',
        channelId: 'test-channel',
        channelName: 'Test Channel',
        duration: 120,
        publishedAt: '2024-01-01T00:00:00Z'
      });
    });
  });

  it('should remove video from wishlist', async () => {
    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    // Click remove button
    const removeButton = screen.getByTestId('remove-button');
    await act(async () => {
      removeButton.click();
    });

    await waitFor(() => {
      expect(mockElectron.wishlistRemove).toHaveBeenCalledWith('test-video-1');
    });
  });

  it('should handle errors gracefully', async () => {
    // Mock error
    mockElectron.wishlistGetByStatus.mockRejectedValue(new Error('Database error'));

    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Database error');
    });
  });

  it('should set up wishlist update event listener', () => {
    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    expect(mockElectron.onWishlistUpdated).toHaveBeenCalled();
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useWishlist must be used within a WishlistProvider');

    consoleSpy.mockRestore();
  });
});