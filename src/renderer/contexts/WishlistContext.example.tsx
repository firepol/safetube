/**
 * Example usage of WishlistContext
 * 
 * This file demonstrates how to use the WishlistContext in components.
 * It's not part of the actual application but serves as documentation.
 */

import React from 'react';
import { useWishlist } from './WishlistContext';
import { VideoData } from '../../shared/types';

// Example: Component that shows wishlist counts with badges
export const WishlistBadge: React.FC = () => {
  const { wishlistCounts, getUnreadCount } = useWishlist();
  const unreadCount = getUnreadCount();

  return (
    <div className="flex items-center space-x-2">
      <span>My Wishlist</span>
      {unreadCount > 0 && (
        <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
          {unreadCount}
        </span>
      )}
      <span className="text-gray-500 text-sm">
        ({wishlistCounts.total} total)
      </span>
    </div>
  );
};

// Example: Component that adds videos to wishlist
export const AddToWishlistButton: React.FC<{ video: VideoData }> = ({ video }) => {
  const { addToWishlist, isInWishlist, isLoading } = useWishlist();
  const wishlistStatus = isInWishlist(video.id);

  const handleAddToWishlist = async () => {
    const result = await addToWishlist(video);
    if (result.success) {
      console.log('Video added to wishlist successfully');
    } else {
      console.error('Failed to add video to wishlist:', result.error);
    }
  };

  if (wishlistStatus.inWishlist) {
    return (
      <button disabled className="px-4 py-2 bg-gray-300 text-gray-500 rounded">
        {wishlistStatus.status === 'pending' && 'Pending Approval'}
        {wishlistStatus.status === 'approved' && 'Approved'}
        {wishlistStatus.status === 'denied' && 'Denied'}
      </button>
    );
  }

  return (
    <button
      onClick={handleAddToWishlist}
      disabled={isLoading}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
    >
      {isLoading ? 'Adding...' : '+ Wishlist'}
    </button>
  );
};

// Example: Component that displays wishlist items by status
export const WishlistTabs: React.FC = () => {
  const { wishlistData, wishlistCounts, removeFromWishlist, markAsRead } = useWishlist();
  const [activeTab, setActiveTab] = React.useState<'pending' | 'approved' | 'denied'>('pending');

  const handleRemove = async (videoId: string) => {
    const result = await removeFromWishlist(videoId);
    if (result.success) {
      console.log('Video removed from wishlist');
    } else {
      console.error('Failed to remove video:', result.error);
    }
  };

  const handleItemClick = (videoId: string) => {
    markAsRead(videoId);
    // Navigate to video or show details
  };

  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 ${activeTab === 'pending' ? 'border-b-2 border-blue-500' : ''}`}
        >
          Pending ({wishlistCounts.pending})
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`px-4 py-2 ${activeTab === 'approved' ? 'border-b-2 border-blue-500' : ''}`}
        >
          Approved ({wishlistCounts.approved})
        </button>
        <button
          onClick={() => setActiveTab('denied')}
          className={`px-4 py-2 ${activeTab === 'denied' ? 'border-b-2 border-blue-500' : ''}`}
        >
          Denied ({wishlistCounts.denied})
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {wishlistData[activeTab].map((item) => (
          <div
            key={item.video_id}
            className="flex items-center justify-between p-4 border-b hover:bg-gray-50 cursor-pointer"
            onClick={() => handleItemClick(item.video_id)}
          >
            <div className="flex items-center space-x-4">
              <img
                src={item.thumbnail || '/placeholder-thumbnail.svg'}
                alt={item.title}
                className="w-16 h-12 object-cover rounded"
              />
              <div>
                <h3 className="font-medium">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.channel_name}</p>
                {item.denial_reason && (
                  <p className="text-sm text-red-500">Reason: {item.denial_reason}</p>
                )}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(item.video_id);
              }}
              className="px-3 py-1 text-red-500 hover:bg-red-50 rounded"
            >
              Remove
            </button>
          </div>
        ))}
        
        {wishlistData[activeTab].length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No {activeTab} videos
          </div>
        )}
      </div>
    </div>
  );
};

// Example: Parent moderation component
export const ParentModerationPanel: React.FC = () => {
  const { wishlistData, approveVideo, denyVideo, error, clearError } = useWishlist();
  const [denyReason, setDenyReason] = React.useState('');
  const [selectedVideo, setSelectedVideo] = React.useState<string | null>(null);

  const handleApprove = async (videoId: string) => {
    const result = await approveVideo(videoId);
    if (result.success) {
      console.log('Video approved successfully');
    } else {
      console.error('Failed to approve video:', result.error);
    }
  };

  const handleDeny = async (videoId: string, reason?: string) => {
    const result = await denyVideo(videoId, reason);
    if (result.success) {
      console.log('Video denied successfully');
      setDenyReason('');
      setSelectedVideo(null);
    } else {
      console.error('Failed to deny video:', result.error);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
          <button onClick={clearError} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <h2 className="text-xl font-bold">Pending Videos ({wishlistData.pending.length})</h2>
      
      {wishlistData.pending.map((item) => (
        <div key={item.video_id} className="border rounded-lg p-4">
          <div className="flex items-start space-x-4">
            <img
              src={item.thumbnail || '/placeholder-thumbnail.svg'}
              alt={item.title}
              className="w-32 h-24 object-cover rounded"
            />
            <div className="flex-1">
              <h3 className="font-medium text-lg">{item.title}</h3>
              <p className="text-gray-600">{item.channel_name}</p>
              <p className="text-sm text-gray-500 mt-2">{item.description}</p>
              <p className="text-xs text-gray-400 mt-2">
                Requested: {new Date(item.requested_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <div className="space-x-2">
              <button
                onClick={() => handleApprove(item.video_id)}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Approve
              </button>
              <button
                onClick={() => setSelectedVideo(item.video_id)}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Deny
              </button>
            </div>
            
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Watch
            </a>
          </div>
          
          {selectedVideo === item.video_id && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <label className="block text-sm font-medium mb-2">
                Denial Reason (optional):
              </label>
              <textarea
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                className="w-full p-2 border rounded"
                rows={3}
                maxLength={500}
                placeholder="Explain why this video is not appropriate..."
              />
              <div className="flex justify-end space-x-2 mt-2">
                <button
                  onClick={() => {
                    setSelectedVideo(null);
                    setDenyReason('');
                  }}
                  className="px-3 py-1 text-gray-600 hover:bg-gray-200 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeny(item.video_id, denyReason.trim() || undefined)}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Deny Video
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      
      {wishlistData.pending.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No pending videos to review
        </div>
      )}
    </div>
  );
};