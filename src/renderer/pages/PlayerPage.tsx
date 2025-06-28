import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import videos from '../data/videos.json';
import { YouTubeAPI, VideoStream, AudioTrack } from '../services/youtube';
import { Video } from '../types';
import { TimeIndicator } from '../components/layout/TimeIndicator';
import { CountdownOverlay } from '../components/video/CountdownOverlay';
import { logVerbose } from '@/shared/logging';
import { audioWarningService } from '../services/audioWarning';

export const PlayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const video = (videos as Video[]).find((v) => v.id === id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingTimeoutRef = useRef<number | undefined>(undefined);
  
  // Time tracking state
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(0);
  const [countdownWarningSeconds, setCountdownWarningSeconds] = useState<number>(60);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
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

  useEffect(() => {
    if (video && video.resumeAt && videoRef.current) {
      videoRef.current.currentTime = video.resumeAt;
    }
  }, [video]);

  useEffect(() => {
    const loadLocalFile = async () => {
      if (video?.type === 'local') {
        try {
          // Handle separate video and audio files
          if (video.video && video.audio) {
            logVerbose('Loading split local files:', { video: video.video, audio: video.audio });
            
            // Get video file URL
            const videoPath = await window.electron.getLocalFile(video.video);
            logVerbose('Received video file path:', videoPath);
            
            // Get audio file URL
            const audioPath = await window.electron.getLocalFile(video.audio);
            logVerbose('Received audio file path:', audioPath);

            if (videoRef.current) {
              // Create a hidden audio element
              const audioElement = document.createElement('audio');
              audioElement.src = audioPath;
              audioElement.style.display = 'none';
              document.body.appendChild(audioElement);

              // Set up video element
              videoRef.current.src = videoPath;
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
                logVerbose('Video metadata loaded');
              });

              audioElement.addEventListener('loadedmetadata', () => {
                logVerbose('Audio metadata loaded');
              });

              videoRef.current.addEventListener('loadeddata', () => {
                logVerbose('Video data loaded');
              });

              audioElement.addEventListener('loadeddata', () => {
                logVerbose('Audio data loaded');
              });

              videoRef.current.addEventListener('canplay', () => {
                logVerbose('Video can play');
                setIsLoading(false);
              });

              // Clean up audio element when component unmounts
              return () => {
                audioElement.remove();
              };
            }
          } else if (video.url) {
            // Handle single file
            logVerbose('Loading local file:', video.url);
            const path = await window.electron.getLocalFile(video.url);
            logVerbose('Received local file path:', path);
            
            if (videoRef.current) {
              videoRef.current.src = path;
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
                logVerbose('Video metadata loaded');
              });
              videoRef.current.addEventListener('loadeddata', () => {
                logVerbose('Video data loaded');
              });
              videoRef.current.addEventListener('canplay', () => {
                logVerbose('Video can play');
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
          logVerbose('Loading DLNA video:', { server, port, path });
          const dlnaUrl = await window.electron.getDlnaFile(server, port, path);
          logVerbose('Received DLNA URL:', dlnaUrl);
          if (videoRef.current) {
            videoRef.current.src = dlnaUrl;
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
            logVerbose('Using pre-defined stream URL from JSON:', video.streamUrl);
            
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
              logVerbose('Using pre-defined audio stream:', video.audioStreamUrl);
            } else {
              logVerbose('No audio stream provided - video only mode');
            }
          } else {
            logVerbose('Fetching available streams for video:', video.id);
            const { videoStreams, audioTracks } = await window.electron.getVideoStreams(video.id);
            
            // Log available audio tracks
            logVerbose('Available audio tracks:', audioTracks.map(t => ({
              language: t.language,
              mimeType: t.mimeType,
              bitrate: t.bitrate,
              url: t.url.substring(0, 50) + '...'
            })));
            
            // Use the proper stream selection functions
            const highestQuality = YouTubeAPI.getHighestQualityStream(videoStreams, audioTracks, video.preferredLanguages);
            logVerbose('Highest quality stream result:', {
              ...highestQuality,
              videoUrl: highestQuality.videoUrl.substring(0, 50) + '...',
              audioUrl: highestQuality.audioUrl ? highestQuality.audioUrl.substring(0, 50) + '...' : undefined
            });
            
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
              logVerbose('Selected audio track:', {
                ...audioTrack,
                url: audioTrack.url.substring(0, 50) + '...'
              });
            } else {
              logVerbose('No audio track selected - video only mode. Audio tracks were available:', audioTracks.length > 0);
            }

            logVerbose('Selected video stream:', videoStream);
          }

          if (!videoStream?.url) {
            throw new Error('No video stream URL available');
          }

          // For video-only entries, we can use direct playback
          if (!audioTrack) {
            logVerbose('Using direct playback for video-only stream');
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
              logVerbose('MediaSource ended');
            });

            mediaSource.addEventListener('sourceclose', () => {
              logVerbose('MediaSource closed');
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
              logVerbose('Video metadata loaded');
            });

            videoElement.addEventListener('loadeddata', () => {
              logVerbose('Video data loaded');
            });

            videoElement.addEventListener('canplay', () => {
              logVerbose('Video can play');
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

            logVerbose('Using MIME types:', { videoMimeType, audioMimeType });

            // Create source buffers for video and audio
            if (mediaSource.readyState !== 'open') {
              throw new Error('MediaSource is not in open state');
            }

            try {
              videoBuffer = mediaSource.addSourceBuffer(videoMimeType);
              logVerbose('Created video source buffer');
              
              audioBuffer = mediaSource.addSourceBuffer(audioMimeType);
              logVerbose('Created audio source buffer');
            } catch (e) {
              console.error('Error creating source buffers:', e);
              // If we fail to create the source buffers, try with a more generic MIME type
              if (videoStream.mimeType.includes('webm')) {
                videoBuffer = mediaSource.addSourceBuffer('video/webm');
                logVerbose('Created video source buffer with generic MIME type');
                
                audioBuffer = mediaSource.addSourceBuffer('audio/webm');
                logVerbose('Created audio source buffer with generic MIME type');
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
                  logVerbose(`${type} stream complete`);
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
            logVerbose('Starting video and audio streams...');
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
                logVerbose('All data streamed, ending stream');
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

  // Time tracking functions
  const startTimeTracking = useCallback(() => {
    logVerbose('[TimeTracking] startTimeTracking called');
    if (!timeTrackingRef.current.isTracking) {
      timeTrackingRef.current = {
        startTime: Date.now(),
        totalWatched: 0,
        isTracking: true,
        lastUpdateTime: Date.now()
      };
      logVerbose('[TimeTracking] Time tracking started:', timeTrackingRef.current);
    } else {
      logVerbose('[TimeTracking] Time tracking already active');
    }
  }, []);

  const updateTimeTracking = useCallback(async () => {
    logVerbose('[TimeTracking] updateTimeTracking called, isTracking:', timeTrackingRef.current.isTracking);
    if (timeTrackingRef.current.isTracking && video) {
      const currentTime = Date.now();
      const timeWatched = (currentTime - timeTrackingRef.current.lastUpdateTime) / 1000; // Convert to seconds
      
      // Only update if at least 1 second has passed to prevent excessive updates
      if (timeWatched >= 1) {
        timeTrackingRef.current.totalWatched += timeWatched;
        timeTrackingRef.current.lastUpdateTime = currentTime;

        // Record the time watched
        if (videoRef.current) {
          logVerbose('[TimeTracking] updateTimeTracking:', {
            videoId: video.id,
            currentTime: videoRef.current.currentTime,
            timeWatched
          });
          await window.electron.recordVideoWatching(
            video.id,
            videoRef.current.currentTime,
            timeWatched
          );
        } else {
          logVerbose('[TimeTracking] videoRef.current is null');
        }
      }
    } else {
      logVerbose('[TimeTracking] Not tracking - isTracking is false or no video');
    }
  }, [video]);

  const stopTimeTracking = useCallback(async () => {
    logVerbose('[TimeTracking] stopTimeTracking called, isTracking:', timeTrackingRef.current.isTracking);
    if (timeTrackingRef.current.isTracking) {
      await updateTimeTracking();
      timeTrackingRef.current.isTracking = false;
      logVerbose('[TimeTracking] Time tracking stopped');
    }
  }, [updateTimeTracking]);

  // Check time limits on mount and when video changes
  useEffect(() => {
    logVerbose('[TimeTracking] PlayerPage useEffect triggered for video:', video?.id);
    logVerbose('[TimeTracking] window.electron available functions:', Object.keys(window.electron || {}));
    
    let isMounted = true;
    
    const checkTimeLimits = async () => {
      if (!video || !isMounted) return;
      
      try {
        const state = await window.electron.getTimeTrackingState();
        if (isMounted) {
          setTimeRemainingSeconds(state.timeRemaining);
          
          // If limit is reached, don't allow playback
          if (state.isLimitReached) {
            logVerbose('[TimeTracking] Daily time limit reached');
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
        
        // Check for audio warnings
        audioWarningService.checkAudioWarnings(state.timeRemaining, isVideoPlaying);
        
        if (state.isLimitReached) {
          logVerbose('[TimeTracking] Time limit reached during playback - implementing Time\'s Up behavior');
          
          // Stop video playback
          if (videoRef.current) {
            videoRef.current.pause();
          }
          
          // Exit fullscreen if in fullscreen mode
          if (document.fullscreenElement) {
            try {
              await document.exitFullscreen();
              logVerbose('[TimeTracking] Exited fullscreen mode');
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
    
    // Check time limits every 3 seconds during video playback
    intervalId = window.setInterval(monitorTimeLimits, 3000);
    
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [video, navigate]);

  // Fetch countdown configuration and update video play state
  useEffect(() => {
    const fetchCountdownConfig = async () => {
      try {
        const timeLimits = await window.electron.getTimeLimits();
        const countdownSeconds = timeLimits.countdownWarningSeconds ?? 60;
        const audioWarningSeconds = timeLimits.audioWarningSeconds ?? 10;
        const useSystemBeep = timeLimits.useSystemBeep ?? true;
        const customBeepSound = timeLimits.customBeepSound;
        
        setCountdownWarningSeconds(countdownSeconds);
        
        // Initialize audio warning service
        await audioWarningService.initialize({
          countdownWarningSeconds: countdownSeconds,
          audioWarningSeconds: audioWarningSeconds,
          useSystemBeep: useSystemBeep,
          customBeepSound: customBeepSound,
        });
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
      // Reset audio warning state when video starts playing
      audioWarningService.resetState();
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

  // Cleanup audio warning service on unmount
  useEffect(() => {
    return () => {
      audioWarningService.destroy();
    };
  }, []);

  if (!video) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-100">
        <div className="p-4">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            ← Back
          </button>
          <div className="text-red-500">Video not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
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
          <video
            ref={videoRef}
            className="w-full"
            controls
            autoPlay
            playsInline
            onPlay={() => {
              logVerbose('[TimeTracking] Video onPlay event fired');
              startTimeTracking();
            }}
            onPause={() => {
              logVerbose('[TimeTracking] Video onPause event fired');
              stopTimeTracking();
            }}
            onEnded={() => {
              logVerbose('[TimeTracking] Video onEnded event fired');
              stopTimeTracking();
            }}
            onTimeUpdate={() => {
              // Throttle time update events to prevent excessive calls
              if (!timeTrackingRef.current.lastUpdateTime || 
                  Date.now() - timeTrackingRef.current.lastUpdateTime > 1000) {
                logVerbose('[TimeTracking] Video onTimeUpdate event fired');
                updateTimeTracking();
              }
            }}
            onSeeking={() => {
              logVerbose('[TimeTracking] Video onSeeking event fired');
              updateTimeTracking();
            }}
            onSeeked={() => {
              logVerbose('[TimeTracking] Video onSeeked event fired');
              updateTimeTracking();
            }}
            onError={(e) => {
              console.error('Video error:', e);
              setError('Failed to play video - the stream may have expired');
              setIsLoading(false);
            }}
            onLoadedData={() => {
              logVerbose('Video loaded successfully');
              setIsLoading(false);
            }}
          />
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