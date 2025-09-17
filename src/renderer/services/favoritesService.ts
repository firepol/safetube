import { FavoriteVideo, FavoritesConfig } from '@/shared/types';
import { VideoCardBaseProps } from '../components/video/VideoCardBase';
import { logVerboseRenderer } from '@/shared/logging';


/**
 * Renderer-side favorites service with caching and optimistic updates
 */
export class FavoritesService {
  private static favoritesCache: FavoriteVideo[] | null = null;
  private static favoriteStatusCache = new Map<string, boolean>();
  private static cacheExpiry: number | null = null;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get all favorites with caching
   */
  static async getFavorites(forceRefresh: boolean = false): Promise<FavoriteVideo[]> {
    try {
      // Check cache validity
      const now = Date.now();
      if (!forceRefresh &&
          this.favoritesCache &&
          this.cacheExpiry &&
          now < this.cacheExpiry) {
        logVerboseRenderer('[FavoritesService] Returning cached favorites');
        return this.favoritesCache;
      }

      logVerboseRenderer('[FavoritesService] Fetching favorites from main process');
      const favorites = await window.electron.favoritesGetAll();

      // Update cache
      this.favoritesCache = favorites;
      this.cacheExpiry = now + this.CACHE_DURATION;

      // Update status cache
      this.favoriteStatusCache.clear();
      favorites.forEach(favorite => {
        this.favoriteStatusCache.set(favorite.videoId, true);
      });

      // Note: We don't cache false values here to avoid cache bloat
      // False values are determined by absence from the favorites list

      logVerboseRenderer('[FavoritesService] Cached', favorites.length, 'favorites');
      return favorites;
    } catch (error) {
      logVerboseRenderer('[FavoritesService] Error getting favorites:', error);
      throw error;
    }
  }

  /**
   * Add a favorite with optimistic updates
   */
  static async addFavorite(
    videoId: string,
    source: string,
    type: 'youtube' | 'local' | 'dlna',
    title: string,
    thumbnail: string,
    duration: number,
    lastWatched?: string
  ): Promise<FavoriteVideo> {
    try {
      logVerboseRenderer('[FavoritesService] Adding favorite:', { videoId, source, type, title });

      // Optimistic update
      this.favoriteStatusCache.set(videoId, true);

      const favorite = await window.electron.favoritesAdd(
        videoId, source, type, title, thumbnail, duration, lastWatched
      );

      // Update cache if present
      if (this.favoritesCache) {
        const existingIndex = this.favoritesCache.findIndex(f => f.videoId === videoId);
        if (existingIndex >= 0) {
          this.favoritesCache[existingIndex] = favorite;
        } else {
          this.favoritesCache.push(favorite);
        }
      }

      logVerboseRenderer('[FavoritesService] Successfully added favorite:', favorite.videoId);
      return favorite;
    } catch (error) {
      // Rollback optimistic update
      this.favoriteStatusCache.delete(videoId);
      logVerboseRenderer('[FavoritesService] Error adding favorite:', error);
      throw error;
    }
  }

  /**
   * Remove a favorite with optimistic updates
   */
  static async removeFavorite(videoId: string): Promise<FavoriteVideo> {
    try {
      logVerboseRenderer('[FavoritesService] Removing favorite:', videoId);

      // Store previous state for rollback
      const wasFavorite = this.favoriteStatusCache.get(videoId) || false;

      // Optimistic update
      this.favoriteStatusCache.set(videoId, false);

      const removedFavorite = await window.electron.favoritesRemove(videoId);

      // Update cache if present
      if (this.favoritesCache) {
        this.favoritesCache = this.favoritesCache.filter(f => f.videoId !== videoId);
      }

      logVerboseRenderer('[FavoritesService] Successfully removed favorite:', videoId);
      return removedFavorite;
    } catch (error) {
      // Rollback optimistic update
      this.favoriteStatusCache.set(videoId, true);
      logVerboseRenderer('[FavoritesService] Error removing favorite:', error);
      throw error;
    }
  }

