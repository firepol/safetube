import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SearchBar } from '../components/search/SearchBar';
import { SearchVideoPreviewModal } from '../components/search/SearchVideoPreviewModal';
import { VideoCardBase, VideoCardBaseProps } from '../components/video/VideoCardBase';
import { TimeIndicator, TimeTrackingState } from '../components/layout/TimeIndicator';
import { BreadcrumbNavigation, BreadcrumbItem } from '../components/layout/BreadcrumbNavigation';
import { SearchResult } from '../../shared/types';
import { useWishlist } from '../contexts/WishlistContext';

interface SearchResultsPageProps {}

export const SearchResultsPage: React.FC<SearchResultsPageProps> = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'database' | 'youtube'>('database');
  const [hasSearched, setHasSearched] = useState(false);
  const [timeTrackingState, setTimeTrackingState] = useState<TimeTrackingState | undefined>(undefined);
  const { isInWishlist } = useWishlist();

  // Video preview modal state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<SearchResult | null>(null);
  const [isAddingToWishlist, setIsAddingToWishlist] = useState(false);

  const query = searchParams.get('q') || '';
  const sourceId = searchParams.get('source');

  // Function to update search results with current wishlist status
  const updateResultsWithWishlistStatus = useCallback((searchResults: SearchResult[]): SearchResult[] => {
    return searchResults.map(result => {
      const wishlistInfo = isInWishlist(result.id);
      return {
        ...result,
        isInWishlist: wishlistInfo.inWishlist,
        wishlistStatus: wishlistInfo.status
      };
    });
  }, [isInWishlist]);

  // Load time tracking state
  useEffect(() => {
    const checkTimeLimits = async () => {
      try {
        if (window.electron && window.electron.getTimeTrackingState) {
          const state = await window.electron.getTimeTrackingState();
          if (state.isLimitReached) {
            navigate('/time-up');
            return;
          }
          setTimeTrackingState({
            timeRemaining: state.timeRemaining,
            timeLimit: state.timeLimitToday,
            timeUsed: state.timeUsedToday,
            isLimitReached: state.isLimitReached
          });
        }
      } catch (error) {
        console.error('Error checking time limits:', error);
      }
    };
    checkTimeLimits();
  }, [navigate]);

  // Perform database search
  const performDatabaseSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    
    try {
      // Use source-scoped search if sourceId is provided
      const response = await window.electron.searchDatabase(searchQuery, sourceId || undefined);
      
      if (response.success && response.data) {
        const filteredResults = response.data;
        
        // Update results with current wishlist status
        const resultsWithWishlistStatus = updateResultsWithWishlistStatus(filteredResults);
        
        setResults(resultsWithWishlistStatus);
        setSearchType('database');
        setHasSearched(true);

        // Auto-fallback to YouTube if no database results
        if (filteredResults.length === 0) {
          await performYouTubeSearch(searchQuery);
        }
      } else {
        setError(response.error || 'Database search failed');
        setResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Database search failed');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [sourceId]);

  // Perform YouTube search
  const performYouTubeSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await window.electron.searchYouTube(searchQuery);
      
      if (response.success && response.data) {
        // Update results with current wishlist status
        const resultsWithWishlistStatus = updateResultsWithWishlistStatus(response.data);
        
        setResults(resultsWithWishlistStatus);
        setSearchType('youtube');
        setHasSearched(true);
      } else {
        setError(response.error || 'YouTube search failed');
        setResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'YouTube search failed');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle search from SearchBar
  const handleSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    // Update URL with search query
    setSearchParams({ q: searchQuery });
    
    // Perform database search (with auto-fallback to YouTube)
    performDatabaseSearch(searchQuery);
  }, [setSearchParams, performDatabaseSearch]);

  // Handle manual YouTube search button
  const handleYouTubeSearch = useCallback(() => {
    if (!query.trim()) return;
    performYouTubeSearch(query);
  }, [query, performYouTubeSearch]);

  // Handle video click - opens preview modal
  const handleVideoClick = useCallback((video: VideoCardBaseProps) => {
    const searchResult = results.find(r => r.id === video.id);
    if (searchResult) {
      setSelectedVideo(searchResult);
      setIsPreviewOpen(true);
    } else if (video.isApprovedSource) {
      // Navigate to video player for approved sources
      navigate(`/player/${encodeURIComponent(video.id)}`, {
        state: {
          videoTitle: video.title,
          returnTo: `/search?q=${encodeURIComponent(query)}${sourceId ? `&source=${sourceId}` : ''}`,
        }
      });
    }
  }, [navigate, query, sourceId, results]);

  // Handle watch in browser with blocking enabled
  const handleWatchInBrowser = useCallback(async (videoUrl: string) => {
    try {
      const result = await window.electron.openVideoInWindow(videoUrl, { disableBlocking: false });
      if (!result.success) {
        setError('Failed to open video window');
      }
    } catch (err) {
      console.error('Error opening video window:', err);
      setError(err instanceof Error ? err.message : 'Failed to open video window');
    }
  }, []);

  // Handle watch with no restrictions (blocking disabled)
  const handleWatchNoRestrictions = useCallback(async (videoUrl: string) => {
    try {
      const result = await window.electron.openVideoInWindow(videoUrl, { disableBlocking: true });
      if (!result.success) {
        setError('Failed to open video window');
      }
    } catch (err) {
      console.error('Error opening video window:', err);
      setError(err instanceof Error ? err.message : 'Failed to open video window');
    }
  }, []);

  // Handle add to wishlist
  const handleAddToWishlist = useCallback(async (video: SearchResult) => {
    setIsAddingToWishlist(true);
    try {
      const result = await window.electron.wishlistAdd({
        id: video.id,
        title: video.title,
        thumbnail: video.thumbnail,
        description: video.description || '',
        channelId: video.channelId || '',
        channelName: video.channelName || '',
        duration: video.duration,
        url: video.url || '',
        publishedAt: video.publishedAt || new Date().toISOString(),
      });

      if (result.success) {
        // Update local state to reflect wishlist addition
        setResults(prevResults =>
          prevResults.map(v =>
            v.id === video.id
              ? { ...v, isInWishlist: true, wishlistStatus: 'pending' as const }
              : v
          )
        );
        // Update selected video state
        setSelectedVideo(prev => prev && prev.id === video.id
          ? { ...prev, isInWishlist: true, wishlistStatus: 'pending' as const }
          : prev
        );
      } else {
        setError(result.error || 'Failed to add to wishlist');
      }
    } catch (err) {
      console.error('Failed to add to wishlist:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsAddingToWishlist(false);
    }
  }, []);

  // Search on initial load if query exists
  useEffect(() => {
    if (query && !hasSearched) {
      performDatabaseSearch(query);
    }
  }, [query, hasSearched, performDatabaseSearch]);

  // Update search results when wishlist changes
  useEffect(() => {
    if (results.length > 0) {
      const updatedResults = updateResultsWithWishlistStatus(results);
      // Only update if there are actual changes to avoid infinite loops
      const hasChanges = updatedResults.some((result, index) => 
        result.isInWishlist !== results[index].isInWishlist || 
        result.wishlistStatus !== results[index].wishlistStatus
      );
      if (hasChanges) {
        setResults(updatedResults);
      }
    }
  }, [isInWishlist, updateResultsWithWishlistStatus]);

  // Generate breadcrumb items
  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', path: '/' }
    ];

    if (query) {
      items.push({ 
        label: `Search: "${query}"${sourceId ? ' (in source)' : ''}`, 
        isActive: true 
      });
    } else {
      items.push({ label: 'Search', isActive: true });
    }

    return items;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <BreadcrumbNavigation items={getBreadcrumbItems()} />
            
            <div className="flex-1 max-w-2xl mx-8">
              <SearchBar
                onSearch={handleSearch}
                placeholder="Search videos..."
                isLoading={isLoading}
                autoFocus={!query}
                initialValue={query}
              />
            </div>

            <TimeIndicator initialState={timeTrackingState} />
          </div>
        </div>
      </div>

      {/* Search Results Header */}
      {hasSearched && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Search Results
              </h1>
              {query && (
                <p className="text-gray-600 mt-1">
                  {results.length} results for "{query}" 
                  {sourceId && <span className="text-sm text-blue-600"> in current source</span>}
                  <span className="ml-2 text-sm bg-gray-100 px-2 py-1 rounded">
                    {searchType === 'database' ? 'Database' : 'YouTube'}
                  </span>
                </p>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              {sourceId && (
                <button
                  onClick={() => {
                    // Remove source parameter to search all sources
                    const newParams = new URLSearchParams(searchParams);
                    newParams.delete('source');
                    setSearchParams(newParams);
                    performDatabaseSearch(query);
                  }}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Search All Sources
                </button>
              )}
              {searchType === 'database' && (
                <button
                  onClick={handleYouTubeSearch}
                  disabled={isLoading}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  Search YouTube
                </button>
              )}
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <svg className="w-5 h-5 text-red-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-red-800">Search Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600">Searching...</span>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && hasSearched && results.length === 0 && !error && (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
              <p className="text-gray-600 mb-4">
                {searchType === 'database' 
                  ? "No videos found in your approved sources. Try searching YouTube for new content."
                  : "No videos found on YouTube for this search."
                }
              </p>
              {searchType === 'database' && (
                <button
                  onClick={handleYouTubeSearch}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Search YouTube
                </button>
              )}
            </div>
          )}

          {/* Results Grid */}
          {!isLoading && results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {results.map((video) => (
                <VideoCardBase
                  key={video.id}
                  id={video.id}
                  thumbnail={video.thumbnail}
                  title={video.title}
                  duration={video.duration}
                  type={video.type || "youtube"}
                  isApprovedSource={video.isApprovedSource}
                  isInWishlist={video.isInWishlist}
                  wishlistStatus={video.wishlistStatus}
                  showWishlistButton={!video.isApprovedSource}
                  description={video.description}
                  channelId={video.channelId}
                  channelName={video.channelName}
                  url={video.url}
                  publishedAt={video.publishedAt}
                  onVideoClick={handleVideoClick}
                  onWishlistAdd={async (videoData) => {
                    try {
                      const result = await window.electron.wishlistAdd({
                        id: videoData.id,
                        title: videoData.title,
                        thumbnail: videoData.thumbnail,
                        description: videoData.description || '',
                        channelId: videoData.channelId || '',
                        channelName: videoData.channelName || '',
                        duration: videoData.duration,
                        url: videoData.url || '',
                        publishedAt: videoData.publishedAt || new Date().toISOString(),
                      });
                      
                      if (result.success) {
                        // Update local state to reflect wishlist addition
                        setResults(prevResults => 
                          prevResults.map(result => 
                            result.id === videoData.id 
                              ? { ...result, isInWishlist: true, wishlistStatus: 'pending' as const }
                              : result
                          )
                        );
                      } else {
                        setError(result.error || 'Failed to add to wishlist');
                      }
                    } catch (err) {
                      console.error('Failed to add to wishlist:', err);
                      setError(err instanceof Error ? err.message : 'An unknown error occurred');
                      // TODO: Show error toast
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!hasSearched && !query && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h2 className="text-xl font-medium text-gray-900 mb-2">Search for Videos</h2>
            <p className="text-gray-600">
              Enter a search term to find videos from your approved sources or YouTube.
            </p>
          </div>
        </div>
      )}

      {/* Video Preview Modal */}
      <SearchVideoPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        video={selectedVideo}
        onWatchInBrowser={handleWatchInBrowser}
        onWatchNoRestrictions={handleWatchNoRestrictions}
        onAddToWishlist={selectedVideo && !selectedVideo.isApprovedSource ? handleAddToWishlist : undefined}
        isAddingToWishlist={isAddingToWishlist}
      />
    </div>
  );
};

export default SearchResultsPage;