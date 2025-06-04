import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import videos from '../data/videos.json';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

declare global {
  interface Window {
    electron: {
      getLocalFile: (filePath: string) => Promise<string>;
      getDlnaFile: (server: string, port: number, path: string) => Promise<string>;
    };
  }
}

// Define a Video type to avoid implicit any
interface Video {
  id: string;
  type: string;
  title: string;
  thumbnail: string;
  duration: number;
  url: string;
  streamUrl?: string;
  resumeAt?: number;
}

export const PlayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const video = videos.find((v: Video) => v.id === id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [localFilePath, setLocalFilePath] = useState<string | null>(null);
  const [dlnaUrl, setDlnaUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (video && video.resumeAt && playerRef.current) {
      playerRef.current.currentTime(video.resumeAt);
    }
  }, [video]);

  useEffect(() => {
    const loadLocalFile = async () => {
      if (video?.type === 'local' && video.url && video.url.startsWith('file://')) {
        try {
          const path = await window.electron.getLocalFile(video.url);
          setLocalFilePath(path);
        } catch (error) {
          console.error('Error loading local file:', error);
        }
      }
    };
    loadLocalFile();
  }, [video]);

  useEffect(() => {
    const loadDlnaFile = async () => {
      if (video?.type === 'dlna' && video.url) {
        try {
          setIsLoading(true);
          setError(null);
          console.log('Loading DLNA video:', video);
          const url = new URL(video.url);
          const server = url.hostname;
          const port = parseInt(url.port);
          const path = url.pathname;
          console.log('DLNA URL parts:', { server, port, path });
          const dlnaUrl = await window.electron.getDlnaFile(server, port, path);
          console.log('Received DLNA URL:', dlnaUrl);
          setDlnaUrl(dlnaUrl);
        } catch (error) {
          console.error('Error loading DLNA file:', error);
          setError(error instanceof Error ? error.message : 'Failed to load DLNA video');
        } finally {
          setIsLoading(false);
        }
      } else {
        console.log('Video not DLNA or missing URL:', video);
      }
    };
    loadDlnaFile();
  }, [video]);

  useEffect(() => {
    if (videoRef.current && (dlnaUrl || localFilePath)) {
      const options = {
        controls: true,
        autoplay: true,
        preload: 'auto',
        fluid: true,
        html5: {
          nativeVideoTracks: true,
          nativeAudioTracks: true,
          nativeTextTracks: true
        }
      };

      playerRef.current = videojs(videoRef.current, options, function onPlayerReady() {
        console.log('Player is ready');
        this.src({
          src: dlnaUrl || `file://${localFilePath}`,
          type: 'video/mp4' // Try mp4 first, video.js will try other formats if needed
        });
      });

      return () => {
        if (playerRef.current) {
          playerRef.current.dispose();
        }
      };
    }
  }, [dlnaUrl, localFilePath]);

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
          <div className="text-center text-muted-foreground">Loading video...</div>
        ) : error ? (
          <div className="text-center text-red-600">{error}</div>
        ) : video.streamUrl ? (
          <video
            ref={videoRef}
            className="video-js vjs-default-skin vjs-big-play-centered w-full h-auto max-w-3xl max-h-[80vh] bg-black rounded-lg"
            controls
            autoPlay
          />
        ) : video.type === 'youtube' ? (
          <div className="w-full max-w-2xl aspect-video">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${video.url.split('v=')[1]}`}
              title={video.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        ) : video.type === 'local' && localFilePath ? (
          <video
            ref={videoRef}
            className="video-js vjs-default-skin vjs-big-play-centered w-full h-auto max-w-3xl max-h-[80vh] bg-black rounded-lg"
            controls
            autoPlay
          />
        ) : video.type === 'dlna' && dlnaUrl ? (
          <video
            ref={videoRef}
            className="video-js vjs-default-skin vjs-big-play-centered w-full h-auto max-w-3xl max-h-[80vh] bg-black rounded-lg"
            controls
            autoPlay
          />
        ) : (
          <div className="text-center text-muted-foreground">Video type not supported yet.</div>
        )}
      </div>
    </div>
  );
}; 