  /**
   * Check if a video is favorited with caching
   */
  static async isFavorite(videoId: string): Promise<boolean> {
    try {
      // Check cache first
      if (this.favoriteStatusCache.has(videoId)) {
        const cached = this.favoriteStatusCache.get(videoId)!;
        logVerboseRenderer('[FavoritesService] Returning cached favorite status for', videoId, ':', cached);
        return cached;
      }

      // If we have a favorites cache, check if the video is in the list
      if (this.favoritesCache && this.cacheExpiry && Date.now() < this.cacheExpiry) {
        const isFav = this.favoritesCache.some(f => f.videoId === videoId);
        this.favoriteStatusCache.set(videoId, isFav);
        logVerboseRenderer('[FavoritesService] Returning cached favorite status from list for', videoId, ':', isFav);
        return isFav;
      }

      logVerboseRenderer('[FavoritesService] Checking favorite status for:', videoId);
      const isFav = await window.electron.favoritesIsFavorite(videoId);

      // Update cache
      this.favoriteStatusCache.set(videoId, isFav);

      logVerboseRenderer('[FavoritesService] Favorite status for', videoId, ':', isFav);
      return isFav;
    } catch (error) {
      logVerboseRenderer('[FavoritesService] Error checking favorite status:', error);
      return false; // Default to false on error
    }
  }

  /**
   * Toggle favorite status with optimistic updates
   */
  static async toggleFavorite(
    videoId: string,
    source: string,
    type: 'youtube' | 'local' | 'dlna',
    title: string,
    thumbnail: string,
    duration: number,
    lastWatched?: string
  ): Promise<{ favorite: FavoriteVideo | null; isFavorite: boolean }> {
    try {
      logVerboseRenderer('[FavoritesService] Toggling favorite:', { videoId, source, type, title });

      // Get current state
      const currentState = await this.isFavorite(videoId);

      // Optimistic update
      this.favoriteStatusCache.set(videoId, !currentState);

      const favorite = await window.electron.favoritesToggle(
        videoId, source, type, title, thumbnail, duration, lastWatched
      );

      const newState = !currentState;

      // Update cache based on new state
      if (this.favoritesCache) {
        if (newState) {
          // Added to favorites
          const existingIndex = this.favoritesCache.findIndex(f => f.videoId === videoId);
          if (existingIndex >= 0) {
            this.favoritesCache[existingIndex] = favorite;
          } else {
            this.favoritesCache.push(favorite);
          }
        } else {
          // Removed from favorites
          this.favoritesCache = this.favoritesCache.filter(f => f.videoId !== videoId);
        }
      }

      logVerboseRenderer('[FavoritesService] Successfully toggled favorite:', videoId, 'now', newState);
      return {
        favorite: newState ? favorite : null,
        isFavorite: newState
      };
    } catch (error) {
      // Rollback optimistic update
      const currentState = this.favoriteStatusCache.get(videoId);
      if (currentState !== undefined) {
        this.favoriteStatusCache.set(videoId, !currentState);
      }
      logVerboseRenderer('[FavoritesService] Error toggling favorite:', error);
      throw error;
    }
  }

  /**
   * Update favorite metadata
   */
  static async updateFavoriteMetadata(
    videoId: string,
    metadata: Partial<FavoriteVideo>
  ): Promise<FavoriteVideo> {
    try {
      logVerboseRenderer('[FavoritesService] Updating favorite metadata:', { videoId, metadata });

      const updatedFavorite = await window.electron.favoritesUpdateMetadata(videoId, metadata);

      // Update cache if present
      if (this.favoritesCache) {
        const index = this.favoritesCache.findIndex(f => f.videoId === videoId);
        if (index >= 0) {
          this.favoritesCache[index] = updatedFavorite;
        }
      }

      logVerboseRenderer('[FavoritesService] Successfully updated favorite metadata:', videoId);
      return updatedFavorite;
    } catch (error) {
      logVerboseRenderer('[FavoritesService] Error updating favorite metadata:', error);
      throw error;
    }
  }

  /**
   * Get favorites by source
   */
  static async getFavoritesBySource(sourceId: string): Promise<FavoriteVideo[]> {
    try {
      logVerboseRenderer('[FavoritesService] Getting favorites by source:', sourceId);
      return await window.electron.favoritesGetBySource(sourceId);
    } catch (error) {
      logVerboseRenderer('[FavoritesService] Error getting favorites by source:', error);
      throw error;
    }
  }

  /**
   * Get favorites configuration
   */
  static async getFavoritesConfig(): Promise<FavoritesConfig> {
    try {
      logVerboseRenderer('[FavoritesService] Getting favorites config');
      return await window.electron.favoritesGetConfig();
    } catch (error) {
      logVerboseRenderer('[FavoritesService] Error getting favorites config:', error);
      throw error;
    }
  }

  /**
   * Update favorites configuration
   */
  static async updateFavoritesConfig(config: Partial<FavoritesConfig>): Promise<FavoritesConfig> {
    try {
      logVerboseRenderer('[FavoritesService] Updating favorites config:', config);
      return await window.electron.favoritesUpdateConfig(config);
    } catch (error) {
      logVerboseRenderer('[FavoritesService] Error updating favorites config:', error);
      throw error;
    }
  }

