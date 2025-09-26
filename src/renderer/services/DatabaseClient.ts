import { logVerbose } from '../lib/logging';

/**
 * Database response interface matching the main process response format
 */
interface DatabaseResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Video record interface for database operations
 */
export interface VideoRecord {
  id: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  url?: string;
  is_available: boolean;
  source_id: string;
  description?: string;
  published_at?: string;
}

/**
 * View record interface for database operations
 */
export interface ViewRecord {
  video_id: string;
  source_id: string;
  position: number;
  time_watched: number;
  duration?: number;
  watched: boolean;
  first_watched: string;
  last_watched: string;
}

/**
 * Favorite record interface for database operations
 */
export interface FavoriteRecord {
  video_id: string;
  source_id: string;
  date_added: string;
}

/**
 * Source record interface for database operations
 */
export interface SourceRecord {
  id: string;
  type: string;
  title: string;
  sort_order?: number;
  url?: string;
  channel_id?: string;
  path?: string;
  max_depth?: number;
}

/**
 * DatabaseClient - Renderer-side client for SQLite database operations
 *
 * This service provides a clean interface for the renderer process to interact
 * with the SQLite database through IPC communication with the main process.
 *
 * All methods follow the SafeTube pattern of using window.electron.* calls
 * and include proper error handling, logging, and TypeScript types.
 */
export class DatabaseClient {

  // ==================== Connection and Health ====================

