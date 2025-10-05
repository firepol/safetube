import React, { useState, useEffect } from 'react';
import { WishlistItem, WishlistStatus } from '@/shared/types';
import { ModerationVideoCard } from './ModerationVideoCard';
import { VideoPreviewModal } from './VideoPreviewModal';
import { DenyReasonDialog } from './DenyReasonDialog';

export const WishlistModerationTab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<WishlistStatus>('pending');
  const [wishlistItems, setWishlistItems] = useState<{
    pending: WishlistItem[];
    approved: WishlistItem[];
    denied: WishlistItem[];
  }>({
    pending: [],
    approved: [],
    denied: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    video: WishlistItem | null;
  }>({
    isOpen: false,
    video: null
  });

  const [denyDialog, setDenyDialog] = useState<{
    isOpen: boolean;
    video: WishlistItem | null;
  }>({
    isOpen: false,
    video: null
  });

  // Load wishlist data
  const loadWishlistData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load data for all statuses
      const [pendingItems, approvedItems, deniedItems] = await Promise.all([
        window.electron.wishlistGetByStatus('pending'),
        window.electron.wishlistGetByStatus('approved'),
        window.electron.wishlistGetByStatus('denied')
      ]);

      setWishlistItems({
        pending: pendingItems,
        approved: approvedItems,
        denied: deniedItems
      });
    } catch (err) {
      console.error('Error loading wishlist data:', err);
      setError('Failed to load wishlist data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadWishlistData();
  }, []);



  // Action handlers
  const handleWatch = (item: WishlistItem) => {
    setPreviewModal({
      isOpen: true,
      video: item
    });
  };

  const handleApprove = async (videoId: string) => {
    try {
      await window.electron.wishlistApprove(videoId);
      await loadWishlistData(); // Refresh data
    } catch (err) {
      console.error('Error approving video:', err);
      setError('Failed to approve video. Please try again.');
    }
  };

  const handleDenyClick = (item: WishlistItem) => {
    setDenyDialog({
      isOpen: true,
      video: item
    });
  };

  const handleDenyConfirm = async (reason?: string) => {
    if (!denyDialog.video) return;

    try {
      await window.electron.wishlistDeny(denyDialog.video.video_id, reason);
      await loadWishlistData(); // Refresh data
    } catch (err) {
      console.error('Error denying video:', err);
      setError('Failed to deny video. Please try again.');
    }
  };

  // Modal handlers
  const handlePreviewModalApprove = async (videoId: string) => {
    await handleApprove(videoId);
    setPreviewModal({ isOpen: false, video: null });
  };

  const handlePreviewModalDeny = (videoId: string) => {
    const video = previewModal.video;
    if (video) {
      setPreviewModal({ isOpen: false, video: null });
      setDenyDialog({ isOpen: true, video });
    }
  };

  // Get current tab data
  const currentTabData = wishlistItems[activeTab];

  // Tab counts for badges
  const tabCounts = {
    pending: wishlistItems.pending.length,
    approved: wishlistItems.approved.length,
    denied: wishlistItems.denied.length
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading wishlist data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wishlist Moderation Panel */}
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Wishlist Moderation</h2>
              <p className="text-sm text-gray-600 mt-1">
                Review and moderate your child's video requests
              </p>
            </div>
            <button
              onClick={loadWishlistData}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {(['pending', 'approved', 'denied'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setActiveTab(status)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === status
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="capitalize">{status}</span>
                {tabCounts[status] > 0 && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    status === 'approved' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {tabCounts[status]}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {currentTabData.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">
                {activeTab === 'pending' ? '⏳' : activeTab === 'approved' ? '✅' : '❌'}
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No {activeTab} videos
              </h3>
              <p className="text-gray-600">
                {activeTab === 'pending' 
                  ? "Your child hasn't requested any videos yet."
                  : activeTab === 'approved'
                  ? "No videos have been approved yet."
                  : "No videos have been denied yet."
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {currentTabData.map((item) => (
                <ModerationVideoCard
                  key={item.id}
                  item={item}
                  onWatch={handleWatch}
                  onApprove={handleApprove}
                  onDeny={handleDenyClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Video Preview Modal */}
      <VideoPreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal({ isOpen: false, video: null })}
        video={previewModal.video}
        onApprove={handlePreviewModalApprove}
        onDeny={handlePreviewModalDeny}
      />

      {/* Deny Reason Dialog */}
      <DenyReasonDialog
        isOpen={denyDialog.isOpen}
        onClose={() => setDenyDialog({ isOpen: false, video: null })}
        onConfirm={handleDenyConfirm}
        videoTitle={denyDialog.video?.title}
      />
    </div>
  );
};

export default WishlistModerationTab;