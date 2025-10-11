import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WishlistPage } from '../WishlistPage';

// Mock window.electron for TimeIndicator component
beforeEach(() => {
  global.window.electron = {
    getTimeTrackingState: vi.fn().mockResolvedValue({
      currentDate: '2025-01-01',
      timeUsedToday: 0,
      timeLimitToday: 3600,
      timeRemaining: 3600,
      isLimitReached: false
    }),
    getTimeLimits: vi.fn().mockResolvedValue({
      countdownWarningSeconds: 60,
      audioWarningSeconds: 10
    })
  } as any;
});

// Mock the WishlistContext
let mockWishlistContext = {
  wishlistData: {
    pending: [],
    approved: [],
    denied: []
  },
  wishlistCounts: {
    pending: 0,
    approved: 0,
    denied: 0
  },
  isLoading: false,
  error: null,
  removeFromWishlist: vi.fn(),
  refreshWishlist: vi.fn(),
  isInWishlist: vi.fn()
};

vi.mock('../../contexts/WishlistContext', () => ({
  useWishlist: () => mockWishlistContext
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/wishlist', state: null })
  };
});

describe('WishlistPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset context to default state
    mockWishlistContext = {
      wishlistData: {
        pending: [],
        approved: [],
        denied: []
      },
      wishlistCounts: {
        pending: 0,
        approved: 0,
        denied: 0
      },
      isLoading: false,
      error: null,
      removeFromWishlist: vi.fn(),
      refreshWishlist: vi.fn(),
      isInWishlist: vi.fn()
    };
  });

  it('renders the wishlist page with tabs', () => {
    render(
      <BrowserRouter>
        <WishlistPage />
      </BrowserRouter>
    );

    expect(screen.getByText('My Wishlist')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Denied')).toBeInTheDocument();
  });

  it('shows empty state when no videos in current tab', () => {
    render(
      <BrowserRouter>
        <WishlistPage />
      </BrowserRouter>
    );

    expect(screen.getByText('No videos waiting for approval')).toBeInTheDocument();
    expect(screen.getByText('When you add videos to your wishlist, they\'ll appear here.')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockWishlistContext.isLoading = true;

    render(
      <BrowserRouter>
        <WishlistPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Loading your wishlist...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockWishlistContext.error = 'Failed to load wishlist';

    render(
      <BrowserRouter>
        <WishlistPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Error loading wishlist')).toBeInTheDocument();
    expect(screen.getByText('Failed to load wishlist')).toBeInTheDocument();
  });
});