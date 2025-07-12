import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { YouTubeIframePlayer } from '../services/youtubeIframe';

interface YouTubePlayerPageProps {
  videoId?: string;
}

export const YouTubePlayerPage: React.FC<YouTubePlayerPageProps> = ({ videoId }) => {
  const navigate = useNavigate();
  const playerRef = useRef<YouTubeIframePlayer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  console.log('[YouTubePlayerPage] Component mounted with videoId:', videoId);

  const mountPlayer = async () => {
    if (!videoId) {
      console.error('[YouTubePlayerPage] No video ID provided');
      setError('No video ID provided');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('[YouTubePlayerPage] Mounting player for videoId:', videoId);

      // Create player with direct container reference
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
      console.error('[YouTubePlayerPage] Error mounting player:', err);
      setError(err instanceof Error ? err.message : 'Failed to load video');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('[YouTubePlayerPage] useEffect triggered, videoId:', videoId);
    
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId]);

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-100">
        <div className="p-4">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            ← Back
          </button>
          <div className="text-red-500">Error: {error}</div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-100">
        <div className="p-4">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            ← Back
          </button>
          <div className="text-lg mb-2">Loading YouTube player...</div>
        </div>
      </div>
    );
  }

  console.log('[YouTubePlayerPage] Rendering component. isLoading:', isLoading, 'error:', error);
  console.log('[YouTubePlayerPage] About to render container div');

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <div className="p-4">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          ← Back
        </button>
      </div>
      <div className="flex-grow flex items-center justify-center p-4 relative">
        <div className="w-full max-w-4xl relative">
          {/* Always render the player container */}
          <div 
            id="youtube-player"
            className="w-full h-96"
            style={{ minHeight: '400px' }}
            ref={(el) => {
              console.log('[YouTubePlayerPage] *** REF CALLBACK FIRED ***', el);
              containerRef.current = el;
              if (el) {
                console.log('[YouTubePlayerPage] Container element ID:', el.id);
                console.log('[YouTubePlayerPage] Container element in DOM:', document.getElementById('youtube-player'));
                // Mount the player when the container is available
                mountPlayer();
              } else {
                console.log('[YouTubePlayerPage] Ref callback called with null element');
              }
            }}
          ></div>
          {/* Overlay for loading (but not error, since we handle error above) */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-80 z-10">
              <div className="text-lg mb-2">Loading YouTube player...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 