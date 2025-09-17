import { FavoriteVideo, FavoritesConfig, FavoritesOperationResult, VideoMetadata } from '../shared/types';
import { DEFAULT_FAVORITES_CONFIG } from '../shared/favoritesValidation';
import {
  readFavoritesConfig,
  writeFavoritesConfig,
  addFavorite,
  removeFavorite,
  getFavorites as getUtilFavorites,
  isFavorite
} from './fileUtils';

/**
 * Main process favorites service with validation and error handling
 * Simplified for Phase 1 implementation
 */
export class FavoritesService {

  /**
   * Get all favorites
   */
  static async getFavorites(): Promise<FavoritesOperationResult> {
    try {
      const favorites = await getUtilFavorites();

      return {
        success: true,
        data: favorites
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get favorites: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Add a favorite
   */
  static async addFavorite(metadata: VideoMetadata): Promise<FavoritesOperationResult> {
    try {
      await addFavorite(metadata);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add favorite: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Remove a favorite
   */
  static async removeFavorite(videoId: string): Promise<FavoritesOperationResult> {
    try {
      await removeFavorite(videoId);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to remove favorite: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check if video is favorited
   */
  static async isFavorite(videoId: string): Promise<FavoritesOperationResult> {
    try {
      const favorited = await isFavorite(videoId);

      return {
        success: true,
        data: favorited
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to check favorite status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get favorites configuration
   */
  static async getFavoritesConfig(): Promise<FavoritesOperationResult> {
    try {
      const config = await readFavoritesConfig();

      return {
        success: true,
        data: config
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get favorites config: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Update favorites configuration
   */
  static async updateFavoritesConfig(config: FavoritesConfig): Promise<FavoritesOperationResult> {
    try {
      await writeFavoritesConfig(config);

      return {
        success: true,
        data: config
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update favorites config: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Legacy method stubs for compatibility - will be implemented in later phases

  /**
   * Toggle favorite status - stub implementation
   */
  static async toggleFavorite(
    videoId: string,
    source: string,
    type: 'youtube' | 'local' | 'dlna',
    title: string,
    thumbnail: string,
    duration: number,
    lastWatched?: string
  ): Promise<FavoritesOperationResult> {
    try {
      const isCurrentlyFavorite = await isFavorite(videoId);

      if (isCurrentlyFavorite) {
        await removeFavorite(videoId);
        return { success: true, data: { isFavorite: false } as any };
      } else {
        const metadata: VideoMetadata = { id: videoId, type, title, thumbnail, duration };
        await addFavorite(metadata);
        return { success: true, data: { isFavorite: true } as any };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to toggle favorite: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Update favorite metadata - stub implementation
   */
  static async updateFavoriteMetadata(videoId: string, metadata: any): Promise<FavoritesOperationResult> {
    // Not implemented in Phase 1
    return {
      success: false,
      error: 'updateFavoriteMetadata not implemented in Phase 1'
    };
  }

  /**
   * Get favorites by source - stub implementation
   */
  static async getFavoritesBySource(sourceId: string): Promise<FavoritesOperationResult> {
    // Not implemented in Phase 1
    return {
      success: true,
      data: []
    };
  }

  /**
   * Cleanup orphaned favorites - stub implementation
   */
  static async cleanupOrphanedFavorites(): Promise<FavoritesOperationResult> {
    // Not implemented in Phase 1
    return {
      success: true,
      data: { cleaned: 0 } as any
    };
  }

  /**
   * Sync with watch history - stub implementation
   */
  static async syncWithWatchHistory(): Promise<FavoritesOperationResult> {
    // Not implemented in Phase 1
    return {
      success: true,
      data: { synced: 0 } as any
    };
  }
}