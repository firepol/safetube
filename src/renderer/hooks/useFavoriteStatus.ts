import { useState, useEffect, useCallback } from 'react';

interface FavoriteVideo {
  videoId: string;
  sourceType: 'youtube' | 'local' | 'dlna' | 'downloaded';
  title: string;
  thumbnail: string;
  duration: number;
  dateAdded: string;
}

/**
 * Simple hook for managing favorite status - similar to useVideoStatus
 * Loads favorites once and provides simple check function
 */
export const useFavoriteStatus = () => {
  const [favoriteVideos, setFavoriteVideos] = useState<FavoriteVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load favorite videos data on mount - memoized to prevent recreation
  const loadFavorites = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const favoriteData = await (window as any).electron.favoritesGetAll();
      setFavoriteVideos(favoriteData || []);
    } catch (err) {
      console.error('Error loading favorite videos:', err);
      setError('Failed to load favorite videos');
      setFavoriteVideos([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  /**
   * Check if a video is favorited - memoized to prevent infinite loops
   * @param videoId - The ID of the video to check
   * @returns boolean indicating if video is favorited
   */
  const isFavorite = useCallback((videoId: string, videoType?: 'youtube' | 'local' | 'dlna' | 'downloaded'): boolean => {
    // Try exact match first
    let result = favoriteVideos.some(f => f.videoId === videoId);

    // If no exact match and we have a video type, try with normalized ID
    if (!result && videoType && videoType !== 'youtube') {
      const normalizedId = videoType + ':' + videoId;
      result = favoriteVideos.some(f => f.videoId === normalizedId);
    }

    // Also try without prefix for already prefixed IDs
    if (!result && videoId.includes(':')) {
      const withoutPrefix = videoId.substring(videoId.indexOf(':') + 1);
      result = favoriteVideos.some(f => f.videoId === withoutPrefix);
    }

    return result;
  }, [favoriteVideos]);

  /**
   * Reload favorites from storage (call after making changes)
   */
  const refreshFavorites = useCallback(() => {
    loadFavorites();
  }, [loadFavorites]);

  return {
    favoriteVideos,
    isLoading,
    error,
    isFavorite,
    refreshFavorites
  };
};