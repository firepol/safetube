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
      if (video?.type === 'local') {
        try {
          // Handle separate video and audio files
          if (video.video && video.audio) {
            console.log('Loading split local files:', { video: video.video, audio: video.audio });
            
            // Get video file URL
            const videoPath = await window.electron.getLocalFile(video.video);
            console.log('Received video file path:', videoPath);
            
            // Get audio file URL
            const audioPath = await window.electron.getLocalFile(video.audio);
            console.log('Received audio file path:', audioPath);

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
                console.log('Video metadata loaded');
              });

              audioElement.addEventListener('loadedmetadata', () => {
                console.log('Audio metadata loaded');
              });

              videoRef.current.addEventListener('loadeddata', () => {
                console.log('Video data loaded');
              });

              audioElement.addEventListener('loadeddata', () => {
                console.log('Audio data loaded');
              });

              videoRef.current.addEventListener('canplay', () => {
                console.log('Video can play');
                setIsLoading(false);
              });

              // Clean up audio element when component unmounts
              return () => {
                audioElement.remove();
              };
            }
          } else if (video.url) {
            // Handle single file
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
            
            // Log available audio tracks
            console.log('Available audio tracks:', audioTracks.map(t => ({
              language: t.language,
              mimeType: t.mimeType,
              bitrate: t.bitrate,
              url: t.url.substring(0, 50) + '...'
            })));
            
            // Use the proper stream selection functions
            const highestQuality = YouTubeAPI.getHighestQualityStream(videoStreams, audioTracks, video.preferredLanguages);
            console.log('Highest quality stream result:', {
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
              console.log('Selected audio track:', {
                ...audioTrack,
                url: audioTrack.url.substring(0, 50) + '...'
              });
            } else {
              console.log('No audio track selected - video only mode. Audio tracks were available:', audioTracks.length > 0);
            }

            console.log('Selected video stream:', videoStream);
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
              
              const audioMimeType = audioTrack.mimeType === 'webm'
                ? 'audio/webm; codecs="opus"'
                : 'audio/mp4; codecs="mp4a.40.2"';

              console.log('Using MIME types:', { videoMimeType, audioMimeType });

              // Create source buffers for video and audio
              const videoBuffer = mediaSource.addSourceBuffer(videoMimeType);
              console.log('Created video source buffer');
              
              const audioBuffer = mediaSource.addSourceBuffer(audioMimeType);
              console.log('Created audio source buffer');

              // Fetch video and audio data
              console.log('Fetching video data from:', videoStream.url.substring(0, 50) + '...');
              const videoResponse = await fetch(videoStream.url);
              console.log('Video response status:', videoResponse.status);
              
              console.log('Fetching audio data from:', audioTrack.url.substring(0, 50) + '...');
              const audioResponse = await fetch(audioTrack.url);
              console.log('Audio response status:', audioResponse.status);

              if (!videoResponse.ok || !audioResponse.ok) {
                throw new Error(`Failed to fetch video or audio data: video=${videoResponse.status}, audio=${audioResponse.status}`);
              }

              const videoData = await videoResponse.arrayBuffer();
              console.log('Video data size:', videoData.byteLength);
              
              const audioData = await audioResponse.arrayBuffer();
              console.log('Audio data size:', audioData.byteLength);

              // Append video and audio data to their respective buffers
              videoBuffer.addEventListener('updateend', () => {
                console.log('Video buffer update ended');
                if (!videoBuffer.updating && mediaSource.readyState === 'open') {
                  mediaSource.endOfStream();
                }
              });

              audioBuffer.addEventListener('updateend', () => {
                console.log('Audio buffer update ended');
                if (!audioBuffer.updating && mediaSource.readyState === 'open') {
                  mediaSource.endOfStream();
                }
              });

              console.log('Appending video buffer...');
              videoBuffer.appendBuffer(videoData);
              console.log('Appending audio buffer...');
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