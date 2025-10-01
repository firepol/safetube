import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { VideoGrid } from '../layout/VideoGrid';
import { PageHeader } from '../layout/PageHeader';
import { BreadcrumbNavigation, BreadcrumbItem } from '../layout/BreadcrumbNavigation';
import { TimeIndicator, TimeTrackingState } from '../layout/TimeIndicator';
import { logVerbose } from '../../lib/logging';

interface FolderItem {
  name: string;
  path: string;
  type: 'folder';
  depth: number;
  videoCount?: number;
}

interface VideoItem {
  id: string;
  title: string;
  thumbnail: string;
  type: 'local';
  depth: number;
  relativePath?: string;
  flattened?: boolean;
  url: string;
}

interface FolderContents {
  folders: FolderItem[];
  videos: VideoItem[];
  depth: number;
}

interface LocalFolderNavigatorProps {
  sourcePath: string;
  maxDepth: number;
  sourceTitle: string;
  onBackClick: () => void;
  onVideoClick: (video: VideoItem, currentFolderPath: string) => void;
  initialFolderPath?: string;
  sourceId?: string;
}

export const LocalFolderNavigator: React.FC<LocalFolderNavigatorProps> = ({
  sourcePath,
  maxDepth,
  sourceTitle,
  onBackClick,
  onVideoClick,
  initialFolderPath,
  sourceId
}) => {
  const navigate = useNavigate();
  const [contents, setContents] = useState<FolderContents | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoDurations, setVideoDurations] = useState<Record<string, number>>({});
  const [loadingDurations, setLoadingDurations] = useState<Record<string, boolean>>({});
  const [durationLoadingController, setDurationLoadingController] = useState<AbortController | null>(null);
  const processedVideosRef = useRef<Set<string>>(new Set());
  const [folderVideoCounts, setFolderVideoCounts] = useState<Record<string, number>>({});
  const [loadingFolderCounts, setLoadingFolderCounts] = useState<Record<string, boolean>>({});
  // NUCLEAR APPROACH: Always derive state from props, never use useState for navigation
  const currentFolderPath = initialFolderPath || sourcePath;
  const navigationStack = useMemo(() => {
    if (initialFolderPath) {
      const pathParts = initialFolderPath.replace(sourcePath, '').split(/[/\\]/).filter(Boolean);
      const stack = [sourcePath];
      let currentPath = sourcePath;

      for (const part of pathParts) {
        // Use simple string concatenation with platform-appropriate separator
        // Since we can't use async in useMemo, we'll detect platform and use appropriate separator
        const separator = sourcePath.includes('\\') ? '\\' : '/';
        currentPath = `${currentPath}${separator}${part}`;
        stack.push(currentPath);
      }

      return stack;
    }
    return [sourcePath];
  }, [initialFolderPath, sourcePath]);
  const [watchedVideos, setWatchedVideos] = useState<any[]>([]);
  const [timeTrackingState, setTimeTrackingState] = useState<TimeTrackingState | undefined>(undefined);

  const currentDepth = navigationStack.length;

  // Load watched videos data
  useEffect(() => {
    const loadWatchedVideos = async () => {
      try {
        const watchedData = await (window as any).electron.getWatchedVideos();
        // console.log('[LocalFolderNavigator] Loaded watched videos:', watchedData);
        setWatchedVideos(watchedData);
      } catch (error) {
        console.error('Error loading watched videos:', error);
        setWatchedVideos([]);
      }
    };
    loadWatchedVideos();
  }, []);

  // Load time tracking state
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

  // Function to check video status
  const getVideoStatus = (videoId: string) => {
    const watchedData = watchedVideos.find(w => w.videoId === videoId);
    if (!watchedData) return { isWatched: false, isClicked: false };

    const status = {
      isWatched: !!watchedData.watched, // Convert to boolean (handles both 1/0 and true/false)
      isClicked: true // If it's in watched.json, it was clicked
    };
    
    return status;
  };

  // Function to handle watched folder click
  const handleWatchedFolderClick = async () => {
    try {
      // Get the actual source ID by loading sources and finding the one that matches this path
      const sources = await (window as any).electron.loadVideosFromSources();
      const sourceData = sources.videosBySource?.find((s: any) => s.path === sourcePath);
      
      if (sourceData) {
        navigate(`/source/${sourceData.id}/watched`);
      } else {
        console.error('Could not find source for path:', sourcePath);
        // Fallback to a generated ID
        const fallbackId = sourcePath.replace(/[^a-zA-Z0-9]/g, '_');
        navigate(`/source/${fallbackId}/watched`);
      }
    } catch (error) {
      console.error('Error finding source ID:', error);
      // Fallback to a generated ID
      const fallbackId = sourcePath.replace(/[^a-zA-Z0-9]/g, '_');
      navigate(`/source/${fallbackId}/watched`);
    }
  };

  useEffect(() => {
    loadFolderContents();
  }, [currentFolderPath]);

  // Load video durations lazily after contents are loaded (cancellable)
  useEffect(() => {
    if (contents?.videos) {
      // Cancel any existing duration loading
      if (durationLoadingController) {
        durationLoadingController.abort();
      }

      // Clear processed videos ref for new contents
      processedVideosRef.current.clear();

      // Create new abort controller for this loading session
      const controller = new AbortController();
      setDurationLoadingController(controller);

      const loadDurations = async () => {
        // Process videos in batches to avoid blocking the UI
        const videosToProcess = contents.videos.filter(video => 
          video.url && !processedVideosRef.current.has(video.id)
        );

        // Process videos in small batches with delays to keep UI responsive
        const batchSize = 3;
        for (let i = 0; i < videosToProcess.length; i += batchSize) {
          // Check if loading was cancelled
          if (controller.signal.aborted) {
            logVerbose('[LocalFolderNavigator] Duration loading cancelled');
            break;
          }

          const batch = videosToProcess.slice(i, i + batchSize);
          
          // Process batch in parallel
          const batchPromises = batch.map(async (video) => {
            if (controller.signal.aborted) return;
            
            // Mark as being processed
            processedVideosRef.current.add(video.id);
            setLoadingDurations(prev => ({ ...prev, [video.id]: true }));
            
            try {
              if (window.electron && window.electron.getLocalVideoDuration) {
                const duration = await window.electron.getLocalVideoDuration(video.url);
                if (!controller.signal.aborted) {
                  setVideoDurations(prev => ({ ...prev, [video.id]: duration }));
                }
              }
            } catch (error) {
              if (!controller.signal.aborted) {
                console.error('Error loading video duration for:', video.id, error);
                setVideoDurations(prev => ({ ...prev, [video.id]: 0 }));
              }
            } finally {
              if (!controller.signal.aborted) {
                setLoadingDurations(prev => ({ ...prev, [video.id]: false }));
              }
            }
          });

          await Promise.all(batchPromises);
          
          // Small delay between batches to keep UI responsive
          if (i + batchSize < videosToProcess.length && !controller.signal.aborted) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      };

      loadDurations();
    }

    // Cleanup function to cancel loading when component unmounts or dependencies change
    return () => {
      if (durationLoadingController) {
        durationLoadingController.abort();
      }
    };
  }, [contents?.videos]); // Only depend on contents.videos

  // Load folder video counts when contents change
  useEffect(() => {
    if (contents?.folders) {
      const loadFolderCounts = async () => {
        for (const folder of contents.folders) {
          // Skip if already loading or loaded
          if (loadingFolderCounts[folder.path] || folderVideoCounts[folder.path] !== undefined) {
            continue;
          }

          setLoadingFolderCounts(prev => ({ ...prev, [folder.path]: true }));

          try {
            if (window.electron && window.electron.getFolderVideoCount) {
              const count = await window.electron.getFolderVideoCount(folder.path, maxDepth);
              setFolderVideoCounts(prev => ({ ...prev, [folder.path]: count }));
            }
          } catch (error) {
            console.error('Error loading folder video count for:', folder.path, error);
            setFolderVideoCounts(prev => ({ ...prev, [folder.path]: 0 }));
          } finally {
            setLoadingFolderCounts(prev => ({ ...prev, [folder.path]: false }));
          }
        }
      };

      loadFolderCounts();
    }
  }, [contents?.folders, maxDepth]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (durationLoadingController) {
        durationLoadingController.abort();
      }
    };
  }, [durationLoadingController]);

  const loadFolderContents = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!window.electron?.getLocalFolderContents) {
        throw new Error('getLocalFolderContents not available');
      }

      const result = await window.electron.getLocalFolderContents(currentFolderPath, maxDepth, currentDepth);
      setContents(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFolderClick = (folder: FolderItem) => {
    // Cancel any ongoing duration loading
    if (durationLoadingController) {
      durationLoadingController.abort();
    }

    // Navigate using URL instead of state updates
    if (sourceId) {
      // Use platform-appropriate separator for path replacement
      const separator = sourcePath.includes('\\') ? '\\' : '/';
      const relativePath = folder.path.replace(`${sourcePath}${separator}`, '');
      navigate(`/source/${sourceId}?folder=${encodeURIComponent(relativePath)}`);
    }
  };

  const handleBackClick = () => {
    // Cancel any ongoing duration loading
    if (durationLoadingController) {
      durationLoadingController.abort();
    }

    // Navigate using URL instead of state updates
    if (navigationStack.length > 1) {
      const parentPath = navigationStack[navigationStack.length - 2];
      if (parentPath === sourcePath) {
        // Going back to source root
        navigate(`/source/${sourceId}`);
      } else {
        // Going back to parent folder
        const separator = sourcePath.includes('\\') ? '\\' : '/';
        const relativePath = parentPath.replace(`${sourcePath}${separator}`, '');
        navigate(`/source/${sourceId}?folder=${encodeURIComponent(relativePath)}`);
      }
    } else {
      onBackClick();
    }
  };

  const getCurrentFolderName = () => {
    if (currentFolderPath === sourcePath) {
      return sourceTitle;
    }
    return currentFolderPath.split(/[/\\]/).pop() || 'Unknown';
  };

  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', path: '/' }
    ];

    // Determine if we're at the source root or in a subfolder
    const isAtSourceRoot = currentFolderPath === sourcePath;
    const currentStackIndex = navigationStack.length - 1; // Index of current location

    // Add source item - clickable if we're in a subfolder, active if we're at source root
    if (sourceId) {
      if (isAtSourceRoot) {
        items.push({ label: sourceTitle, isActive: true });
      } else {
        items.push({ label: sourceTitle, path: `/source/${sourceId}` });
      }
    } else {
      items.push({ label: sourceTitle, isActive: isAtSourceRoot });
    }

    // Add folder path items (skip the source path at index 0)
    navigationStack.slice(1).forEach((path, index) => {
      const folderName = path.split(/[/\\]/).pop() || 'Unknown';
      const actualIndex = index + 1; // Adjust for slice(1)
      const isCurrentLocation = actualIndex === currentStackIndex;

      if (sourceId && !isCurrentLocation) {
        // Make intermediate folders clickable
        const separator = sourcePath.includes('\\') ? '\\' : '/';
        const relativePath = path.replace(`${sourcePath}${separator}`, '');
        items.push({
          label: folderName,
          path: `/source/${sourceId}?folder=${encodeURIComponent(relativePath)}`
        });
      } else {
        // Current location should be active (bold, non-clickable)
        items.push({ label: folderName, isActive: isCurrentLocation });
      }
    });

    return items;
  };

  const getBreadcrumbPath = () => {
    return navigationStack.map((path, index) => {
      if (index === 0) return sourceTitle;
      return path.split('/').pop() || 'Unknown';
    }).join(' > ');
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading folder contents...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-600 mb-4">Error: {error}</div>
        <button
          onClick={handleBackClick}
          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors"
        >
          ← Go Back
        </button>
      </div>
    );
  }

  if (!contents) {
    return (
      <div className="p-4">
        <div className="text-gray-600">No contents found.</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <BreadcrumbNavigation items={getBreadcrumbItems()} />
        <div className="flex items-center space-x-3">
          <button
            onClick={handleWatchedFolderClick}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors"
          >
            Watched Videos
          </button>
          <TimeIndicator initialState={timeTrackingState} />
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-6">{getCurrentFolderName()}</h1>

      {/* Folders Section */}
      {contents.folders.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">📁 Folders</h2>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {contents.folders.map((folder) => {
              const isLoading = loadingFolderCounts[folder.path];
              const videoCount = folderVideoCounts[folder.path];

              return (
                <div key={folder.path} className="w-full flex justify-center">
                  <div
                    onClick={() => handleFolderClick(folder)}
                    className="bg-white rounded-xl border shadow-md flex flex-col w-full cursor-pointer max-w-[280px] sm:max-w-[320px] lg:max-w-[380px] xl:max-w-[420px] 2xl:max-w-[500px] transition-transform hover:scale-[1.03]"
                  >
                    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-xl">
                      <div className="h-full w-full bg-blue-100 flex items-center justify-center">
                        <div className="text-6xl text-blue-500">📁</div>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-between p-3">
                      <h3 className="text-base font-semibold text-foreground truncate">{folder.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {isLoading
                          ? 'Loading...'
                          : videoCount !== undefined
                            ? `${videoCount} video${videoCount !== 1 ? 's' : ''}`
                            : 'Click to open'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Videos Section */}
      {contents.videos.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-gray-700">🎬 Videos</h2>
          <VideoGrid
            videos={contents.videos.map((video) => {
              const { isWatched, isClicked } = getVideoStatus(video.id);

              return {
                id: video.id,
                thumbnail: video.thumbnail || '',
                title: video.title,
                duration: videoDurations[video.id] || 0,
                type: video.type,
                watched: isWatched,
                isClicked: isClicked,
                source: sourceId || 'local',
                isFavorite: false, // Will be updated by VideoGrid's favorite sync
                onVideoClick: () => {
                  // Cancel any ongoing duration loading when video is clicked
                  if (durationLoadingController) {
                    durationLoadingController.abort();
                  }

                  // Pass breadcrumb data with video click
                  const enhancedOnVideoClick = (video: VideoItem, folderPath: string) => {
                    // Create enhanced video with breadcrumb data
                    const breadcrumbData = {
                      sourceName: sourceTitle,
                      sourceId: sourceId,
                      basePath: sourcePath,
                      folderPath: navigationStack.slice(1).map(path => ({
                        name: path.split('/').pop() || 'Unknown',
                        path: path
                      }))
                    };

                    // Extend the video object to include navigation context
                    const videoWithContext = {
                      ...video,
                      navigationContext: {
                        breadcrumb: breadcrumbData,
                        returnTo: sourceId ? `/source/${sourceId}?folder=${encodeURIComponent(folderPath.replace(sourcePath + '/', ''))}` : undefined
                      }
                    };

                    onVideoClick(videoWithContext, folderPath);
                  };

                  enhancedOnVideoClick(video, currentFolderPath);
                }
              };
            })}
            groupByType={false}
            // Enable favorite icons for local videos
            showFavoriteIcons={true}
          />
        </div>
      )}

      {/* Empty State */}
      {contents.folders.length === 0 && contents.videos.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📂</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Empty Folder</h3>
          <p className="text-gray-500">This folder contains no videos or subfolders.</p>
        </div>
      )}
    </div>
  );
};
