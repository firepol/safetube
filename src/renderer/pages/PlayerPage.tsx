import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { YouTubeAPI, VideoStream, AudioTrack } from '../services/youtube-api';
import { PlayerConfigService } from '../services/playerConfig';
import { Video } from '../types';
import { BasePlayerPage } from './BasePlayerPage';

function getSrc(val: unknown): string {
  console.log('[PlayerPage] getSrc called with:', val);
  if (typeof val === 'string') {
    console.log('[PlayerPage] getSrc returning string:', val);
    return val;
  }
  if (val && typeof val === 'object' && 'url' in val && typeof (val as any).url === 'string') {
    console.log('[PlayerPage] getSrc returning object url:', (val as any).url);
    return (val as any).url;
  }
  console.log('[PlayerPage] getSrc returning empty string');
  return '';
}

export const PlayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingTimeoutRef = useRef<number | undefined>(undefined);
  
  // Time tracking state
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(0);
  const [countdownWarningSeconds, setCountdownWarningSeconds] = useState<number>(60);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);

  // Load video data when component mounts or ID changes
  useEffect(() => {
    const loadVideoData = async () => {
      if (!id) return;
      
      try {
        setIsLoading(true);
        const videoData = await window.electron.getVideoData(id);
        setVideo(videoData);
        setError(null);
      } catch (err) {
        console.error('[PlayerPage] Error loading video data:', err);
        setError('Video not found');
      } finally {
        setIsLoading(false);
      }
    };

    loadVideoData();
  }, [id]);

  useEffect(() => {
    if (video && video.resumeAt && videoRef.current) {
      videoRef.current.currentTime = video.resumeAt;
    }
  }, [video]);

  useEffect(() => {
    const loadLocalFile = async () => {
      console.log('[PlayerPage] loadLocalFile called, video:', video);
      if (video?.type === 'local') {
        console.log('[PlayerPage] Processing local video:', { id: video.id, title: video.title, video: video.video, audio: video.audio, url: video.url });
        try {
          // Handle separate video and audio files
          if (video.video && video.audio) {
            // Get video file URL
            const videoPath = await window.electron.getLocalFile(video.video);
            
            // Get audio file URL
            const audioPath = await window.electron.getLocalFile(video.audio);

            if (videoRef.current) {
              // Create a hidden audio element
              const audioElement = document.createElement('audio');
              audioElement.src = getSrc(audioPath);
              audioElement.style.display = 'none';
              document.body.appendChild(audioElement);

              // Set up video element
              videoRef.current.src = getSrc(videoPath);
              videoRef.current.muted = true; // Mute the video element since we'll play audio separately

              // Sync audio with video
              videoRef.current.addEventListener('play', () => {
                audioElement.currentTime = videoRef.current?.currentTime || 0;
                audioElement.play();
              });

              videoRef.current.addEventListener('pause', () => {
                audioElement.pause();
              });

              videoRef.current.addEventListener('seeking', () => {
                if (videoRef.current) {
                  audioElement.currentTime = videoRef.current.currentTime;
                }
              });

              // Add event listeners for debugging
              videoRef.current.addEventListener('error', (e) => {
                console.error('Video element error:', e);
                const error = videoRef.current?.error;
                if (error) {
                  console.error('Error code:', error.code);
                  console.error('Error message:', error.message);
                }
              });

              audioElement.addEventListener('error', (e) => {
                console.error('Audio element error:', e);
                const error = audioElement.error;
                if (error) {
                  console.error('Error code:', error.code);
                  console.error('Error message:', error.message);
                }
              });

              videoRef.current.addEventListener('loadedmetadata', () => {
                // console.log('Video metadata loaded');
              });

              audioElement.addEventListener('loadedmetadata', () => {
                // console.log('Audio metadata loaded');
              });

              videoRef.current.addEventListener('loadeddata', () => {
                // console.log('Video data loaded');
              });

              audioElement.addEventListener('loadeddata', () => {
                // console.log('Audio data loaded');
              });

              videoRef.current.addEventListener('canplay', () => {
                // console.log('Video can play');
                setIsLoading(false);
              });

              // Clean up audio element when component unmounts
              return () => {
                audioElement.remove();
              };
            }
          } else if (video.url) {
            // Handle single file
            console.log('[PlayerPage] Loading single local file:', video.url);
            const path = await window.electron.getLocalFile(video.url);
            console.log('[PlayerPage] Local file path resolved:', path);
            
            if (videoRef.current) {
              videoRef.current.src = getSrc(path);
              console.log('[PlayerPage] Set video src to:', getSrc(path));
              // Add event listeners for debugging
              videoRef.current.addEventListener('error', (e) => {
                console.error('Video element error:', e);
                const error = videoRef.current?.error;
                if (error) {
                  console.error('Error code:', error.code);
                  console.error('Error message:', error.message);
                }
              });
              videoRef.current.addEventListener('loadedmetadata', () => {
                // console.log('Video metadata loaded');
              });
              videoRef.current.addEventListener('loadeddata', () => {
                // console.log('Video data loaded');
              });
              videoRef.current.addEventListener('canplay', () => {
                // console.log('Video can play');
                setIsLoading(false);
              });
            }
          } else {
            throw new Error('No video file specified');
          }
        } catch (error) {
          console.error('Error loading local file:', error);
          setError('Failed to load local file: ' + (error instanceof Error ? error.message : String(error)));
          setIsLoading(false);
        }
      }
    };
    loadLocalFile();
  }, [video]);

  useEffect(() => {
    const loadDlnaFile = async () => {
      if (video?.type === 'dlna' && video.url) {
        try {
          const url = new URL(video.url);
          const server = url.hostname;
          const port = parseInt(url.port);
          const path = url.pathname;
          const dlnaUrl = await window.electron.getDlnaFile(server, port, path);
          if (videoRef.current) {
            videoRef.current.src = getSrc(dlnaUrl);
          }
          setIsLoading(false);
        } catch (error) {
          console.error('Error loading DLNA file:', error);
          setError('Failed to load DLNA file');
          setIsLoading(false);
        }
      }
    };
    loadDlnaFile();
  }, [video]);

  useEffect(() => {
    const loadYouTubeVideo = async () => {
      if (video?.type === 'youtube' && video.id) {
        try {
          let videoStream: VideoStream | undefined;
          let audioTrack: AudioTrack | undefined;
          let mediaSource: MediaSource | null = null;
          let videoBuffer: SourceBuffer | null = null;
          let audioBuffer: SourceBuffer | null = null;
          let isMediaSourceActive = true;

          // Cleanup function
          const cleanup = () => {
            isMediaSourceActive = false;
            if (videoBuffer && mediaSource?.sourceBuffers.length) {
              try {
                mediaSource.removeSourceBuffer(videoBuffer);
              } catch (e) {
                console.warn('Error removing video buffer:', e);
              }
            }
            if (audioBuffer && mediaSource?.sourceBuffers.length) {
              try {
                mediaSource.removeSourceBuffer(audioBuffer);
              } catch (e) {
                console.warn('Error removing audio buffer:', e);
              }
            }
            if (mediaSource?.readyState === 'open') {
              try {
                mediaSource.endOfStream();
              } catch (e) {
                console.warn('Error ending media source stream:', e);
              }
            }
          };

          if (video.useJsonStreamUrls && video.streamUrl) {
            videoStream = {
              url: video.streamUrl,
              quality: 'predefined',
              mimeType: video.streamUrl.includes('webm') ? 'video/webm' : 'video/mp4'
            };

            // Only get audio track if it's not a video-only entry
            if (video.audioStreamUrl) {
              audioTrack = {
                url: video.audioStreamUrl,
                language: 'en',
                mimeType: video.audioStreamUrl.includes('webm') ? 'audio/webm' : 'audio/mp4'
              };
            }
          } else {
            const { videoStreams, audioTracks } = await window.electron.getVideoStreams(video.id);
            
            // Get MediaSource configuration for max quality
            const mediaSourceConfig = await PlayerConfigService.getMediaSourceConfig();
            
            // Use the proper stream selection functions with max quality limit
            const highestQuality = YouTubeAPI.getHighestQualityStream(
              videoStreams, 
              audioTracks, 
              mediaSourceConfig.preferredLanguages,
              mediaSourceConfig.maxQuality
            );
            
            videoStream = {
              url: highestQuality.videoUrl,
              quality: highestQuality.quality,
              mimeType: highestQuality.videoUrl.includes('webm') ? 'video/webm' : 'video/mp4'
            };

            if (highestQuality.audioUrl) {
              audioTrack = {
                url: highestQuality.audioUrl,
                language: highestQuality.audioLanguage || 'en',
                mimeType: highestQuality.audioUrl.includes('webm') ? 'audio/webm' : 'audio/m4a'
              };
            }
          }

          if (!videoStream?.url) {
            throw new Error('No video stream URL available');
          }

          // For video-only entries, we can use direct playback
          if (!audioTrack) {
            if (videoRef.current) {
              videoRef.current.src = videoStream.url;
              setIsLoading(false);
            }
            return;
          }

          // For videos with both video and audio, use MediaSource
          mediaSource = new MediaSource();
          const videoUrl = URL.createObjectURL(mediaSource);
          const videoElement = videoRef.current;
          if (videoElement) {
            videoElement.src = videoUrl;
          }

          // Set up MediaSource event handlers
          if (mediaSource) {
            mediaSource.addEventListener('sourceended', () => {
              // console.log('MediaSource ended');
            });

            mediaSource.addEventListener('sourceclose', () => {
              // console.log('MediaSource closed');
            });
          }

          // Set up video element event handlers
          if (videoElement) {
            videoElement.addEventListener('error', (e) => {
              console.error('Video element error:', e);
              const error = videoElement.error;
              if (error) {
                console.error('Error code:', error.code);
                console.error('Error message:', error.message);
              }
              setError('Video playback error: ' + (error?.message || 'Unknown error'));
              setIsLoading(false);
            });

            videoElement.addEventListener('loadedmetadata', () => {
              // console.log('Video metadata loaded');
            });

            videoElement.addEventListener('loadeddata', () => {
              // console.log('Video data loaded');
            });

            videoElement.addEventListener('canplay', () => {
              // console.log('Video can play');
            });
          }

          // Wait for MediaSource to be ready
          await new Promise<void>((resolve, reject) => {
            const handleSourceOpen = () => {
              if (!mediaSource) {
                reject(new Error('MediaSource is null'));
                return;
              }
              mediaSource.removeEventListener('sourceopen', handleSourceOpen);
              resolve();
            };

            const handleSourceClose = () => {
              if (!mediaSource) return;
              mediaSource.removeEventListener('sourceclose', handleSourceClose);
              reject(new Error('MediaSource was closed before it could be used'));
            };

            mediaSource?.addEventListener('sourceopen', handleSourceOpen);
            mediaSource?.addEventListener('sourceclose', handleSourceClose);
          });

          try {
            if (!isMediaSourceActive || !mediaSource) return;

            // Determine the correct MIME type and codec
            const videoMimeType = videoStream.mimeType.includes('webm') 
              ? (videoStream.mimeType.includes('vp9') 
                ? 'video/webm; codecs="vp9"' 
                : 'video/webm; codecs="vp8"')
              : 'video/mp4; codecs="avc1.42E01E"';
            
            // Use WebM audio for WebM video to ensure compatibility
            const audioMimeType = videoStream.mimeType.includes('webm')
              ? 'audio/webm; codecs="opus"'
              : 'audio/mp4; codecs="mp4a.40.2"';

            // Create source buffers for video and audio
            if (mediaSource.readyState !== 'open') {
              throw new Error('MediaSource is not in open state');
            }

            try {
              videoBuffer = mediaSource.addSourceBuffer(videoMimeType);
              audioBuffer = mediaSource.addSourceBuffer(audioMimeType);
            } catch (e) {
              console.error('Error creating source buffers:', e);
              // If we fail to create the source buffers, try with a more generic MIME type
              if (videoStream.mimeType.includes('webm')) {
                videoBuffer = mediaSource.addSourceBuffer('video/webm');
                audioBuffer = mediaSource.addSourceBuffer('audio/webm');
              } else {
                throw e;
              }
            }

            // Function to stream data in chunks
            const streamData = async (url: string, buffer: SourceBuffer, type: string) => {
              if (!isMediaSourceActive || !mediaSource) return;

              const response = await fetch(url);
              if (!response.ok) {
                throw new Error(`Failed to fetch ${type} data: ${response.status}`);
              }

              const reader = response.body?.getReader();
              if (!reader) {
                throw new Error(`Failed to get reader for ${type} data`);
              }

              while (isMediaSourceActive && mediaSource) {
                const { done, value } = await reader.read();
                if (done) {
                  break;
                }

                // Wait for the buffer to be ready
                while (buffer.updating && isMediaSourceActive && mediaSource) {
                  await new Promise(resolve => setTimeout(resolve, 10));
                }

                if (!isMediaSourceActive || !mediaSource) break;

                try {
                  // Check if the buffer is still attached to the MediaSource
                  if (Array.from(mediaSource.sourceBuffers).includes(buffer)) {
                    buffer.appendBuffer(value);
                  } else {
                    console.warn(`${type} buffer was removed from MediaSource`);
                    break;
                  }
                } catch (e) {
                  console.warn(`Error appending ${type} buffer:`, e);
                  break;
                }
              }
            };

            // Start streaming both video and audio
            await Promise.all([
              streamData(videoStream.url, videoBuffer, 'video'),
              streamData(audioTrack.url, audioBuffer, 'audio')
            ]);

            // End the stream when both are done
            if (isMediaSourceActive && mediaSource && mediaSource.readyState === 'open') {
              // Wait for any pending updates to complete
              while ((videoBuffer?.updating || audioBuffer?.updating) && isMediaSourceActive && mediaSource) {
                await new Promise(resolve => setTimeout(resolve, 10));
              }

              if (isMediaSourceActive && mediaSource && mediaSource.readyState === 'open') {
                mediaSource.endOfStream();
              }
            }
            setIsLoading(false);
          } catch (error) {
            console.error('Error setting up MediaSource:', error);
            setError('Failed to set up video playback: ' + (error instanceof Error ? error.message : String(error)));
            setIsLoading(false);
          }

          // Add cleanup on component unmount
          return () => {
            cleanup();
          };
        } catch (error) {
          console.error('Error loading YouTube video:', error);
          setError('Failed to load YouTube video');
          setIsLoading(false);
        }
      }
    };
    loadYouTubeVideo();
  }, [video]);

  // Set a timeout to prevent infinite loading
  useEffect(() => {
    if (isLoading) {
      loadingTimeoutRef.current = window.setTimeout(() => {
        setError('Loading timeout - video may be unavailable');
        setIsLoading(false);
      }, 10000); // 10 second timeout
    }
    return () => {
      if (loadingTimeoutRef.current) {
        window.clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [isLoading]);

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
            if (videoRef.current) {
              videoRef.current.pause();
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
          if (videoRef.current) {
            videoRef.current.pause();
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

  // Update video play state
  useEffect(() => {
    if (!videoRef.current) return;

    const handlePlay = () => {
      setIsVideoPlaying(true);
    };

    const handlePause = () => {
      setIsVideoPlaying(false);
    };

    const videoElement = videoRef.current;
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);

    return () => {
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
    };
  }, [videoRef.current]);

  // Time tracking state
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
    if (!timeTrackingRef.current.isTracking) {
      timeTrackingRef.current = {
        startTime: Date.now(),
        totalWatched: 0,
        isTracking: true,
        lastUpdateTime: Date.now()
      };
    }
  }, []);

  const updateTimeTracking = useCallback(async () => {
    if (timeTrackingRef.current.isTracking && video) {
      const currentTime = Date.now();
      const timeWatched = (currentTime - timeTrackingRef.current.lastUpdateTime) / 1000;
      
      if (timeWatched >= 1) {
        timeTrackingRef.current.totalWatched += timeWatched;
        timeTrackingRef.current.lastUpdateTime = currentTime;

        // Record the time watched
        if (videoRef.current) {
          await window.electron.recordVideoWatching(
            video.id,
            videoRef.current.currentTime,
            timeWatched
          );
        }
      }
    }
  }, [video]);

  const stopTimeTracking = useCallback(async () => {
    if (timeTrackingRef.current.isTracking) {
      await updateTimeTracking();
      timeTrackingRef.current.isTracking = false;
    }
  }, [updateTimeTracking]);

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
    // Throttle time update events to prevent excessive calls
    if (!timeTrackingRef.current.lastUpdateTime || 
        Date.now() - timeTrackingRef.current.lastUpdateTime > 1000) {
      updateTimeTracking();
    }
  }, [updateTimeTracking]);

  const handleVideoSeeking = useCallback(() => {
    updateTimeTracking();
  }, [updateTimeTracking]);

  const handleVideoSeeked = useCallback(() => {
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

    >
      <video
        ref={videoRef}
        className="w-full"
        controls
        autoPlay
        playsInline
        onPlay={handleVideoPlay}
        onPause={handleVideoPause}
        onEnded={handleVideoEnded}
        onTimeUpdate={handleVideoTimeUpdate}
        onSeeking={handleVideoSeeking}
        onSeeked={handleVideoSeeked}
        onError={(e) => {
          console.error('Video error:', e);
          handleVideoError('Failed to play video - the stream may have expired');
        }}
        onLoadedData={handleVideoLoaded}
      />
    </BasePlayerPage>
  );
}; 