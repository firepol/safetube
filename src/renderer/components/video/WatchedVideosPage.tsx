import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pagination } from '../layout/Pagination';
import { TimeIndicator, TimeTrackingState } from '../layout/TimeIndicator';
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
                videosWithDetails.push({
                  ...videoData,
                  watchedData: watchedVideo
                });
              } else {
                // Video exists but doesn't belong to this source, skip it
                continue;
              }
            } else {
              // Video data not available, check if it's a local video by trying to decode the ID
              const { isEncodedFilePath, decodeFilePath } = await import('../../../shared/fileUtils');
              if (isEncodedFilePath(watchedVideo.videoId)) {
                try {
                  const filePath = decodeFilePath(watchedVideo.videoId);
                  // Check if this file belongs to the current source
                  if (sourceData.path && filePath.startsWith(sourceData.path)) {
                    const fileName = path.basename(filePath, path.extname(filePath));
                    videosWithDetails.push({
                      id: watchedVideo.videoId,
                      title: fileName,
                      thumbnail: '',
                      type: 'local',
                      duration: watchedVideo.duration || 0,
                      sourceId: sourceId,
                      sourceTitle: sourceData.title,
                      watchedData: watchedVideo
                    });
                  }
                } catch (decodeError) {
                  logVerbose('[WatchedVideosPage] Error decoding file path:', watchedVideo.videoId, decodeError);
                }
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
    navigate(`/player/${video.id}`);
  };

  const handlePageChange = (newPage: number) => {
    navigate(`/source/${sourceId}/watched/${newPage}`);
  };

  const handleBackClick = () => {
    navigate(`/source/${sourceId}`);
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
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBackClick}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors duration-200"
            >
              ← Back to {source?.title || 'Source'}
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                ✅ Watched Videos
              </h1>
              <p className="text-gray-600">
                {source?.title || 'Source'} • {paginationState?.totalVideos || 0} videos fully watched
              </p>
            </div>
          </div>
          <TimeIndicator realTime={true} updateInterval={3000} />
        </div>

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
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              ← Back to Source
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              {watchedVideos.map((video) => (
                <div
                  key={video.id}
                  className={`bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:scale-105 ${
                    video.watchedData.watched === false ? 'border-2 border-blue-400' : 
                    video.watchedData.watched === undefined ? 'border-2 border-gray-300' : ''
                  }`}
                  onClick={() => handleVideoClick(video)}
                >
                  <div className="aspect-video bg-gray-200 overflow-hidden">
                    {video.thumbnail ? (
                      <img 
                        src={video.thumbnail} 
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                        <div className="text-2xl text-gray-500">📹</div>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">
                      {video.title}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{video.type === 'youtube' ? 'YouTube' : 'Local Video'}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      Last watched: {new Date(video.watchedData.lastWatched).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
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
    </div>
  );
};
