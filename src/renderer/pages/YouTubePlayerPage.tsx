import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { YouTubeIframePlayer } from '../services/youtubeIframe';
import { BasePlayerPage } from './BasePlayerPage';
import { Video } from '../types';
import { logVerbose } from '../lib/logging';
import { audioWarningService } from '../services/audioWarning';
import { useDownload } from '../hooks/useDownload';
import { CompactControlsRow } from '../components/video/CompactControlsRow';
import { FavoritesService } from '../services/favoritesService';
import { useFavoriteStatus } from '../hooks/useFavoriteStatus';


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

  // Use simple favorite status hook
  const { isFavorite: isFavoriteVideo, refreshFavorites } = useFavoriteStatus();

  // Download state management using shared hook
  const {
    downloadStatus,
    isDownloading,
    checkDownloadStatus,
    handleStartDownload,
    handleCancelDownload,
    handleResetDownload
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

  // Get current favorite status for this video
  const isFavorite = video?.id ? isFavoriteVideo(video.id, video.type) : false;

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

  const onResetDownload = useCallback(() => {
    if (video?.id) {
      handleResetDownload(video.id);
    }
  }, [video?.id, handleResetDownload]);

  // Favorite handlers - call service to toggle and then refresh
  const handleFavoriteToggle = useCallback(async (videoId: string, newFavoriteStatus: boolean) => {
    try {
      if (!video) {
        return;
      }

      // Validate required data before proceeding
      if (!video.title || video.title.trim() === '') {
        return;
      }

      // For YouTube videos, construct thumbnail URL if not available
      const thumbnail = video.thumbnail || (video.id ? `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg` : '');

      // Call service to toggle favorite
      await FavoritesService.toggleFavorite(
        video.id,
        video.sourceId || 'youtube',
        'youtube',
        video.title,
        thumbnail,
        video.duration || 0,
        new Date().toISOString()
      );

      // Refresh favorites to get updated state
      refreshFavorites();
    } catch (error) {
    }
  }, [video, refreshFavorites]);

  // Initialize YouTube player
  useEffect(() => {
    let cleanup = () => {};
    if (containerRef.current && videoId && !isLoading) {
      // Use requestAnimationFrame to ensure DOM is painted before mounting
      requestAnimationFrame(() => {
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
              // Small delay to ensure player is fully ready
              setTimeout(() => {
                if (ytPlayerInstance.current && typeof ytPlayerInstance.current.seekTo === 'function') {
                  ytPlayerInstance.current.seekTo(video.resumeAt, true);
                }
              }, 1000);
            }
          },
          onStateChange: (event: any) => {
            // 1 = playing, 2 = paused, 0 = ended
            if (event.data === 1) {
              // Playing
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
      });
    }
    return cleanup;
  }, [videoId, isLoading, startTimeTracking, stopTimeTracking, video?.resumeAt]);

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

  // Keyboard shortcuts for favorites (F key)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle F key when not typing in an input field
      if (event.key === 'f' || event.key === 'F') {
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }

        event.preventDefault();
        // Trigger favorite toggle by simulating click on the favorite button
        const favoriteButton = document.querySelector('[data-testid="favorite-button"]') as HTMLButtonElement;
        if (favoriteButton) {
          favoriteButton.click();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);



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
      
      {/* Compact Controls Row - combines download and favorite functionality */}
      {video && (
        <div className="mt-4">
          <CompactControlsRow
            video={video}
            isFavorite={isFavorite}
            onFavoriteToggle={handleFavoriteToggle}
            downloadStatus={downloadStatus}
            isDownloading={isDownloading}
            onStartDownload={onStartDownload}
            onCancelDownload={onCancelDownload}
            onResetDownload={onResetDownload}
            showResetButton={downloadStatus.status === 'completed'}
            size="large"
          />

          {/* Keyboard shortcut hint */}
          <div className="mt-2 text-center">
            <div className="text-xs text-gray-500">
              Press <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded">F</kbd> to toggle favorite
            </div>
          </div>
        </div>
      )}
    </BasePlayerPage>
  );
}; 