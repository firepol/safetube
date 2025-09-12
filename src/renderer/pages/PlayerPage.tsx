import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { YouTubeAPI, VideoStream, AudioTrack } from '../services/youtube-api';
import { PlayerConfigService } from '../services/playerConfig';
import { Video } from '../types';
import { BasePlayerPage } from './BasePlayerPage';
import { logVerbose } from '../lib/logging';
import { audioWarningService } from '../services/audioWarning';


function getSrc(val: unknown): string {
  logVerbose('[PlayerPage] getSrc called with:', val);
  if (typeof val === 'string') {
    logVerbose('[PlayerPage] getSrc returning string:', val);
    return val;
  }
  if (val && typeof val === 'object' && 'url' in val && typeof (val as any).url === 'string') {
    logVerbose('[PlayerPage] getSrc returning object url:', (val as any).url);
    return (val as any).url;
  }
  logVerbose('[PlayerPage] getSrc returning empty string');
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
  
  // Conversion state
  const [conversionStatus, setConversionStatus] = useState<{
    status: 'idle' | 'converting' | 'completed' | 'failed';
    progress?: number;
    error?: string;
  }>({ status: 'idle' });
  const [hasConvertedVideo, setHasConvertedVideo] = useState<boolean>(false);
  const [needsConversion, setNeedsConversion] = useState<boolean>(false);
  
  // Time tracking state
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(0);
  const [countdownWarningSeconds, setCountdownWarningSeconds] = useState<number>(60);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  
  // Flag to prevent infinite loop when setting resume time
  const resumeAttemptedRef = useRef<boolean>(false);

  // Conversion functions
  const checkConversionStatus = async (filePath: string) => {
    try {
      const [needsConversionResult, hasConvertedResult, statusResult] = await Promise.all([
        window.electron.needsVideoConversion(filePath),
        window.electron.hasConvertedVideo(filePath),
        window.electron.getConversionStatus(filePath)
      ]);
      
      setNeedsConversion(needsConversionResult);
      setHasConvertedVideo(hasConvertedResult);
      setConversionStatus(statusResult);
    } catch (error) {
      console.error('[PlayerPage] Error checking conversion status:', error);
    }
  };

  const handleStartConversion = async () => {
    if (!video?.url) return;
    
    try {
      setConversionStatus({ status: 'converting', progress: 0 });
      await window.electron.startVideoConversion(video.url, { quality: 'medium' });
      
      // Start polling for status updates
      const pollInterval = setInterval(async () => {
        try {
          const status = await window.electron.getConversionStatus(video.url);
          setConversionStatus(status);
          
          if (status.status === 'completed') {
            clearInterval(pollInterval);
            setHasConvertedVideo(true);
            // Reload the video with converted version
            await loadVideoWithConversion();
          } else if (status.status === 'failed') {
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error('[PlayerPage] Error polling conversion status:', error);
        }
      }, 1000);
      
    } catch (error) {
      console.error('[PlayerPage] Error starting conversion:', error);
      setConversionStatus({ 
        status: 'failed', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  };

  const handleUseConvertedVideo = async () => {
    if (!video?.url) return;
    
    try {
      const convertedPath = await window.electron.getExistingConvertedVideoPath(video.url);
      if (convertedPath && videoRef.current) {
        const convertedFileUrl = await window.electron.getLocalFile(convertedPath);
        videoRef.current.src = getSrc(convertedFileUrl);
        setError(null);
        logVerbose('[PlayerPage] Switched to converted video:', getSrc(convertedFileUrl));
      }
    } catch (error) {
      console.error('[PlayerPage] Error using converted video:', error);
      setError('Failed to load converted video');
    }
  };

  const loadVideoWithConversion = async () => {
    if (!video?.url) return;
    
    try {
      const hasConverted = await window.electron.hasConvertedVideo(video.url);
      if (hasConverted && videoRef.current) {
        const convertedPath = await window.electron.getExistingConvertedVideoPath(video.url);
        if (convertedPath) {
          const convertedFileUrl = await window.electron.getLocalFile(convertedPath);
          videoRef.current.src = getSrc(convertedFileUrl);
          setError(null);
          logVerbose('[PlayerPage] Loaded converted video:', getSrc(convertedFileUrl));
        }
      }
    } catch (error) {
      console.error('[PlayerPage] Error loading converted video:', error);
    }
  };

  // Load video data when component mounts or ID changes
  useEffect(() => {
    const loadVideoData = async () => {
      if (!id) return;
      
      try {
        setIsLoading(true);
        const videoData = await window.electron.getVideoData(id);
        logVerbose('[PlayerPage] Loaded video data:', videoData);
        if (videoData) {
          setVideo(videoData);
          setError(null);
          // Reset resume flag for new video
          resumeAttemptedRef.current = false;
        } else {
          setVideo(null);
          setError('Video not found');
        }
      } catch (err) {
        console.error('[PlayerPage] Error loading video data:', err);
        setError('Video not found');
      } finally {
        setIsLoading(false);
      }
    };

    loadVideoData();
  }, [id]);

  // Check conversion status when video is loaded
  useEffect(() => {
    if (video?.url && video.type === 'local') {
      checkConversionStatus(video.url);
    }
  }, [video?.url]);

  useEffect(() => {
    if (video && video.resumeAt && videoRef.current) {
      videoRef.current.currentTime = video.resumeAt;
    }
  }, [video]);

  useEffect(() => {
    const loadLocalFile = async () => {
      logVerbose('[PlayerPage] loadLocalFile called, video:', video);
      if (video?.type === 'local') {
        logVerbose('[PlayerPage] Processing local video:', { id: video.id, title: video.title, video: video.video, audio: video.audio, url: video.url, resumeAt: video.resumeAt });
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
                logVerbose('[PlayerPage] Video can play event fired for separate streams');
                // Set resume time if available - use a small delay to ensure video is ready
                if (video.resumeAt && video.resumeAt > 0 && videoRef.current && !resumeAttemptedRef.current) {
                  logVerbose('[PlayerPage] Attempting to resume at:', video.resumeAt);
                  resumeAttemptedRef.current = true; // Prevent infinite loop
                  setTimeout(() => {
                    try {
                      if (videoRef.current && video.resumeAt && videoRef.current.duration > 0) {
                        // Only resume if the position is within the video duration
                        if (video.resumeAt < videoRef.current.duration) {
                          videoRef.current.currentTime = video.resumeAt;
                          logVerbose('[PlayerPage] Successfully set resume time for local video with separate streams:', video.resumeAt);
                        } else {
                          logVerbose('[PlayerPage] Resume time exceeds video duration, starting from beginning');
                        }
                      } else {
                        logVerbose('[PlayerPage] Video not ready for resume - duration:', videoRef.current?.duration, 'resumeAt:', video.resumeAt);
                      }
                    } catch (error) {
                      console.warn('[PlayerPage] Failed to set resume time for separate streams:', error);
                      // Continue with normal playback even if resume fails
                    }
                  }, 100);
                } else {
                  logVerbose('[PlayerPage] No resume time or video not ready - resumeAt:', video.resumeAt, 'videoRef:', !!videoRef.current, 'already attempted:', resumeAttemptedRef.current);
                }
                setIsLoading(false);
              });

              // Clean up audio element when component unmounts
              return () => {
                audioElement.remove();
              };
            }
          } else if (video.url) {
            // Handle single file
            logVerbose('[PlayerPage] Loading single local file:', video.url);
            const path = await window.electron.getLocalFile(video.url);
            logVerbose('[PlayerPage] Local file path resolved:', path);
            
            if (videoRef.current) {
              try {
                // Check if video needs conversion for compatibility
                const needsConversion = await window.electron.needsVideoConversion(video.url);
                
                if (needsConversion) {
                  logVerbose('[PlayerPage] Video needs conversion for browser compatibility');
                  
                  // Check if converted video already exists
                  const hasConverted = await window.electron.hasConvertedVideo(video.url);
                  
                  if (hasConverted) {
                    // Use existing converted video
                    const convertedPath = await window.electron.getExistingConvertedVideoPath(video.url);
                    if (convertedPath) {
                      const convertedFileUrl = await window.electron.getLocalFile(convertedPath);
                      videoRef.current.src = getSrc(convertedFileUrl);
                      logVerbose('[PlayerPage] Using existing converted video:', getSrc(convertedFileUrl));
                    } else {
                      // Fallback to original (shouldn't happen)
                      videoRef.current.src = getSrc(path);
                      logVerbose('[PlayerPage] Fallback to original file:', getSrc(path));
                    }
                  } else {
                    // Try to load original file - it will likely fail and show error UI
                    videoRef.current.src = getSrc(path);
                    logVerbose('[PlayerPage] Attempting to load original file (will likely fail):', getSrc(path));
                  }
                } else {
                  // Use original file
                  videoRef.current.src = getSrc(path);
                  logVerbose('[PlayerPage] Set video src to original file:', getSrc(path));
                }
              } catch (conversionError) {
                console.error('[PlayerPage] Error during codec detection:', conversionError);
                // Fallback to original file
                videoRef.current.src = getSrc(path);
                logVerbose('[PlayerPage] Fallback to original file after codec detection error:', getSrc(path));
              }
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
                logVerbose('[PlayerPage] Video can play event fired for single local file');
                // Set resume time if available - use a small delay to ensure video is ready
                if (video.resumeAt && video.resumeAt > 0 && videoRef.current && !resumeAttemptedRef.current) {
                  logVerbose('[PlayerPage] Attempting to resume single file at:', video.resumeAt);
                  resumeAttemptedRef.current = true; // Prevent infinite loop
                  setTimeout(() => {
                    try {
                      if (videoRef.current && video.resumeAt && videoRef.current.duration > 0) {
                        // Only resume if the position is within the video duration
                        if (video.resumeAt < videoRef.current.duration) {
                          videoRef.current.currentTime = video.resumeAt;
                          logVerbose('[PlayerPage] Successfully set resume time for single local file:', video.resumeAt);
                        } else {
                          logVerbose('[PlayerPage] Resume time exceeds video duration, starting from beginning');
                        }
                      } else {
                        logVerbose('[PlayerPage] Single file video not ready for resume - duration:', videoRef.current?.duration, 'resumeAt:', video.resumeAt);
                      }
                    } catch (error) {
                      console.warn('[PlayerPage] Failed to set resume time for single file:', error);
                      // Continue with normal playback even if resume fails
                    }
                  }, 100);
                } else {
                  logVerbose('[PlayerPage] No resume time for single file - resumeAt:', video.resumeAt, 'videoRef:', !!videoRef.current, 'already attempted:', resumeAttemptedRef.current);
                }
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
            // Set resume time if available
            if (video.resumeAt && video.resumeAt > 0) {
              videoRef.current.addEventListener('loadedmetadata', () => {
                setTimeout(() => {
                  try {
                    if (videoRef.current && video.resumeAt) {
                      videoRef.current.currentTime = video.resumeAt;
                      logVerbose('[PlayerPage] Set resume time for DLNA video:', video.resumeAt);
                    }
                  } catch (error) {
                    console.warn('[PlayerPage] Failed to set resume time for DLNA video:', error);
                  }
                }, 100);
              }, { once: true });
            }
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
            // logVerbose('[PlayerPage] Media source config:', mediaSourceConfig);
            
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
            logVerbose('[PlayerPage] chosen stream quality:', videoStream.quality);

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
                // Set resume time if available
                if (video.resumeAt && video.resumeAt > 0) {
                  videoRef.current.addEventListener('loadedmetadata', () => {
                    setTimeout(() => {
                      try {
                        if (videoRef.current && video.resumeAt) {
                          videoRef.current.currentTime = video.resumeAt;
                          logVerbose('[PlayerPage] Set resume time for YouTube video-only:', video.resumeAt);
                        }
                      } catch (error) {
                        console.warn('[PlayerPage] Failed to set resume time for YouTube video-only:', error);
                      }
                    }, 100);
                  }, { once: true });
                }
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
                // Set resume time if available - use a small delay to ensure video is ready
                if (video.resumeAt && video.resumeAt > 0) {
                  setTimeout(() => {
                    try {
                      if (video.resumeAt) {
                        videoElement.currentTime = video.resumeAt;
                        logVerbose('[PlayerPage] Set resume time for YouTube media source:', video.resumeAt);
                      }
                    } catch (error) {
                      console.warn('[PlayerPage] Failed to set resume time for YouTube media source:', error);
                    }
                  }, 100);
                }
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
        
        // Check and trigger audio warnings
        audioWarningService.checkAudioWarnings(state.timeRemaining, isVideoPlaying);
        
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
            timeWatched,
            video.duration
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
        console.error('[PlayerPage] Failed to reinitialize audio warnings:', e);
      }
      audioWarningService.resetState();
    })();
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

  // Custom error display for conversion options
  const renderConversionError = () => {
    if (!error || !needsConversion) return null;
    
    return (
      <div className="text-center text-red-500 mb-4">
        <div className="text-lg mb-2">Video Playback Error</div>
        <div className="text-sm mb-4">{error}</div>
        
        <div className="space-y-3">
          {conversionStatus.status === 'converting' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-blue-800 font-medium mb-2">Converting Video...</div>
              <div className="text-sm text-blue-600 mb-2">
                Converting video for compatibility. This may take several minutes.
              </div>
              {conversionStatus.progress !== undefined && (
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${conversionStatus.progress}%` }}
                  ></div>
                </div>
              )}
              <div className="text-xs text-blue-500 mt-2">
                You can close this and come back later. The conversion will continue in the background.
              </div>
            </div>
          )}
          
          {conversionStatus.status === 'failed' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-red-800 font-medium mb-2">Conversion Failed</div>
              <div className="text-sm text-red-600 mb-3">
                {conversionStatus.error || 'An error occurred during conversion'}
              </div>
              <button
                onClick={handleStartConversion}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                Try Converting Again
              </button>
            </div>
          )}
          
          {conversionStatus.status === 'completed' && hasConvertedVideo && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-green-800 font-medium mb-2">Video Converted Successfully!</div>
              <div className="text-sm text-green-600 mb-3">
                The video has been converted to a compatible format.
              </div>
              <button
                onClick={handleUseConvertedVideo}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
              >
                Play Converted Video
              </button>
            </div>
          )}
          
          {conversionStatus.status === 'idle' && !hasConvertedVideo && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-yellow-800 font-medium mb-2">Video Format Not Supported</div>
              <div className="text-sm text-yellow-600 mb-3">
                This video uses an older format that isn't supported by modern browsers. 
                You can convert it to a compatible format.
              </div>
              <button
                onClick={handleStartConversion}
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 transition-colors"
              >
                Convert Video
              </button>
              <div className="text-xs text-yellow-500 mt-2">
                Note: Conversion may take several minutes for long videos.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // If there's an error and we need conversion, show custom UI instead of BasePlayerPage error
  if (error && needsConversion) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-100">
        <div className="p-4">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            ← Back
          </button>
          {renderConversionError()}
        </div>
      </div>
    );
  }

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
        data-testid="video-player"
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