  /**
   * Cleanup orphaned favorites
   */
  static async cleanupOrphanedFavorites(): Promise<FavoriteVideo[]> {
    try {
      logVerboseRenderer('[FavoritesService] Cleaning up orphaned favorites');
      const result = await window.electron.favoritesCleanupOrphaned();

      // Clear cache to force refresh
      this.clearCache();

      return result;
    } catch (error) {
      logVerboseRenderer('[FavoritesService] Error cleaning up orphaned favorites:', error);
      throw error;
    }
  }

  /**
   * Sync with watch history
   */
  static async syncWithWatchHistory(): Promise<FavoriteVideo[]> {
    try {
      logVerboseRenderer('[FavoritesService] Syncing with watch history');
      const result = await window.electron.favoritesSyncWatchHistory();

      // Clear cache to force refresh
      this.clearCache();

      return result;
    } catch (error) {
      logVerboseRenderer('[FavoritesService] Error syncing with watch history:', error);
      throw error;
    }
  }

  /**
   * Create a favorites source for the video grid system
   */
  static async getFavoritesSource(): Promise<{
    id: string;
    title: string;
    type: string;
    videos: VideoCardBaseProps[];
    count: number;
  }> {
    try {
      logVerboseRenderer('[FavoritesService] Creating favorites source');
      const favorites = await this.getFavorites();

      // Convert favorites to VideoCardBaseProps format
      const videos: VideoCardBaseProps[] = favorites.map(favorite => ({
        id: favorite.videoId,
        title: favorite.title,
        thumbnail: favorite.thumbnail || '', // Provide empty string fallback
        duration: favorite.duration || 0, // Provide 0 fallback for duration
        type: favorite.sourceType,
        watched: false, // Will be populated by mergeWatchedData
        isClicked: false, // Will be populated by UI
        isFavorite: true, // Always true for favorites source
        showFavoriteIcon: true // Show the star icon
      }));

      return {
        id: 'favorites',
        title: 'Favorites',
        type: 'favorites',
        videos,
        count: favorites.length
      };
    } catch (error) {
      logVerboseRenderer('[FavoritesService] Error creating favorites source:', error);
      return {
        id: 'favorites',
        title: 'Favorites',
        type: 'favorites',
        videos: [],
        count: 0
      };
    }
  }

  /**
   * Get favorites status for multiple videos (bulk operation)
   */
  static async getFavoritesStatus(videoIds: string[]): Promise<Map<string, boolean>> {
    const statusMap = new Map<string, boolean>();

    try {
      // Check cache first
      const uncachedIds: string[] = [];
      videoIds.forEach(videoId => {
        if (this.favoriteStatusCache.has(videoId)) {
          statusMap.set(videoId, this.favoriteStatusCache.get(videoId)!);
        } else {
          uncachedIds.push(videoId);
        }
      });

      // If all are cached, return immediately
      if (uncachedIds.length === 0) {
        logVerboseRenderer('[FavoritesService] All favorite statuses found in cache');
        return statusMap;
      }

      // Get favorites list to check uncached videos
      const favorites = await this.getFavorites();
      const favoriteIds = new Set(favorites.map(f => f.videoId));

      // Update status map and cache for uncached videos
      uncachedIds.forEach(videoId => {
        const isFav = favoriteIds.has(videoId);
        statusMap.set(videoId, isFav);
        this.favoriteStatusCache.set(videoId, isFav);
      });

      logVerboseRenderer('[FavoritesService] Retrieved bulk favorite statuses for', videoIds.length, 'videos');
      return statusMap;
    } catch (error) {
      logVerboseRenderer('[FavoritesService] Error getting bulk favorite statuses:', error);

      // Return all as false on error
      videoIds.forEach(videoId => {
        statusMap.set(videoId, false);
      });
      return statusMap;
    }
  }

  /**
   * Clear the favorites cache
   */
  static clearCache(): void {
    logVerboseRenderer('[FavoritesService] Clearing cache');
    this.favoritesCache = null;
    this.favoriteStatusCache.clear();
    this.cacheExpiry = null;
  }

  /**
   * Preload favorites status for video grid optimization
   */
  static async preloadFavoritesStatus(): Promise<void> {
    try {
      logVerboseRenderer('[FavoritesService] Preloading favorites status');
      await this.getFavorites();
    } catch (error) {
      logVerboseRenderer('[FavoritesService] Error preloading favorites status:', error);
    }
  }
}