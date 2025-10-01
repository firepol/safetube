import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pagination } from '../components/layout/Pagination';
import { TimeIndicator, TimeTrackingState } from '../components/layout/TimeIndicator';
import { VideoGrid } from '../components/layout/VideoGrid';
import { BreadcrumbNavigation, BreadcrumbItem } from '../components/layout/BreadcrumbNavigation';
import { logVerbose } from '../lib/logging';
import { SourceValidationService } from '../services/sourceValidationService';

interface WatchedVideo {
  videoId: string;
  position: number;
  lastWatched: string;
  timeWatched: number;
  duration?: number;
  watched?: boolean;
}

interface VideoWithDetails {
  id: string;
  title: string;
  thumbnail: string;
  type: 'youtube' | 'local' | 'dlna';
  duration: number;
  sourceId: string;
  sourceTitle: string;
  watchedData: WatchedVideo;
}

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [, setTimeTrackingState] = useState<TimeTrackingState | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [watchedVideos, setWatchedVideos] = useState<VideoWithDetails[]>([]);
  const [paginationState, setPaginationState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [validationResults, setValidationResults] = useState<Map<string, boolean>>(new Map());
  const pageSize = 20; // Videos per page

  useEffect(() => {
    const checkTimeLimits = async () => {
      try {
        if (!(window as any).electron || !(window as any).electron.getTimeTrackingState) {
          throw new Error('window.electron.getTimeTrackingState not available');
        }
        const state = await (window as any).electron.getTimeTrackingState();
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
      } catch (error) {
        console.error('Error checking time limits:', error);
      }
    };
    checkTimeLimits();
  }, [navigate]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load watched videos data
        const watchedData = await (window as any).electron.getWatchedVideos();
        
        // Show ALL videos from watched.json (no filtering)
        const validWatchedVideos = watchedData.filter((w: WatchedVideo) => {
          return w.videoId; // Only filter out entries without videoId
        });

        // Get video details for watched videos
        const videosWithDetails: VideoWithDetails[] = [];
        for (const watchedVideo of validWatchedVideos) {
          try {
            const videoData = await (window as any).electron.getVideoData(watchedVideo.videoId);
            if (videoData) {
              // Check for best available thumbnail if original is empty
              let bestThumbnail = videoData.thumbnail;
              if (!bestThumbnail || bestThumbnail.trim() === '') {
                try {
                  const generatedThumbnail = await (window as any).electron.getBestThumbnail(watchedVideo.videoId);
                  if (generatedThumbnail) {
                    bestThumbnail = generatedThumbnail;
                  }
                } catch (error) {
                  logVerbose('[HistoryPage] Error getting best thumbnail for:', watchedVideo.videoId, error);
                }
              }

              videosWithDetails.push({
                ...videoData,
                thumbnail: bestThumbnail,
                watchedData: watchedVideo
              });
            } else {
              // If video data is not available, create a fallback entry
              // Try to determine video type based on video ID format
              let videoType: 'youtube' | 'local' | 'dlna' = 'local';
              if (watchedVideo.videoId.length === 11) {
                // YouTube video IDs are typically 11 characters
                videoType = 'youtube';
              } else if (watchedVideo.videoId.includes('/') || watchedVideo.videoId.startsWith('_')) {
                // Local video paths contain '/' or start with '_'
                videoType = 'local';
              }

              // Check for best available thumbnail for fallback entry
              let bestThumbnail = '';
              try {
                const generatedThumbnail = await (window as any).electron.getBestThumbnail(watchedVideo.videoId);
                if (generatedThumbnail) {
                  bestThumbnail = generatedThumbnail;
                }
              } catch (error) {
                logVerbose('[HistoryPage] Error getting best thumbnail for fallback video:', watchedVideo.videoId, error);
              }

              videosWithDetails.push({
                id: watchedVideo.videoId,
                title: `Video (${watchedVideo.videoId})`,
                thumbnail: bestThumbnail,
                type: videoType, // Detected type based on ID format
                duration: watchedVideo.duration || 0,
                sourceId: watchedVideo.source || 'unknown', // Use source from watchedData
                sourceTitle: 'Unknown Source',
                watchedData: watchedVideo
              });
            }
          } catch (error) {
            logVerbose('[HistoryPage] Error loading video data for:', watchedVideo.videoId, error);
            // Create a fallback entry for videos that can't be loaded
            // Try to determine video type based on video ID format
            let videoType: 'youtube' | 'local' | 'dlna' = 'local';
            if (watchedVideo.videoId.length === 11) {
              // YouTube video IDs are typically 11 characters
              videoType = 'youtube';
            } else if (watchedVideo.videoId.includes('/') || watchedVideo.videoId.startsWith('_')) {
              // Local video paths contain '/' or start with '_'
              videoType = 'local';
            }

            // Check for best available thumbnail for error fallback entry
            let bestThumbnail = '';
            try {
              const generatedThumbnail = await (window as any).electron.getBestThumbnail(watchedVideo.videoId);
              if (generatedThumbnail) {
                bestThumbnail = generatedThumbnail;
              }
            } catch (error) {
              logVerbose('[HistoryPage] Error getting best thumbnail for error fallback video:', watchedVideo.videoId, error);
            }

            videosWithDetails.push({
              id: watchedVideo.videoId,
              title: `Video (${watchedVideo.videoId})`,
              thumbnail: bestThumbnail,
              type: videoType, // Detected type based on ID format
              duration: watchedVideo.duration || 0,
              sourceId: watchedVideo.source || 'unknown', // Use source from watchedData
              sourceTitle: 'Unknown Source',
              watchedData: watchedVideo
            });
          }
        }

        // Sort by last watched date (newest first)
        videosWithDetails.sort((a, b) =>
          new Date(b.watchedData.lastWatched).getTime() - new Date(a.watchedData.lastWatched).getTime()
        );

        // Batch validate all videos for source availability
        const videosToValidate = videosWithDetails.map(v => ({
          videoId: v.id,
          sourceId: v.sourceId,
          sourceType: v.type === 'youtube' ? 'youtube' : v.type === 'local' ? 'local' : 'dlna'
        }));

        const validationMap = await SourceValidationService.batchValidateVideos(videosToValidate);
        setValidationResults(validationMap);

        // Apply pagination
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedVideos = videosWithDetails.slice(startIndex, endIndex);

        setWatchedVideos(paginatedVideos);
        setPaginationState({
          currentPage,
          totalPages: Math.ceil(videosWithDetails.length / pageSize),
          totalVideos: videosWithDetails.length
        });

      } catch (err) {
        console.error('Error loading history:', err);
        setError('Failed to load video history');
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, [currentPage]);

  const handleVideoClick = (video: VideoWithDetails) => {
    navigate(`/player/${encodeURIComponent(video.id)}`, {
      state: {
        videoTitle: video.title,
        returnTo: '/history',
        breadcrumb: {
          sourceName: 'History',
          historyPath: '/history', // Special field for History page navigation
          basePath: '/history'
        }
      }
    });
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleBackClick = () => {
    navigate('/');
  };

  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    return [
      { label: 'Home', path: '/' },
      { label: 'History', isActive: true }
    ];
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <BreadcrumbNavigation items={getBreadcrumbItems()} />
          <TimeIndicator realTime={true} updateInterval={3000} />
        </div>
        <div className="text-center py-12">
          <div className="text-lg mb-2">Loading video history...</div>
          <div className="text-sm text-gray-500">This may take a few moments</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <BreadcrumbNavigation items={getBreadcrumbItems()} />
          <TimeIndicator realTime={true} updateInterval={3000} />
        </div>
        <div className="text-center py-12">
          <div className="text-lg mb-2 text-red-500">Error: {error}</div>
          <p className="text-gray-500">There was a problem loading your video history.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <BreadcrumbNavigation items={getBreadcrumbItems()} />
        <TimeIndicator realTime={true} updateInterval={3000} />
      </div>

      <h1 className="text-2xl font-bold mb-2">📚 Video History</h1>
      <p className="text-gray-600 mb-6">{paginationState?.totalVideos || 0} videos total</p>

      {/* History Videos Grid */}
      {watchedVideos.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Video History</h2>
          <p className="text-gray-500">
            You haven't watched any videos yet. Start watching to see your history here!
          </p>
        </div>
      ) : (
        <>
          <VideoGrid
            videos={watchedVideos.map((video) => {
              // Calculate progress percentage for watched videos
              const progress = video.watchedData.duration
                ? (video.watchedData.position / video.watchedData.duration) * 100
                : 0;

              return {
                id: video.id,
                thumbnail: video.thumbnail || '',
                title: video.title,
                duration: video.duration || 0,
                type: video.type,
                watched: !!video.watchedData.watched, // Convert to boolean (handles both 1/0 and true/false)
                isClicked: true, // All videos in history have been clicked
                progress: progress,
                resumeAt: video.watchedData.position,
                onVideoClick: () => handleVideoClick(video),
                sourceId: video.sourceId || 'unknown',
                lastWatched: video.watchedData.lastWatched,
                // Will be checked by VideoGrid using simple favorites hook
                isFavorite: false,
                // Source validation
                isAvailable: validationResults.get(video.id) ?? true,
                unavailableReason: "This video's source is no longer approved"
              };
            })}
            groupByType={false}
            className="mb-6"
            // Enable favorite icons for YouTube videos in history
            showFavoriteIcons={true}
          />

          {/* Pagination */}
          {paginationState && paginationState.totalPages > 1 && (
            <Pagination
              currentPage={paginationState.currentPage}
              totalPages={paginationState.totalPages}
              onPageChange={handlePageChange}
              className="mb-6"
            />
          )}
        </>
      )}
    </div>
  );
};
