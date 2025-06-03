import React, { useState, useRef } from 'react';
import { Video } from '../types';

interface VideoPlayerProps {
  video: Video;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = async () => {
    if (videoRef.current) {
      try {
        if (video.type === 'dlna') {
          // For DLNA videos, we need to get the file URL first
          const url = new URL(video.videoUrl);
          const server = url.hostname;
          const port = parseInt(url.port);
          const path = url.pathname;
          const fileUrl = await window.electron.getDlnaFile(server, port, path);
          videoRef.current.src = fileUrl;
        } else {
          // For local files, we need to get the file URL
          const fileUrl = await window.electron.getLocalFile(video.videoUrl);
          videoRef.current.src = fileUrl;
        }
        await videoRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Error playing video:', error);
      }
    }
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          className="w-full h-full"
          data-testid="video-player"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        {!isPlaying && (
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
        )}
      </div>
      <div className="mt-4">
        <h2 className="text-xl font-bold">{video.title}</h2>
        <p className="text-gray-600 mt-2">{video.description}</p>
      </div>
    </div>
  );
}; 