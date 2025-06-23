import React, { useState, useRef, useEffect } from 'react';
import { Video } from '../types';
import { recordVideoWatching, getTimeTrackingState } from '../../shared/timeTracking';

interface VideoPlayerProps {
  video: Video;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video }) => {
  console.log('[TimeTracking] VideoPlayer component rendering with video:', video.id);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeTrackingState, setTimeTrackingState] = useState<{
    timeRemaining: number;
    isLimitReached: boolean;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
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

  // Check time limits on mount and when video changes
  useEffect(() => {
    console.log('[TimeTracking] VideoPlayer useEffect triggered for video:', video.id);
    const checkTimeLimits = async () => {
      try {
        const state = await getTimeTrackingState();
        setTimeTrackingState({
          timeRemaining: state.timeRemaining,
          isLimitReached: state.isLimitReached
        });
        
        // If limit is reached, don't allow playback
        if (state.isLimitReached) {
          setIsPlaying(false);
          if (videoRef.current) {
            videoRef.current.pause();
          }
        }
      } catch (error) {
        console.error('Error checking time limits:', error);
      }
    };

    checkTimeLimits();
  }, [video.id]);

  const startTimeTracking = () => {
    console.log('[TimeTracking] startTimeTracking called');
    if (!timeTrackingRef.current.isTracking) {
      timeTrackingRef.current = {
        startTime: Date.now(),
        totalWatched: 0,
        isTracking: true,
        lastUpdateTime: Date.now()
      };
      console.log('[TimeTracking] Time tracking started:', timeTrackingRef.current);
    } else {
      console.log('[TimeTracking] Time tracking already active');
    }
  };

  const updateTimeTracking = async () => {
    console.log('[TimeTracking] updateTimeTracking called, isTracking:', timeTrackingRef.current.isTracking);
    if (timeTrackingRef.current.isTracking) {
      const currentTime = Date.now();
      const timeWatched = (currentTime - timeTrackingRef.current.lastUpdateTime) / 1000; // Convert to seconds
      timeTrackingRef.current.totalWatched += timeWatched;
      timeTrackingRef.current.lastUpdateTime = currentTime;

      // Record the time watched
      if (videoRef.current) {
        console.log('[TimeTracking] updateTimeTracking:', {
          videoId: video.id,
          currentTime: videoRef.current.currentTime,
          timeWatched
        });
        await recordVideoWatching(
          video.id,
          videoRef.current.currentTime,
          timeWatched
        );
      } else {
        console.log('[TimeTracking] videoRef.current is null');
      }
    } else {
      console.log('[TimeTracking] Not tracking - isTracking is false');
    }
  };

  const stopTimeTracking = async () => {
    console.log('[TimeTracking] stopTimeTracking called, isTracking:', timeTrackingRef.current.isTracking);
    if (timeTrackingRef.current.isTracking) {
      await updateTimeTracking();
      timeTrackingRef.current.isTracking = false;
      console.log('[TimeTracking] Time tracking stopped');
    }
  };

  const handlePlay = async () => {
    console.log('[TimeTracking] handlePlay called');
    if (videoRef.current) {
      try {
        // Check time limits before playing
        const state = await getTimeTrackingState();
        if (state.isLimitReached) {
          console.log('Daily time limit reached');
          return;
        }

        if (video.type === 'dlna') {
          // For DLNA videos, use the specific fields
          if (video.server && video.port && video.path) {
            const fileUrl = await window.electron.getDlnaFile(video.server, video.port, video.path);
            videoRef.current.src = fileUrl;
          } else {
            throw new Error('Missing DLNA video information');
          }
        } else {
          // For local files, we need to get the file URL
          const fileUrl = await window.electron.getLocalFile(video.url);
          videoRef.current.src = fileUrl;
        }

        // Set resume position if available
        if (video.resumeAt && videoRef.current) {
          videoRef.current.currentTime = video.resumeAt;
        }

        await videoRef.current.play();
        console.log('[TimeTracking] Video play() completed');
        setIsPlaying(true);
        startTimeTracking();
      } catch (error) {
        console.error('Error playing video:', error);
      }
    } else {
      console.log('[TimeTracking] videoRef.current is null in handlePlay');
    }
  };

  const handlePause = async () => {
    console.log('[TimeTracking] handlePause called');
    setIsPlaying(false);
    await stopTimeTracking();
  };

  const handleEnded = async () => {
    console.log('[TimeTracking] handleEnded called');
    setIsPlaying(false);
    await stopTimeTracking();
  };

  const handleTimeUpdate = async () => {
    console.log('[TimeTracking] handleTimeUpdate called, isPlaying:', isPlaying);
    // Always update time tracking during playback
    await updateTimeTracking();

    // Check time limits periodically during playback
    if (isPlaying && videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      const state = await getTimeTrackingState();
      
      if (state.isLimitReached) {
        console.log('Daily time limit reached during playback');
        videoRef.current.pause();
        setIsPlaying(false);
        await stopTimeTracking();
      }
    }
  };

  const handleSeeking = async () => {
    // Update time tracking when seeking starts
    if (timeTrackingRef.current.isTracking) {
      await updateTimeTracking();
    }
  };

  const handleSeeked = async () => {
    // Update time tracking when seeking ends
    if (timeTrackingRef.current.isTracking) {
      await updateTimeTracking();
    }
  };

  console.log('[TimeTracking] VideoPlayer render function executing');
  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          className="w-full h-full"
          data-testid="video-player"
          onPlay={() => {
            console.log('[TimeTracking] Video onPlay event fired');
            setIsPlaying(true);
          }}
          onPause={() => {
            console.log('[TimeTracking] Video onPause event fired');
            handlePause();
          }}
          onEnded={() => {
            console.log('[TimeTracking] Video onEnded event fired');
            handleEnded();
          }}
          onTimeUpdate={() => {
            console.log('[TimeTracking] Video onTimeUpdate event fired');
            handleTimeUpdate();
          }}
          onSeeking={() => {
            console.log('[TimeTracking] Video onSeeking event fired');
            handleSeeking();
          }}
          onSeeked={() => {
            console.log('[TimeTracking] Video onSeeked event fired');
            handleSeeked();
          }}
        />
        {!isPlaying ? (
          <button
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white hover:bg-opacity-40 transition-opacity"
            aria-label="Play video"
          >
            <svg
              className="w-16 h-16"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white hover:bg-opacity-40 transition-opacity"
            aria-label="Pause video"
          >
            <svg
              className="w-16 h-16"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          </button>
        )}
      </div>
      <div className="mt-4">
        <h2 className="text-xl font-bold">{video.title}</h2>
        {timeTrackingState && (
          <div className="mt-2 text-sm">
            {timeTrackingState.isLimitReached ? (
              <p className="text-red-600">Daily time limit reached</p>
            ) : (
              <p className="text-green-600">
                Time remaining: {Math.floor(timeTrackingState.timeRemaining / 60)}m {timeTrackingState.timeRemaining % 60}s
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 