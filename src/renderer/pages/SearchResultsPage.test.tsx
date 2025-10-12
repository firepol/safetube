import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SearchResultsPage } from './SearchResultsPage';
import { SearchResult } from '../../shared/types';
import { vi, beforeEach } from 'vitest';

// Mock the SearchBar component
vi.mock('../components/search/SearchBar', () => ({
  SearchBar: ({ onSearch, isLoading, autoFocus }: any) => (
    <div data-testid="search-bar">
      <input
        data-testid="search-input"
        onChange={(e) => onSearch(e.target.value)}
        disabled={isLoading}
        autoFocus={autoFocus}
      />
      {isLoading && <div data-testid="loading">Loading...</div>}
    </div>
  )
}));

// Mock electron API
const mockElectron = {
  searchDatabase: vi.fn(),
  searchYouTube: vi.fn(),
};

Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true,
});

// Mock WishlistContext
const mockWishlistContext = {
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
  isInWishlist: vi.fn().mockReturnValue({ inWishlist: false })
};

vi.mock('../contexts/WishlistContext', () => ({
  useWishlist: () => mockWishlistContext
}));

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  };
});

const mockSearchResults: SearchResult[] = [
  {
    id: 'video1',
    title: 'Test Video 1',
    thumbnail: 'https://example.com/thumb1.jpg',
    description: 'Test description 1',
    duration: 300,
    channelId: 'channel1',
    channelName: 'Test Channel 1',
    url: 'https://youtube.com/watch?v=video1',
    publishedAt: '2023-01-01T00:00:00Z',
    isApprovedSource: true,
  },
  {
    id: 'video2',
    title: 'Test Video 2',
    thumbnail: 'https://example.com/thumb2.jpg',
    description: 'Test description 2',
    duration: 600,
    channelId: 'channel2',
    channelName: 'Test Channel 2',
    url: 'https://youtube.com/watch?v=video2',
    publishedAt: '2023-01-02T00:00:00Z',
    isApprovedSource: false,
    isInWishlist: false,
  },
];

const renderWithRouter = (initialEntries = ['/search']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SearchResultsPage />
    </MemoryRouter>
  );
};

