import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
}

export const LocalFolderNavigator: React.FC<LocalFolderNavigatorProps> = ({
  sourcePath,
  maxDepth,
  sourceTitle,
  onBackClick,
  onVideoClick,
  initialFolderPath
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
  const [navigationStack, setNavigationStack] = useState<string[]>(() => {
    if (initialFolderPath) {
      // Build navigation stack from source path to initial folder path
      const pathParts = initialFolderPath.replace(sourcePath, '').split('/').filter(Boolean);
      const stack = [sourcePath];
      let currentPath = sourcePath;
      
      for (const part of pathParts) {
        currentPath = `${currentPath}/${part}`;
        stack.push(currentPath);
      }
      
      return stack;
    }
    return [sourcePath];
  });
  
  const [currentFolderPath, setCurrentFolderPath] = useState(initialFolderPath || sourcePath);
  const [watchedVideos, setWatchedVideos] = useState<any[]>([]);

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

  // Function to check video status
  const getVideoStatus = (videoId: string) => {
    const watchedData = watchedVideos.find(w => w.videoId === videoId);
    if (!watchedData) return { isWatched: false, isClicked: false };
    
    const status = {
      isWatched: watchedData.watched === true,
      isClicked: true // If it's in watched.json, it was clicked
    };
    
    // Debug logging
    if (watchedData) {
      logVerbose(`[LocalFolderNavigator] Video ${videoId}:`, {
        watched: watchedData.watched,
        position: watchedData.position,
        isWatched: status.isWatched,
        isClicked: status.isClicked
      });
    }
    
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
    
    setNavigationStack(prev => [...prev, folder.path]);
    setCurrentFolderPath(folder.path);
    setContents(null); // Clear contents to show loading state
  };

  const handleBackClick = () => {
    // Cancel any ongoing duration loading
    if (durationLoadingController) {
      durationLoadingController.abort();
    }
    
    if (navigationStack.length > 1) {
      const newStack = navigationStack.slice(0, -1);
      setNavigationStack(newStack);
      setCurrentFolderPath(newStack[newStack.length - 1]);
      setContents(null); // Clear contents to show loading state
    } else {
      onBackClick();
    }
  };

  const getCurrentFolderName = () => {
    if (currentFolderPath === sourcePath) {
      return sourceTitle;
    }
    return currentFolderPath.split('/').pop() || 'Unknown';
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
      {/* Navigation Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBackClick}
            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors flex items-center space-x-2"
          >
            <span>←</span>
            <span>Back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold">{getCurrentFolderName()}</h1>
            <p className="text-sm text-gray-500">{getBreadcrumbPath()}</p>
          </div>
        </div>
      </div>

      {/* Watched Videos Folder */}
      <div className="mb-6">
        <div
          onClick={handleWatchedFolderClick}
          className="bg-white rounded-lg shadow-md p-4 cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:scale-105 border-2 border-blue-100 hover:border-blue-300 inline-block"
        >
          <div className="flex items-center space-x-3">
            <div className="text-4xl">✅</div>
            <div>
              <h3 className="font-semibold text-gray-900">Watched Videos</h3>
              <p className="text-sm text-gray-500">View videos you've fully watched from this source</p>
            </div>
          </div>
        </div>
      </div>

      {/* Folders Section */}
      {contents.folders.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">📁 Folders</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contents.folders.map((folder) => {
              const isLoading = loadingFolderCounts[folder.path];
              const videoCount = folderVideoCounts[folder.path];
              
              return (
                <div
                  key={folder.path}
                  onClick={() => handleFolderClick(folder)}
                  className="bg-white rounded-lg shadow-md p-4 cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:scale-105 border-2 border-blue-100 hover:border-blue-300"
                >
                  <div className="text-4xl mb-2">📁</div>
                  <h3 className="font-semibold text-gray-900">{folder.name}</h3>
                  <p className="text-sm text-gray-500">
                    {isLoading 
                      ? 'Loading...' 
                      : videoCount !== undefined 
                        ? `${videoCount} video${videoCount !== 1 ? 's' : ''}`
                        : 'Click to open'
                    }
                  </p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contents.videos.map((video) => {
              const { isWatched, isClicked } = getVideoStatus(video.id);
              
              // Determine CSS classes - watched takes priority over clicked
              const cssClasses = [
                'bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:scale-105',
                isWatched ? 'watched' : isClicked ? 'clicked' : ''
              ].filter(Boolean).join(' ');
              
              return (
                <div
                  key={video.id}
                  onClick={() => {
                    // Cancel any ongoing duration loading when video is clicked
                    if (durationLoadingController) {
                      durationLoadingController.abort();
                    }
                    onVideoClick(video, currentFolderPath);
                  }}
                  className={cssClasses}
                >
                <div className="aspect-video bg-gray-200 flex items-center justify-center">
                  <div className="text-4xl">🎬</div>
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-gray-900 mb-1">{video.title}</h3>
                  <p className="text-xs text-gray-400">
                    {loadingDurations[video.id] 
                      ? 'Loading duration...' 
                      : videoDurations[video.id] 
                        ? `${Math.floor(videoDurations[video.id] / 60)}:${(videoDurations[video.id] % 60).toString().padStart(2, '0')}`
                        : 'Duration unknown'
                    }
                  </p>
                  {video.relativePath && (
                    <p className="text-xs text-gray-400 mt-1 truncate">{video.relativePath}</p>
                  )}
                </div>
              </div>
              );
            })}
          </div>
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
