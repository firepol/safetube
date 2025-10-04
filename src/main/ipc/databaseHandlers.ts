import { ipcMain } from 'electron';
import log from '../logger';
import DatabaseService from '../services/DatabaseService';
import { MigrationService } from '../database/MigrationService';
import SimpleSchemaManager from '../database/SimpleSchemaManager';
import DatabaseErrorHandler from '../services/DatabaseErrorHandler';
import { IPC } from '../../shared/ipc-channels';
import {
  findCachedPage,
  findVideoById,
  findVideosBySource,
  searchVideos,
  getDownloadStatus,
  cleanupOldDownloads,
  getAllDownloadedVideos,
  getDownloadedVideosBySource,
  getDownloadedVideoById,
  isVideoDownloaded,
  getTotalDownloadedSize
} from '../database/queries';

// Types for IPC database operations
interface DatabaseResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

interface VideoRecord {
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

interface ViewRecord {
  video_id: string;
  source_id: string;
  position: number;
  time_watched: number;
  duration?: number;
  watched: boolean;
  first_watched: string;
  last_watched: string;
}

interface FavoriteRecord {
  video_id: string;
  source_id: string;
  date_added: string;
}

interface SourceRecord {
  id: string;
  type: string;
  title: string;
  sort_preference?: string;
  position?: number;
  url?: string;
  channel_id?: string;
  path?: string;
  max_depth?: number;
  thumbnail?: string;
  total_videos?: number;
}

/**
 * Database IPC Handlers - Phase 1 Operations
 * Following existing SafeTube IPC handler patterns
 */
export function registerDatabaseHandlers() {
  // YouTube Page Cache: Get a cached page (for preload YouTubePageCache)
  ipcMain.handle(IPC.YOUTUBE_CACHE_DB.GET_PAGE, async (_, sourceId: string, pageNumber: number): Promise<DatabaseResponse<any>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const pageSize = 50;
      const page = await findCachedPage(dbService, sourceId, pageNumber, pageSize);
      return { success: true, data: page };
    } catch (error) {
      log.error('[Database IPC] Failed to get cached YouTube page:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get cached YouTube page',
        code: 'GET_YT_PAGE_CACHE_FAILED'
      };
    }
  });
  // Database connection and health
  ipcMain.handle(IPC.DATABASE.HEALTH_CHECK, async (): Promise<DatabaseResponse<{ isHealthy: boolean; version?: string }>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const healthCheck = await dbService.healthCheck();
      return {
        success: true,
        data: healthCheck
      };
    } catch (error) {
      log.error('[Database IPC] Health check failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed',
        code: 'HEALTH_CHECK_FAILED'
      };
    }
  });

  // Migration Operations
  ipcMain.handle(IPC.DATABASE.MIGRATE_PHASE1, async (): Promise<DatabaseResponse<{ summary: any }>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const schemaManager = new SimpleSchemaManager(dbService);
      const errorHandler = new DatabaseErrorHandler();
      const migrationService = new MigrationService(dbService, schemaManager, errorHandler);

      log.info('[Database IPC] Starting Phase 1 migration');
      const summary = await migrationService.executePhase1Migration();

      return {
        success: true,
        data: { summary }
      };
    } catch (error) {
      log.error('[Database IPC] Phase 1 migration failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Migration failed',
        code: 'MIGRATION_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.DATABASE.MIGRATE_PHASE2, async (): Promise<DatabaseResponse<{ summary: any }>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const schemaManager = new SimpleSchemaManager(dbService);
      const errorHandler = new DatabaseErrorHandler();
      const migrationService = new MigrationService(dbService, schemaManager, errorHandler);

      log.info('[Database IPC] Starting Phase 2 migration');
      const summary = await migrationService.executePhase2Migration();

      return {
        success: true,
        data: { summary }
      };
    } catch (error) {
      log.error('[Database IPC] Phase 2 migration failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Migration failed',
        code: 'MIGRATION_PHASE2_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.DATABASE.VERIFY_MIGRATION, async (): Promise<DatabaseResponse<{ integrity: any }>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const schemaManager = new SimpleSchemaManager(dbService);
      const errorHandler = new DatabaseErrorHandler();
      const migrationService = new MigrationService(dbService, schemaManager, errorHandler);

      const integrity = await migrationService.verifyMigrationIntegrity();

      return {
        success: true,
        data: { integrity }
      };
    } catch (error) {
      log.error('[Database IPC] Migration verification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed',
        code: 'VERIFICATION_FAILED'
      };
    }
  });

  // Video Operations
  ipcMain.handle(IPC.VIDEOS.GET_BY_SOURCE, async (_, sourceId: string): Promise<DatabaseResponse<VideoRecord[]>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const videos = await findVideosBySource(dbService, sourceId);

      return {
        success: true,
        data: (videos || []) as VideoRecord[]
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get videos by source:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get videos',
        code: 'GET_VIDEOS_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.VIDEOS.GET_BY_ID, async (_, videoId: string): Promise<DatabaseResponse<VideoRecord | null>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const video = await findVideoById(dbService, videoId);

      return {
        success: true,
        data: (video || null) as VideoRecord | null
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get video by ID:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get video',
        code: 'GET_VIDEO_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.VIDEOS.SEARCH, async (_, query: string, sourceId?: string): Promise<DatabaseResponse<VideoRecord[]>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const videos = await searchVideos(dbService, query, sourceId);

      return {
        success: true,
        data: (videos || []) as VideoRecord[]
      };
    } catch (error) {
      log.error('[Database IPC] Video search failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
        code: 'SEARCH_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.VIDEOS.UPDATE_METADATA, async (_, videoId: string, metadata: Partial<VideoRecord>): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();

      // Build dynamic update query
      const fields = Object.keys(metadata).filter(key => key !== 'id');
      if (fields.length === 0) {
        return { success: true, data: true };
      }

      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(field => (metadata as any)[field]);
      values.push(videoId);

      await dbService.run(`
        UPDATE videos SET ${setClause} WHERE id = ?
      `, values);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to update video metadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update video',
        code: 'UPDATE_VIDEO_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.VIDEOS.UPDATE_AVAILABILITY, async (_, videoId: string, isAvailable: boolean): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();
      await dbService.run(`
        UPDATE videos SET is_available = ? WHERE id = ?
      `, [isAvailable ? 1 : 0, videoId]);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to update video availability:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update availability',
        code: 'UPDATE_AVAILABILITY_FAILED'
      };
    }
  });

  // View Records Operations
  ipcMain.handle(IPC.VIEW_RECORDS.GET, async (_, videoId: string): Promise<DatabaseResponse<ViewRecord | null>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const record = await dbService.get<ViewRecord>(`
        SELECT * FROM view_records WHERE video_id = ?
      `, [videoId]);

      return {
        success: true,
        data: record || null
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get view record:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get view record',
        code: 'GET_VIEW_RECORD_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.VIEW_RECORDS.UPDATE, async (_, videoId: string, update: Partial<ViewRecord>): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();

      // Upsert view record
      await dbService.run(`
        INSERT OR REPLACE INTO view_records (
          video_id, source_id, position, time_watched, duration,
          watched, first_watched, last_watched
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        videoId,
        update.source_id || 'unknown',
        update.position || 0,
        update.time_watched || 0,
        update.duration || null,
        update.watched ? 1 : 0,
        update.first_watched || new Date().toISOString(),
        new Date().toISOString() // Always update last_watched
      ]);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to update view record:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update view record',
        code: 'UPDATE_VIEW_RECORD_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.VIEW_RECORDS.GET_HISTORY, async (_, limit: number = 50): Promise<DatabaseResponse<(ViewRecord & VideoRecord)[]>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const rawHistory = await dbService.all<ViewRecord & VideoRecord>(`
        SELECT vr.*, v.title, v.thumbnail, v.duration as video_duration
        FROM view_records vr
        JOIN videos v ON vr.video_id = v.id
        ORDER BY vr.last_watched DESC
        LIMIT ?
      `, [limit]);

      // Enhance thumbnails for local videos (check for cached generated thumbnails)
      const fs = await import('fs');
      const { AppPaths } = await import('../appPaths');
      const { getThumbnailUrl } = await import('../services/thumbnailService');
      const { parseVideoId } = await import('../../shared/fileUtils');
      const { getThumbnailCacheKey } = await import('../../shared/thumbnailUtils');

      const history = rawHistory.map(record => {
        let thumbnail = record.thumbnail || '';

        // For local videos without thumbnails, check for cached generated thumbnails
        if (!thumbnail && record.video_id && record.video_id.startsWith('local:')) {
          const parsed = parseVideoId(record.video_id);
          if (parsed.success && parsed.parsed?.type === 'local') {
            const cacheKey = getThumbnailCacheKey(record.video_id, 'local');
            const cachedThumbnailPath = AppPaths.getThumbnailPath(`${cacheKey}.jpg`);

            if (fs.existsSync(cachedThumbnailPath)) {
              thumbnail = getThumbnailUrl(cachedThumbnailPath);
            }
          }
        }

        return {
          ...record,
          thumbnail
        };
      });

      return {
        success: true,
        data: history || []
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get view history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get history',
        code: 'GET_HISTORY_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.VIEW_RECORDS.GET_RECENTLY_WATCHED, async (_, limit: number = 20): Promise<DatabaseResponse<(ViewRecord & VideoRecord)[]>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const recent = await dbService.all<ViewRecord & VideoRecord>(`
        SELECT vr.*, v.title, v.thumbnail, v.duration as video_duration
        FROM view_records vr
        JOIN videos v ON vr.video_id = v.id
        WHERE vr.time_watched > 0
        ORDER BY vr.last_watched DESC
        LIMIT ?
      `, [limit]);

      return {
        success: true,
        data: recent || []
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get recently watched:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recently watched',
        code: 'GET_RECENTLY_WATCHED_FAILED'
      };
    }
  });

  // Favorites Operations
  ipcMain.handle(IPC.FAVORITES.GET_ALL, async (): Promise<DatabaseResponse<any[]>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const rawFavorites = await dbService.all<any>(`
        SELECT f.*, v.title, v.thumbnail, v.duration, v.is_available, s.type as source_type
        FROM favorites f
        JOIN videos v ON f.video_id = v.id
        LEFT JOIN sources s ON f.source_id = s.id
        ORDER BY f.date_added DESC
      `);

      // Transform to expected FavoriteVideo format
      const favorites = rawFavorites.map((fav: any) => ({
        videoId: fav.video_id,
        dateAdded: fav.date_added,
        sourceType: fav.source_type === 'youtube_channel' || fav.source_type === 'youtube_playlist' ? 'youtube' : fav.source_type,
        sourceId: fav.source_id,
        title: fav.title,
        thumbnail: fav.thumbnail,
        duration: fav.duration
      }));

      return {
        success: true,
        data: favorites || []
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get favorites:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get favorites',
        code: 'GET_FAVORITES_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.FAVORITES.ADD, async (_, videoId: string, sourceId: string): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();
      await dbService.run(`
        INSERT OR REPLACE INTO favorites (video_id, source_id, date_added)
        VALUES (?, ?, ?)
      `, [videoId, sourceId, new Date().toISOString()]);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to add favorite:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add favorite',
        code: 'ADD_FAVORITE_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.FAVORITES.REMOVE, async (_, videoId: string): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();
      await dbService.run(`
        DELETE FROM favorites WHERE video_id = ?
      `, [videoId]);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to remove favorite:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove favorite',
        code: 'REMOVE_FAVORITE_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.FAVORITES.IS_FAVORITE, async (_, videoId: string): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const result = await dbService.get<{ count: number }>(`
        SELECT COUNT(*) as count FROM favorites WHERE video_id = ?
      `, [videoId]);

      return {
        success: true,
        data: (result?.count || 0) > 0
      };
    } catch (error) {
      log.error('[Database IPC] Failed to check favorite status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check favorite',
        code: 'CHECK_FAVORITE_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.FAVORITES.TOGGLE, async (_, videoId: string, sourceId: string): Promise<DatabaseResponse<{ isFavorite: boolean }>> => {
    try {
      const dbService = DatabaseService.getInstance();

      // Check if it's already a favorite
      const existing = await dbService.get<{ count: number }>(`
        SELECT COUNT(*) as count FROM favorites WHERE video_id = ?
      `, [videoId]);

      const isFavorite = (existing?.count || 0) > 0;

      if (isFavorite) {
        // Remove from favorites
        await dbService.run(`DELETE FROM favorites WHERE video_id = ?`, [videoId]);
        return {
          success: true,
          data: { isFavorite: false }
        };
      } else {
        // Add to favorites
        // First, ensure the video exists in the videos table
        const videoExists = await dbService.get<{ count: number }>(`
          SELECT COUNT(*) as count FROM videos WHERE id = ?
        `, [videoId]);

        if (!videoExists || videoExists.count === 0) {
          // Video doesn't exist, create a minimal entry
          // Determine video type from video ID pattern
          let videoType = 'local';
          if (videoId.startsWith('local:')) {
            videoType = 'local';
          } else if (videoId.length === 11 && /^[A-Za-z0-9_-]{11}$/.test(videoId)) {
            videoType = 'youtube';
          }

          await dbService.run(`
            INSERT OR IGNORE INTO videos (id, title, source_id, created_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
          `, [videoId, `Video ${videoId}`, sourceId]);
        }

        // Then, ensure the source exists in the sources table
        const sourceExists = await dbService.get<{ count: number }>(`
          SELECT COUNT(*) as count FROM sources WHERE id = ?
        `, [sourceId]);

        if (!sourceExists || sourceExists.count === 0) {
          // Source doesn't exist, create a minimal entry
          // Determine source type from video ID or source ID pattern
          let sourceType = 'local';
          if (videoId.startsWith('local:') || sourceId.startsWith('local')) {
            sourceType = 'local';
          } else if (videoId.length === 11 && /^[A-Za-z0-9_-]{11}$/.test(videoId)) {
            sourceType = 'youtube_channel';
          }

          await dbService.run(`
            INSERT OR IGNORE INTO sources (id, type, title, sort_preference)
            VALUES (?, ?, ?, ?)
          `, [sourceId, sourceType, `Source ${sourceId}`, 'newestFirst']);
        }

        await dbService.run(`
          INSERT INTO favorites (video_id, source_id, date_added)
          VALUES (?, ?, ?)
        `, [videoId, sourceId, new Date().toISOString()]);
        return {
          success: true,
          data: { isFavorite: true }
        };
      }
    } catch (error) {
      log.error('[Database IPC] Failed to toggle favorite:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle favorite',
        code: 'TOGGLE_FAVORITE_FAILED'
      };
    }
  });

  // Sources Operations
  ipcMain.handle(IPC.SOURCES.GET_ALL, async (): Promise<DatabaseResponse<SourceRecord[]>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const sources = await dbService.all<SourceRecord>(`
        SELECT * FROM sources ORDER BY position ASC, title ASC
      `);

      return {
        success: true,
        data: sources || []
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get sources:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get sources',
        code: 'GET_SOURCES_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.SOURCES.GET_BY_ID, async (_, sourceId: string): Promise<DatabaseResponse<SourceRecord | null>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const source = await dbService.get<SourceRecord>(`
        SELECT * FROM sources WHERE id = ?
      `, [sourceId]);

      return {
        success: true,
        data: source || null
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get source:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get source',
        code: 'GET_SOURCE_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.SOURCES.CREATE, async (_, source: Omit<SourceRecord, 'id'>): Promise<DatabaseResponse<string>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const sourceId = `source_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      await dbService.run(`
        INSERT INTO sources (id, type, title, sort_preference, position, url, channel_id, path, max_depth, thumbnail, total_videos)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        sourceId,
        source.type,
        source.title,
        source.sort_preference || null,
        source.position || null,
        source.url || null,
        source.channel_id || null,
        source.path || null,
        source.max_depth || null,
        (source as any).thumbnail || null,
        (source as any).total_videos || null
      ]);

      return {
        success: true,
        data: sourceId
      };
    } catch (error) {
      log.error('[Database IPC] Failed to create source:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create source',
        code: 'CREATE_SOURCE_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.SOURCES.UPDATE, async (_, sourceId: string, updates: Partial<SourceRecord>): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();

      // Build dynamic update query
      const fields = Object.keys(updates).filter(key => key !== 'id');
      if (fields.length === 0) {
        return { success: true, data: true };
      }

      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(field => (updates as any)[field]);
      values.push(sourceId);

      await dbService.run(`
        UPDATE sources SET ${setClause} WHERE id = ?
      `, values);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to update source:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update source',
        code: 'UPDATE_SOURCE_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.SOURCES.DELETE, async (_, sourceId: string): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();

      // Use transaction to delete source and related data
      await dbService.executeTransaction([
        { sql: `DELETE FROM youtube_api_results WHERE source_id = ?`, params: [sourceId] },
        { sql: `DELETE FROM favorites WHERE source_id = ?`, params: [sourceId] },
        { sql: `DELETE FROM view_records WHERE source_id = ?`, params: [sourceId] },
        { sql: `DELETE FROM videos WHERE source_id = ?`, params: [sourceId] },
        { sql: `DELETE FROM sources WHERE id = ?`, params: [sourceId] }
      ]);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to delete source:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete source',
        code: 'DELETE_SOURCE_FAILED'
      };
    }
  });

  // YouTube API Results Operations
  ipcMain.handle(IPC.YOUTUBE_CACHE_DB.GET_CACHED_RESULTS, async (_, sourceId: string, page: number = 1): Promise<DatabaseResponse<string[]>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const pageSize = 50; // Default page size
      const offset = (page - 1) * pageSize;

      const results = await dbService.all<{ video_id: string }>(`
        SELECT video_id FROM youtube_api_results
        WHERE source_id = ? AND position >= ? AND position < ?
        ORDER BY position ASC
      `, [sourceId, offset + 1, offset + pageSize + 1]);

      const videoIds = (results || []).map(r => r.video_id);

      return {
        success: true,
        data: videoIds
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get cached results:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get cached results',
        code: 'GET_CACHE_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.YOUTUBE_CACHE_DB.SET_CACHED_RESULTS, async (_, sourceId: string, page: number, videoIds: string[]): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const pageSize = 50;
      const basePosition = (page - 1) * pageSize;

      // Clear existing entries for this page range
      await dbService.run(`
        DELETE FROM youtube_api_results
        WHERE source_id = ? AND position >= ? AND position < ?
      `, [sourceId, basePosition + 1, basePosition + pageSize + 1]);

      // Insert new entries
      const queries = videoIds.map((videoId, index) => ({
        sql: `INSERT INTO youtube_api_results (source_id, video_id, position, fetch_timestamp) VALUES (?, ?, ?, ?)`,
        params: [sourceId, videoId, basePosition + index + 1, new Date().toISOString()]
      }));

      if (queries.length > 0) {
        await dbService.executeTransaction(queries);
      }

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to set cached results:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set cached results',
        code: 'SET_CACHE_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.YOUTUBE_CACHE_DB.CLEAR_CACHE, async (_, sourceId: string): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();
      await dbService.run(`
        DELETE FROM youtube_api_results WHERE source_id = ?
      `, [sourceId]);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to clear cache:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear cache',
        code: 'CLEAR_CACHE_FAILED'
      };
    }
  });

  // ============================================================================
  // PHASE 2 HANDLERS: Usage Logs, Time Limits, Usage Extras, Settings
  // ============================================================================

  // Usage Logs Operations
  ipcMain.handle(IPC.USAGE_LOGS.GET_BY_DATE, async (_, date: string): Promise<DatabaseResponse<any>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const { getUsageLogByDate } = await import('../database/queries/usageLogQueries');
      const log = await getUsageLogByDate(dbService, date);

      return {
        success: true,
        data: log
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get usage log:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get usage log',
        code: 'GET_USAGE_LOG_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.USAGE_LOGS.UPSERT, async (_, date: string, secondsUsed: number): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const { upsertUsageLog } = await import('../database/queries/usageLogQueries');
      await upsertUsageLog(dbService, date, secondsUsed);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to upsert usage log:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upsert usage log',
        code: 'UPSERT_USAGE_LOG_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.USAGE_LOGS.INCREMENT, async (_, date: string, secondsToAdd: number): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const { incrementUsageLog } = await import('../database/queries/usageLogQueries');
      await incrementUsageLog(dbService, date, secondsToAdd);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to increment usage log:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to increment usage log',
        code: 'INCREMENT_USAGE_LOG_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.USAGE_LOGS.GET_BY_DATE_RANGE, async (_, startDate: string, endDate: string): Promise<DatabaseResponse<any[]>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const { getUsageLogsByDateRange } = await import('../database/queries/usageLogQueries');
      const logs = await getUsageLogsByDateRange(dbService, startDate, endDate);

      return {
        success: true,
        data: logs
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get usage logs by date range:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get usage logs',
        code: 'GET_USAGE_LOGS_RANGE_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.USAGE_LOGS.GET_MONTHLY, async (_, monthPrefix: string): Promise<DatabaseResponse<number>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const { getMonthlyUsage } = await import('../database/queries/usageLogQueries');
      const totalSeconds = await getMonthlyUsage(dbService, monthPrefix);

      return {
        success: true,
        data: totalSeconds
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get monthly usage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get monthly usage',
        code: 'GET_MONTHLY_USAGE_FAILED'
      };
    }
  });

  // Time Limits Operations
  ipcMain.handle(IPC.TIME_LIMITS.GET, async (): Promise<DatabaseResponse<any>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const { getTimeLimits } = await import('../database/queries/timeLimitQueries');
      const limits = await getTimeLimits(dbService);

      return {
        success: true,
        data: limits
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get time limits:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get time limits',
        code: 'GET_TIME_LIMITS_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.TIME_LIMITS.UPDATE, async (_, timeLimits: any): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const { upsertTimeLimits } = await import('../database/queries/timeLimitQueries');
      await upsertTimeLimits(dbService, timeLimits);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to update time limits:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update time limits',
        code: 'UPDATE_TIME_LIMITS_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.TIME_LIMITS.GET_FOR_DAY, async (_, dayOfWeek: number): Promise<DatabaseResponse<number>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const { getTimeLimitForDay } = await import('../database/queries/timeLimitQueries');
      const minutes = await getTimeLimitForDay(dbService, dayOfWeek);

      return {
        success: true,
        data: minutes
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get time limit for day:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get time limit for day',
        code: 'GET_TIME_LIMIT_DAY_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.TIME_LIMITS.UPDATE_DAY, async (_, dayOfWeek: string, minutes: number): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const { updateDayLimit } = await import('../database/queries/timeLimitQueries');
      await updateDayLimit(dbService, dayOfWeek, minutes);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to update day limit:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update day limit',
        code: 'UPDATE_DAY_LIMIT_FAILED'
      };
    }
  });

  // Usage Extras Operations
  ipcMain.handle(IPC.USAGE_EXTRAS.GET_BY_DATE, async (_, date: string): Promise<DatabaseResponse<any[]>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const { getUsageExtrasByDate } = await import('../database/queries/usageExtraQueries');
      const extras = await getUsageExtrasByDate(dbService, date);

      return {
        success: true,
        data: extras
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get usage extras:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get usage extras',
        code: 'GET_USAGE_EXTRAS_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.USAGE_EXTRAS.GET_TOTAL_MINUTES, async (_, date: string): Promise<DatabaseResponse<number>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const { getTotalExtraMinutes } = await import('../database/queries/usageExtraQueries');
      const totalMinutes = await getTotalExtraMinutes(dbService, date);

      return {
        success: true,
        data: totalMinutes
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get total extra minutes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get total extra minutes',
        code: 'GET_TOTAL_EXTRAS_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.USAGE_EXTRAS.ADD, async (_, date: string, minutesAdded: number, reason?: string, addedBy?: string): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const { addUsageExtra } = await import('../database/queries/usageExtraQueries');
      await addUsageExtra(dbService, date, minutesAdded, reason, addedBy);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to add usage extra:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add usage extra',
        code: 'ADD_USAGE_EXTRA_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.USAGE_EXTRAS.DELETE, async (_, id: number): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const { deleteUsageExtra } = await import('../database/queries/usageExtraQueries');
      await deleteUsageExtra(dbService, id);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to delete usage extra:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete usage extra',
        code: 'DELETE_USAGE_EXTRA_FAILED'
      };
    }
  });

  // Settings Operations
  ipcMain.handle(IPC.DB_SETTINGS.GET_SETTING, async (_, key: string, defaultValue?: any): Promise<DatabaseResponse<any>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const { getSetting } = await import('../database/queries/settingsQueries');
      const value = await getSetting(dbService, key, defaultValue);

      return {
        success: true,
        data: value
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get setting:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get setting',
        code: 'GET_SETTING_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.DB_SETTINGS.SET_SETTING, async (_, key: string, value: any, type?: string, description?: string): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const { setSetting } = await import('../database/queries/settingsQueries');
      await setSetting(dbService, key, value, type as any, description);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to set setting:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set setting',
        code: 'SET_SETTING_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.DB_SETTINGS.GET_BY_NAMESPACE, async (_, namespace: string): Promise<DatabaseResponse<Record<string, any>>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const { getSettingsByNamespace } = await import('../database/queries/settingsQueries');
      const settings = await getSettingsByNamespace(dbService, namespace);

      return {
        success: true,
        data: settings
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get settings by namespace:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get settings by namespace',
        code: 'GET_SETTINGS_NAMESPACE_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.DB_SETTINGS.SET_BY_NAMESPACE, async (_, namespace: string, settings: Record<string, any>): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const { setSettingsByNamespace } = await import('../database/queries/settingsQueries');
      await setSettingsByNamespace(dbService, namespace, settings);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to set settings by namespace:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set settings by namespace',
        code: 'SET_SETTINGS_NAMESPACE_FAILED'
      };
    }
  });

  // ============================================================================
  // Download Operations
  // ============================================================================

  ipcMain.handle(IPC.DOWNLOADS.GET_STATUS, async (_, videoId: string): Promise<DatabaseResponse<any>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const status = await getDownloadStatus(dbService, videoId);

      return {
        success: true,
        data: status || null
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get download status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get download status',
        code: 'GET_DOWNLOAD_STATUS_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.DOWNLOADS.CHECK_DOWNLOADED, async (_, videoId: string): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const isDownloaded = await isVideoDownloaded(dbService, videoId);

      return {
        success: true,
        data: isDownloaded
      };
    } catch (error) {
      log.error('[Database IPC] Failed to check if video is downloaded:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check download status',
        code: 'CHECK_DOWNLOADED_FAILED'
      };
    }
  });

  // Cleanup old downloads (completed >7 days, failed >30 days)
  ipcMain.handle('downloads:cleanup', async (): Promise<DatabaseResponse<number>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const result = await cleanupOldDownloads(dbService);

      return {
        success: true,
        data: result.removed
      };
    } catch (error) {
      log.error('[Database IPC] Failed to cleanup old downloads:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cleanup downloads',
        code: 'CLEANUP_DOWNLOADS_FAILED'
      };
    }
  });

  // ============================================================================
  // Downloaded Videos Operations
  // ============================================================================

  ipcMain.handle(IPC.DOWNLOADED_VIDEOS.GET_ALL, async (): Promise<DatabaseResponse<any[]>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const videos = await getAllDownloadedVideos(dbService);

      return {
        success: true,
        data: videos || []
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get all downloaded videos:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get downloaded videos',
        code: 'GET_DOWNLOADED_VIDEOS_FAILED'
      };
    }
  });

  ipcMain.handle(IPC.DOWNLOADED_VIDEOS.GET_BY_SOURCE, async (_, sourceId: string): Promise<DatabaseResponse<any[]>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const videos = await getDownloadedVideosBySource(dbService, sourceId);

      return {
        success: true,
        data: videos || []
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get downloaded videos by source:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get downloaded videos by source',
        code: 'GET_DOWNLOADED_VIDEOS_BY_SOURCE_FAILED'
      };
    }
  });

  ipcMain.handle('downloaded-videos:get-by-id', async (_, videoId: string): Promise<DatabaseResponse<any>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const video = await getDownloadedVideoById(dbService, videoId);

      return {
        success: true,
        data: video || null
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get downloaded video by ID:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get downloaded video',
        code: 'GET_DOWNLOADED_VIDEO_BY_ID_FAILED'
      };
    }
  });

  ipcMain.handle('downloaded-videos:get-total-size', async (_, sourceId?: string): Promise<DatabaseResponse<number>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const totalSize = await getTotalDownloadedSize(dbService, sourceId);

      return {
        success: true,
        data: totalSize
      };
    } catch (error) {
      log.error('[Database IPC] Failed to get total downloaded size:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get total size',
        code: 'GET_TOTAL_SIZE_FAILED'
      };
    }
  });

  log.info('[Database IPC] All database handlers registered');
}

export default registerDatabaseHandlers;