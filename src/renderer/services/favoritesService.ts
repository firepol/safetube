import { FavoriteVideo, FavoritesConfig } from '@/shared/types';
import { VideoCardBaseProps } from '../components/video/VideoCardBase';
import { logVerbose } from '../lib/logging';


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
        return this.favoritesCache;
      }

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

      return favorites;
    } catch (error) {
      logVerbose('[FavoritesService] Error getting favorites:', error);
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
      logVerbose('[FavoritesService] Adding favorite:', { videoId, source, type, title });

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

      logVerbose('[FavoritesService] Successfully added favorite:', favorite.videoId);
      return favorite;
    } catch (error) {
      // Rollback optimistic update
      this.favoriteStatusCache.delete(videoId);
      console.error('[FavoritesService] Error adding favorite, rolled back cache:', error);
      logVerbose('[FavoritesService] Error adding favorite:', error);
      throw error;
    }
  }

  /**
   * Remove a favorite with optimistic updates
   */
  static async removeFavorite(videoId: string): Promise<FavoriteVideo> {
    try {
      logVerbose('[FavoritesService] Removing favorite:', videoId);

      // Store previous state for rollback
      const wasFavorite = this.favoriteStatusCache.get(videoId) || false;

      // Optimistic update
      this.favoriteStatusCache.set(videoId, false);

      const removedFavorite = await window.electron.favoritesRemove(videoId);

      // Update cache if present
      if (this.favoritesCache) {
        this.favoritesCache = this.favoritesCache.filter(f => f.videoId !== videoId);
      }

      logVerbose('[FavoritesService] Successfully removed favorite:', videoId);
      return removedFavorite;
    } catch (error) {
      // Rollback optimistic update
      this.favoriteStatusCache.set(videoId, true);
      logVerbose('[FavoritesService] Error removing favorite:', error);
      throw error;
    }
  }

  /**
   * Check if a video is favorited with caching
   */
  static async isFavorite(videoId: string, type?: 'youtube' | 'local' | 'dlna'): Promise<boolean> {
    try {
      // Use original video ID like watched.json format (no normalization)
      const originalVideoId = videoId;

      // Check cache first
      if (this.favoriteStatusCache.has(originalVideoId)) {
        const cached = this.favoriteStatusCache.get(originalVideoId)!;
        return cached;
      }

      // If we have a favorites cache, check if the video is in the list
      if (this.favoritesCache && this.cacheExpiry && Date.now() < this.cacheExpiry) {
        const isFav = this.favoritesCache.some(f => f.videoId === originalVideoId);
        this.favoriteStatusCache.set(originalVideoId, isFav);
        return isFav;
      }

      logVerbose('[FavoritesService] Checking favorite status for:', originalVideoId);
      const isFav = await window.electron.favoritesIsFavorite(originalVideoId);

      // Update cache
      this.favoriteStatusCache.set(originalVideoId, isFav);

      logVerbose('[FavoritesService] Favorite status for', originalVideoId, ':', isFav);
      return isFav;
    } catch (error) {
      logVerbose('[FavoritesService] Error checking favorite status:', error);
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
      logVerbose('[FavoritesService] Toggling favorite:', { videoId, source, type, title });

      // Use original video ID like watched.json format (no normalization)
      const originalVideoId = videoId;

      // Get current state using original ID
      const currentState = await this.isFavorite(videoId, type);

      // Optimistic update using original ID
      this.favoriteStatusCache.set(originalVideoId, !currentState);

      const favorite = await window.electron.favoritesToggle(
        videoId, source, type, title, thumbnail, duration, lastWatched
      );


      const newState = !currentState;

      // Update cache based on new state using original ID
      if (this.favoritesCache) {
        if (newState) {
          // Added to favorites
          const existingIndex = this.favoritesCache.findIndex(f => f.videoId === originalVideoId);
          if (existingIndex >= 0) {
            this.favoritesCache[existingIndex] = favorite;
          } else {
            this.favoritesCache.push(favorite);
          }
        } else {
          // Removed from favorites
          const initialLength = this.favoritesCache.length;
          this.favoritesCache = this.favoritesCache.filter(f => f.videoId !== originalVideoId);
        }
      }

      logVerbose('[FavoritesService] Successfully toggled favorite:', originalVideoId, 'now', newState);
      return {
        favorite: newState ? favorite : null,
        isFavorite: newState
      };
    } catch (error) {
      // Rollback optimistic update using original ID
      const originalVideoId = videoId;
      const currentState = this.favoriteStatusCache.get(originalVideoId);
      if (currentState !== undefined) {
        this.favoriteStatusCache.set(originalVideoId, !currentState);
      }
      console.error('[FavoritesService] Error toggling favorite:', error);
      logVerbose('[FavoritesService] Error toggling favorite:', error);
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
      logVerbose('[FavoritesService] Updating favorite metadata:', { videoId, metadata });

      const updatedFavorite = await window.electron.favoritesUpdateMetadata(videoId, metadata);

      // Update cache if present
      if (this.favoritesCache) {
        const index = this.favoritesCache.findIndex(f => f.videoId === videoId);
        if (index >= 0) {
          this.favoritesCache[index] = updatedFavorite;
        }
      }

      logVerbose('[FavoritesService] Successfully updated favorite metadata:', videoId);
      return updatedFavorite;
    } catch (error) {
      logVerbose('[FavoritesService] Error updating favorite metadata:', error);
      throw error;
    }
  }

  /**
   * Get favorites by source
   */
  static async getFavoritesBySource(sourceId: string): Promise<FavoriteVideo[]> {
    try {
      logVerbose('[FavoritesService] Getting favorites by source:', sourceId);
      return await window.electron.favoritesGetBySource(sourceId);
    } catch (error) {
      logVerbose('[FavoritesService] Error getting favorites by source:', error);
      throw error;
    }
  }

  /**
   * Get favorites configuration
   */
  static async getFavoritesConfig(): Promise<FavoritesConfig> {
    try {
      logVerbose('[FavoritesService] Getting favorites config');
      return await window.electron.favoritesGetConfig();
    } catch (error) {
      logVerbose('[FavoritesService] Error getting favorites config:', error);
      throw error;
    }
  }

  /**
   * Update favorites configuration
   */
  static async updateFavoritesConfig(config: Partial<FavoritesConfig>): Promise<FavoritesConfig> {
    try {
      logVerbose('[FavoritesService] Updating favorites config:', config);
      return await window.electron.favoritesUpdateConfig(config);
    } catch (error) {
      logVerbose('[FavoritesService] Error updating favorites config:', error);
      throw error;
    }
  }

  /**
   * Cleanup orphaned favorites
   */
  static async cleanupOrphanedFavorites(): Promise<FavoriteVideo[]> {
    try {
      logVerbose('[FavoritesService] Cleaning up orphaned favorites');
      const result = await window.electron.favoritesCleanupOrphaned();

      // Clear cache to force refresh
      this.clearCache();

      return result;
    } catch (error) {
      logVerbose('[FavoritesService] Error cleaning up orphaned favorites:', error);
      throw error;
    }
  }

  /**
   * Sync with watch history
   */
  static async syncWithWatchHistory(): Promise<FavoriteVideo[]> {
    try {
      logVerbose('[FavoritesService] Syncing with watch history');
      const result = await window.electron.favoritesSyncWatchHistory();

      // Clear cache to force refresh
      this.clearCache();

      return result;
    } catch (error) {
      logVerbose('[FavoritesService] Error syncing with watch history:', error);
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
      logVerbose('[FavoritesService] Creating favorites source');
      const favorites = await this.getFavorites();

      // Convert favorites to VideoCardBaseProps format with thumbnail processing
      const videos: VideoCardBaseProps[] = [];
      for (const favorite of favorites) {
        // Check for best available thumbnail if original is empty (like History page does)
        let bestThumbnail = favorite.thumbnail;
        if (!bestThumbnail || bestThumbnail.trim() === '') {
          try {
            const generatedThumbnail = await window.electron.getBestThumbnail(favorite.videoId);
            if (generatedThumbnail) {
              bestThumbnail = generatedThumbnail;
              logVerbose('[FavoritesService] Using generated thumbnail for:', favorite.videoId, '->', generatedThumbnail);
            }
          } catch (error) {
            logVerbose('[FavoritesService] Error getting best thumbnail for:', favorite.videoId, error);
          }
        }

        videos.push({
          id: favorite.videoId,
          title: favorite.title,
          thumbnail: bestThumbnail || '', // Use generated thumbnail or empty string
          duration: favorite.duration || 0, // Provide 0 fallback for duration
          type: favorite.sourceType,
          watched: false, // Will be populated by mergeWatchedData
          isClicked: false, // Will be populated by UI
          isFavorite: true, // Always true for favorites source
          showFavoriteIcon: true, // Show the star icon
          isAvailable: true, // Favorites should always be available
          isFallback: false // Never show fallback UI for favorites
        });
      }

      return {
        id: 'favorites',
        title: 'Favorites',
        type: 'favorites',
        videos,
        count: favorites.length
      };
    } catch (error) {
      logVerbose('[FavoritesService] Error creating favorites source:', error);
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

      return statusMap;
    } catch (error) {
      logVerbose('[FavoritesService] Error getting bulk favorite statuses:', error);

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
    logVerbose('[FavoritesService] Clearing cache');
    this.favoritesCache = null;
    this.favoriteStatusCache.clear();
    this.cacheExpiry = null;
  }

  /**
   * Clear cache and force refresh on next access
   * Useful when navigating between pages to ensure fresh state
   */
  static invalidateCache(): void {
    logVerbose('[FavoritesService] Invalidating cache for fresh state');
    this.clearCache();
  }

  /**
   * Preload favorites status for video grid optimization
   */
  static async preloadFavoritesStatus(): Promise<void> {
    try {
      logVerbose('[FavoritesService] Preloading favorites status');
      await this.getFavorites();
    } catch (error) {
      logVerbose('[FavoritesService] Error preloading favorites status:', error);
    }
  }
}