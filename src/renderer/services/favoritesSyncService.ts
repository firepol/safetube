import { FavoritesService } from './favoritesService';
import { normalizeVideoSource } from '../../shared/favoritesUtils';
import { logVerbose } from '../lib/logging';

export interface FavoriteSyncEvent {
  videoId: string;
  isFavorite: boolean;
  timestamp: number;
  source: string;
  type: 'youtube' | 'local' | 'dlna';
  metadata?: {
    title: string;
    thumbnail: string;
    duration: number;
  };
}

/**
 * Service for real-time favorite status synchronization across all components
 * Provides event-based communication for immediate updates
 */
export class FavoritesSyncService {
  private static listeners = new Set<(event: FavoriteSyncEvent) => void>();
  private static eventQueue: FavoriteSyncEvent[] = [];
  private static isProcessingQueue = false;

  /**
   * Subscribe to favorite status changes
   */
  static subscribe(callback: (event: FavoriteSyncEvent) => void): () => void {
    logVerbose('[FavoritesSyncService] Adding listener');
    this.listeners.add(callback);

    return () => {
      logVerbose('[FavoritesSyncService] Removing listener');
      this.listeners.delete(callback);
    };
  }

  /**
   * Broadcast favorite status change to all listeners
   */
  static broadcast(event: FavoriteSyncEvent): void {
    logVerbose('[FavoritesSyncService] Broadcasting favorite status change:', {
      videoId: event.videoId,
      isFavorite: event.isFavorite,
      source: event.source,
      type: event.type,
      listenersCount: this.listeners.size
    });

    // Add to queue for processing
    this.eventQueue.push(event);

    // Process queue asynchronously
    this.processEventQueue();

    // Notify all listeners immediately
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logVerbose('[FavoritesSyncService] Error in listener callback:', error);
      }
    });
  }

  /**
   * Toggle favorite with automatic synchronization
   */
  static async toggleFavoriteWithSync(
    videoId: string,
    source: string,
    type: 'youtube' | 'local' | 'dlna',
    title: string,
    thumbnail: string,
    duration: number,
    lastWatched?: string
  ): Promise<{ favorite: any; isFavorite: boolean }> {
    try {
      logVerbose('[FavoritesSyncService] Toggling favorite with sync:', {
        videoId, source, type, title
      });

      // Normalize the video source for consistent handling
      const normalizedSource = normalizeVideoSource({
        id: videoId,
        type,
        title,
        thumbnail,
        duration,
        url: source
      });

      // Use the FavoritesService to toggle
      const result = await FavoritesService.toggleFavorite(
        normalizedSource.id,
        source,
        normalizedSource.type,
        normalizedSource.title,
        normalizedSource.thumbnail || '',
        normalizedSource.duration || 0,
        lastWatched
      );

      // Broadcast the change to all listeners
      this.broadcast({
        videoId: normalizedSource.id,
        isFavorite: result.isFavorite,
        timestamp: Date.now(),
        source,
        type: normalizedSource.type,
        metadata: {
          title: normalizedSource.title,
          thumbnail: normalizedSource.thumbnail || '',
          duration: normalizedSource.duration || 0
        }
      });

      logVerbose('[FavoritesSyncService] Successfully toggled favorite with sync:', {
        videoId: normalizedSource.id,
        newStatus: result.isFavorite
      });

      return result;
    } catch (error) {
      logVerbose('[FavoritesSyncService] Error toggling favorite with sync:', error);
      throw error;
    }
  }

  /**
   * Load favorite statuses for multiple videos (without broadcasting to prevent loops)
   */
  static async loadAndSyncStatuses(videoIds: string[]): Promise<Map<string, boolean>> {
    try {
      logVerbose('[FavoritesSyncService] Loading statuses for', videoIds.length, 'videos');

      const statusMap = await FavoritesService.getFavoritesStatus(videoIds);

      logVerbose('[FavoritesSyncService] Loaded statuses for', statusMap.size, 'videos');
      return statusMap;
    } catch (error) {
      logVerbose('[FavoritesSyncService] Error loading statuses:', error);
      throw error;
    }
  }

  /**
   * Sync a single video's favorite status
   */
  static async syncVideoStatus(videoId: string, type?: 'youtube' | 'local' | 'dlna'): Promise<boolean> {
    try {
      const isFavorite = await FavoritesService.isFavorite(videoId, type);

      this.broadcast({
        videoId,
        isFavorite,
        timestamp: Date.now(),
        source: 'sync',
        type: type || 'youtube',
        metadata: {
          title: '',
          thumbnail: '',
          duration: 0
        }
      });

      return isFavorite;
    } catch (error) {
      logVerbose('[FavoritesSyncService] Error syncing video status:', error);
      return false;
    }
  }

  /**
   * Process event queue to handle batching and deduplication
   */
  private static async processEventQueue(): Promise<void> {
    if (this.isProcessingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Process events in batches to avoid overwhelming the system
      const batchSize = 10;
      while (this.eventQueue.length > 0) {
        const batch = this.eventQueue.splice(0, batchSize);

        // Deduplicate by videoId, keeping the latest event
        const deduplicated = new Map<string, FavoriteSyncEvent>();
        batch.forEach(event => {
          const existing = deduplicated.get(event.videoId);
          if (!existing || event.timestamp > existing.timestamp) {
            deduplicated.set(event.videoId, event);
          }
        });

        // Process deduplicated events
        for (const event of deduplicated.values()) {
          await this.processEvent(event);
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Process a single sync event
   */
  private static async processEvent(event: FavoriteSyncEvent): Promise<void> {
    try {
      // Update any cross-component state if needed
      // For now, this is mainly handled by the broadcast to listeners

      logVerbose('[FavoritesSyncService] Processed sync event:', {
        videoId: event.videoId,
        isFavorite: event.isFavorite,
        type: event.type
      });
    } catch (error) {
      logVerbose('[FavoritesSyncService] Error processing sync event:', error);
    }
  }

  /**
   * Clear all listeners (useful for cleanup)
   */
  static clearListeners(): void {
    logVerbose('[FavoritesSyncService] Clearing all listeners');
    this.listeners.clear();
  }

  /**
   * Get current listener count (for debugging)
   */
  static getListenerCount(): number {
    return this.listeners.size;
  }

  /**
   * Force sync all cached favorites
   */
  static async forceSyncAll(): Promise<void> {
    try {
      logVerbose('[FavoritesSyncService] Force syncing all favorites');

      // Clear cache and reload
      FavoritesService.clearCache();
      const favorites = await FavoritesService.getFavorites(true);

      // Broadcast all current favorites
      favorites.forEach(favorite => {
        this.broadcast({
          videoId: favorite.videoId,
          isFavorite: true,
          timestamp: Date.now(),
          source: 'force-sync',
          type: favorite.sourceType,
          metadata: {
            title: favorite.title,
            thumbnail: favorite.thumbnail || '',
            duration: favorite.duration || 0
          }
        });
      });

      logVerbose('[FavoritesSyncService] Force sync completed for', favorites.length, 'favorites');
    } catch (error) {
      logVerbose('[FavoritesSyncService] Error in force sync:', error);
    }
  }
}