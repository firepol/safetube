import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Pagination } from '../components/layout/Pagination';
import { TimeIndicator, TimeTrackingState } from '../components/layout/TimeIndicator';
import { LocalFolderNavigator } from '../components/video/LocalFolderNavigator';
import { VideoGrid } from '../components/layout/VideoGrid';
import { VideoSkeleton } from '../components/layout/VideoSkeleton';
import { PageHeader } from '../components/layout/PageHeader';
import { BreadcrumbNavigation, BreadcrumbItem } from '../components/layout/BreadcrumbNavigation';
import { logVerbose } from '../lib/logging';
import { SourceValidationService } from '../services/sourceValidationService';
import { NavigationCache } from '../services/navigationCache';

export const SourcePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sourceId, page } = useParams();
  const [timeTrackingState, setTimeTrackingState] = useState<TimeTrackingState | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [source, setSource] = useState<any>(null);
  const [currentPageVideos, setCurrentPageVideos] = useState<any[]>([]);
  const [paginationState, setPaginationState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [watchedVideos, setWatchedVideos] = useState<any[]>([]);
  const [validationResults, setValidationResults] = useState<Map<string, boolean>>(new Map());



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
      if (!sourceId) {
        setError('Source ID not provided');
        setIsLoading(false);
        return;
      }

      try {
        // 🚀 INSTANT CACHE CHECK: Try cache first for sub-100ms navigation
        const cachedPageData = NavigationCache.getCachedPageData(sourceId, currentPage);

        if (cachedPageData) {
  
          // Ultra-fast state update from cache
          React.startTransition(() => {
            setSource(cachedPageData.source);
            setIsLoading(false);
            setCurrentPageVideos(cachedPageData.videos);
            setPaginationState(cachedPageData.paginationState);
            setIsLoadingVideos(false);
            setError(null);
          });

          // Start background prefetch for adjacent pages
          if (cachedPageData.paginationState) {
            NavigationCache.prefetchAdjacentPages(
              sourceId,
              currentPage,
              cachedPageData.paginationState.totalPages
            );
          }

          return; // Exit early - cached data is sufficient
        }


        // Batch initial state updates for better performance
        React.startTransition(() => {
          setIsLoading(true);
          setIsLoadingVideos(true);
          setError(null);
        });


        let foundSource: any;

        // First, get the source info to check if it's a local source
        if (!window.electron?.loadVideosFromSources) {
          setError('Required dependencies not available');
          setIsLoading(false);
          return;
        }

        const allSourcesResult = await window.electron.loadVideosFromSources();

        const { videosBySource } = allSourcesResult;

        logVerbose(`[SourcePage] 📋 loadVideosFromSources returned ${videosBySource?.length || 0} sources:`,
          videosBySource?.map((s: any) => s.id).join(', ') || 'none');
        logVerbose(`[SourcePage] 🔍 Looking for sourceId: ${sourceId}`);

        foundSource = videosBySource.find((s: any) => s.id === sourceId);
        if (!foundSource) {
          logVerbose(`[SourcePage] ❌ Source ${sourceId} not found in videosBySource array`);
          setError(`Source not found (SourcePage): ${sourceId}`);
          setIsLoading(false);
          return;
        }

        logVerbose(`[SourcePage] ✅ Found source: ${foundSource.id} (${foundSource.title}) with ${foundSource.videoCount} videos`);


        // For non-local sources, try to load videos using the optimized approach
        if (foundSource.type !== 'local' && window.electron?.loadVideosForSource) {
          try {
            const result = await window.electron.loadVideosForSource(sourceId);
            // Only overwrite if result.source exists (some sources like favorites may not return a source object)
            if (result.source) {
              foundSource = result.source;
            }
          } catch (error) {
            logVerbose('[SourcePage] Failed to load specific source, using fallback data:', error);
            // Continue with foundSource from loadVideosFromSources
          }
        }

        // 🎯 CRITICAL: Batch UI updates for instant skeleton→content transition

        // Load videos for the current page first (this is the critical path)
        let videos: any[] = [];
        let paginationData: any = null;

        if (window.electron.getPaginatedVideos) {
          const pageResult = await window.electron.getPaginatedVideos(sourceId, currentPage);
          logVerbose(`[SourcePage] 📊 Received pagination state:`, pageResult.paginationState);
          logVerbose(`[SourcePage] 📊 Received ${pageResult.videos?.length || 0} videos`);
          if (pageResult.videos && pageResult.videos.length > 0) {
            logVerbose(`[SourcePage] 📊 First video:`, pageResult.videos[0]);
          }
          videos = pageResult.videos || [];
          paginationData = pageResult.paginationState || null;
        } else {
          // Fallback: use all videos from source
          videos = foundSource.videos || [];
          paginationData = foundSource.paginationState || {
            currentPage: 1,
            totalPages: 1,
            totalVideos: foundSource.videos?.length || 0,
            pageSize: 50 // Will be updated with actual config
          };
        }

        // 🚨 ULTRA-FAST UI UPDATE: Batch all state changes into single atomic update
        const batchedUpdate = () => {
          logVerbose(`[SourcePage] 🎯 Setting state with ${videos.length} videos`);
          setSource(foundSource);
          setIsLoading(false); // Header can render immediately
          setCurrentPageVideos(videos); // Videos ready for display
          setPaginationState(paginationData);
          setIsLoadingVideos(false); // Triggers instant skeleton→content transition
        };

        // Use React.startTransition for non-blocking update
        React.startTransition(batchedUpdate);

        // 🚀 CACHE THE RESULTS: Store for instant future navigation
        NavigationCache.cachePageData(sourceId, currentPage, foundSource, videos, paginationData);

        // 🚀 BACKGROUND PREFETCH: Start prefetching adjacent pages
        if (paginationData && paginationData.totalPages > 1) {
          NavigationCache.prefetchAdjacentPages(sourceId, currentPage, paginationData.totalPages);
        }


        // 🚀 ASYNC ENHANCEMENT: Non-blocking operations that enhance UX
        if (sourceId === 'favorites' && videos.length > 0) {
          // Run validation and thumbnail generation asynchronously - these don't block UI
          Promise.resolve().then(async () => {

            // Process thumbnails in parallel, not sequentially
            const thumbnailPromises = videos.map(async (video) => {
              if (!video.thumbnail || video.thumbnail.trim() === '') {
                try {
                  const generatedThumbnail = await (window as any).electron.getBestThumbnail(video.id);
                  if (generatedThumbnail) {
                    return { id: video.id, thumbnail: generatedThumbnail };
                  }
                } catch (error) {
                  logVerbose('[SourcePage] Error getting best thumbnail for:', video.id, error);
                }
              }
              return null;
            });

            // Wait for thumbnails and update videos
            const thumbnailResults = await Promise.all(thumbnailPromises);

            const updatedVideos = videos.map(video => {
              const thumbnailUpdate = thumbnailResults.find(t => t?.id === video.id);
              return thumbnailUpdate ? { ...video, thumbnail: thumbnailUpdate.thumbnail } : video;
            });

            // Update videos with new thumbnails (React will efficiently update only changed items)
            if (thumbnailResults.some(t => t !== null)) {
              React.startTransition(() => {
                setCurrentPageVideos(updatedVideos);
              });
            }

            // Run validation
            const videosToValidate = updatedVideos.map(v => ({
              videoId: v.id,
              sourceId: v.sourceId && v.sourceId !== 'local' ? v.sourceId : (v.originalSourceId || 'unknown'),
              sourceType: v.type === 'youtube' ? 'youtube' : v.type === 'local' ? 'local' : 'dlna'
            }));

            const validationMap = await SourceValidationService.batchValidateVideos(videosToValidate);

            React.startTransition(() => {
              setValidationResults(validationMap);
            });

          }).catch(error => {
            console.error('🚨 [FRONTEND-PERF] Error in background enhancement processing:', error);
            logVerbose('[SourcePage] Error in async thumbnail/validation processing:', error);
          });
        }


      } catch (err) {
        setError('Error loading source: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsLoading(false);
        setIsLoadingVideos(false);
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
      const encodedId = encodeURIComponent(video.id);
      const targetUrl = `/player/${encodedId}`;
      navigate(targetUrl, {
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
    } else {
      console.error('[SourcePage] Unknown video type or undefined type', {
        videoType: video.type,
        video: video
      });
      // Fallback navigation - assume it's a YouTube video if type is undefined
      if (!video.type && video.id) {
        console.log('[SourcePage] Fallback - treating as YouTube video');
        const encodedId = encodeURIComponent(video.id);
        const targetUrl = `/player/${encodedId}`;
        navigate(targetUrl, {
          state: {
            videoTitle: video.title,
            returnTo: `/source/${sourceId}${currentPage > 1 ? `/page/${currentPage}` : ''}`,
            breadcrumb: breadcrumbData
          }
        });
      }
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
        <div className="flex items-center justify-between mb-6">
          <BreadcrumbNavigation items={getBreadcrumbItems()} />
          <TimeIndicator initialState={timeTrackingState} />
        </div>
        <h1 className="text-2xl font-bold mb-2">{sourceId ? `Loading ${sourceId}...` : 'Loading source...'}</h1>
        <div className="flex items-center space-x-3 mb-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Fetching videos from YouTube API...</span>
        </div>
        <VideoSkeleton count={15} />
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

      {/* Video Grid or Loading */}
      {isLoadingVideos ? (
        <VideoSkeleton count={15} className="mb-6" />
      ) : (
        <VideoGrid
          videos={currentPageVideos.map((video: any) => {
            const { isWatched, isClicked } = getVideoStatus(video.id);

            // For favorites, use validation results; otherwise use video's isAvailable flag
            const isAvailable = sourceId === 'favorites'
              ? validationResults.get(video.id) ?? true
              : video.isAvailable !== false;

            return {
              id: video.id,
              thumbnail: video.thumbnail || '/placeholder-thumbnail.svg',
              title: video.title,
              duration: video.duration || 0,
              type: video.type || (source?.type === 'youtube_channel' || source?.type === 'youtube_playlist' ? 'youtube' : undefined),
              watched: isWatched,
              isClicked: isClicked,
              isAvailable: isAvailable,
              unavailableReason: sourceId === 'favorites' ? "This video's source is no longer approved" : undefined,
              isFallback: video.isFallback === true,
              errorInfo: video.errorInfo,
              resumeAt: video.resumeAt,
              onVideoClick: () => handleVideoClick({
                ...video,
                type: video.type || (source?.type === 'youtube_channel' || source?.type === 'youtube_playlist' ? 'youtube' : undefined)
              }, undefined),
              // isFavorite will be populated by VideoGrid's useFavoriteStatus hook
              sourceId: sourceId === 'favorites'
                ? (video.originalSourceId || video.sourceId || 'unknown')
                : (source?.id || 'unknown'),
              lastWatched: video.lastWatched
            };
          })}
          groupByType={false}
          className="mb-6"
          // Enable favorite icons for all sources including local, YouTube, and favorites page
          showFavoriteIcons={true}
        />
      )}
      
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
