import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pagination } from '../layout/Pagination';
import { TimeIndicator, TimeTrackingState } from '../layout/TimeIndicator';
import { VideoGrid } from '../layout/VideoGrid';
import { BreadcrumbNavigation, BreadcrumbItem } from '../layout/BreadcrumbNavigation';
import { logVerbose } from '../../lib/logging';
import path from 'path';

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

export const WatchedVideosPage: React.FC = () => {
  const navigate = useNavigate();
  const { sourceId, page } = useParams();
  const [, setTimeTrackingState] = useState<TimeTrackingState | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<any>(null);
  const [watchedVideos, setWatchedVideos] = useState<VideoWithDetails[]>([]);
  const [paginationState, setPaginationState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const currentPage = page ? parseInt(page) : 1;
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
    const loadWatchedVideos = async () => {
      if (!sourceId) return;
      
      try {
        setIsLoading(true);
        setError(null);

        // Load source information
        const sources = await (window as any).electron.loadVideosFromSources();
        const sourceData = sources.videosBySource?.find((s: any) => s.id === sourceId);
        if (!sourceData) {
          throw new Error('Source not found');
        }
        setSource(sourceData);

        // Load watched videos data
        const watchedData = await (window as any).electron.getWatchedVideos();
        
        // Filter watched videos for this source - only show actually watched videos
        const sourceWatchedVideos = watchedData.filter((w: WatchedVideo) => {
          return w.videoId && w.watched === true; // Only show videos that are actually watched
        });

        // Get video details for watched videos
        const videosWithDetails: VideoWithDetails[] = [];
        for (const watchedVideo of sourceWatchedVideos) {
          try {
            const videoData = await (window as any).electron.getVideoData(watchedVideo.videoId);
            if (videoData) {
              // For local videos, check if the video path matches the source path
              // For other videos, check sourceId
              const belongsToSource = videoData.sourceId === sourceId ||
                (videoData.type === 'local' && videoData.url && sourceData.path &&
                 videoData.url.startsWith(sourceData.path));

              if (belongsToSource) {
                // Check for best available thumbnail if original is empty
                let bestThumbnail = videoData.thumbnail;
                if (!bestThumbnail || bestThumbnail.trim() === '') {
                  try {
                    const generatedThumbnail = await (window as any).electron.getBestThumbnail(watchedVideo.videoId);
                    if (generatedThumbnail) {
                      bestThumbnail = generatedThumbnail;
                      logVerbose('[WatchedVideosPage] Using generated thumbnail for:', watchedVideo.videoId, '->', generatedThumbnail);
                    }
                  } catch (error) {
                    logVerbose('[WatchedVideosPage] Error getting best thumbnail for:', watchedVideo.videoId, error);
                  }
                }

                videosWithDetails.push({
                  ...videoData,
                  thumbnail: bestThumbnail,
                  watchedData: watchedVideo
                });
              } else {
                // Video exists but doesn't belong to this source, skip it
                continue;
              }
            } else {
              // Video data not available, check if it's a local video by extracting path from URI-style ID
              const { extractPathFromVideoId } = await import('../../../shared/fileUtils');
              const filePath = extractPathFromVideoId(watchedVideo.videoId);
              if (filePath && sourceData.path && filePath.startsWith(sourceData.path)) {
                const fileName = path.basename(filePath, path.extname(filePath));

                // Check for best available thumbnail for this video
                let bestThumbnail = watchedVideo.thumbnail || '';
                if (!bestThumbnail || bestThumbnail.trim() === '') {
                  try {
                    const generatedThumbnail = await (window as any).electron.getBestThumbnail(watchedVideo.videoId);
                    if (generatedThumbnail) {
                      bestThumbnail = generatedThumbnail;
                      logVerbose('[WatchedVideosPage] Using generated thumbnail for fallback video:', watchedVideo.videoId, '->', generatedThumbnail);
                    }
                  } catch (error) {
                    logVerbose('[WatchedVideosPage] Error getting best thumbnail for fallback video:', watchedVideo.videoId, error);
                  }
                }

                videosWithDetails.push({
                  id: watchedVideo.videoId,
                  title: watchedVideo.title || fileName,
                  thumbnail: bestThumbnail,
                  type: 'local',
                  duration: watchedVideo.duration || 0,
                  sourceId: sourceId,
                  sourceTitle: sourceData.title,
                  watchedData: watchedVideo
                });
              }
            }
          } catch (error) {
            logVerbose('[WatchedVideosPage] Error loading video data for:', watchedVideo.videoId, error);
            // Skip videos that can't be loaded instead of creating fallback entries
            continue;
          }
        }

        // Sort by last watched date (newest first)
        videosWithDetails.sort((a, b) => 
          new Date(b.watchedData.lastWatched).getTime() - new Date(a.watchedData.lastWatched).getTime()
        );

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
        console.error('Error loading watched videos:', err);
        setError('Failed to load watched videos');
      } finally {
        setIsLoading(false);
      }
    };

    loadWatchedVideos();
  }, [sourceId, currentPage]);

  const handleVideoClick = (video: VideoWithDetails) => {
    navigate(`/player/${encodeURIComponent(video.id)}`, {
      state: {
        videoTitle: video.title,
        returnTo: `/source/${sourceId}/watched`,
        breadcrumb: {
          sourceName: source?.title || 'Source',
          sourceId: sourceId,
          basePath: `/source/${sourceId}/watched`,
          isWatchedVideos: true
        }
      }
    });
  };

  const handlePageChange = (newPage: number) => {
    navigate(`/source/${sourceId}/watched/${newPage}`);
  };

  const handleBackClick = () => {
    navigate(`/source/${sourceId}`);
  };

  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', path: '/' }
    ];

    if (source?.title) {
      items.push({ label: source.title, path: `/source/${sourceId}` });
    }

    items.push({ label: 'Watched Videos', isActive: true });

    return items;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg mb-2">Loading watched videos...</div>
          <div className="text-sm text-gray-500">This may take a few moments</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg mb-2 text-red-500">Error: {error}</div>
          <button
            onClick={handleBackClick}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            ← Back to Source
          </button>
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

      <h1 className="text-2xl font-bold mb-2">✅ Watched Videos</h1>
      <p className="text-gray-600 mb-6">{paginationState?.totalVideos || 0} videos fully watched</p>

      {/* Watched Videos Grid */}
      {watchedVideos.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Fully Watched Videos</h2>
          <p className="text-gray-500 mb-4">
            You haven't fully watched any videos from this source yet.
          </p>
          <button
            onClick={handleBackClick}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors"
          >
            ← Back to Source
          </button>
        </div>
      ) : (
        <>
          <VideoGrid
            videos={watchedVideos.map((video) => {
              const isWatched = video.watchedData.watched === true;
              const isClicked = true; // All videos in watched videos page have been clicked

              return {
                id: video.id,
                thumbnail: video.thumbnail || '',
                title: video.title,
                duration: video.duration || 0,
                type: video.type,
                watched: isWatched,
                isClicked: isClicked,
                onVideoClick: () => handleVideoClick(video)
              };
            })}
            groupByType={false}
            className="mb-6"
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
