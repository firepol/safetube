import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { YouTubeIframePlayer } from '../services/youtubeIframe';

interface YouTubePlayerPageProps {
  videoId?: string;
}

export const YouTubePlayerPage: React.FC<YouTubePlayerPageProps> = ({ videoId }) => {
  const navigate = useNavigate();
  const playerRef = useRef<YouTubeIframePlayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!videoId) {
      setError('No video ID provided');
      setIsLoading(false);
      return;
    }

    const mountPlayer = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        playerRef.current = new YouTubeIframePlayer('youtube-player');
        await playerRef.current.mount(videoId, {
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            modestbranding: 1,
            rel: 0, // Don't show related videos from other channels
            controls: 1,
            showinfo: 1,
            fs: 1, // Allow fullscreen
          },
        });
        
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load video');
        setIsLoading(false);
      }
    };

    mountPlayer();

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black">
        <button 
          onClick={() => navigate('/')}
          className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          ← Back to Videos
        </button>
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black">
        <button 
          onClick={() => navigate('/')}
          className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          ← Back to Videos
        </button>
        <div className="text-white">Loading YouTube player...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black">
      <button 
        onClick={() => navigate('/')}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        ← Back to Videos
      </button>
      <div 
        id="youtube-player" 
        className="w-full max-w-4xl h-96"
        style={{ minHeight: '400px' }}
      ></div>
    </div>
  );
}; 