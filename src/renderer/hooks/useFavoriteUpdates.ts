import { useState, useEffect, useCallback } from 'react';
import { FavoritesService } from '../services/favoritesService';
import { FavoritesSyncService, FavoriteSyncEvent } from '../services/favoritesSyncService';
import { logVerbose } from '../lib/logging';

export interface FavoriteUpdate {
  videoId: string;
  isFavorite: boolean;
  timestamp: number;
}

export interface UseFavoriteUpdatesOptions {
  onFavoriteUpdate?: (videoId: string, isFavorite: boolean) => void;
  autoSync?: boolean; // Whether to automatically sync on mount
  enableRealTimeSync?: boolean; // Whether to enable real-time synchronization
}

/**
 * Hook for managing real-time favorite status updates across components
 * Enhanced with cross-player synchronization support
 */
export function useFavoriteUpdates(options: UseFavoriteUpdatesOptions = {}) {
  const [favoriteUpdates, setFavoriteUpdates] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [syncEnabled] = useState(options.enableRealTimeSync !== false);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);

  // Bulk load favorite statuses for multiple videos
  const loadFavoriteStatuses = useCallback(async (videoIds: string[]) => {
    if (videoIds.length === 0) return;

    try {
      setIsLoading(true);
      logVerbose('[useFavoriteUpdates] Loading favorite statuses for', videoIds.length, 'videos');

      const statusMap = await FavoritesService.getFavoritesStatus(videoIds);

      // Update local state
      setFavoriteUpdates(prev => {
        const newUpdates = { ...prev };
        statusMap.forEach((isFavorite, videoId) => {
          newUpdates[videoId] = isFavorite;
        });
        return newUpdates;
      });

      // Call callback for each update
      if (options.onFavoriteUpdate) {
        statusMap.forEach((isFavorite, videoId) => {
          options.onFavoriteUpdate!(videoId, isFavorite);
        });
      }

      logVerbose('[useFavoriteUpdates] Loaded favorite statuses:', Object.fromEntries(statusMap));
    } catch (error) {
      logVerbose('[useFavoriteUpdates] Error loading favorite statuses:', error);
    } finally {
      setIsLoading(false);
    }
  }, [options.onFavoriteUpdate]);

  // Update single favorite status
  const updateFavoriteStatus = useCallback((videoId: string, isFavorite: boolean) => {
    logVerbose('[useFavoriteUpdates] Updating favorite status:', videoId, '->', isFavorite);

    setFavoriteUpdates(prev => ({
      ...prev,
      [videoId]: isFavorite
    }));

    // Call optional callback
    if (options.onFavoriteUpdate) {
      options.onFavoriteUpdate(videoId, isFavorite);
    }
  }, [options.onFavoriteUpdate]);

  // Clear all updates (useful for component unmount or reset)
  const clearFavoriteUpdates = useCallback(() => {
    logVerbose('[useFavoriteUpdates] Clearing favorite updates');
    setFavoriteUpdates({});
  }, []);

  // Get favorite status for a specific video
  const getFavoriteStatus = useCallback((videoId: string): boolean | undefined => {
    return favoriteUpdates[videoId];
  }, [favoriteUpdates]);

  // Check if we have favorite status for a video
  const hasFavoriteStatus = useCallback((videoId: string): boolean => {
    return videoId in favoriteUpdates;
  }, [favoriteUpdates]);

  // Sync favorite statuses from cache (useful for initial load)
  const syncFromCache = useCallback(async () => {
    try {
      setIsLoading(true);
      logVerbose('[useFavoriteUpdates] Syncing from favorites cache');

      // Preload the favorites cache
      await FavoritesService.preloadFavoritesStatus();

      logVerbose('[useFavoriteUpdates] Cache sync completed');
    } catch (error) {
      logVerbose('[useFavoriteUpdates] Error syncing from cache:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle real-time sync events (only set up once per component)
  useEffect(() => {
    if (!syncEnabled) return;

    logVerbose('[useFavoriteUpdates] Setting up real-time sync listener');

    const unsubscribe = FavoritesSyncService.subscribe((event: FavoriteSyncEvent) => {
      // Only log for actual user actions, not bulk loads
      if (event.source !== 'bulk-load') {
        logVerbose('[useFavoriteUpdates] Received sync event:', {
          videoId: event.videoId,
          isFavorite: event.isFavorite
        });
      }

      // Update local state
      setFavoriteUpdates(prev => ({
        ...prev,
        [event.videoId]: event.isFavorite
      }));

      // Call callback if provided (but not for bulk loads to prevent loops)
      if (options.onFavoriteUpdate && event.source !== 'bulk-load') {
        options.onFavoriteUpdate(event.videoId, event.isFavorite);
      }
    });

    return () => {
      logVerbose('[useFavoriteUpdates] Cleaning up real-time sync listener');
      unsubscribe();
    };
  }, [syncEnabled, options.onFavoriteUpdate]); // Keep callback in deps for proper updates

  // Auto-sync on mount if enabled
  useEffect(() => {
    if (options.autoSync) {
      syncFromCache();
    }
  }, [options.autoSync, syncFromCache]);

  // Toggle favorite with automatic synchronization
  const toggleFavoriteWithSync = useCallback(async (
    videoId: string,
    source: string,
    type: 'youtube' | 'local' | 'dlna',
    title: string,
    thumbnail: string,
    duration: number,
    lastWatched?: string
  ) => {
    return FavoritesSyncService.toggleFavoriteWithSync(
      videoId, source, type, title, thumbnail, duration, lastWatched
    );
  }, []);

  // Load statuses with synchronization (but without broadcasting to prevent loops)
  const loadFavoriteStatusesWithSync = useCallback(async (videoIds: string[]) => {
    if (videoIds.length === 0 || isLoadingStatuses) return new Map();

    try {
      setIsLoadingStatuses(true);

      // Debug logging for YouTube video IDs
      const youtubeIds = videoIds.filter(id => !id.startsWith('local:'));
      if (youtubeIds.length > 0) {
        logVerbose('[useFavoriteUpdates] Loading favorite statuses for YouTube videos:', youtubeIds);
      }

      if (syncEnabled) {
        // Use the sync service for loading but don't broadcast to prevent infinite loops
        const statusMap = await FavoritesSyncService.loadAndSyncStatuses(videoIds);

        // Debug logging for YouTube video status results
        if (youtubeIds.length > 0) {
          const youtubeStatuses = Object.fromEntries(
            youtubeIds.map(id => [id, statusMap.get(id) || false])
          );
          logVerbose('[useFavoriteUpdates] YouTube video favorite statuses loaded:', youtubeStatuses);
        }

        // Update local state without triggering callbacks
        setFavoriteUpdates(prev => {
          const newUpdates = { ...prev };
          statusMap.forEach((isFavorite, videoId) => {
            newUpdates[videoId] = isFavorite;
          });
          return newUpdates;
        });

        return statusMap;
      } else {
        return loadFavoriteStatuses(videoIds);
      }
    } finally {
      setIsLoadingStatuses(false);
    }
  }, [syncEnabled, loadFavoriteStatuses, isLoadingStatuses]);

  return {
    favoriteUpdates,
    isLoading,
    loadFavoriteStatuses,
    loadFavoriteStatusesWithSync,
    updateFavoriteStatus,
    clearFavoriteUpdates,
    getFavoriteStatus,
    hasFavoriteStatus,
    syncFromCache,
    toggleFavoriteWithSync,
    syncEnabled
  };
}