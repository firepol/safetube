import DatabaseService from '../../services/DatabaseService';
import { YouTubeApiResult } from './types';

/**
 * Type-safe query helpers for youtube_api_results table
 * Consolidates YouTube API cache queries from multiple files
 */

/**
 * Get cached YouTube page for a source
 * Used in: databaseHandlers.ts, youtubePageCache.ts
 */
export async function findCachedPage(
  db: DatabaseService,
  sourceId: string,
  pageNumber: number,
  pageSize: number = 50
): Promise<any | null> {
  const start = (pageNumber - 1) * pageSize + 1;
  const end = start + pageSize - 1;
  const pageRange = `${start}-${end}`;

  // Query all video info for this page range
  const rows = await db.all<any>(
    `SELECT v.id, v.title, v.published_at, v.thumbnail, v.duration, v.url,
            v.is_available, v.description, y.position, y.fetch_timestamp
     FROM youtube_api_results y
     JOIN videos v ON y.video_id = v.id
     WHERE y.source_id = ? AND y.page_range = ?
     ORDER BY y.position ASC`,
    [sourceId, pageRange]
  );

  if (!rows || rows.length === 0) {
    return null;
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

  // Fetch totalResults for the source
  const totalResultsRow = await db.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM youtube_api_results WHERE source_id = ?`,
    [sourceId]
  );
  const totalResults = totalResultsRow?.count || 0;

  // Fetch sourceType from sources table
  const sourceRow = await db.get<{ type: string }>(
    `SELECT type FROM sources WHERE id = ?`,
    [sourceId]
  );
  const sourceType = sourceRow?.type || 'youtube_channel';

  return {
    videos,
    pageNumber,
    totalResults,
    timestamp,
    sourceId,
    sourceType
  };
}

/**
 * Save YouTube page results to cache
 * Used in: databaseHandlers.ts, youtubePageCache.ts
 */
export async function saveCachedPage(
  db: DatabaseService,
  sourceId: string,
  pageNumber: number,
  videoIds: string[],
  pageSize: number = 50
): Promise<void> {
  const basePosition = (pageNumber - 1) * pageSize;
  const start = basePosition + 1;
  const end = basePosition + pageSize;
  const pageRange = `${start}-${end}`;

  // Clear existing entries for this page range
  await db.run(
    `DELETE FROM youtube_api_results
     WHERE source_id = ? AND position >= ? AND position < ?`,
    [sourceId, basePosition + 1, basePosition + pageSize + 1]
  );

  // Insert new entries
  const queries = videoIds.map((videoId, index) => ({
    sql: `INSERT INTO youtube_api_results (source_id, video_id, position, page_range, fetch_timestamp)
          VALUES (?, ?, ?, ?, ?)`,
    params: [sourceId, videoId, basePosition + index + 1, pageRange, new Date().toISOString()]
  }));

  if (queries.length > 0) {
    await db.executeTransaction(queries);
  }
}

/**
 * Clear all cached results for a source
 * Used in: databaseHandlers.ts, ipcHandlerRegistry.ts
 */
export async function clearSourceCache(db: DatabaseService, sourceId: string): Promise<void> {
  await db.run('DELETE FROM youtube_api_results WHERE source_id = ?', [sourceId]);
}

/**
 * Get all cached video IDs for a source
 * Used in: databaseHandlers.ts
 */
export async function findCachedVideoIds(
  db: DatabaseService,
  sourceId: string,
  page: number = 1,
  pageSize: number = 50
): Promise<string[]> {
  const offset = (page - 1) * pageSize;

  const results = await db.all<{ video_id: string }>(
    `SELECT video_id FROM youtube_api_results
     WHERE source_id = ? AND position >= ? AND position < ?
     ORDER BY position ASC`,
    [sourceId, offset + 1, offset + pageSize + 1]
  );

  return results.map(r => r.video_id);
}

/**
 * Count cached results for a source
 * Used in: Various cache validation operations
 */
export async function countCachedResults(db: DatabaseService, sourceId: string): Promise<number> {
  const result = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM youtube_api_results WHERE source_id = ?',
    [sourceId]
  );
  return result?.count || 0;
}

/**
 * Delete cache by source (cascade cleanup)
 * Used in: databaseHandlers.ts
 */
export async function deleteYouTubeCacheBySource(
  db: DatabaseService,
  sourceId: string
): Promise<void> {
  await db.run('DELETE FROM youtube_api_results WHERE source_id = ?', [sourceId]);
}
