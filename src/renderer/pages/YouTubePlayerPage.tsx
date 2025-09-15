import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { YouTubeIframePlayer } from '../services/youtubeIframe';
import { BasePlayerPage } from './BasePlayerPage';
import { Video } from '../types';
import { logVerbose } from '../lib/logging';
import { audioWarningService } from '../services/audioWarning';
import { useDownload } from '../hooks/useDownload';
import { DownloadUI } from '../components/video/DownloadUI';


const PLAYER_CONTAINER_ID = 'youtube-player-container';

export const YouTubePlayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  // URL decode the video ID since it was encoded when creating navigation links
  const videoId = id ? decodeURIComponent(id) : id;
  const navigate = useNavigate();
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

  // Download state management using shared hook
  const {
    downloadStatus,
    isDownloading,
    checkDownloadStatus,
    handleStartDownload,
    handleCancelDownload
  } = useDownload();

  // Load video data when component mounts
  useEffect(() => {
    const loadVideoData = async () => {
      if (!videoId) return;
      
      try {
        setIsLoading(true);
        const videoData = await window.electron.getVideoData(videoId);
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
  }, [videoId]);

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
            // Navigate to Time's Up page
            navigate('/time-up');
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
        
        // Check and trigger audio warnings
        audioWarningService.checkAudioWarnings(state.timeRemaining, isVideoPlaying);
        
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
          
          // Navigate to Time's Up page
          navigate('/time-up');
        }
      } catch (error) {
        console.error('Error monitoring time limits:', error);
      }
    };
    
    // Only poll while playing to ensure fresh play-state in the closure
    if (isVideoPlaying) {
      intervalId = window.setInterval(monitorTimeLimits, 1000);
    }
    
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [video, isVideoPlaying]);

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

  // Check download status when video loads
  useEffect(() => {
    if (video?.id && video.type === 'youtube') {
      checkDownloadStatus(video.id);
    }
  }, [video?.id, video?.type, checkDownloadStatus]);

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
    logVerbose('[YouTubePlayerPage] startTimeTracking called');
    if (!timeTrackingRef.current.isTracking) {
      timeTrackingRef.current = {
        startTime: Date.now(),
        totalWatched: 0,
        isTracking: true,
        lastUpdateTime: Date.now(),
        lastVideoTime: ytPlayerInstance.current?.getCurrentTime?.() || 0
      };
      logVerbose('[YouTubePlayerPage] Time tracking started:', timeTrackingRef.current);
    }
  }, []);

      const updateTimeTracking = useCallback(async () => {
      logVerbose('[YouTubePlayerPage] updateTimeTracking called, isTracking:', timeTrackingRef.current.isTracking, 'video:', !!video, 'player:', !!ytPlayerInstance.current);
    if (timeTrackingRef.current.isTracking && video && ytPlayerInstance.current) {
      const currentTime = Date.now();
      const timeWatched = (currentTime - timeTrackingRef.current.lastUpdateTime) / 1000;
      
      if (timeWatched >= 1) {
        timeTrackingRef.current.totalWatched += timeWatched;
        timeTrackingRef.current.lastUpdateTime = currentTime;

        // Record the time watched
        const videoCurrentTime = ytPlayerInstance.current.getCurrentTime();
        logVerbose('[YouTubePlayerPage] Recording time:', { videoId: video.id, currentTime: videoCurrentTime, timeWatched });
        await window.electron.recordVideoWatching(
          video.id,
          videoCurrentTime,
          timeWatched,
          video.duration
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

  // Download handlers
  const onStartDownload = useCallback(() => {
    if (video) {
      handleStartDownload(video);
    }
  }, [video, handleStartDownload]);

  const onCancelDownload = useCallback(() => {
    if (video?.id) {
      handleCancelDownload(video.id);
    }
  }, [video?.id, handleCancelDownload]);

  // Initialize YouTube player
  useEffect(() => {
    let cleanup = () => {};
    if (containerRef.current && videoId && !isLoading) {
      playerRef.current = new YouTubeIframePlayer(PLAYER_CONTAINER_ID);
      
      // Prepare player options with resume time if available
      const playerOptions: any = {
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
            
            // If we have a resume time, seek to it after the player is ready
            if (video?.resumeAt && video.resumeAt > 0) {
              logVerbose('[YouTubePlayerPage] Seeking to resume time:', video.resumeAt);
              // Small delay to ensure player is fully ready
              setTimeout(() => {
                if (ytPlayerInstance.current && typeof ytPlayerInstance.current.seekTo === 'function') {
                  ytPlayerInstance.current.seekTo(video.resumeAt, true);
                }
              }, 1000);
            }
          },
          onStateChange: (event: any) => {
            logVerbose('[YouTubePlayerPage] YouTube player state changed:', event.data);
            // 1 = playing, 2 = paused, 0 = ended
            if (event.data === 1) {
              // Playing
              logVerbose('[YouTubePlayerPage] Video started playing');
              setIsVideoPlaying(true);
              // Re-initialize and reset warnings on play start to apply latest config
              (async () => {
                try {
                  const timeLimits = await window.electron.getTimeLimits();
                  await audioWarningService.initialize({
                    countdownWarningSeconds: timeLimits.countdownWarningSeconds ?? 60,
                    audioWarningSeconds: timeLimits.audioWarningSeconds ?? 10,
                    useSystemBeep: timeLimits.useSystemBeep ?? true,
                    customBeepSound: timeLimits.customBeepSound,
                  });
                } catch (e) {
                  console.error('[YouTubePlayerPage] Failed to reinitialize audio warnings:', e);
                }
                audioWarningService.resetState();
              })();
              // Call the time tracking function directly
              startTimeTracking();
            } else if (event.data === 2 || event.data === 0) {
              // Paused or ended
              logVerbose('[YouTubePlayerPage] Video paused/ended');
              setIsVideoPlaying(false);
              // Call the time tracking function directly
              stopTimeTracking();
            }
          },
          onError: (event: any) => {
            console.error('YouTube player error:', event);
            setError('Failed to load YouTube video');
            setIsLoading(false);
          },
        },
      };
      
      // Add start time if resumeAt is available
      if (video?.resumeAt && video.resumeAt > 0) {
        playerOptions.startSeconds = video.resumeAt;
      }
      
      playerRef.current.mount(videoId, playerOptions);
      cleanup = () => {
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }
      };
    }
    return cleanup;
  }, [videoId, isLoading, startTimeTracking, stopTimeTracking, video?.resumeAt]);

  // Polling-based time tracking for YouTube iframe player
  useEffect(() => {
    logVerbose('[YouTubePlayerPage] Time tracking effect triggered, isVideoPlaying:', isVideoPlaying, 'video:', !!video);
    if (!isVideoPlaying || !video) return;

    logVerbose('[YouTubePlayerPage] Starting time tracking interval');
    const intervalId = setInterval(() => {
      updateTimeTracking();
    }, 1000); // Update every second

    return () => {
      logVerbose('[YouTubePlayerPage] Clearing time tracking interval');
      clearInterval(intervalId);
    };
  }, [isVideoPlaying, video, updateTimeTracking]);



  return (
    <BasePlayerPage
      video={video}
      isLoading={isLoading}
      error={error}
      isVideoPlaying={isVideoPlaying}
      timeRemainingSeconds={timeRemainingSeconds}
      countdownWarningSeconds={countdownWarningSeconds}
    >
      <div ref={containerRef} id={PLAYER_CONTAINER_ID} className="w-full aspect-video bg-black">
        {/* YouTube player will be mounted here */}
      </div>
      
      {/* Download UI using shared component */}
      <DownloadUI
        video={video}
        downloadStatus={downloadStatus}
        isDownloading={isDownloading}
        onStartDownload={onStartDownload}
        onCancelDownload={onCancelDownload}
      />
    </BasePlayerPage>
  );
}; 