import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Pagination } from '../components/layout/Pagination';
import { TimeIndicator, TimeTrackingState } from '../components/layout/TimeIndicator';
import { LocalFolderNavigator } from '../components/video/LocalFolderNavigator';
import { VideoGrid } from '../components/layout/VideoGrid';
import { PageHeader } from '../components/layout/PageHeader';
import { BreadcrumbNavigation, BreadcrumbItem } from '../components/layout/BreadcrumbNavigation';
import { logVerbose } from '../lib/logging';

export const SourcePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sourceId, page } = useParams();
  const [timeTrackingState, setTimeTrackingState] = useState<TimeTrackingState | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<any>(null);
  const [currentPageVideos, setCurrentPageVideos] = useState<any[]>([]);
  const [paginationState, setPaginationState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [watchedVideos, setWatchedVideos] = useState<any[]>([]);

  const currentPage = page ? parseInt(page) : 1;
  
  // Extract folder parameter from URL query string
  const urlParams = new URLSearchParams(location.search);
  const folderParam = urlParams.get('folder');
  const initialFolderPath = folderParam && source?.path ?
    (() => {
      const decodedFolder = decodeURIComponent(folderParam);
      // Detect platform and use appropriate separator
      const separator = source.path.includes('\\') ? '\\' : '/';
      return `${source.path}${separator}${decodedFolder}`;
    })() : undefined;

  // Load watched videos data
  useEffect(() => {
    const loadWatchedVideos = async () => {
      try {
        const watchedData = await (window as any).electron.getWatchedVideos();
        setWatchedVideos(watchedData);
      } catch (error) {
        console.error('Error loading watched videos:', error);
        setWatchedVideos([]);
      }
    };
    loadWatchedVideos();
  }, []);


  // Function to check video status
  const getVideoStatus = (videoId: string) => {
    const watchedData = watchedVideos.find(w => w.videoId === videoId);
    if (!watchedData) return { isWatched: false, isClicked: false };
    
    return {
      isWatched: watchedData.watched === true,
      isClicked: true // If it's in watched.json, it was clicked
    };
  };

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

        // Load videos for the current page
        if (window.electron.getPaginatedVideos) {
          const pageResult = await window.electron.getPaginatedVideos(sourceId, currentPage);
          setCurrentPageVideos(pageResult.videos || []);
          setPaginationState(pageResult.paginationState || null);
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

  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', path: '/' }
    ];

    if (source?.title) {
      items.push({ label: source.title, isActive: true });
    }

    return items;
  };

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

  const handleVideoClick = (video: any, currentFolderPath?: string) => {
    // Check if video already has navigation context (from LocalFolderNavigator)
    // If so, use that breadcrumb data instead of creating new one
    let breadcrumbData = video.navigationContext?.breadcrumb || {
      sourceName: source?.title,
      sourceId: sourceId,
      basePath: source?.path
    };

    // If we have a current folder path, add folder information to breadcrumb
    if (currentFolderPath && source?.path && currentFolderPath !== source.path) {
      const folderPath = [];

      // Build the folder hierarchy for breadcrumbs
      const separator = source.path.includes('\\') ? '\\' : '/';
      const relativePath = currentFolderPath.replace(source.path, '').replace(/^[/\\]/, '');
      const folderParts = relativePath.split(/[/\\]/).filter(Boolean);

      let buildPath = source.path;
      for (const part of folderParts) {
        buildPath = `${buildPath}${separator}${part}`;
        folderPath.push({
          name: part,
          path: buildPath
        });
      }

      breadcrumbData = {
        ...breadcrumbData,
        folderPath: folderPath
      };
    }

    if (video.type === 'youtube') {
      navigate(`/player/${encodeURIComponent(video.id)}`, {
        state: {
          videoTitle: video.title,
          returnTo: `/source/${sourceId}${currentPage > 1 ? `/page/${currentPage}` : ''}`,
          breadcrumb: breadcrumbData
        }
      });
    } else if (video.type === 'local') {
      // For local videos, include folder context in return navigation
      let returnTo = `/source/${sourceId}${currentPage > 1 ? `/page/${currentPage}` : ''}`;

      // If we have a current folder path and it's different from the source path,
      // we need to include folder context in the return URL
      if (currentFolderPath && source?.path && currentFolderPath !== source.path) {
        // Encode the folder path as a query parameter
        const relativePath = currentFolderPath.replace(source.path, '').replace(/^[/\\]/, '');
        returnTo += `?folder=${encodeURIComponent(relativePath)}`;
      }

      navigate(`/player/${encodeURIComponent(video.id)}`, {
        state: {
          returnTo: returnTo,
          currentFolderPath: currentFolderPath,
          breadcrumb: breadcrumbData
        }
      });
    }
  };

  const handleResetClick = async () => {
    if (!sourceId || !window.electron?.clearSourceCache) {
      console.error('Reset functionality not available');
      alert('Reset functionality not available');
      return;
    }

    try {
      const result = await window.electron.clearSourceCache(sourceId);

      if (result.success) {
        // Success - show success message and navigate to page 1
        alert(`✅ ${result.message || 'Cache cleared successfully'}`);
        // Navigate to page 1 to trigger fresh data load
        if (currentPage === 1) {
          // If we're already on page 1, force a reload
          window.location.reload();
        } else {
          // Navigate to page 1
          navigate(`/source/${sourceId}`);
        }
      } else {
        // Error occurred - show appropriate error message
        if (result.error === 'rate_limit') {
          // Rate limit error - show specific message
          alert(`⚠️ ${result.message}\n\nThe existing cache will continue to be used until the API is available again.`);
        } else if (result.error === 'api_error') {
          // General API error - show error message
          alert(`❌ ${result.message}\n\nPlease check your internet connection or API configuration.`);
        } else {
          // General error
          alert(`❌ ${result.message || 'Failed to clear cache'}`);
        }
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      logVerbose('[SourcePage] Error clearing cache:', error);
      alert(`❌ Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`);
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
        <BreadcrumbNavigation items={getBreadcrumbItems()} className="mb-4" />
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="p-4">
        <BreadcrumbNavigation items={getBreadcrumbItems()} className="mb-4" />
        <h1 className="text-2xl font-bold">Source Not Found</h1>
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
    const componentKey = `localfoldernav-${sourceId}-${initialFolderPath || 'source-root'}`;

    return (
      <LocalFolderNavigator
        key={componentKey}
        sourcePath={sourcePath}
        maxDepth={maxDepth}
        sourceTitle={source?.title || 'Local Source'}
        onBackClick={handleBackClick}
        onVideoClick={handleVideoClick}
        initialFolderPath={initialFolderPath}
        sourceId={sourceId}
      />
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <BreadcrumbNavigation items={getBreadcrumbItems()} />
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(`/source/${sourceId}/watched`)}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors"
          >
            Watched Videos
          </button>
          <button
            onClick={handleResetClick}
            className="text-sm text-gray-500 hover:text-gray-700 underline cursor-pointer"
          >
            Reset
          </button>
          <TimeIndicator initialState={timeTrackingState} />
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-2">{source.title}</h1>
      <p className="text-gray-600 mb-6">{source.videoCount} videos</p>
      
      {/* Pagination - Top (centered on page) */}
      {paginationState && paginationState.totalPages > 1 && (
        <div className="flex justify-center mb-6">
          <Pagination
            currentPage={paginationState.currentPage}
            totalPages={paginationState.totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Video Grid */}
      <VideoGrid
        videos={currentPageVideos.map((video: any) => {
          const { isWatched, isClicked } = getVideoStatus(video.id);

          return {
            id: video.id,
            thumbnail: video.thumbnail || '/placeholder-thumbnail.svg',
            title: video.title,
            duration: video.duration || 0,
            type: video.type,
            watched: isWatched,
            isClicked: isClicked,
            isAvailable: video.isAvailable !== false,
            isFallback: video.isFallback === true,
            errorInfo: video.errorInfo,
            resumeAt: video.resumeAt,
            onVideoClick: () => handleVideoClick(video),
            // isFavorite will be populated by VideoGrid's useFavoriteStatus hook
            source: source?.id || 'unknown',
            lastWatched: video.lastWatched
          };
        })}
        groupByType={false}
        className="mb-6"
        // Enable favorite icons for all sources including local, YouTube, and favorites page
        showFavoriteIcons={true}
      />
      
      {/* Bottom pagination */}
      {paginationState && paginationState.totalPages > 1 && (
        <div className="flex justify-center mb-6">
          <Pagination
            currentPage={paginationState.currentPage}
            totalPages={paginationState.totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
};
