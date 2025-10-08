import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { WishlistVideoCard } from '../components/video/WishlistVideoCard';
import { useWishlist } from '../contexts/WishlistContext';
import { WishlistItem } from '../../shared/types';
import { VideoCardBaseProps } from '../components/video/VideoCardBase';
import { BreadcrumbNavigation, BreadcrumbItem } from '../components/layout/BreadcrumbNavigation';
import { TimeIndicator } from '../components/layout/TimeIndicator';
import { SearchBar } from '../components/search/SearchBar';

export const WishlistPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { wishlistData, wishlistCounts, isLoading, error, removeFromWishlist, refreshWishlist } = useWishlist();
  const hasInitialized = useRef(false);
  
  // Start with pending as default, will be updated on first load if needed
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'denied'>('pending');

  useEffect(() => {
    refreshWishlist();
  }, [location, refreshWishlist]);

  // Set default tab to 'approved' if there are approved videos, but only on initial load
  useEffect(() => {
    if (!isLoading && !hasInitialized.current) {
      hasInitialized.current = true;
      if (wishlistCounts.approved > 0) {
        setActiveTab('approved');
      }
    }
  }, [wishlistCounts.approved, isLoading]);

  // Convert WishlistItem to VideoCardBaseProps for VideoGrid
  const convertWishlistItemToVideoCard = (item: WishlistItem): VideoCardBaseProps => ({
    id: item.video_id,
    title: item.title,
    thumbnail: item.thumbnail || '',
    duration: item.duration || 0,
    type: 'youtube' as const,
    sourceId: item.channel_id || 'unknown',
    description: item.description || '',
    channelId: item.channel_id || '',
    channelName: item.channel_name || '',
    url: item.url,
    publishedAt: item.created_at,
    isApprovedSource: item.status === 'approved',
    isInWishlist: true,
    wishlistStatus: item.status,
    showWishlistButton: false, // Don't show wishlist button on wishlist page
  });

  // Get videos for current tab
  const getCurrentTabVideos = (): VideoCardBaseProps[] => {
    const items = wishlistData[activeTab];
    if (!items || !Array.isArray(items)) {
      return [];
    }
    return items.map(convertWishlistItemToVideoCard);
  };

  const handleVideoClick = (video: VideoCardBaseProps) => {
    if (video.wishlistStatus === 'approved') {
      // Navigate to video player for approved videos with proper breadcrumb data
      navigate(`/player/${encodeURIComponent(video.id)}`, {
        state: {
          videoTitle: video.title,
          returnTo: '/wishlist',
          breadcrumb: {
            sourceName: 'My Wishlist',
            sourceId: null, // No source ID for wishlist
            historyPath: '/wishlist'
          },
          // Pass video metadata to ensure proper title display
          videoMetadata: {
            type: 'youtube',
            title: video.title,
            thumbnail: video.thumbnail,
            duration: video.duration,
            url: video.url,
            sourceId: 'wishlist-approved',
            sourceTitle: 'My Wishlist',
            sourceType: 'youtube_channel',
            sourceThumbnail: '',
            navigationContext: {
              breadcrumb: {
                sourceName: 'My Wishlist',
                sourceId: null,
                historyPath: '/wishlist'
              },
              returnTo: '/wishlist'
            }
          }
        }
      });
    } else {
      // For pending/denied videos, just show info (no action)
      console.log('Video not approved for playbook:', video);
    }
  };

  const handleRemoveFromWishlist = async (videoId: string) => {
    try {
      await removeFromWishlist(videoId);
    } catch (error) {
      console.error('Failed to remove from wishlist:', error);
      // TODO: Show error toast
    }
  };

  const handleSearch = (query: string) => {
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    return [
      { label: 'Home', path: '/' },
      { label: 'My Wishlist', isActive: true }
    ];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <BreadcrumbNavigation items={getBreadcrumbItems()} />
              
              <div className="flex-1 max-w-md mx-8">
                <SearchBar
                  onSearch={handleSearch}
                  placeholder="Search videos..."
                  className="w-full"
                />
              </div>
              
              <TimeIndicator realTime={true} updateInterval={3000} />
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <div className="text-lg">Loading your wishlist...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <BreadcrumbNavigation items={getBreadcrumbItems()} />
              
              <div className="flex-1 max-w-md mx-8">
                <SearchBar
                  onSearch={handleSearch}
                  placeholder="Search videos..."
                  className="w-full"
                />
              </div>
              
              <TimeIndicator realTime={true} updateInterval={3000} />
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-red-600 font-bold mb-2">Error loading wishlist</div>
            <div className="text-gray-600 mb-4">{error}</div>
            <button
              onClick={() => navigate('/')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentTabVideos = getCurrentTabVideos();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <BreadcrumbNavigation items={getBreadcrumbItems()} />
            
            <div className="flex-1 max-w-md mx-8">
              <SearchBar
                onSearch={handleSearch}
                placeholder="Search videos..."
                className="w-full"
              />
            </div>
            
            <TimeIndicator realTime={true} updateInterval={3000} />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('pending')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === 'pending'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pending
                {wishlistCounts.pending > 0 && (
                  <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {wishlistCounts.pending}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('approved')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === 'approved'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Approved
                {wishlistCounts.approved > 0 && (
                  <span className="ml-2 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {wishlistCounts.approved}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('denied')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === 'denied'
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Denied
                {wishlistCounts.denied > 0 && (
                  <span className="ml-2 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {wishlistCounts.denied}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab Description */}
        <div className="mb-6">
          {activeTab === 'pending' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-yellow-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">Waiting for Parent Approval</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    These videos are waiting for your parent to review and approve them.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'approved' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-green-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-green-800">Ready to Watch!</h3>
                  <p className="text-sm text-green-700 mt-1">
                    These videos have been approved by your parent. Click to watch them!
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'denied' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-red-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-red-800">Not Approved</h3>
                  <p className="text-sm text-red-700 mt-1">
                    These videos were not approved by your parent. You can remove them from your wishlist.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Empty State */}
        {currentTabVideos.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">
              {activeTab === 'pending' && '⏳'}
              {activeTab === 'approved' && '🎉'}
              {activeTab === 'denied' && '😔'}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === 'pending' && 'No videos waiting for approval'}
              {activeTab === 'approved' && 'No approved videos yet'}
              {activeTab === 'denied' && 'No denied videos'}
            </h3>
            <p className="text-gray-600 mb-4">
              {activeTab === 'pending' && 'When you add videos to your wishlist, they\'ll appear here.'}
              {activeTab === 'approved' && 'When your parent approves videos, they\'ll appear here.'}
              {activeTab === 'denied' && 'Videos that weren\'t approved will appear here.'}
            </p>
            <button
              onClick={() => navigate('/search')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Search for Videos
            </button>
          </div>
        )}

        {/* Videos Grid */}
        {currentTabVideos.length > 0 && (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 auto-rows-max place-items-center">
            {wishlistData[activeTab]?.map((item) => {
              const videoProps = convertWishlistItemToVideoCard(item);
              
              // Define actions based on tab
              const actions = activeTab === 'approved' 
                ? [
                    {
                      label: 'Play',
                      onClick: () => handleVideoClick(videoProps),
                      className: 'bg-green-600 hover:bg-green-700 text-white',
                      icon: (
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      )
                    },
                    {
                      label: 'Remove',
                      onClick: () => handleRemoveFromWishlist(item.video_id),
                      className: 'bg-gray-600 hover:bg-gray-700 text-white',
                      icon: (
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )
                    }
                  ]
                : [
                    {
                      label: 'Remove',
                      onClick: () => handleRemoveFromWishlist(item.video_id),
                      className: 'bg-gray-600 hover:bg-gray-700 text-white',
                      icon: (
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )
                    }
                  ];

              return (
                <WishlistVideoCard
                  key={item.video_id}
                  {...videoProps}
                  wishlistItem={item}
                  actions={actions}
                  onVideoClick={handleVideoClick}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WishlistPage;