import { ipcMain } from 'electron';
import log from '../logger';
import DatabaseService from '../services/DatabaseService';
import { MigrationService } from '../database/MigrationService';
import SimpleSchemaManager from '../database/SimpleSchemaManager';
import DatabaseErrorHandler from '../services/DatabaseErrorHandler';

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
  sort_order?: number;
  url?: string;
  channel_id?: string;
  path?: string;
  max_depth?: number;
}

/**
 * Database IPC Handlers - Phase 1 Operations
 * Following existing SafeTube IPC handler patterns
 */
export function registerDatabaseHandlers() {
  // YouTube Page Cache: Get a cached page (for preload YouTubePageCache)
  ipcMain.handle('youtube-cache:get-page', async (_, sourceId: string, pageNumber: number): Promise<DatabaseResponse<any>> => {
    try {
      const dbService = DatabaseService.getInstance();
      // Get page size from config or default
      const pageSize = 50;
      const start = (pageNumber - 1) * pageSize + 1;
      const end = start + pageSize - 1;
      const pageRange = `${start}-${end}`;

      // Query all video info for this page range
      const rows = await dbService.all<any>(
        `SELECT v.id, v.title, v.published_at, v.thumbnail, v.duration, v.url, v.is_available, v.description, y.position, y.fetch_timestamp
         FROM youtube_api_results y
         JOIN videos v ON y.video_id = v.id
         WHERE y.source_id = ? AND y.page_range = ?
         ORDER BY y.position ASC`,
        [sourceId, pageRange]
      );
      if (!rows || rows.length === 0) {
        return { success: true, data: null };
      }
      // Compose the CachedYouTubePage object
      const videos = rows.map(r => ({
        id: r.id,
        title: r.title,
        publishedAt: r.published_at,
        thumbnail: r.thumbnail,
        duration: r.duration,
        url: r.url,
        isAvailable: r.is_available,
        description: r.description
      }));
      const fetchTimestamps = rows.map(r => new Date(r.fetch_timestamp).getTime());
      const timestamp = fetchTimestamps.length > 0 ? Math.max(...fetchTimestamps) : Date.now();
      // Fetch totalResults for the source (count of all video_ids)
      const totalResultsRow = await dbService.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM youtube_api_results WHERE source_id = ?`,
        [sourceId]
      );
      const totalResults = totalResultsRow?.count || 0;
      // Fetch sourceType from sources table
      const sourceRow = await dbService.get<{ type: string }>(
        `SELECT type FROM sources WHERE id = ?`,
        [sourceId]
      );
      const sourceType = sourceRow?.type || 'youtube_channel';
      const page: any = {
        videos,
        pageNumber,
        totalResults,
        timestamp,
        sourceId,
        sourceType
      };
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
  ipcMain.handle('database:health-check', async (): Promise<DatabaseResponse<{ isHealthy: boolean; version?: string }>> => {
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
  ipcMain.handle('database:migrate-phase1', async (): Promise<DatabaseResponse<{ summary: any }>> => {
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

  ipcMain.handle('database:verify-migration', async (): Promise<DatabaseResponse<{ integrity: any }>> => {
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
  ipcMain.handle('database:videos:get-by-source', async (_, sourceId: string): Promise<DatabaseResponse<VideoRecord[]>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const videos = await dbService.all<VideoRecord>(`
        SELECT * FROM videos
        WHERE source_id = ?
        ORDER BY title ASC
      `, [sourceId]);

      return {
        success: true,
        data: videos || []
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

  ipcMain.handle('database:videos:get-by-id', async (_, videoId: string): Promise<DatabaseResponse<VideoRecord | null>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const video = await dbService.get<VideoRecord>(`
        SELECT * FROM videos WHERE id = ?
      `, [videoId]);

      return {
        success: true,
        data: video || null
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

  ipcMain.handle('database:videos:search', async (_, query: string, sourceId?: string): Promise<DatabaseResponse<VideoRecord[]>> => {
    try {
      const dbService = DatabaseService.getInstance();
      let sql = `
        SELECT v.* FROM videos v
        JOIN videos_fts vf ON v.id = vf.rowid
        WHERE videos_fts MATCH ?
      `;
      const params: any[] = [query];

      if (sourceId) {
        sql += ` AND v.source_id = ?`;
        params.push(sourceId);
      }

      sql += ` ORDER BY rank LIMIT 100`;

      const videos = await dbService.all<VideoRecord>(sql, params);

      return {
        success: true,
        data: videos || []
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

  ipcMain.handle('database:videos:update-metadata', async (_, videoId: string, metadata: Partial<VideoRecord>): Promise<DatabaseResponse<boolean>> => {
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

  ipcMain.handle('database:videos:update-availability', async (_, videoId: string, isAvailable: boolean): Promise<DatabaseResponse<boolean>> => {
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
  ipcMain.handle('database:view-records:get', async (_, videoId: string): Promise<DatabaseResponse<ViewRecord | null>> => {
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

  ipcMain.handle('database:view-records:update', async (_, videoId: string, update: Partial<ViewRecord>): Promise<DatabaseResponse<boolean>> => {
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

  ipcMain.handle('database:view-records:get-history', async (_, limit: number = 50): Promise<DatabaseResponse<(ViewRecord & VideoRecord)[]>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const history = await dbService.all<ViewRecord & VideoRecord>(`
        SELECT vr.*, v.title, v.thumbnail, v.duration as video_duration
        FROM view_records vr
        JOIN videos v ON vr.video_id = v.id
        ORDER BY vr.last_watched DESC
        LIMIT ?
      `, [limit]);

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

  ipcMain.handle('database:view-records:get-recently-watched', async (_, limit: number = 20): Promise<DatabaseResponse<(ViewRecord & VideoRecord)[]>> => {
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
  ipcMain.handle('database:favorites:get-all', async (): Promise<DatabaseResponse<(FavoriteRecord & VideoRecord)[]>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const favorites = await dbService.all<FavoriteRecord & VideoRecord>(`
        SELECT f.*, v.title, v.thumbnail, v.duration, v.is_available
        FROM favorites f
        JOIN videos v ON f.video_id = v.id
        ORDER BY f.date_added DESC
      `);

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

  ipcMain.handle('database:favorites:add', async (_, videoId: string, sourceId: string): Promise<DatabaseResponse<boolean>> => {
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

  ipcMain.handle('database:favorites:remove', async (_, videoId: string): Promise<DatabaseResponse<boolean>> => {
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

  ipcMain.handle('database:favorites:is-favorite', async (_, videoId: string): Promise<DatabaseResponse<boolean>> => {
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

  ipcMain.handle('database:favorites:toggle', async (_, videoId: string, sourceId: string): Promise<DatabaseResponse<{ isFavorite: boolean }>> => {
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
  ipcMain.handle('database:sources:get-all', async (): Promise<DatabaseResponse<SourceRecord[]>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const sources = await dbService.all<SourceRecord>(`
        SELECT * FROM sources ORDER BY sort_order ASC, title ASC
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

  ipcMain.handle('database:sources:get-by-id', async (_, sourceId: string): Promise<DatabaseResponse<SourceRecord | null>> => {
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

  ipcMain.handle('database:sources:create', async (_, source: Omit<SourceRecord, 'id'>): Promise<DatabaseResponse<string>> => {
    try {
      const dbService = DatabaseService.getInstance();
      const sourceId = `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await dbService.run(`
        INSERT INTO sources (id, type, title, sort_order, url, channel_id, path, max_depth, thumbnail, total_videos)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        sourceId,
        source.type,
        source.title,
        source.sort_order || null,
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

  ipcMain.handle('database:sources:update', async (_, sourceId: string, updates: Partial<SourceRecord>): Promise<DatabaseResponse<boolean>> => {
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

  ipcMain.handle('database:sources:delete', async (_, sourceId: string): Promise<DatabaseResponse<boolean>> => {
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
  ipcMain.handle('database:youtube-cache:get-cached-results', async (_, sourceId: string, page: number = 1): Promise<DatabaseResponse<string[]>> => {
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

  ipcMain.handle('database:youtube-cache:set-cached-results', async (_, sourceId: string, page: number, videoIds: string[]): Promise<DatabaseResponse<boolean>> => {
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

  ipcMain.handle('database:youtube-cache:clear-cache', async (_, sourceId: string): Promise<DatabaseResponse<boolean>> => {
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

  ipcMain.handle('youtube-cache:save', async (_, sourceId: string, cache: any): Promise<DatabaseResponse<boolean>> => {
    try {
      const dbService = DatabaseService.getInstance();

      // Save the complete cache object to youtube_api_results table
      await dbService.run(`
        INSERT OR REPLACE INTO youtube_api_results (
          source_id, page_number, video_ids, fetched_at, cache_data
        ) VALUES (?, ?, ?, datetime('now'), ?)
      `, [
        sourceId,
        1, // Use page 1 for complete cache
        JSON.stringify(cache.videos?.map((v: any) => v.id) || []),
        JSON.stringify(cache)
      ]);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      log.error('[Database IPC] Failed to save YouTube cache:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save YouTube cache',
        code: 'SAVE_CACHE_FAILED'
      };
    }
  });

  log.info('[Database IPC] All database handlers registered');
}

export default registerDatabaseHandlers;