import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CachedResultsModal } from './CachedResultsModal';
import { Search, SearchResult } from '@/shared/types';

// Mock VideoGrid component
vi.mock('../layout/VideoGrid', () => ({
  VideoGrid: ({ videos }: { videos: any[] }) => (
    <div data-testid="video-grid">
      {videos.map((video, index) => (
        <div key={index} data-testid="video-card">
          {video.title}
        </div>
      ))}
    </div>
  )
}));

describe('CachedResultsModal', () => {
  const mockSearch: Search = {
    id: 1,
    query: 'test search',
    search_type: 'database',
    result_count: 2,
    timestamp: '2024-01-01T12:00:00Z',
    created_at: '2024-01-01T12:00:00Z'
  };

  const mockResults: SearchResult[] = [
    {
      id: 'video1',
      title: 'Test Video 1',
      thumbnail: 'thumb1.jpg',
      description: 'Description 1',
      duration: 120,
      channelId: 'channel1',
      channelName: 'Channel 1',
      url: 'https://youtube.com/watch?v=video1',
      publishedAt: '2024-01-01T10:00:00Z',
      isApprovedSource: true
    },
    {
      id: 'video2',
      title: 'Test Video 2',
      thumbnail: 'thumb2.jpg',
      description: 'Description 2',
      duration: 180,
      channelId: 'channel2',
      channelName: 'Channel 2',
      url: 'https://youtube.com/watch?v=video2',
      publishedAt: '2024-01-01T11:00:00Z',
      isApprovedSource: false
    }
  ];

  it('does not render when closed', () => {
    render(
      <CachedResultsModal
        isOpen={false}
        onClose={vi.fn()}
        search={mockSearch}
        results={mockResults}
      />
    );
    
    expect(screen.queryByText('Cached Search Results')).not.toBeInTheDocument();
  });

  it('does not render when search is null', () => {
    render(
      <CachedResultsModal
        isOpen={true}
        onClose={vi.fn()}
        search={null}
        results={mockResults}
      />
    );
    
    expect(screen.queryByText('Cached Search Results')).not.toBeInTheDocument();
  });

  it('renders modal with search information and results', () => {
    render(
      <CachedResultsModal
        isOpen={true}
        onClose={vi.fn()}
        search={mockSearch}
        results={mockResults}
      />
    );
    
    expect(screen.getByText('Cached Search Results')).toBeInTheDocument();
    expect(screen.getByText('"test search"')).toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByTestId('video-grid')).toBeInTheDocument();
    expect(screen.getByText('Test Video 1')).toBeInTheDocument();
    expect(screen.getByText('Test Video 2')).toBeInTheDocument();
  });

  it('renders empty state when no results', () => {
    render(
      <CachedResultsModal
        isOpen={true}
        onClose={vi.fn()}
        search={mockSearch}
        results={[]}
      />
    );
    
    expect(screen.getByText('No cached results')).toBeInTheDocument();
    expect(screen.getByText('The cached results for this search are no longer available.')).toBeInTheDocument();
  });

  it('shows YouTube warning for YouTube search results', () => {
    const youtubeSearch: Search = {
      ...mockSearch,
      search_type: 'youtube'
    };

    render(
      <CachedResultsModal
        isOpen={true}
        onClose={vi.fn()}
        search={youtubeSearch}
        results={mockResults}
      />
    );
    
    expect(screen.getByText('YouTube')).toBeInTheDocument();
    expect(screen.getByText(/These are YouTube search results that may not be from approved sources/)).toBeInTheDocument();
  });
});