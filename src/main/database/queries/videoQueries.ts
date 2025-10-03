import DatabaseService from '../../services/DatabaseService';
import { Video } from './types';

/**
 * Type-safe query helpers for videos table
 * Consolidates common video queries from multiple files
 */

/**
 * Find video by ID
 * Used in: index.ts, ipcHandlerRegistry.ts, databaseHandlers.ts
 */
export async function findVideoById(db: DatabaseService, id: string): Promise<Video | null> {
  return db.get<Video>(
    `SELECT id, title, published_at, thumbnail, duration, url, is_available,
            description, source_id, created_at, updated_at
     FROM videos WHERE id = ?`,
    [id]
  );
}

/**
 * Find videos by source ID
 * Used in: ipcHandlerRegistry.ts, databaseHandlers.ts, videoDataService.ts
 */
export async function findVideosBySource(db: DatabaseService, sourceId: string): Promise<Video[]> {
  return db.all<Video>(
    `SELECT id, title, published_at, thumbnail, duration, url, is_available,
            description, source_id, created_at, updated_at
     FROM videos WHERE source_id = ?
     ORDER BY published_at DESC`,
    [sourceId]
  );
}

/**
 * Find videos by multiple IDs (batch query)
 * Used in: index.ts for performance optimization
 */
export async function findVideosByIds(db: DatabaseService, videoIds: string[]): Promise<Video[]> {
  if (videoIds.length === 0) return [];

  const placeholders = videoIds.map(() => '?').join(',');
  return db.all<Video>(
    `SELECT id, title, published_at, thumbnail, duration, url, is_available,
            description, source_id, created_at, updated_at
     FROM videos WHERE id IN (${placeholders})`,
    videoIds
  );
}

/**
 * Search videos by title/description (full-text search)
 * Used in: databaseHandlers.ts
 */
export async function searchVideos(db: DatabaseService, query: string, sourceId?: string): Promise<Video[]> {
  let sql = `
    SELECT v.id, v.title, v.published_at, v.thumbnail, v.duration, v.url,
           v.is_available, v.description, v.source_id, v.created_at, v.updated_at
    FROM videos v
    JOIN videos_fts vf ON v.id = vf.id
    WHERE videos_fts MATCH ?
  `;

  const params: any[] = [query];

  if (sourceId) {
    sql += ` AND v.source_id = ?`;
    params.push(sourceId);
  }

  sql += ` ORDER BY rank LIMIT 100`;

  return db.all<Video>(sql, params);
}

/**
 * Update video availability
 * Used in: databaseHandlers.ts
 */
export async function updateVideoAvailability(
  db: DatabaseService,
  videoId: string,
  isAvailable: boolean
): Promise<void> {
  await db.run(
    `UPDATE videos SET is_available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [isAvailable ? 1 : 0, videoId]
  );
}

/**
 * Check if video exists
 * Used in: timeTracking.ts, index.ts
 */
export async function videoExists(db: DatabaseService, videoId: string): Promise<boolean> {
  const result = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM videos WHERE id = ?',
    [videoId]
  );
  return (result?.count || 0) > 0;
}

/**
 * Batch upsert videos (for performance)
 * Used in: videoDataService.ts, index.ts
 */
export async function batchUpsertVideos(db: DatabaseService, videos: any[]): Promise<void> {
  if (videos.length === 0) return;

  await db.batchUpsertVideos(videos);
}
