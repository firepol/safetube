import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pagination } from '../components/layout/Pagination';
import { TimeIndicator, TimeTrackingState } from '../components/layout/TimeIndicator';
import { LocalFolderNavigator } from '../components/video/LocalFolderNavigator';
import { logVerbose } from '../lib/logging';

export const SourcePage: React.FC = () => {
  const navigate = useNavigate();
  const { sourceId, page } = useParams();
  const [timeTrackingState, setTimeTrackingState] = useState<TimeTrackingState | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<any>(null);
  const [currentPageVideos, setCurrentPageVideos] = useState<any[]>([]);
  const [paginationState, setPaginationState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const currentPage = page ? parseInt(page) : 1;

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
    const loadSourceAndVideos = async () => {
      if (!sourceId || !window.electron?.loadVideosFromSources) {
        setError('Required dependencies not available');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Load all sources to find the one we need
        const result = await window.electron.loadVideosFromSources();
        const { videosBySource } = result;
        
        const foundSource = videosBySource.find((s: any) => s.id === sourceId);
        if (!foundSource) {
          setError(`Source not found: ${sourceId}`);
          setIsLoading(false);
          return;
        }

        setSource(foundSource);

        // Debug logging for source data
        logVerbose('[SourcePage] Found source:', foundSource);
        logVerbose('[SourcePage] Source videos count:', foundSource.videos?.length);
        logVerbose('[SourcePage] Current page:', currentPage);

        // Load videos for the current page
        if (window.electron.getPaginatedVideos) {
          const pageResult = await window.electron.getPaginatedVideos(sourceId, currentPage);
          setCurrentPageVideos(pageResult.videos || []);
          setPaginationState(pageResult.paginationState || null);
          
          // Debug logging
          logVerbose('[SourcePage] Pagination result:', pageResult);
          logVerbose('[SourcePage] Pagination state:', pageResult.paginationState);
          logVerbose('[SourcePage] Videos count:', pageResult.videos?.length);
        } else {
          // Fallback: use all videos from source
          setCurrentPageVideos(foundSource.videos || []);
          setPaginationState({
            currentPage: 1,
            totalPages: 1,
            totalVideos: foundSource.videos?.length || 0,
            pageSize: 50 // Will be updated with actual config
          });
        }
      } catch (err) {
        setError('Error loading source: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsLoading(false);
      }
    };

    loadSourceAndVideos();
  }, [sourceId, currentPage]);

  // For local sources, we need to get the maxDepth from the source data
  // The source object should already contain this information from the backend

  const handleBackClick = () => {
    navigate('/');
  };

  const handlePageChange = (pageNumber: number) => {
    if (pageNumber === 1) {
      navigate(`/source/${sourceId}`);
    } else {
      navigate(`/source/${sourceId}/page/${pageNumber}`);
    }
  };

  const handleVideoClick = (video: any) => {
    if (video.type === 'youtube') {
      navigate(`/player/${video.id}`, { 
        state: { 
          videoTitle: video.title,
          returnTo: `/source/${sourceId}${currentPage > 1 ? `/page/${currentPage}` : ''}`
        } 
      });
    } else if (video.type === 'local') {
      navigate(`/player/${video.id}`, {
        state: { 
          returnTo: `/source/${sourceId}${currentPage > 1 ? `/page/${currentPage}` : ''}`
        }
      });
    }
  };

  const handleResetClick = async () => {
    if (!sourceId || !window.electron?.clearSourceCache) {
      console.error('Reset functionality not available');
      return;
    }

    try {
      await window.electron.clearSourceCache(sourceId);
      // Reload the page to refresh the data
      window.location.reload();
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading source...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBackClick}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors"
          >
            ← Back to Sources
          </button>
          <h1 className="text-2xl font-bold">Error</h1>
        </div>
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBackClick}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors"
          >
            ← Back to Sources
          </button>
          <h1 className="text-2xl font-bold">Source Not Found</h1>
        </div>
      </div>
    );
  }

  // Check if this is a local source that should use the navigator
  const isLocalSource = source?.type === 'local';
  
  // For local sources, get maxDepth from the source data
  // The backend should provide this information when loading the source
  const maxDepth = source?.maxDepth || 2;
  const sourcePath = source?.path || source?.url;

  // For local sources, use the folder navigator
  if (isLocalSource) {
    return (
      <LocalFolderNavigator
        sourcePath={sourcePath}
        maxDepth={maxDepth}
        sourceTitle={source?.title || 'Local Source'}
        onBackClick={handleBackClick}
        onVideoClick={handleVideoClick}
      />
    );
  }

  // For other sources (YouTube, DLNA), use the regular video grid
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleBackClick}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors"
          >
            ← Back to Sources
          </button>
          <h1 className="text-2xl font-bold">{source.title}</h1>
          <span className="text-sm text-gray-500">({source.videoCount} videos)</span>
          <button
            onClick={handleResetClick}
            className="text-sm text-gray-500 hover:text-gray-700 underline cursor-pointer"
          >
            Reset
          </button>
        </div>
        <TimeIndicator initialState={timeTrackingState} />
      </div>
      
      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        {currentPageVideos.map((video: any) => (
          <div
            key={video.id}
            className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:scale-105"
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
              <p className="text-xs text-gray-500">
                {video.type === 'youtube' ? 'YouTube' : 'Local Video'}
              </p>
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
    </div>
  );
};
