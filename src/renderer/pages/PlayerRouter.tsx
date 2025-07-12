import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PlayerPage } from './PlayerPage';
import { YouTubePlayerPage } from './YouTubePlayerPage';
import { loadPlayerConfig } from '../services/playerConfig';
import type { YouTubePlayerType } from '../types/playerConfig';

export const PlayerRouter: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const videoId = id;
  const [, setPlayerType] = useState<YouTubePlayerType>('mediasource');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<React.ReactNode | null>(null);

  useEffect(() => {
    const determinePlayerType = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Wait for electron API to be available (robust retry)
        let retries = 0;
        const maxRetries = 30;
        while ((!window.electron || !window.electron.getVideoData) && retries < maxRetries) {
          if (retries === 0) {
            console.warn('[PlayerRouter] Waiting for window.electron.getVideoData to be available...');
          }
          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
        }
        if (!window.electron || !window.electron.getVideoData) {
          console.error('[PlayerRouter] window.electron.getVideoData is not available after retries');
          setSelectedPlayer(<PlayerPage />);
          setIsLoading(false);
          return;
        }

        // Fetch video data first
        if (!videoId) {
          throw new Error('No video ID provided');
        }
        let video = null;
        try {
          video = await window.electron.getVideoData(videoId);
          console.log('[PlayerRouter] Video data:', video);
        } catch (error) {
          console.error('[PlayerRouter] Error getting video data:', error);
          setSelectedPlayer(<PlayerPage />);
          setIsLoading(false);
          return;
        }

        // Load configuration
        const config = await loadPlayerConfig();
        console.log('[PlayerRouter] Config loaded:', config);

        // Check for per-video override
        let finalPlayerType = config.youtubePlayerType;
        if (videoId && config.perVideoOverrides?.[videoId]) {
          finalPlayerType = config.perVideoOverrides[videoId].youtubePlayerType;
          console.log('[PlayerRouter] Using per-video override:', finalPlayerType);
        }
        setPlayerType(finalPlayerType);

        // Route to appropriate player based on video type and config
        if (video && video.type === 'youtube' && finalPlayerType === 'iframe') {
          console.log('[PlayerRouter] YouTube video with iframe config, using YouTube iframe player');
          setSelectedPlayer(<YouTubePlayerPage videoId={videoId} />);
          console.log('[PlayerRouter] Set YouTube iframe player component');
        } else {
          console.log('[PlayerRouter] Using MediaSource player (video type:', video?.type, ', config type:', finalPlayerType, ')');
          setSelectedPlayer(<PlayerPage />);
          console.log('[PlayerRouter] Set MediaSource player component');
        }

        console.log('[PlayerRouter] Setting isLoading to false');
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load player config or video data:', err);
        setError('Failed to load player configuration or video data');
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