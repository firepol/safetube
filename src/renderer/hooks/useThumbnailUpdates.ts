import { useEffect, useState } from 'react';

interface ThumbnailUpdate {
  videoId: string;
  thumbnailUrl: string;
}

interface UseThumbnailUpdatesOptions {
  onThumbnailUpdate?: (videoId: string, thumbnailUrl: string) => void;
}

/**
 * Hook to listen for thumbnail updates from the main process
 * and optionally call a callback when thumbnails are ready
 */
export function useThumbnailUpdates(options: UseThumbnailUpdatesOptions = {}) {
  const [thumbnailUpdates, setThumbnailUpdates] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!window.electron?.onThumbnailReady) {
      console.warn('[useThumbnailUpdates] Thumbnail ready events not available');
      return;
    }

    const handleThumbnailReady = (data: ThumbnailUpdate) => {
      console.log('[useThumbnailUpdates] Thumbnail ready for video:', data.videoId, '->', data.thumbnailUrl);

      // Update local state
      setThumbnailUpdates(prev => ({
        ...prev,
        [data.videoId]: data.thumbnailUrl
      }));

      // Call optional callback
      if (options.onThumbnailUpdate) {
        options.onThumbnailUpdate(data.videoId, data.thumbnailUrl);
      }
    };

    // Subscribe to thumbnail updates and get wrapped callback for cleanup
    const wrappedCallback = window.electron.onThumbnailReady(handleThumbnailReady);

    // Cleanup on unmount
    return () => {
      if (window.electron?.offThumbnailReady && wrappedCallback) {
        window.electron.offThumbnailReady(wrappedCallback);
      }
    };
  }, [options.onThumbnailUpdate]);

  return {
    thumbnailUpdates,
    getThumbnailForVideo: (videoId: string) => thumbnailUpdates[videoId],
    hasThumbnailUpdate: (videoId: string) => videoId in thumbnailUpdates
  };
}