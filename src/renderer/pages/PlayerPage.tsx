import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import videos from '../data/videos.json';

declare global {
  interface Window {
    electron: {
      getLocalFile: (filePath: string) => Promise<string>;
      getDlnaFile: (server: string, port: number, path: string) => Promise<string>;
    };
  }
}

export const PlayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const video = videos.find((v) => v.id === id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localFilePath, setLocalFilePath] = useState<string | null>(null);
  const [dlnaUrl, setDlnaUrl] = useState<string | null>(null);

  useEffect(() => {
    if (video && video.resumeAt && videoRef.current) {
      videoRef.current.currentTime = video.resumeAt;
    }
  }, [video]);

  useEffect(() => {
    const loadLocalFile = async () => {
      if (video?.type === 'local' && video.url.startsWith('file://')) {
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
      if (video?.type === 'dlna' && video.server && video.port && video.path) {
        try {
          const url = await window.electron.getDlnaFile(video.server, video.port, video.path);
          setDlnaUrl(url);
        } catch (error) {
          console.error('Error loading DLNA file:', error);
        }
      }
    };
    loadDlnaFile();
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
        {video.streamUrl ? (
          <video
            ref={videoRef}
            className="w-full h-auto max-w-3xl max-h-[80vh] bg-black rounded-lg"
            src={video.streamUrl}
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
            className="w-full h-auto max-w-3xl max-h-[80vh] bg-black rounded-lg"
            src={`file://${localFilePath}`}
            controls
            autoPlay
          />
        ) : video.type === 'dlna' && dlnaUrl ? (
          <video
            ref={videoRef}
            className="w-full h-auto max-w-3xl max-h-[80vh] bg-black rounded-lg"
            src={dlnaUrl}
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