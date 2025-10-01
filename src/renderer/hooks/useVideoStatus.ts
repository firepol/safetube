import { useState, useEffect } from 'react';

interface WatchedVideo {
  videoId: string;
  position: number;
  lastWatched: string;
  timeWatched: number;
  duration?: number;
  watched?: boolean;
}

interface VideoStatus {
  isWatched: boolean;
  isClicked: boolean;
}

/**
 * Custom hook for managing video status (watched/clicked) across the application.
 * Centralizes the logic for determining if a video has been watched or clicked.
 */
export const useVideoStatus = () => {
  const [watchedVideos, setWatchedVideos] = useState<WatchedVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load watched videos data on mount
  useEffect(() => {
    const loadWatchedVideos = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const watchedData = await (window as any).electron.getWatchedVideos();
        setWatchedVideos(watchedData || []);
      } catch (err) {
        console.error('Error loading watched videos:', err);
        setError('Failed to load watched videos');
        setWatchedVideos([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadWatchedVideos();
  }, []);

  /**
   * Get the watch status for a specific video
   * @param videoId - The ID of the video to check
   * @returns Object with isWatched and isClicked status
   */
  const getVideoStatus = (videoId: string): VideoStatus => {
    const watchedData = watchedVideos.find(w => w.videoId === videoId);

    if (!watchedData) {
      return { isWatched: false, isClicked: false };
    }

    return {
      isWatched: !!watchedData.watched, // Convert to boolean (handles both 1/0 and true/false)
      isClicked: true // If it's in watched.json, it was clicked
    };
  };

  /**
   * Get watch statuses for multiple videos at once
   * @param videoIds - Array of video IDs to check
   * @returns Map of videoId to VideoStatus
   */
  const getMultipleVideoStatuses = (videoIds: string[]): Map<string, VideoStatus> => {
    const statusMap = new Map<string, VideoStatus>();

    for (const videoId of videoIds) {
      statusMap.set(videoId, getVideoStatus(videoId));
    }

    return statusMap;
  };

  /**
   * Refresh the watched videos data
   */
  const refreshWatchedVideos = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const watchedData = await (window as any).electron.getWatchedVideos();
      setWatchedVideos(watchedData || []);
    } catch (err) {
      console.error('Error refreshing watched videos:', err);
      setError('Failed to refresh watched videos');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    // Data
    watchedVideos,
    isLoading,
    error,

    // Functions
    getVideoStatus,
    getMultipleVideoStatuses,
    refreshWatchedVideos
  };
};