  /**
   * Check database health and connection status
   */
  static async healthCheck(): Promise<{ isHealthy: boolean; version?: string } | null> {
    try {
      const response = await (window.electron as any).invoke('database:health-check') as DatabaseResponse<{ isHealthy: boolean; version?: string }>;

      if (response.success) {
        return response.data || null;
      } else {
        logVerbose('[DatabaseClient] Health check failed:', response.error);
        return null;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Health check error:', error);
      return null;
    }
  }

  // ==================== Migration Operations ====================

  /**
   * Execute Phase 1 database migration
   */
  static async migratePhase1(): Promise<{ summary: any } | null> {
    try {
      const response = await (window.electron as any).invoke('database:migrate-phase1') as DatabaseResponse<{ summary: any }>;

      if (response.success) {
        logVerbose('[DatabaseClient] Phase 1 migration completed successfully');
        return response.data || null;
      } else {
        logVerbose('[DatabaseClient] Phase 1 migration failed:', response.error);
        return null;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Phase 1 migration error:', error);
      return null;
    }
  }

  /**
   * Verify migration integrity
   */
  static async verifyMigration(): Promise<{ integrity: any } | null> {
    try {
      const response = await (window.electron as any).invoke('database:verify-migration') as DatabaseResponse<{ integrity: any }>;

      if (response.success) {
        return response.data || null;
      } else {
        logVerbose('[DatabaseClient] Migration verification failed:', response.error);
        return null;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Migration verification error:', error);
      return null;
    }
  }

  // ==================== Video Operations ====================

  /**
   * Get all videos from a specific source
   */
  static async getVideosBySource(sourceId: string): Promise<VideoRecord[]> {
    try {
      const response = await (window.electron as any).invoke('database:videos:get-by-source', sourceId) as DatabaseResponse<VideoRecord[]>;

      if (response.success) {
        return response.data || [];
      } else {
        logVerbose('[DatabaseClient] Get videos by source failed:', response.error);
        return [];
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Get videos by source error:', error);
      return [];
    }
  }

  /**
   * Get a single video by ID
   */
  static async getVideoById(videoId: string): Promise<VideoRecord | null> {
    try {
      const response = await (window.electron as any).invoke('database:videos:get-by-id', videoId) as DatabaseResponse<VideoRecord | null>;

      if (response.success) {
        return response.data || null;
      } else {
        logVerbose('[DatabaseClient] Get video by ID failed:', response.error);
        return null;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Get video by ID error:', error);
      return null;
    }
  }

  /**
   * Search videos by title and description
   */
  static async searchVideos(query: string, sourceId?: string): Promise<VideoRecord[]> {
    try {
      const response = await (window.electron as any).invoke('database:videos:search', query, sourceId) as DatabaseResponse<VideoRecord[]>;

      if (response.success) {
        return response.data || [];
      } else {
        logVerbose('[DatabaseClient] Video search failed:', response.error);
        return [];
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Video search error:', error);
      return [];
    }
  }

  /**
   * Update video metadata
   */
  static async updateVideoMetadata(videoId: string, metadata: Partial<VideoRecord>): Promise<boolean> {
    try {
      const response = await (window.electron as any).invoke('database:videos:update-metadata', videoId, metadata) as DatabaseResponse<boolean>;

      if (response.success) {
        return response.data || false;
      } else {
        logVerbose('[DatabaseClient] Update video metadata failed:', response.error);
        return false;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Update video metadata error:', error);
      return false;
    }
  }

  /**
   * Update video availability status
   */
  static async updateVideoAvailability(videoId: string, isAvailable: boolean): Promise<boolean> {
    try {
      const response = await (window.electron as any).invoke('database:videos:update-availability', videoId, isAvailable) as DatabaseResponse<boolean>;

      if (response.success) {
        return response.data || false;
      } else {
        logVerbose('[DatabaseClient] Update video availability failed:', response.error);
        return false;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Update video availability error:', error);
      return false;
    }
  }

  // ==================== View Records Operations ====================

  /**
   * Get view record for a specific video
   */
  static async getViewRecord(videoId: string): Promise<ViewRecord | null> {
    try {
      const response = await (window.electron as any).invoke('database:view-records:get', videoId) as DatabaseResponse<ViewRecord | null>;

      if (response.success) {
        return response.data || null;
      } else {
        logVerbose('[DatabaseClient] Get view record failed:', response.error);
        return null;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Get view record error:', error);
      return null;
    }
  }

  /**
   * Update or create view record for video watching progress
   */
  static async updateViewRecord(videoId: string, update: Partial<ViewRecord>): Promise<boolean> {
    try {
      const response = await (window.electron as any).invoke('database:view-records:update', videoId, update) as DatabaseResponse<boolean>;

      if (response.success) {
        return response.data || false;
      } else {
        logVerbose('[DatabaseClient] Update view record failed:', response.error);
        return false;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Update view record error:', error);
      return false;
    }
  }

  /**
   * Get viewing history with video metadata
   */
  static async getViewingHistory(limit: number = 50): Promise<(ViewRecord & VideoRecord)[]> {
    try {
      const response = await (window.electron as any).invoke('database:view-records:get-history', limit) as DatabaseResponse<(ViewRecord & VideoRecord)[]>;

      if (response.success) {
        return response.data || [];
      } else {
        logVerbose('[DatabaseClient] Get viewing history failed:', response.error);
        return [];
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Get viewing history error:', error);
      return [];
    }
  }

  /**
   * Get recently watched videos
   */
  static async getRecentlyWatched(limit: number = 20): Promise<(ViewRecord & VideoRecord)[]> {
    try {
      const response = await (window.electron as any).invoke('database:view-records:get-recently-watched', limit) as DatabaseResponse<(ViewRecord & VideoRecord)[]>;

      if (response.success) {
        return response.data || [];
      } else {
        logVerbose('[DatabaseClient] Get recently watched failed:', response.error);
        return [];
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Get recently watched error:', error);
      return [];
    }
  }

  // ==================== Favorites Operations ====================

  /**
   * Get all favorites with video metadata
   */
  static async getFavorites(): Promise<(FavoriteRecord & VideoRecord)[]> {
    try {
      const response = await (window.electron as any).invoke('database:favorites:get-all') as DatabaseResponse<(FavoriteRecord & VideoRecord)[]>;

      if (response.success) {
        return response.data || [];
      } else {
        logVerbose('[DatabaseClient] Get favorites failed:', response.error);
        return [];
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Get favorites error:', error);
      return [];
    }
  }

  /**
   * Add video to favorites
   */
  static async addFavorite(videoId: string, sourceId: string): Promise<boolean> {
    try {
      const response = await (window.electron as any).invoke('database:favorites:add', videoId, sourceId) as DatabaseResponse<boolean>;

      if (response.success) {
        logVerbose('[DatabaseClient] Added favorite:', videoId);
        return response.data || false;
      } else {
        logVerbose('[DatabaseClient] Add favorite failed:', response.error);
        return false;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Add favorite error:', error);
      return false;
    }
  }

  /**
   * Remove video from favorites
   */
  static async removeFavorite(videoId: string): Promise<boolean> {
    try {
      const response = await (window.electron as any).invoke('database:favorites:remove', videoId) as DatabaseResponse<boolean>;

      if (response.success) {
        logVerbose('[DatabaseClient] Removed favorite:', videoId);
        return response.data || false;
      } else {
        logVerbose('[DatabaseClient] Remove favorite failed:', response.error);
        return false;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Remove favorite error:', error);
      return false;
    }
  }

  /**
   * Check if video is in favorites
   */
  static async isFavorite(videoId: string): Promise<boolean> {
    try {
      const response = await (window.electron as any).invoke('database:favorites:is-favorite', videoId) as DatabaseResponse<boolean>;

      if (response.success) {
        return response.data || false;
      } else {
        logVerbose('[DatabaseClient] Check favorite status failed:', response.error);
        return false;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Check favorite status error:', error);
      return false;
    }
  }

  /**
   * Toggle favorite status for video
   */
  static async toggleFavorite(videoId: string, sourceId: string): Promise<{ isFavorite: boolean } | null> {
    try {
      const response = await (window.electron as any).invoke('database:favorites:toggle', videoId, sourceId) as DatabaseResponse<{ isFavorite: boolean }>;

      if (response.success) {
        const result = response.data || { isFavorite: false };
        logVerbose('[DatabaseClient] Toggled favorite:', videoId, '→', result.isFavorite);
        return result;
      } else {
        logVerbose('[DatabaseClient] Toggle favorite failed:', response.error);
        return null;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Toggle favorite error:', error);
      return null;
    }
  }

  // ==================== Sources Operations ====================

  /**
   * Get all video sources
   */
  static async getSources(): Promise<SourceRecord[]> {
    try {
      const response = await (window.electron as any).invoke('database:sources:get-all') as DatabaseResponse<SourceRecord[]>;

      if (response.success) {
        return response.data || [];
      } else {
        logVerbose('[DatabaseClient] Get sources failed:', response.error);
        return [];
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Get sources error:', error);
      return [];
    }
  }

  /**
   * Get single source by ID
   */
  static async getSourceById(sourceId: string): Promise<SourceRecord | null> {
    try {
      const response = await (window.electron as any).invoke('database:sources:get-by-id', sourceId) as DatabaseResponse<SourceRecord | null>;

      if (response.success) {
        return response.data || null;
      } else {
        logVerbose('[DatabaseClient] Get source by ID failed:', response.error);
        return null;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Get source by ID error:', error);
      return null;
    }
  }

  /**
   * Create new video source
   */
  static async createSource(source: Omit<SourceRecord, 'id'>): Promise<string | null> {
    try {
      const response = await (window.electron as any).invoke('database:sources:create', source) as DatabaseResponse<string>;

      if (response.success) {
        logVerbose('[DatabaseClient] Created source:', response.data);
        return response.data || null;
      } else {
        logVerbose('[DatabaseClient] Create source failed:', response.error);
        return null;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Create source error:', error);
      return null;
    }
  }

  /**
   * Update existing video source
   */
  static async updateSource(sourceId: string, updates: Partial<SourceRecord>): Promise<boolean> {
    try {
      const response = await (window.electron as any).invoke('database:sources:update', sourceId, updates) as DatabaseResponse<boolean>;

      if (response.success) {
        logVerbose('[DatabaseClient] Updated source:', sourceId);
        return response.data || false;
      } else {
        logVerbose('[DatabaseClient] Update source failed:', response.error);
        return false;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Update source error:', error);
      return false;
    }
  }

  /**
   * Delete video source and all related data
   */
  static async deleteSource(sourceId: string): Promise<boolean> {
    try {
      const response = await (window.electron as any).invoke('database:sources:delete', sourceId) as DatabaseResponse<boolean>;

      if (response.success) {
        logVerbose('[DatabaseClient] Deleted source:', sourceId);
        return response.data || false;
      } else {
        logVerbose('[DatabaseClient] Delete source failed:', response.error);
        return false;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Delete source error:', error);
      return false;
    }
  }

  // ==================== YouTube Cache Operations ====================

  /**
   * Get cached YouTube API results for source page
   */
  static async getCachedResults(sourceId: string, page: number = 1): Promise<string[]> {
    try {
      const response = await (window.electron as any).invoke('database:youtube-cache:get-cached-results', sourceId, page) as DatabaseResponse<string[]>;

      if (response.success) {
        return response.data || [];
      } else {
        logVerbose('[DatabaseClient] Get cached results failed:', response.error);
        return [];
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Get cached results error:', error);
      return [];
    }
  }

  /**
   * Set cached YouTube API results for source page
   */
  static async setCachedResults(sourceId: string, page: number, videoIds: string[]): Promise<boolean> {
    try {
      const response = await (window.electron as any).invoke('database:youtube-cache:set-cached-results', sourceId, page, videoIds) as DatabaseResponse<boolean>;

      if (response.success) {
        logVerbose('[DatabaseClient] Set cached results:', sourceId, 'page', page, videoIds.length, 'videos');
        return response.data || false;
      } else {
        logVerbose('[DatabaseClient] Set cached results failed:', response.error);
        return false;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Set cached results error:', error);
      return false;
    }
  }

  /**
   * Clear all cached results for a source (reset functionality)
   */
  static async clearCache(sourceId: string): Promise<boolean> {
    try {
      const response = await (window.electron as any).invoke('database:youtube-cache:clear-cache', sourceId) as DatabaseResponse<boolean>;

      if (response.success) {
        logVerbose('[DatabaseClient] Cleared cache for source:', sourceId);
        return response.data || false;
      } else {
        logVerbose('[DatabaseClient] Clear cache failed:', response.error);
        return false;
      }
    } catch (error) {
      logVerbose('[DatabaseClient] Clear cache error:', error);
      return false;
    }
  }
}

export default DatabaseClient;