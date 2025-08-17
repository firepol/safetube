import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Video } from '../types';
import { TimeIndicator } from '../components/layout/TimeIndicator';
import { CountdownOverlay } from '../components/video/CountdownOverlay';
import { audioWarningService } from '../services/audioWarning';

export interface BasePlayerPageProps {
  video: Video | null;
  isLoading: boolean;
  error: string | null;
  isVideoPlaying: boolean;
  timeRemainingSeconds: number;
  countdownWarningSeconds: number;
  onVideoPlay: () => void;
  onVideoPause: () => void;
  onVideoEnded: () => void;
  onVideoTimeUpdate: () => void;
  onVideoSeeking: () => void;
  onVideoSeeked: () => void;
  onVideoError: (error: string) => void;
  onVideoLoaded: () => void;
  children: React.ReactNode;
  /** Function to get current video time for time tracking (optional) */
  getCurrentVideoTime?: () => number;
}

export const BasePlayerPage: React.FC<BasePlayerPageProps> = ({
  video,
  isLoading,
  error,
  isVideoPlaying,
  timeRemainingSeconds,
  countdownWarningSeconds,
  onVideoPlay,
  onVideoPause,
  onVideoEnded,
  onVideoTimeUpdate,
  onVideoSeeking,
  onVideoSeeked,
  onVideoError,
  onVideoLoaded,
  children,
  getCurrentVideoTime
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const timeTrackingRef = useRef<{
    startTime: number;
    totalWatched: number;
    isTracking: boolean;
    lastUpdateTime: number;
  }>({
    startTime: 0,
    totalWatched: 0,
    isTracking: false,
    lastUpdateTime: 0
  });

  // Time tracking functions
  const startTimeTracking = useCallback(() => {
    // Only handle time tracking if getCurrentVideoTime is provided
    if (!getCurrentVideoTime) return;
    
    if (!timeTrackingRef.current.isTracking) {
      timeTrackingRef.current = {
        startTime: Date.now(),
        totalWatched: 0,
        isTracking: true,
        lastUpdateTime: Date.now()
      };
    }
  }, [getCurrentVideoTime]);

  const updateTimeTracking = useCallback(async () => {
    // Only handle time tracking if getCurrentVideoTime is provided
    // Otherwise, let the child component handle it
    if (!getCurrentVideoTime) return;
    
    if (timeTrackingRef.current.isTracking && video) {
      const currentTime = Date.now();
      const timeWatched = (currentTime - timeTrackingRef.current.lastUpdateTime) / 1000;
      
      if (timeWatched >= 1) {
        timeTrackingRef.current.totalWatched += timeWatched;
        timeTrackingRef.current.lastUpdateTime = currentTime;

        // Record the time watched
        if (video) {
          const videoCurrentTime = getCurrentVideoTime();
          await window.electron.recordVideoWatching(
            video.id,
            videoCurrentTime,
            timeWatched
          );
        }
      }
    }
  }, [video, getCurrentVideoTime]);

  const stopTimeTracking = useCallback(async () => {
    // Only handle time tracking if getCurrentVideoTime is provided
    if (!getCurrentVideoTime) return;
    
    if (timeTrackingRef.current.isTracking) {
      await updateTimeTracking();
      timeTrackingRef.current.isTracking = false;
    }
  }, [updateTimeTracking, getCurrentVideoTime]);

  // Check time limits on mount and when video changes
  useEffect(() => {
    let isMounted = true;
    
    const checkTimeLimits = async () => {
      if (!video || !isMounted) return;
      
      try {
        const state = await window.electron.getTimeTrackingState();
        if (isMounted && state.isLimitReached) {
          // If limit is reached, don't allow playback
          onVideoPause();
        }
      } catch (error) {
        console.error('Error checking time limits:', error);
      }
    };

    checkTimeLimits();
    
    return () => {
      isMounted = false;
    };
  }, [video?.id, onVideoPause]);

  // Continuous time limit monitoring during video playback
  useEffect(() => {
    if (!video) return;
    
    let isMounted = true;
    let intervalId: number | undefined;
    
    const monitorTimeLimits = async () => {
      try {
        const state = await window.electron.getTimeTrackingState();
        if (!isMounted) return;
        
        // Check for audio warnings
        const roundedTimeRemaining = Math.round(state.timeRemaining * 10) / 10;
        
        // Use video element's actual state as fallback if isVideoPlaying state is incorrect
        const actualVideoPlaying = isVideoPlaying;
        
        audioWarningService.checkAudioWarnings(roundedTimeRemaining, actualVideoPlaying);
        
        if (state.isLimitReached) {
          // Stop video playback
          onVideoPause();
          
          // Exit fullscreen if in fullscreen mode
          if (document.fullscreenElement) {
            try {
              await document.exitFullscreen();
            } catch (error) {
              console.error('Error exiting fullscreen:', error);
            }
          }
          
          // Navigate to Time's Up page
          navigate('/time-up');
        }
      } catch (error) {
        console.error('Error monitoring time limits:', error);
      }
    };
    
    // Check time limits every 1 second during video playback for more precise audio warning timing
    intervalId = window.setInterval(monitorTimeLimits, 1000);
    
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [video, navigate, isVideoPlaying, onVideoPause]);

  // Fetch countdown configuration and initialize audio warning service
  useEffect(() => {
    const fetchCountdownConfig = async () => {
      try {
        const timeLimits = await window.electron.getTimeLimits();
        const countdownSeconds = timeLimits.countdownWarningSeconds ?? 60;
        const audioWarningSeconds = timeLimits.audioWarningSeconds ?? 10;
        const useSystemBeep = timeLimits.useSystemBeep ?? true;
        const customBeepSound = timeLimits.customBeepSound;
        
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

  const handleBackClick = () => {
    const returnTo = (location.state as any)?.returnTo;
    if (returnTo) {
      navigate(returnTo);
    } else {
      navigate(-1);
    }
  };

  // Enhanced event handlers that include time tracking
  const handleVideoPlay = useCallback(() => {
    startTimeTracking();
    onVideoPlay();
  }, [startTimeTracking, onVideoPlay]);

  const handleVideoPause = useCallback(() => {
    stopTimeTracking();
    onVideoPause();
  }, [stopTimeTracking, onVideoPause]);

  const handleVideoEnded = useCallback(() => {
    stopTimeTracking();
    onVideoEnded();
  }, [stopTimeTracking, onVideoEnded]);

  const handleVideoTimeUpdate = useCallback(() => {
    // Throttle time update events to prevent excessive calls
    if (!timeTrackingRef.current.lastUpdateTime || 
        Date.now() - timeTrackingRef.current.lastUpdateTime > 1000) {
      updateTimeTracking();
    }
    onVideoTimeUpdate();
  }, [updateTimeTracking, onVideoTimeUpdate]);

  const handleVideoSeeking = useCallback(() => {
    updateTimeTracking();
    onVideoSeeking();
  }, [updateTimeTracking, onVideoSeeking]);

  const handleVideoSeeked = useCallback(() => {
    updateTimeTracking();
    onVideoSeeked();
  }, [updateTimeTracking, onVideoSeeked]);

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-100">
        <div className="p-4">
          <button
            onClick={handleBackClick}
            className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            ← Back
          </button>
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
          <button
            onClick={handleBackClick}
            className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            ← Back
          </button>
          <div className="text-red-500">{error || 'Video not found'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBackClick}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            ← Back
          </button>
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
