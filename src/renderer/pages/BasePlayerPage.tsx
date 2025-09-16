import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Video } from '../types';
import { TimeIndicator } from '../components/layout/TimeIndicator';
import { CountdownOverlay } from '../components/video/CountdownOverlay';
import { BreadcrumbNavigation, BreadcrumbItem } from '../components/layout/BreadcrumbNavigation';
import { audioWarningService } from '../services/audioWarning';
import { logVerbose } from '../lib/logging';

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

    logVerbose('[BasePlayerPage] getBreadcrumbItems - video navigation context:', videoNavigationContext);
    logVerbose('[BasePlayerPage] getBreadcrumbItems - location state:', locationState);
    logVerbose('[BasePlayerPage] getBreadcrumbItems - breadcrumb data:', breadcrumbData);

    const items: BreadcrumbItem[] = [
      { label: 'Home', path: '/' }
    ];

    if (breadcrumbData?.sourceName) {
      if (breadcrumbData.sourceId) {
        items.push({
          label: breadcrumbData.sourceName,
          path: `/source/${breadcrumbData.sourceId}`
        });
      } else if (breadcrumbData.historyPath) {
        // Special handling for History page
        items.push({
          label: breadcrumbData.sourceName,
          path: breadcrumbData.historyPath
        });
      } else {
        items.push({ label: breadcrumbData.sourceName });
      }
    }

    if (breadcrumbData?.folderPath && breadcrumbData.folderPath.length > 0) {
      logVerbose('[BasePlayerPage] Processing folderPath:', breadcrumbData.folderPath);
      breadcrumbData.folderPath.forEach((folder: { name: string; path?: string }, index: number) => {
        logVerbose('[BasePlayerPage] Processing folder:', folder);
        if (folder.path && breadcrumbData.sourceId && breadcrumbData.basePath) {
          // Create relative path by removing base path
          let relativePath = folder.path;
          logVerbose('[BasePlayerPage] Original relativePath:', relativePath);
          if (relativePath.startsWith(breadcrumbData.basePath)) {
            relativePath = relativePath.substring(breadcrumbData.basePath.length);
            // Remove leading slash if present
            if (relativePath.startsWith('/')) {
              relativePath = relativePath.substring(1);
            }
          }
          logVerbose('[BasePlayerPage] Final relativePath:', relativePath);

          const generatedPath = `/source/${breadcrumbData.sourceId}?folder=${encodeURIComponent(relativePath)}`;
          logVerbose('[BasePlayerPage] Generated breadcrumb path:', generatedPath);

          items.push({
            label: folder.name,
            path: generatedPath
          });
        } else {
          logVerbose('[BasePlayerPage] Adding non-clickable folder:', folder.name);
          items.push({ label: folder.name });
        }
      });
    } else {
      logVerbose('[BasePlayerPage] No folderPath found or empty folderPath');
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

    logVerbose('[BasePlayerPage] Generated breadcrumb items:', items);

    // Also log the returnTo logic for comparison
    const returnTo = videoNavigationContext?.returnTo || locationState?.returnTo;
    logVerbose('[BasePlayerPage] returnTo value (what old Back button used):', returnTo);

    return items;
  };

  const handleBackClick = () => {
    // First check if the video has preserved navigation context (for downloaded videos)
    const videoNavigationContext = (video as any)?.navigationContext;
    const locationState = location.state as any;

    logVerbose('[BasePlayerPage] handleBackClick - videoNavigationContext:', videoNavigationContext);
    logVerbose('[BasePlayerPage] handleBackClick - locationState:', locationState);

    // Use navigation context from video if available (for downloaded videos),
    // otherwise use location state (for regular videos)
    const returnTo = videoNavigationContext?.returnTo || locationState?.returnTo;

    if (returnTo) {
      logVerbose('[BasePlayerPage] Navigating back to preserved returnTo:', returnTo);
      navigate(returnTo);
    } else {
      logVerbose('[BasePlayerPage] No returnTo found, using browser back');
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
    return (
      <div className="flex flex-col min-h-screen bg-gray-100">
        <div className="p-4">
          <BreadcrumbNavigation items={getBreadcrumbItems()} className="mb-4" />
          <div className="text-red-500">{error || 'Video not found'}</div>
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
