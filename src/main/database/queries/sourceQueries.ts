import DatabaseService from '../../services/DatabaseService';
import { Source, SourceType } from './types';

/**
 * Type-safe query helpers for sources table
 * Consolidates common source queries from multiple files
 */

/**
 * Find source by ID
 * Used in: index.ts, ipcHandlerRegistry.ts, lightweightSourceResolver.ts, videoDataService.ts
 */
export async function findSourceById(db: DatabaseService, id: string): Promise<Source | null> {
  return db.get<Source>(
    `SELECT id, type, title, sort_preference, position, url, channel_id, path, max_depth,
            thumbnail, total_videos, created_at, updated_at
     FROM sources WHERE id = ?`,
    [id]
  );
}

/**
 * Find all sources ordered by position or title
 * Used in: index.ts, ipcHandlerRegistry.ts, videoDataService.ts
 */
export async function findAllSources(db: DatabaseService, orderBy: 'position' | 'title' = 'position'): Promise<Source[]> {
  const orderClause = orderBy === 'position'
    ? 'ORDER BY position ASC, title ASC'
    : 'ORDER BY title ASC';

  return db.all<Source>(
    `SELECT id, type, title, sort_preference, position, url, channel_id, path, max_depth,
            thumbnail, total_videos, created_at, updated_at
     FROM sources ${orderClause}`
  );
}

/**
 * Find sources by type
 * Used in: index.ts, videoDataService.ts, timeTracking.ts
 */
export async function findSourcesByType(db: DatabaseService, type: SourceType): Promise<Source[]> {
  return db.all<Source>(
    `SELECT id, type, title, sort_preference, position, url, channel_id, path, max_depth,
            thumbnail, total_videos, created_at, updated_at
     FROM sources WHERE type = ?
     ORDER BY position ASC, title ASC`,
    [type]
  );
}

/**
 * Find stale YouTube sources (for background refresh)
 * Used in: videoDataService.ts
 */
export async function findStaleSources(db: DatabaseService, thresholdDate: string): Promise<Source[]> {
  return db.all<Source>(
    `SELECT id, type, url, channel_id, title, thumbnail, total_videos
     FROM sources
     WHERE (type = 'youtube_channel' OR type = 'youtube_playlist')
       AND (updated_at IS NULL OR updated_at < ?)`,
    [thresholdDate]
  );
}

/**
 * Update source video count and thumbnail
 * Used in: videoDataService.ts, ipcHandlerRegistry.ts
 */
export async function updateSourceMetadata(
  db: DatabaseService,
  id: string,
  totalVideos?: number,
  thumbnail?: string
): Promise<void> {
  const updates: string[] = [];
  const params: any[] = [];

  if (totalVideos !== undefined) {
    updates.push('total_videos = ?');
    params.push(totalVideos);
  }

  if (thumbnail !== undefined) {
    updates.push('thumbnail = ?');
    params.push(thumbnail);
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db.run(
      `UPDATE sources SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }
}

/**
 * Count total sources
 * Used in: Various admin/stats operations
 */
export async function countSources(db: DatabaseService): Promise<number> {
  const result = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM sources'
  );
  return result?.count || 0;
}

/**
 * Delete source and cascade to related records
 * Used in: ipcHandlerRegistry.ts, databaseHandlers.ts
 */
export async function deleteSource(db: DatabaseService, sourceId: string): Promise<void> {
  // Foreign key constraints will cascade delete to:
  // - youtube_api_results
  // - favorites
  // - view_records
  // - videos
  await db.run('DELETE FROM sources WHERE id = ?', [sourceId]);
}
