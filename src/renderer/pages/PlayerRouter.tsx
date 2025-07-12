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
  const [selectedPlayer, setSelectedPlayer] = useState<React.ReactNode | null>(null);

  useEffect(() => {
    const determinePlayerType = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load configuration
        const config = await loadPlayerConfig();
        
        // Check for per-video override
        if (videoId && config.perVideoOverrides?.[videoId]) {
          setPlayerType(config.perVideoOverrides[videoId].youtubePlayerType);
        } else {
          setPlayerType(config.youtubePlayerType);
        }

        // Route to appropriate player
        if (config.youtubePlayerType === 'iframe' && videoId) {
          try {
            const video = await window.electron.getVideoData(videoId);
            
            if (video && video.type === 'youtube') {
              console.log('[PlayerRouter] YouTube video, using iframe player');
              setSelectedPlayer(<YouTubePlayerPage videoId={videoId} />);
            } else {
              console.log('[PlayerRouter] Non-YouTube video, using MediaSource player');
              setSelectedPlayer(<PlayerPage />);
            }
          } catch (error) {
            console.error('[PlayerRouter] Error getting video data:', error);
            setSelectedPlayer(<PlayerPage />);
          }
        } else {
          setSelectedPlayer(<PlayerPage />);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load player config:', err);
        setError('Failed to load player configuration');
        setPlayerType('mediasource'); // Fallback to MediaSource
        setSelectedPlayer(<PlayerPage />);
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

  return selectedPlayer || <PlayerPage />;
}; 