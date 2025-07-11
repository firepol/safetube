import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PlayerPage } from './PlayerPage';
import { YouTubePlayerPage } from './YouTubePlayerPage';
import { loadPlayerConfig } from '../services/playerConfig';
import type { YouTubePlayerType } from '../types/playerConfig';

export const PlayerRouter: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const videoId = id;
  const [playerType, setPlayerType] = useState<YouTubePlayerType>('mediasource');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const determinePlayerType = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load configuration
        const config = loadPlayerConfig();
        
        // Check for per-video override
        if (videoId && config.perVideoOverrides?.[videoId]) {
          setPlayerType(config.perVideoOverrides[videoId].youtubePlayerType);
        } else {
          setPlayerType(config.youtubePlayerType);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load player config:', err);
        setError('Failed to load player configuration');
        setPlayerType('mediasource'); // Fallback to MediaSource
        setIsLoading(false);
      }
    };

    determinePlayerType();
  }, [videoId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Loading player...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  // Route to appropriate player
  if (playerType === 'iframe' && videoId) {
    return <YouTubePlayerPage videoId={videoId} />;
  }

  // Default to MediaSource player (existing PlayerPage)
  // PlayerPage gets video ID from URL params, so we need to navigate to it
  // For now, we'll need to handle this differently - the router should be used
  // at a higher level where we can control the routing
  return <PlayerPage />;
}; 