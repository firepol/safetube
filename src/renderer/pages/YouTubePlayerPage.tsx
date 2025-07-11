import React, { useEffect, useRef, useState } from 'react';
import { YouTubeIframePlayer } from '../services/youtubeIframe';

interface YouTubePlayerPageProps {
  videoId?: string;
}

export const YouTubePlayerPage: React.FC<YouTubePlayerPageProps> = ({ videoId }) => {
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
          width: 640,
          height: 360,
          playerVars: {
            autoplay: 1,
            modestbranding: 1,
            rel: 0, // Don't show related videos from other channels
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
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Loading YouTube player...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <div id="youtube-player"></div>
    </div>
  );
}; 