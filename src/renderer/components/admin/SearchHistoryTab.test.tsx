import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchHistoryTab } from './SearchHistoryTab';

// Mock the electron API
const mockElectron = {
  getSearchHistory: vi.fn(),
  getCachedSearchResults: vi.fn(),
};

// Mock window.electron
Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true,
});

describe('SearchHistoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockElectron.getSearchHistory.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<SearchHistoryTab />);
    
    expect(screen.getByText('Loading search history...')).toBeInTheDocument();
  });

  it('renders empty state when no search history', async () => {
    mockElectron.getSearchHistory.mockResolvedValue({
      success: true,
      data: []
    });
    
    render(<SearchHistoryTab />);
    
    // Wait for loading to complete
    await screen.findByText('No search history');
    expect(screen.getByText('Search history will appear here once kids start searching for videos.')).toBeInTheDocument();
  });

  it('renders search history table when data is available', async () => {
    const mockSearchHistory = [
      {
        id: 1,
        query: 'test search',
        search_type: 'database',
        result_count: 5,
        timestamp: '2024-01-01T12:00:00Z',
        created_at: '2024-01-01T12:00:00Z'
      }
    ];

    mockElectron.getSearchHistory.mockResolvedValue({
      success: true,
      data: mockSearchHistory
    });
    
    render(<SearchHistoryTab />);
    
    // Wait for data to load
    await screen.findByText('"test search"');
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('5 results')).toBeInTheDocument();
    expect(screen.getByText('View Results')).toBeInTheDocument();
  });

  it('renders error state when loading fails', async () => {
    mockElectron.getSearchHistory.mockResolvedValue({
      success: false,
      error: 'Failed to load data'
    });
    
    render(<SearchHistoryTab />);
    
    // Wait for error to appear
    await screen.findByText('Error');
    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
  });
});