describe('SearchResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('q');
  });

  it('renders initial state without search query', () => {
    renderWithRouter();
    
    expect(screen.getByText('Search for Videos')).toBeInTheDocument();
    expect(screen.getByText('Enter a search term to find videos from your approved sources or YouTube.')).toBeInTheDocument();
    expect(screen.getByTestId('search-bar')).toBeInTheDocument();
  });

  it('renders with search query from URL params', () => {
    mockSearchParams.set('q', 'test query');
    mockElectron.searchDatabase.mockResolvedValue(mockSearchResults);
    
    renderWithRouter(['/search?q=test%20query']);
    
    expect(mockElectron.searchDatabase).toHaveBeenCalledWith('test query');
  });

  it('performs database search and displays results', async () => {
    mockElectron.searchDatabase.mockResolvedValue(mockSearchResults);
    
    renderWithRouter();
    
    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'test query');
    
    await waitFor(() => {
      expect(mockElectron.searchDatabase).toHaveBeenCalledWith('test query');
    });
    
    await waitFor(() => {
      expect(screen.getByText('Search Results')).toBeInTheDocument();
      expect(screen.getByText('2 results for "test query"')).toBeInTheDocument();
      expect(screen.getByText('Test Video 1')).toBeInTheDocument();
      expect(screen.getByText('Test Video 2')).toBeInTheDocument();
    });
  });

  it('auto-fallbacks to YouTube when database search returns no results', async () => {
    mockElectron.searchDatabase.mockResolvedValue([]);
    mockElectron.searchYouTube.mockResolvedValue(mockSearchResults);
    
    renderWithRouter();
    
    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'test query');
    
    await waitFor(() => {
      expect(mockElectron.searchDatabase).toHaveBeenCalledWith('test query');
    });
    
    await waitFor(() => {
      expect(mockElectron.searchYouTube).toHaveBeenCalledWith('test query');
    });
    
    await waitFor(() => {
      expect(screen.getByText('YouTube')).toBeInTheDocument();
    });
  });

  it('handles manual YouTube search button click', async () => {
    mockSearchParams.set('q', 'test query');
    mockElectron.searchDatabase.mockResolvedValue(mockSearchResults);
    mockElectron.searchYouTube.mockResolvedValue([]);
    
    renderWithRouter(['/search?q=test%20query']);
    
    await waitFor(() => {
      expect(screen.getByText('Search YouTube')).toBeInTheDocument();
    });
    
    const youtubeButton = screen.getByText('Search YouTube');
    await userEvent.click(youtubeButton);
    
    expect(mockElectron.searchYouTube).toHaveBeenCalledWith('test query');
  });

  it('displays loading state during search', async () => {
    mockElectron.searchDatabase.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    renderWithRouter();
    
    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'test query');
    
    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });

  it('displays error state when search fails', async () => {
    mockElectron.searchDatabase.mockRejectedValue(new Error('Search failed'));
    
    renderWithRouter();
    
    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'test query');
    
    await waitFor(() => {
      expect(screen.getByText('Search Error')).toBeInTheDocument();
      expect(screen.getByText('Search failed')).toBeInTheDocument();
    });
  });

  it('displays empty state when no results found', async () => {
    mockElectron.searchDatabase.mockResolvedValue([]);
    mockElectron.searchYouTube.mockResolvedValue([]);
    
    renderWithRouter();
    
    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'test query');
    
    await waitFor(() => {
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });

  it('navigates to video player for approved source videos', async () => {
    mockElectron.searchDatabase.mockResolvedValue(mockSearchResults);
    
    renderWithRouter();
    
    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'test query');
    
    await waitFor(() => {
      expect(screen.getByText('Test Video 1')).toBeInTheDocument();
    });
    
    const videoCard = screen.getByText('Test Video 1').closest('div');
    await userEvent.click(videoCard!);
    
    expect(mockNavigate).toHaveBeenCalledWith('/video/video1');
  });

  it('shows wishlist button for unapproved source videos', async () => {
    mockElectron.searchDatabase.mockResolvedValue(mockSearchResults);
    
    renderWithRouter();
    
    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'test query');
    
    await waitFor(() => {
      expect(screen.getByText('+ Add to Wishlist')).toBeInTheDocument();
    });
  });

  it('shows disabled wishlist button for videos already in wishlist', async () => {
    const resultsWithWishlist = [
      {
        ...mockSearchResults[1],
        isInWishlist: true,
      }
    ];
    mockElectron.searchDatabase.mockResolvedValue(resultsWithWishlist);
    
    renderWithRouter();
    
    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'test query');
    
    await waitFor(() => {
      expect(screen.getByText('In Wishlist')).toBeInTheDocument();
    });
    
    const wishlistButton = screen.getByText('In Wishlist');
    expect(wishlistButton).toBeDisabled();
  });

  it('updates URL search params when searching', async () => {
    renderWithRouter();
    
    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'test query');
    
    expect(mockSetSearchParams).toHaveBeenCalledWith({ q: 'test query' });
  });

  it('handles back button click', async () => {
    renderWithRouter();
    
    const backButton = screen.getByText('Back');
    await userEvent.click(backButton);
    
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('displays video duration correctly', async () => {
    mockElectron.searchDatabase.mockResolvedValue(mockSearchResults);
    
    renderWithRouter();
    
    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'test query');
    
    await waitFor(() => {
      expect(screen.getByText('5:00')).toBeInTheDocument(); // 300 seconds = 5:00
      expect(screen.getByText('10:00')).toBeInTheDocument(); // 600 seconds = 10:00
    });
  });

  it('shows needs approval badge for unapproved videos', async () => {
    mockElectron.searchDatabase.mockResolvedValue(mockSearchResults);
    
    renderWithRouter();
    
    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'test query');
    
    await waitFor(() => {
      expect(screen.getByText('Needs Approval')).toBeInTheDocument();
    });
  });

  it('handles thumbnail load errors with fallback', async () => {
    mockElectron.searchDatabase.mockResolvedValue(mockSearchResults);
    
    renderWithRouter();
    
    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'test query');
    
    await waitFor(() => {
      const thumbnails = screen.getAllByRole('img');
      expect(thumbnails.length).toBeGreaterThan(0);
    });
    
    // Simulate image load error
    const thumbnail = screen.getAllByRole('img')[0];
    fireEvent.error(thumbnail);
    
    expect(thumbnail).toHaveAttribute('src', '/placeholder-thumbnail.svg');
  });

  it('prevents wishlist button click from triggering video click', async () => {
    mockElectron.searchDatabase.mockResolvedValue(mockSearchResults);
    
    renderWithRouter();
    
    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'test query');
    
    await waitFor(() => {
      expect(screen.getByText('+ Add to Wishlist')).toBeInTheDocument();
    });
    
    const wishlistButton = screen.getByText('+ Add to Wishlist');
    await userEvent.click(wishlistButton);
    
    // Should not navigate to video player
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/video/'));
  });
});