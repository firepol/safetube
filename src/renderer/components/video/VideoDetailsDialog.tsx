import React from 'react';
import { X } from 'lucide-react';

interface VideoDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  video: {
    id: string;
    title: string;
    thumbnail: string;
    description: string;
    duration: number;
    channelName: string;
    channelId?: string;
    publishedAt: string;
    url: string;
  } | null;
  onAddToWishlist?: (video: any) => void;
  isInWishlist?: boolean;
}

export const VideoDetailsDialog: React.FC<VideoDetailsDialogProps> = ({
  isOpen,
  onClose,
  video,
  onAddToWishlist,
  isInWishlist = false
}) => {
  if (!isOpen || !video) {
    return null;
  }

  const formatDuration = (seconds: number) => {
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
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const handleAddToWishlist = () => {
    if (onAddToWishlist) {
      onAddToWishlist(video);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Video Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Thumbnail */}
          <div className="mb-4">
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-48 object-cover rounded-lg bg-gray-200"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/placeholder-thumbnail.svg';
              }}
            />
          </div>

          {/* Video Info */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{video.title}</h3>
              <p className="text-sm text-gray-600">
                By {video.channelName} • {formatDate(video.publishedAt)} • {formatDuration(video.duration)}
              </p>
            </div>

            {video.description && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Description</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {video.description.length > 300 
                    ? `${video.description.substring(0, 300)}...` 
                    : video.description
                  }
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <p className="text-sm text-gray-600">
            This video is not from an approved source. You can add it to your wishlist for parent review.
          </p>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            {!isInWishlist && onAddToWishlist && (
              <button
                onClick={handleAddToWishlist}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors"
              >
                Add to Wishlist
              </button>
            )}
            {isInWishlist && (
              <span className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 border border-green-200 rounded-md">
                In Wishlist
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoDetailsDialog;