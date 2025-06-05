import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import videos from '../data/videos.json';
import { YouTubeAPI } from '../services/youtube';

// Define a Video type to avoid implicit any
interface Video {
  id: string;
  type: string;
  title: string;
  thumbnail: string;
  duration: number;
  url: string;
  streamUrl?: string;
  audioStreamUrl?: string;
  resumeAt?: number;
  server?: string;
  port?: number;
  path?: string;
  preferredLanguages?: string[];
}

export const PlayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const video = videos.find((v: Video) => v.id === id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localFilePath, setLocalFilePath] = useState<string | null>(null);
  const [dlnaUrl, setDlnaUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (video && video.resumeAt && videoRef.current) {
      videoRef.current.currentTime = video.resumeAt;
    }
  }, [video]);

  useEffect(() => {
    const loadLocalFile = async () => {
      if (video?.type === 'local' && video.url) {
        try {
          const path = await window.electron.getLocalFile(video.url);
          setLocalFilePath(path);
          if (videoRef.current) {
            videoRef.current.src = path;
          }
          setIsLoading(false);
        } catch (error) {
          console.error('Error loading local file:', error);
          setError('Failed to load local file');
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
      if (video?.type === 'youtube' && video.url) {
        try {
          setIsLoading(true);
          const videoId = video.url.split('v=')[1];
          
          // If we have pre-fetched streams, use them
          if (video.streamUrl) {
            console.log('Using pre-fetched stream');
            if (videoRef.current) {
              videoRef.current.src = video.streamUrl;
            }
            setIsLoading(false);
            return;
          }

          // Otherwise fetch streams from YouTube
          console.log('Fetching streams from YouTube');
          const { videoStreams, audioTracks } = await YouTubeAPI.getVideoStreams(videoId);
          
          // Get highest quality stream with preferred language
          const preferredLanguages = video.preferredLanguages || ['en'];
          const streamInfo = YouTubeAPI.getHighestQualityStream(videoStreams, audioTracks, preferredLanguages);
          
          if (streamInfo.audioUrl) {
            // If we have separate video and audio streams, use MediaSource API
            const mediaSource = new MediaSource();
            const videoUrl = URL.createObjectURL(mediaSource);
            
            if (videoRef.current) {
              videoRef.current.src = videoUrl;
              
              mediaSource.addEventListener('sourceopen', async () => {
                try {
                  const videoBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
                  const audioBuffer = mediaSource.addSourceBuffer('audio/mp4; codecs="mp4a.40.2"');
                  
                  // Fetch video and audio data
                  if (!streamInfo.videoUrl || !streamInfo.audioUrl) {
                    throw new Error('Missing video or audio URL');
                  }

                  const [videoResponse, audioResponse] = await Promise.all([
                    fetch(streamInfo.videoUrl),
                    fetch(streamInfo.audioUrl)
                  ]);
                  
                  const [videoData, audioData] = await Promise.all([
                    videoResponse.arrayBuffer(),
                    audioResponse.arrayBuffer()
                  ]);
                  
                  // Append video and audio data
                  videoBuffer.appendBuffer(videoData);
                  audioBuffer.appendBuffer(audioData);
                  
                  mediaSource.endOfStream();
                } catch (error) {
                  console.error('Error setting up MediaSource:', error);
                  setError('Failed to set up video playback');
                }
              });
            }
          } else {
            // If we have a combined stream, use it directly
            if (videoRef.current && streamInfo.videoUrl) {
              videoRef.current.src = streamInfo.videoUrl;
            }
          }
        } catch (error) {
          console.error('Error loading YouTube video:', error);
          setError('Failed to load YouTube video');
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadYouTubeVideo();
  }, [video]);

  if (!video) {
    return <div className="p-8 text-center text-red-600">Video not found</div>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-background border-b">
        <button
          className="rounded bg-muted px-3 py-1 text-sm hover:bg-muted-foreground/10"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button><>&nbsp;</>
        <span className="text-sm text-muted-foreground">
          {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
        </span>
        <span className="text-base font-medium truncate" title={video.title}>
          - {video.title}
        </span>
      </div>
      {/* Video area */}
      <div className="flex-1 flex items-center justify-center bg-black">
        {isLoading ? (
          <div className="text-center text-muted-foreground">
            Loading video...
          </div>
        ) : error ? (
          <div className="text-center text-red-600">
            {error}
          </div>
        ) : (
          <video
            ref={videoRef}
            className="w-full h-auto max-w-3xl max-h-[80vh] bg-black rounded-lg"
            controls
            autoPlay
          />
        )}
      </div>
    </div>
  );
}; 