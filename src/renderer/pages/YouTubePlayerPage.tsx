import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { YouTubeIframePlayer } from '../services/youtubeIframe';

const PLAYER_CONTAINER_ID = 'youtube-player-container';

interface YouTubePlayerPageProps {
  videoId?: string;
}

export const YouTubePlayerPage: React.FC<YouTubePlayerPageProps> = ({ videoId = '' }) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubeIframePlayer | null>(null);

  useEffect(() => {
    if (containerRef.current && videoId) {
      console.log('[YouTubePlayerPage] containerRef ready for player mount:', containerRef.current);
      playerRef.current = new YouTubeIframePlayer(PLAYER_CONTAINER_ID);
      playerRef.current.mount(videoId, {
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          modestbranding: 1,
          rel: 0,
          controls: 1,
          showinfo: 1,
          fs: 1,
        },
      });
      console.log('[YouTubePlayerPage] YouTubeIframePlayer mounted');
    }
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
        console.log('[YouTubePlayerPage] YouTubeIframePlayer destroyed');
      }
    };
  }, [videoId]);

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-gray-100">
      <div className="p-4 w-full max-w-4xl">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold mb-4">YouTube Player Page (React)</h1>
        <div ref={containerRef} id={PLAYER_CONTAINER_ID} className="w-full max-w-2xl aspect-video bg-black mx-auto">
          {/* Custom player will be mounted here */}
        </div>
      </div>
    </div>
  );
}; 