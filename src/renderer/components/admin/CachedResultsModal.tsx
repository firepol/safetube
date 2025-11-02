import React, { useState } from 'react';
import { Search, SearchResult } from '@/shared/types';
import { VideoGrid } from '../layout/VideoGrid';
import { VideoCardBaseProps } from '../video/VideoCardBase';

interface CachedResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  search: Search | null;
  results: SearchResult[];
  isLoading?: boolean;
  error?: string | null;
}

export const CachedResultsModal: React.FC<CachedResultsModalProps> = ({
  isOpen,
  onClose,
  search,
  results,
  isLoading = false,
  error = null
}) => {
  const [selectedVideo, setSelectedVideo] = useState<SearchResult | null>(null);

  if (!isOpen || !search) {
    return null;
  }

  const handleWatchInBrowser = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Convert SearchResult to VideoCardBaseProps for VideoGrid
  const videoCards: VideoCardBaseProps[] = results.map((result) => {
    return {
      id: result.id,
      thumbnail: result.thumbnail,
      title: result.title,
      duration: result.duration,
      type: 'youtube' as const, // Search results are always YouTube videos
      description: result.description,
      channelId: result.channelId,
      channelName: result.channelName,
      url: result.url,
      publishedAt: result.publishedAt,
      // Set isApprovedSource to true so it uses custom onVideoClick handler
      // (prevents default "unapproved source" dialog)
      isApprovedSource: true,
      // Click to open preview dialog
      onVideoClick: () => {
        setSelectedVideo(result);
      }
    };
  });

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getSearchTypeBadge = (searchType: string) => {
    const isDatabase = searchType === 'database';
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          isDatabase
            ? 'bg-blue-100 text-blue-800'
            : 'bg-red-100 text-red-800'
        }`}
      >
        {isDatabase ? 'Database' : 'YouTube'}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900">
                  Cached Search Results
                </h2>
                <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Query:</span> "{search.query}"
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {getSearchTypeBadge(search.search_type)}
                  </div>
                  <div>
                    <span className="font-medium">Date:</span> {formatDate(search.timestamp)}
                  </div>
                  <div>
                    <span className="font-medium">Results:</span> {search.result_count}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
                <h3 className="mt-4 text-sm font-medium text-gray-900">Loading results...</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Fetching cached search results for "{search.query}"
                </p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error loading results</h3>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No cached results</h3>
                <p className="mt-1 text-sm text-gray-500">
                  The cached results for this search are no longer available.
                </p>
              </div>
            ) : (
              <div>
                <div className="mb-4 text-sm text-gray-600">
                  Showing {results.length} cached result{results.length !== 1 ? 's' : ''} for this search.
                  {search.search_type === 'youtube' && (
                    <span className="ml-2 text-amber-600">
                      ⚠️ These are YouTube search results that may not be from approved sources.
                    </span>
                  )}
                </div>

                <VideoGrid
                  videos={videoCards}
                  groupByType={false}
                  className="space-y-6"
                  showFavoriteIcons={false}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {search.search_type === 'database' ? (
                  'Database search results are from approved video sources only.'
                ) : (
                  'YouTube search results may include videos from non-approved sources.'
                )}
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Video Preview Dialog */}
      {selectedVideo && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setSelectedVideo(null)}
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Video Preview
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Search result from: {search.query}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedVideo(null)}
                    className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-200px)]">
                <div className="space-y-6">
                  {/* Video Player */}
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <iframe
                      src={`https://www.youtube.com/embed/${extractYouTubeVideoId(selectedVideo.url)}?rel=0&modestbranding=1`}
                      title={selectedVideo.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>

                  {/* Video Metadata */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {selectedVideo.title}
                        </h3>
                        {selectedVideo.description && (
                          <p className="text-gray-700 text-sm leading-relaxed">
                            {selectedVideo.description}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        {selectedVideo.channelName && (
                          <div className="flex items-center text-sm">
                            <span className="font-medium text-gray-600 w-20">Channel:</span>
                            <span className="text-gray-900">{selectedVideo.channelName}</span>
                          </div>
                        )}

                        {selectedVideo.duration && (
                          <div className="flex items-center text-sm">
                            <span className="font-medium text-gray-600 w-20">Duration:</span>
                            <span className="text-gray-900">{formatDuration(selectedVideo.duration)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center text-sm">
                          <span className="font-medium text-gray-600 w-24">Published:</span>
                          <span className="text-gray-900">{formatDate(selectedVideo.publishedAt)}</span>
                        </div>

                        {selectedVideo.isApprovedSource !== undefined && (
                          <div className="flex items-center text-sm">
                            <span className="font-medium text-gray-600 w-24">Source:</span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              selectedVideo.isApprovedSource
                                ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {selectedVideo.isApprovedSource ? 'Approved' : 'Unapproved'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Video URL */}
                      <div className="text-sm">
                        <span className="font-medium text-gray-600">URL:</span>
                        <button
                          onClick={() => handleWatchInBrowser(selectedVideo.url)}
                          className="text-blue-600 hover:text-blue-800 underline ml-2 break-all text-left"
                        >
                          {selectedVideo.url}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    ℹ️ This is a search result. Click the URL to open in a new window.
                  </div>

                  <button
                    onClick={() => setSelectedVideo(null)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to extract YouTube video ID
function extractYouTubeVideoId(url: string): string {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : '';
}

// Helper function to format duration
function formatDuration(seconds: number): string {
  if (!seconds) return 'Unknown';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export default CachedResultsModal;