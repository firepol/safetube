import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { YouTubeIframePlayer } from '../services/youtubeIframe';
import { BasePlayerPage } from './BasePlayerPage';
import { Video } from '../types';

const PLAYER_CONTAINER_ID = 'youtube-player-container';

export const YouTubePlayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubeIframePlayer | null>(null);
  const ytPlayerInstance = useRef<any>(null);
  
  // State for the base component
  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(0);
  const [countdownWarningSeconds, setCountdownWarningSeconds] = useState<number>(60);

  // Load video data when component mounts
  useEffect(() => {
    const loadVideoData = async () => {
      if (!id) return;
      
      try {
        setIsLoading(true);
        const videoData = await window.electron.getVideoData(id);
        setVideo(videoData);
        setError(null);
      } catch (err) {
        console.error('[YouTubePlayerPage] Error loading video data:', err);
        setError('Video not found');
      } finally {
        setIsLoading(false);
      }
    };

    loadVideoData();
  }, [id]);

  // Check time limits on mount and when video changes
  useEffect(() => {
    let isMounted = true;
    
    const checkTimeLimits = async () => {
      if (!video || !isMounted) return;
      
      try {
        const state = await window.electron.getTimeTrackingState();
        if (isMounted) {
          setTimeRemainingSeconds(state.timeRemaining);
          
          // If limit is reached, don't allow playback
          if (state.isLimitReached) {
            if (ytPlayerInstance.current && ytPlayerInstance.current.pauseVideo) {
              ytPlayerInstance.current.pauseVideo();
            }
          }
        }
      } catch (error) {
        console.error('Error checking time limits:', error);
      }
    };

    checkTimeLimits();
    
    return () => {
      isMounted = false;
    };
  }, [video?.id]);

  // Continuous time limit monitoring during video playback
  useEffect(() => {
    if (!video) return;
    
    let isMounted = true;
    let intervalId: number | undefined;
    
    const monitorTimeLimits = async () => {
      try {
        const state = await window.electron.getTimeTrackingState();
        if (!isMounted) return;
        
        // Update time remaining for countdown overlay
        setTimeRemainingSeconds(state.timeRemaining);
        
        if (state.isLimitReached) {
          // Stop video playback
          if (ytPlayerInstance.current && ytPlayerInstance.current.pauseVideo) {
            ytPlayerInstance.current.pauseVideo();
          }
          
          // Exit fullscreen if in fullscreen mode
          if (document.fullscreenElement) {
            try {
              await document.exitFullscreen();
            } catch (error) {
              console.error('Error exiting fullscreen:', error);
            }
          }
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
  }, [video]);

  // Fetch countdown configuration
  useEffect(() => {
    const fetchCountdownConfig = async () => {
      try {
        const timeLimits = await window.electron.getTimeLimits();
        const countdownSeconds = timeLimits.countdownWarningSeconds ?? 60;
        setCountdownWarningSeconds(countdownSeconds);
      } catch (error) {
        console.error('Error fetching countdown configuration:', error);
        // Keep default values
      }
    };

    fetchCountdownConfig();
  }, []);

  // Initialize YouTube player
  useEffect(() => {
    let cleanup = () => {};
    if (containerRef.current && id && !isLoading) {
      playerRef.current = new YouTubeIframePlayer(PLAYER_CONTAINER_ID);
      playerRef.current.mount(id, {
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          modestbranding: 1,
          rel: 0,
          controls: 1,
          showinfo: 1,
          fs: 1,
        },
        events: {
          onReady: (event: any) => {
            ytPlayerInstance.current = event.target;
            setIsLoading(false);
          },
          onStateChange: (event: any) => {
            // 1 = playing, 2 = paused, 0 = ended
            if (event.data === 1) {
              // Playing
              setIsVideoPlaying(true);
            } else if (event.data === 2 || event.data === 0) {
              // Paused or ended
              setIsVideoPlaying(false);
            }
          },
          onError: (event: any) => {
            console.error('YouTube player error:', event);
            setError('Failed to load YouTube video');
            setIsLoading(false);
          },
        },
      });
      cleanup = () => {
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }
      };
    }
    return cleanup;
      }, [id, isLoading]);

  // Time tracking state
  const timeTrackingRef = useRef<{
    startTime: number;
    totalWatched: number;
    isTracking: boolean;
    lastUpdateTime: number;
    lastVideoTime: number;
  }>({
    startTime: 0,
    totalWatched: 0,
    isTracking: false,
    lastUpdateTime: Date.now(),
    lastVideoTime: 0
  });

  // Time tracking functions
  const startTimeTracking = useCallback(() => {
    if (!timeTrackingRef.current.isTracking) {
      timeTrackingRef.current = {
        startTime: Date.now(),
        totalWatched: 0,
        isTracking: true,
        lastUpdateTime: Date.now(),
        lastVideoTime: ytPlayerInstance.current?.getCurrentTime?.() || 0
      };
    }
  }, []);

  const updateTimeTracking = useCallback(async () => {
    if (timeTrackingRef.current.isTracking && video && ytPlayerInstance.current) {
      const currentTime = Date.now();
      const timeWatched = (currentTime - timeTrackingRef.current.lastUpdateTime) / 1000;
      
      if (timeWatched >= 1) {
        timeTrackingRef.current.totalWatched += timeWatched;
        timeTrackingRef.current.lastUpdateTime = currentTime;

        // Record the time watched
        const videoCurrentTime = ytPlayerInstance.current.getCurrentTime();
        await window.electron.recordVideoWatching(
          video.id,
          videoCurrentTime,
          timeWatched
        );
        
        timeTrackingRef.current.lastVideoTime = videoCurrentTime;
      }
    }
  }, [video]);

  const stopTimeTracking = useCallback(async () => {
    if (timeTrackingRef.current.isTracking) {
      await updateTimeTracking();
      timeTrackingRef.current.isTracking = false;
    }
  }, [updateTimeTracking]);

  // Polling-based time tracking for YouTube iframe player
  useEffect(() => {
    if (!isVideoPlaying || !video) return;

    const intervalId = setInterval(() => {
      updateTimeTracking();
    }, 1000); // Update every second

    return () => {
      clearInterval(intervalId);
    };
  }, [isVideoPlaying, video, updateTimeTracking]);

  // Event handlers for the base component
  const handleVideoPlay = useCallback(() => {
    setIsVideoPlaying(true);
    startTimeTracking();
  }, [startTimeTracking]);

  const handleVideoPause = useCallback(() => {
    setIsVideoPlaying(false);
    stopTimeTracking();
  }, [stopTimeTracking]);

  const handleVideoEnded = useCallback(() => {
    setIsVideoPlaying(false);
    stopTimeTracking();
  }, [stopTimeTracking]);

  const handleVideoTimeUpdate = useCallback(() => {
    // This is handled by the polling interval for YouTube iframe
  }, []);

  const handleVideoSeeking = useCallback(() => {
    // Update time tracking when seeking
    updateTimeTracking();
  }, [updateTimeTracking]);

  const handleVideoSeeked = useCallback(() => {
    // Update time tracking after seeking
    updateTimeTracking();
  }, [updateTimeTracking]);

  const handleVideoError = useCallback((error: string) => {
    setError(error);
    setIsLoading(false);
  }, []);

  const handleVideoLoaded = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <BasePlayerPage
      video={video}
      isLoading={isLoading}
      error={error}
      isVideoPlaying={isVideoPlaying}
      timeRemainingSeconds={timeRemainingSeconds}
      countdownWarningSeconds={countdownWarningSeconds}
      onVideoPlay={handleVideoPlay}
      onVideoPause={handleVideoPause}
      onVideoEnded={handleVideoEnded}
      onVideoTimeUpdate={handleVideoTimeUpdate}
      onVideoSeeking={handleVideoSeeking}
      onVideoSeeked={handleVideoSeeked}
      onVideoError={handleVideoError}
      onVideoLoaded={handleVideoLoaded}

    >
      <div ref={containerRef} id={PLAYER_CONTAINER_ID} className="w-full aspect-video bg-black">
        {/* YouTube player will be mounted here */}
      </div>
    </BasePlayerPage>
  );
}; 