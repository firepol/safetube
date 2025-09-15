import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PlayerPage } from './PlayerPage';
import { YouTubePlayerPage } from './YouTubePlayerPage';
import { loadPlayerConfig } from '../services/playerConfig';
import type { YouTubePlayerType } from '../types/playerConfig';
import { logVerbose } from '../lib/logging';

export const PlayerRouter: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  // URL decode the video ID since it was encoded when creating navigation links
  const videoId = id ? decodeURIComponent(id) : id;
  const [, setPlayerType] = useState<YouTubePlayerType>('mediasource');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<React.ReactNode | null>(null);
  
  logVerbose('[PlayerRouter] Component rendered with id:', id, 'videoId:', videoId);

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
          logVerbose('[PlayerRouter] Video data loaded:', { 
            id: video?.id, 
            type: video?.type, 
            title: video?.title 
          });
        } catch (error) {
          console.error('[PlayerRouter] Error getting video data:', error);
          setSelectedPlayer(<PlayerPage />);
          setIsLoading(false);
          return;
        }

        // Load configuration
        const config = await loadPlayerConfig();

        // Check for per-video override
        let finalPlayerType = config.youtubePlayerType;
        if (videoId && config.perVideoOverrides?.[videoId]) {
          finalPlayerType = config.perVideoOverrides[videoId].youtubePlayerType;
        }
        setPlayerType(finalPlayerType);

        // Route to appropriate player based on video type and config
        logVerbose('[PlayerRouter] Routing decision:', { 
          videoType: video?.type, 
          finalPlayerType, 
          isYouTube: video?.type === 'youtube',
          shouldUseIframe: finalPlayerType === 'iframe'
        });
        
        if (video && video.type === 'youtube' && finalPlayerType === 'iframe') {
          logVerbose('[PlayerRouter] Using YouTubePlayerPage (iframe)');
          setSelectedPlayer(<YouTubePlayerPage />);
        } else if (video && (video.type === 'local' || video.type === 'dlna')) {
          logVerbose('[PlayerRouter] Using PlayerPage for local/DLNA video');
          setSelectedPlayer(<PlayerPage />);
        } else {
          logVerbose('[PlayerRouter] Using PlayerPage (mediasource)');
          setSelectedPlayer(<PlayerPage />);
        }
        
        logVerbose('[PlayerRouter] Final selected player:', selectedPlayer ? 'set' : 'not set');

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