import { useState, useCallback, useEffect } from 'react';
import { DatabaseClient } from '../services/DatabaseClient';

/**
 * Database hook for managing SQLite database operations in React components
 *
 * This hook provides a React-friendly interface to the database operations,
 * including state management, loading states, and error handling.
 */
export const useDatabase = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isHealthy, setIsHealthy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check database health on mount
  useEffect(() => {
    checkHealth();
  }, []);

  /**
   * Check database health and connection status
   */
  const checkHealth = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const healthResult = await DatabaseClient.healthCheck();

      if (healthResult?.isHealthy) {
        setIsHealthy(true);
        setIsInitialized(true);
      } else {
        setIsHealthy(false);
        setError('Database health check failed');
      }
    } catch (err) {
      setIsHealthy(false);
      setError('Failed to connect to database');
      console.error('Database health check error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Execute Phase 1 migration
   */
  const migratePhase1 = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await DatabaseClient.migratePhase1();

      if (result) {
        // After successful migration, check health again
        await checkHealth();
        return result;
      } else {
        throw new Error('Migration failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Migration failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [checkHealth]);

  /**
   * Verify migration integrity
   */
  const verifyMigration = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await DatabaseClient.verifyMigration();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Verification failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    // State
    isInitialized,
    isHealthy,
    isLoading,
    error,

    // Actions
    checkHealth,
    migratePhase1,
    verifyMigration,
  };
};

/**
 * Hook for video-related database operations
 */
export const useDatabaseVideos = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Search videos by title and description
   */
  const searchVideos = useCallback(async (query: string, sourceId?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const results = await DatabaseClient.searchVideos(query, sourceId);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      console.error('Video search error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get videos by source
   */
  const getVideosBySource = useCallback(async (sourceId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const videos = await DatabaseClient.getVideosBySource(sourceId);
      return videos;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get videos';
      setError(errorMessage);
      console.error('Get videos by source error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get single video by ID
   */
  const getVideoById = useCallback(async (videoId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const video = await DatabaseClient.getVideoById(videoId);
      return video;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get video';
      setError(errorMessage);
      console.error('Get video by ID error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update video metadata
   */
  const updateVideoMetadata = useCallback(async (videoId: string, metadata: any) => {
    try {
      setIsLoading(true);
      setError(null);

      const success = await DatabaseClient.updateVideoMetadata(videoId, metadata);
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update video';
      setError(errorMessage);
      console.error('Update video metadata error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    // State
    isLoading,
    error,

    // Actions
    searchVideos,
    getVideosBySource,
    getVideoById,
    updateVideoMetadata,
  };
};

/**
 * Hook for favorites-related database operations
 */
export const useDatabaseFavorites = () => {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load all favorites
   */
  const loadFavorites = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const favoritesData = await DatabaseClient.getFavorites();
      setFavorites(favoritesData);
      return favoritesData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load favorites';
      setError(errorMessage);
      console.error('Load favorites error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Check if video is favorite
   */
  const isFavorite = useCallback(async (videoId: string) => {
    try {
      const result = await DatabaseClient.isFavorite(videoId);
      return result;
    } catch (err) {
      console.error('Check favorite status error:', err);
      return false;
    }
  }, []);

  /**
   * Toggle favorite status
   */
  const toggleFavorite = useCallback(async (videoId: string, sourceId: string) => {
    try {
      setError(null);

      const result = await DatabaseClient.toggleFavorite(videoId, sourceId);

      if (result) {
        // Refresh favorites list after toggle
        await loadFavorites();
        return result.isFavorite;
      }

      return false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle favorite';
      setError(errorMessage);
      console.error('Toggle favorite error:', err);
      return false;
    }
  }, [loadFavorites]);

  /**
   * Add video to favorites
   */
  const addFavorite = useCallback(async (videoId: string, sourceId: string) => {
    try {
      setError(null);

      const success = await DatabaseClient.addFavorite(videoId, sourceId);

      if (success) {
        await loadFavorites();
      }

      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add favorite';
      setError(errorMessage);
      console.error('Add favorite error:', err);
      return false;
    }
  }, [loadFavorites]);

  /**
   * Remove video from favorites
   */
  const removeFavorite = useCallback(async (videoId: string) => {
    try {
      setError(null);

      const success = await DatabaseClient.removeFavorite(videoId);

      if (success) {
        await loadFavorites();
      }

      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove favorite';
      setError(errorMessage);
      console.error('Remove favorite error:', err);
      return false;
    }
  }, [loadFavorites]);

  // Load favorites on mount
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  return {
    // State
    favorites,
    isLoading,
    error,

    // Actions
    loadFavorites,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
  };
};

/**
 * Hook for viewing history database operations
 */
export const useDatabaseHistory = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [recentlyWatched, setRecentlyWatched] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load viewing history
   */
  const loadHistory = useCallback(async (limit: number = 50) => {
    try {
      setIsLoading(true);
      setError(null);

      const historyData = await DatabaseClient.getViewingHistory(limit);
      setHistory(historyData);
      return historyData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load history';
      setError(errorMessage);
      console.error('Load history error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load recently watched videos
   */
  const loadRecentlyWatched = useCallback(async (limit: number = 20) => {
    try {
      setIsLoading(true);
      setError(null);

      const recentData = await DatabaseClient.getRecentlyWatched(limit);
      setRecentlyWatched(recentData);
      return recentData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load recently watched';
      setError(errorMessage);
      console.error('Load recently watched error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update view record for video
   */
  const updateViewRecord = useCallback(async (videoId: string, update: any) => {
    try {
      setError(null);

      const success = await DatabaseClient.updateViewRecord(videoId, update);
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update view record';
      setError(errorMessage);
      console.error('Update view record error:', err);
      return false;
    }
  }, []);

  /**
   * Get view record for specific video
   */
  const getViewRecord = useCallback(async (videoId: string) => {
    try {
      setError(null);

      const record = await DatabaseClient.getViewRecord(videoId);
      return record;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get view record';
      setError(errorMessage);
      console.error('Get view record error:', err);
      return null;
    }
  }, []);

  return {
    // State
    history,
    recentlyWatched,
    isLoading,
    error,

    // Actions
    loadHistory,
    loadRecentlyWatched,
    updateViewRecord,
    getViewRecord,
  };
};

/**
 * Hook for YouTube cache database operations
 */
export const useDatabaseCache = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get cached results for source page
   */
  const getCachedResults = useCallback(async (sourceId: string, page: number = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      const results = await DatabaseClient.getCachedResults(sourceId, page);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get cached results';
      setError(errorMessage);
      console.error('Get cached results error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Set cached results for source page
   */
  const setCachedResults = useCallback(async (sourceId: string, page: number, videoIds: string[]) => {
    try {
      setIsLoading(true);
      setError(null);

      const success = await DatabaseClient.setCachedResults(sourceId, page, videoIds);
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cache results';
      setError(errorMessage);
      console.error('Set cached results error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear cache for source (reset functionality)
   */
  const clearCache = useCallback(async (sourceId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const success = await DatabaseClient.clearCache(sourceId);
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear cache';
      setError(errorMessage);
      console.error('Clear cache error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    // State
    isLoading,
    error,

    // Actions
    getCachedResults,
    setCachedResults,
    clearCache,
  };
};

export default useDatabase;