import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Video } from '../types';
import { TimeIndicator } from '../components/layout/TimeIndicator';
import { CountdownOverlay } from '../components/video/CountdownOverlay';
import { BreadcrumbNavigation, BreadcrumbItem } from '../components/layout/BreadcrumbNavigation';
import { VideoPlayerError } from '../components/video/VideoPlayerError';
import { audioWarningService } from '../services/audioWarning';
import { logVerbose } from '../lib/logging';
import { NavigationCache } from '../services/navigationCache';

export interface BasePlayerPageProps {
  video: Video | null;
  isLoading: boolean;
  error: string | null;
  isVideoPlaying: boolean;
  timeRemainingSeconds: number;
  countdownWarningSeconds: number;


  children: React.ReactNode;

}

export const BasePlayerPage: React.FC<BasePlayerPageProps> = ({
  video,
  isLoading,
  error,
  isVideoPlaying,
  timeRemainingSeconds,
  countdownWarningSeconds,
  children,

}) => {
  const navigate = useNavigate();
  const location = useLocation();







  // Fetch countdown configuration and initialize audio warning service
  useEffect(() => {
    const fetchCountdownConfig = async () => {
      try {
        const timeLimits = await window.electron.getTimeLimits();
        const countdownSeconds = timeLimits.countdownWarningSeconds ?? 60;
        const audioWarningSeconds = timeLimits.audioWarningSeconds ?? 10;
        const useSystemBeep = timeLimits.useSystemBeep ?? true;
        const customBeepSound = timeLimits.customBeepSound;
        
        // logVerbose('[BasePlayerPage] Initializing audio warning service with:', {
        //   countdownSeconds,
        //   audioWarningSeconds,
        //   useSystemBeep,
        //   customBeepSound
        // });
        
        // Initialize audio warning service
        await audioWarningService.initialize({
          countdownWarningSeconds: countdownSeconds,
          audioWarningSeconds: audioWarningSeconds,
          useSystemBeep: useSystemBeep,
          customBeepSound: customBeepSound,
        });
      } catch (error) {
        console.error('Error fetching countdown configuration:', error);
      }
    };

    fetchCountdownConfig();
  }, []);

  // Cleanup audio warning service on unmount
  useEffect(() => {
    return () => {
      audioWarningService.destroy();
    };
  }, []);

  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const videoNavigationContext = (video as any)?.navigationContext;
    const locationState = location.state as any;
    const breadcrumbData = videoNavigationContext?.breadcrumb || locationState?.breadcrumb;


    const items: BreadcrumbItem[] = [
      { label: 'Home', path: '/' }
    ];

    if (breadcrumbData?.sourceName) {
      if (breadcrumbData.sourceId) {
        // Use the last visited page for this source, or page 1 as fallback
        const lastPage = NavigationCache.getLastVisitedPage(breadcrumbData.sourceId);
        const sourcePath = lastPage > 1
          ? `/source/${breadcrumbData.sourceId}/page/${lastPage}`
          : `/source/${breadcrumbData.sourceId}`;

        items.push({
          label: breadcrumbData.sourceName,
          path: sourcePath
        });
      } else if (breadcrumbData.historyPath) {
        // Special handling for History page and Wishlist page
        items.push({
          label: breadcrumbData.sourceName,
          path: breadcrumbData.historyPath
        });
      } else {
        items.push({ label: breadcrumbData.sourceName });
      }
    }

    if (breadcrumbData?.folderPath && breadcrumbData.folderPath.length > 0) {
      breadcrumbData.folderPath.forEach((folder: { name: string; path?: string }, index: number) => {
        if (folder.path && breadcrumbData.sourceId && breadcrumbData.basePath) {
          // Create relative path by removing base path
          let relativePath = folder.path;
          if (relativePath.startsWith(breadcrumbData.basePath)) {
            relativePath = relativePath.substring(breadcrumbData.basePath.length);
            // Remove leading slash or backslash if present
            if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
              relativePath = relativePath.substring(1);
            }
          }

          const generatedPath = `/source/${breadcrumbData.sourceId}?folder=${encodeURIComponent(relativePath)}`;

          items.push({
            label: folder.name,
            path: generatedPath
          });
        } else {
          items.push({ label: folder.name });
        }
      });
    }

    // Add "Watched Videos" breadcrumb if this is from WatchedVideos page
    if (breadcrumbData?.isWatchedVideos && breadcrumbData?.sourceId) {
      items.push({
        label: 'Watched Videos',
        path: `/source/${breadcrumbData.sourceId}/watched`
      });
    }

    if (video?.title) {
      items.push({ label: video.title, isActive: true });
    }

    const returnTo = videoNavigationContext?.returnTo || locationState?.returnTo;

    return items;
  };

  const handleBackClick = () => {
    // First check if the video has preserved navigation context (for downloaded videos)
    const videoNavigationContext = (video as any)?.navigationContext;
    const locationState = location.state as any;


    // Use navigation context from video if available (for downloaded videos),
    // otherwise use location state (for regular videos)
    const returnTo = videoNavigationContext?.returnTo || locationState?.returnTo;

    if (returnTo) {
      navigate(returnTo);
    } else {
      navigate(-1);
    }
  };













  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-100">
        <div className="p-4">
          <BreadcrumbNavigation items={getBreadcrumbItems()} className="mb-4" />
          <div className="text-center">
            <div className="text-lg mb-2">Loading video...</div>
            <div className="text-sm text-gray-500">This may take a few moments</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !video) {
    // Show friendly error page if there's an error, with breadcrumbs visible
    if (error) {
      return (
        <div className="flex flex-col min-h-screen bg-gray-100">
          <div className="p-4">
            <BreadcrumbNavigation items={getBreadcrumbItems()} className="mb-6" />
            <h1 className="text-2xl font-bold mb-4">{video?.title || 'Video Player'}</h1>
            <VideoPlayerError
              errorMessage={error}
              videoUrl={video?.url || video?.id}
              onRetry={() => window.location.reload()}
              videoTitle={video?.title}
            />
          </div>
        </div>
      );
    }

    // Fallback for missing video
    return (
      <div className="flex flex-col min-h-screen bg-gray-100">
        <div className="p-4">
          <BreadcrumbNavigation items={getBreadcrumbItems()} className="mb-4" />
          <div className="text-red-500">Video not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <BreadcrumbNavigation items={getBreadcrumbItems()} />
          <TimeIndicator realTime={true} updateInterval={3000} />
        </div>
        <h1 className="text-2xl font-bold mb-4">{video.title}</h1>
        {isLoading && (
          <div className="text-center mb-4">
            <div className="text-lg mb-2">Loading video...</div>
            <div className="text-sm text-gray-500">This may take a few moments</div>
          </div>
        )}
        {error && (
          <div className="text-center text-red-500 mb-4">
            <div className="text-lg mb-2">Error: {error}</div>
            <div className="text-sm">The video may be unavailable or the stream may have expired</div>
          </div>
        )}
      </div>
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-4xl relative">
          {children}
          <CountdownOverlay
            isVisible={!isLoading && !error}
            timeRemainingSeconds={timeRemainingSeconds}
            isVideoPlaying={isVideoPlaying}
            shouldShowCountdown={timeRemainingSeconds <= countdownWarningSeconds && timeRemainingSeconds > 0}
          />
        </div>
      </div>
    </div>
  );
};
