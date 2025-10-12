import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { SearchResultsPage } from './SearchResultsPage';
import { SearchResult } from '../../shared/types';
import { vi, beforeEach } from 'vitest';

// Mock the SearchBar component - simplified with debounce for testing
vi.mock('../components/search/SearchBar', () => ({
  SearchBar: ({ onSearch, initialValue }: any) => {
    const [value, setValue] = React.useState(initialValue || '');

    // Simulate debounced search like the real component
    React.useEffect(() => {
      if (value.trim()) {
        const timer = setTimeout(() => {
          onSearch(value.trim());
        }, 50); // Very short debounce for tests
        return () => clearTimeout(timer);
      }
    }, [value, onSearch]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
    };

    // Also support immediate search on Enter key
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && value.trim()) {
        e.preventDefault();
        onSearch(value.trim());
      }
    };

    return (
      <div data-testid="search-bar">
        <input
          data-testid="search-input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  }
}));

// Mock electron API
const mockElectron = {
  searchDatabase: vi.fn(),
  searchYouTube: vi.fn(),
  getTimeTrackingState: vi.fn(),
  getTimeLimits: vi.fn(),
  wishlistAdd: vi.fn(),
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
    <Tooltip.Provider>
      <MemoryRouter initialEntries={initialEntries}>
        <SearchResultsPage />
      </MemoryRouter>
    </Tooltip.Provider>
  );
};

describe('SearchResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('q');

    // Setup default mock responses
    mockElectron.getTimeTrackingState.mockResolvedValue({
      timeRemaining: 3600,
      timeLimitToday: 7200,
      timeUsedToday: 3600,
      isLimitReached: false
    });
    mockElectron.getTimeLimits.mockResolvedValue({
      warningThreshold: 300
    });
  });

  it('renders initial state without search query', () => {
    renderWithRouter();
    
    expect(screen.getByText('Search for Videos')).toBeInTheDocument();
    expect(screen.getByText('Enter a search term to find videos from your approved sources or YouTube.')).toBeInTheDocument();
    expect(screen.getByTestId('search-bar')).toBeInTheDocument();
  });

  it('renders with search query from URL params', () => {
    mockSearchParams.set('q', 'test query');
    mockElectron.searchDatabase.mockResolvedValue({ success: true, data: mockSearchResults });

    renderWithRouter(['/search?q=test%20query']);

    expect(mockElectron.searchDatabase).toHaveBeenCalledWith('test query', undefined);
  });

  it('handles manual YouTube search button click', async () => {
    mockSearchParams.set('q', 'test query');
    mockElectron.searchDatabase.mockResolvedValue({ success: true, data: mockSearchResults });
    mockElectron.searchYouTube.mockResolvedValue({ success: true, data: [] });

    renderWithRouter(['/search?q=test%20query']);

    await waitFor(() => {
      expect(screen.getByText('Search YouTube')).toBeInTheDocument();
    });

    const youtubeButton = screen.getByText('Search YouTube');
    await userEvent.click(youtubeButton);

    expect(mockElectron.searchYouTube).toHaveBeenCalledWith('test query');
  });

  it('displays empty state when no results found', async () => {
    mockElectron.searchDatabase.mockResolvedValue({ success: true, data: [] });
    mockElectron.searchYouTube.mockResolvedValue({ success: true, data: [] });

    renderWithRouter();

    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'test query');

    await waitFor(() => {
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });

  it('updates URL search params when searching', async () => {
    mockElectron.searchDatabase.mockResolvedValue({ success: true, data: [] });

    renderWithRouter();

    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'test query');

    await waitFor(() => {
      expect(mockSetSearchParams).toHaveBeenCalledWith({ q: 'test query' });
    });
  });
});