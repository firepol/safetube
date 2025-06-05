import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import videos from '../data/videos.json';
import { YouTubeAPI, VideoStream, AudioTrack } from '../services/youtube';
import { Video } from '../types';

export const PlayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const video = (videos as Video[]).find((v) => v.id === id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localFilePath, setLocalFilePath] = useState<string | null>(null);
  const [dlnaUrl, setDlnaUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (video && video.resumeAt && videoRef.current) {
      videoRef.current.currentTime = video.resumeAt;
    }
  }, [video]);

  useEffect(() => {
    const loadLocalFile = async () => {
      if (video?.type === 'local' && video.url) {
        try {
          console.log('Loading local file:', video.url);
          const path = await window.electron.getLocalFile(video.url);
          console.log('Received local file path:', path);
          setLocalFilePath(path);
          
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
              console.log('Video metadata loaded');
            });
            videoRef.current.addEventListener('loadeddata', () => {
              console.log('Video data loaded');
            });
            videoRef.current.addEventListener('canplay', () => {
              console.log('Video can play');
              setIsLoading(false);
            });
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
          console.log('Loading DLNA video:', { server, port, path });
          const dlnaUrl = await window.electron.getDlnaFile(server, port, path);
          console.log('Received DLNA URL:', dlnaUrl);
          setDlnaUrl(dlnaUrl);
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

          if (video.useJsonStreamUrls && video.streamUrl) {
            console.log('Using pre-defined stream URL from JSON:', video.streamUrl);
            
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
              console.log('Using pre-defined audio stream:', video.audioStreamUrl);
            } else {
              console.log('No audio stream provided - video only mode');
            }
          } else {
            console.log('Fetching available streams for video:', video.id);
            const { videoStreams, audioTracks } = await window.electron.getVideoStreams(video.id);
            
            // Get the best quality video stream
            videoStream = videoStreams.reduce((best, current) => {
              if (!best) return current;
              if (!current.height || !best.height) return best;
              return current.height > best.height ? current : best;
            });

            // Only get audio track if available
            if (audioTracks.length > 0) {
              audioTrack = audioTracks.reduce((best, current) => {
                if (!best) return current;
                if (!current.bitrate || !best.bitrate) return best;
                return current.bitrate > best.bitrate ? current : best;
              });
            }

            console.log('Selected video stream:', videoStream);
            if (audioTrack) {
              console.log('Selected audio track:', audioTrack);
            } else {
              console.log('No audio track selected - video only mode');
            }
          }

          if (!videoStream?.url) {
            throw new Error('No video stream URL available');
          }

          // For video-only entries, we can use direct playback
          if (!audioTrack) {
            console.log('Using direct playback for video-only stream');
            if (videoRef.current) {
              videoRef.current.src = videoStream.url;
              setIsLoading(false);
            }
            return;
          }

          // For videos with both video and audio, use MediaSource
          const mediaSource = new MediaSource();
          const videoUrl = URL.createObjectURL(mediaSource);
          if (videoRef.current) {
            videoRef.current.src = videoUrl;
          }

          mediaSource.addEventListener('sourceopen', async () => {
            try {
              // Determine the correct MIME type and codec
              const videoMimeType = videoStream.mimeType.includes('webm') 
                ? 'video/webm; codecs="vp8"' 
                : 'video/mp4; codecs="avc1.42E01E"';
              
              const audioMimeType = audioTrack.mimeType.includes('webm')
                ? 'audio/webm; codecs="opus"'
                : 'audio/mp4; codecs="mp4a.40.2"';

              console.log('Using MIME types:', { videoMimeType, audioMimeType });

              // Create source buffers for video and audio
              const videoBuffer = mediaSource.addSourceBuffer(videoMimeType);
              const audioBuffer = mediaSource.addSourceBuffer(audioMimeType);

              // Fetch video and audio data
              const videoResponse = await fetch(videoStream.url);
              const audioResponse = await fetch(audioTrack.url);

              if (!videoResponse.ok || !audioResponse.ok) {
                throw new Error('Failed to fetch video or audio data');
              }

              const videoData = await videoResponse.arrayBuffer();
              const audioData = await audioResponse.arrayBuffer();

              // Append video and audio data to their respective buffers
              videoBuffer.addEventListener('updateend', () => {
                if (!videoBuffer.updating && mediaSource.readyState === 'open') {
                  mediaSource.endOfStream();
                }
              });

              audioBuffer.addEventListener('updateend', () => {
                if (!audioBuffer.updating && mediaSource.readyState === 'open') {
                  mediaSource.endOfStream();
                }
              });

              videoBuffer.appendBuffer(videoData);
              audioBuffer.appendBuffer(audioData);
            } catch (error) {
              console.error('Error setting up MediaSource:', error);
              setError('Failed to set up video playback');
            }
          });

          setIsLoading(false);
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
        <button
          onClick={() => navigate(-1)}
          className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          ← Back
        </button>
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
        <div className="w-full max-w-4xl">
          <video
            ref={videoRef}
            className="w-full"
            controls
            autoPlay
            playsInline
            onError={(e) => {
              console.error('Video error:', e);
              setError('Failed to play video - the stream may have expired');
              setIsLoading(false);
            }}
            onLoadedData={() => {
              console.log('Video loaded successfully');
              setIsLoading(false);
            }}
          />
        </div>
      </div>
    </div>
  );
}; 