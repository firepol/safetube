import React from 'react';
import { SearchResult } from '@/shared/types';

interface SearchVideoPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: SearchResult | null;
  onWatchInBrowser?: (url: string) => void;
  onWatchNoRestrictions?: (url: string) => void;
  onAddToWishlist?: (video: SearchResult) => void;
  isAddingToWishlist?: boolean;
}

export const SearchVideoPreviewModal: React.FC<SearchVideoPreviewModalProps> = ({
  isOpen,
  onClose,
  video,
  onWatchInBrowser,
  onWatchNoRestrictions,
  onAddToWishlist,
  isAddingToWishlist = false
}) => {
  if (!isOpen || !video) {
    return null;
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string) => {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const youtubeVideoId = getYouTubeVideoId(video.url);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
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
                  Preview and watch this video
                </p>
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
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-200px)]">
            <div className="space-y-6">
              {/* Video Player */}
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                {youtubeVideoId ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeVideoId}?rel=0&modestbranding=1`}
                    title={video.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <div className="text-center">
                      <div className="text-4xl mb-2">⚠️</div>
                      <div className="text-lg">Unable to load video player</div>
                      <div className="text-sm text-gray-300 mt-2">Invalid YouTube URL</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {video.title}
                    </h3>
                    {video.description && (
                      <p className="text-gray-700 text-sm leading-relaxed">
                        {video.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    {video.channelName && (
                      <div className="flex items-center text-sm">
                        <span className="font-medium text-gray-600 w-20">Channel:</span>
                        <span className="text-gray-900">{video.channelName}</span>
                      </div>
                    )}

                    {video.duration && (
                      <div className="flex items-center text-sm">
                        <span className="font-medium text-gray-600 w-20">Duration:</span>
                        <span className="text-gray-900">{formatDuration(video.duration)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <span className="font-medium text-gray-600 w-24">Published:</span>
                      <span className="text-gray-900">{formatDate(video.publishedAt)}</span>
                    </div>

                    {video.type && (
                      <div className="flex items-center text-sm">
                        <span className="font-medium text-gray-600 w-24">Type:</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          video.type === 'youtube' ? 'bg-red-100 text-red-800' :
                          video.type === 'local' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {video.type.charAt(0).toUpperCase() + video.type.slice(1)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Video URL */}
                  <div className="text-sm">
                    <span className="font-medium text-gray-600">URL:</span>
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline ml-2 break-all"
                    >
                      {video.url}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                ℹ️ Choose how you'd like to watch this video
              </div>

              <div className="flex gap-3">
                {onWatchInBrowser && (
                  <button
                    onClick={() => {
                      onWatchInBrowser(video.url);
                      onClose();
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Watch in Browser
                  </button>
                )}

                {onWatchNoRestrictions && (
                  <button
                    onClick={() => {
                      onWatchNoRestrictions(video.url);
                      onClose();
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                  >
                    Watch (No Restrictions)
                  </button>
                )}

                {onAddToWishlist && !video.isInWishlist && (
                  <button
                    onClick={() => {
                      onAddToWishlist(video);
                      onClose();
                    }}
                    disabled={isAddingToWishlist}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAddingToWishlist ? 'Adding...' : 'Add to Wishlist'}
                  </button>
                )}

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
      </div>
    </div>
  );
};

export default SearchVideoPreviewModal;
