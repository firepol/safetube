import DatabaseService from '../../services/DatabaseService';
import { Favorite, FavoriteWithVideo } from './types';

/**
 * Type-safe query helpers for favorites table
 * Consolidates favorite queries from multiple files
 */

/**
 * Get all favorites with video metadata
 * Used in: ipcHandlerRegistry.ts, databaseHandlers.ts, videoDataService.ts, index.ts
 */
export async function findAllFavorites(db: DatabaseService): Promise<FavoriteWithVideo[]> {
  return db.all<FavoriteWithVideo>(
    `SELECT f.id, f.video_id, f.source_id, f.date_added, f.created_at,
            v.title as video_title,
            v.thumbnail as video_thumbnail,
            v.duration as video_duration,
            v.url as video_url,
            v.published_at as video_published_at,
            v.description as video_description,
            s.title as source_title,
            s.type as source_type
     FROM favorites f
     LEFT JOIN videos v ON f.video_id = v.id
     LEFT JOIN sources s ON f.source_id = s.id
     ORDER BY f.date_added DESC`
  );
}

/**
 * Check if video is favorited
 * Used in: databaseHandlers.ts
 */
export async function isFavorite(db: DatabaseService, videoId: string): Promise<boolean> {
  const result = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM favorites WHERE video_id = ?',
    [videoId]
  );
  return (result?.count || 0) > 0;
}

/**
 * Add video to favorites
 * Used in: databaseHandlers.ts
 */
export async function addFavorite(
  db: DatabaseService,
  videoId: string,
  sourceId: string,
  dateAdded: string = new Date().toISOString()
): Promise<void> {
  await db.run(
    `INSERT OR REPLACE INTO favorites (video_id, source_id, date_added)
     VALUES (?, ?, ?)`,
    [videoId, sourceId, dateAdded]
  );
}

/**
 * Remove video from favorites
 * Used in: databaseHandlers.ts
 */
export async function removeFavorite(db: DatabaseService, videoId: string): Promise<void> {
  await db.run('DELETE FROM favorites WHERE video_id = ?', [videoId]);
}

/**
 * Toggle favorite status (add if not exists, remove if exists)
 * Used in: databaseHandlers.ts
 */
export async function toggleFavorite(
  db: DatabaseService,
  videoId: string,
  sourceId: string
): Promise<boolean> {
  const favorited = await isFavorite(db, videoId);

  if (favorited) {
    await removeFavorite(db, videoId);
    return false;
  } else {
    await addFavorite(db, videoId, sourceId);
    return true;
  }
}

/**
 * Count total favorites
 * Used in: lightweightSourceResolver.ts, index.ts, videoDataService.ts
 */
export async function countFavorites(db: DatabaseService): Promise<number> {
  const result = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM favorites'
  );
  return result?.count || 0;
}

/**
 * Delete favorites by source (cascade cleanup)
 * Used in: databaseHandlers.ts
 */
export async function deleteFavoritesBySource(
  db: DatabaseService,
  sourceId: string
): Promise<void> {
  await db.run('DELETE FROM favorites WHERE source_id = ?', [sourceId]);
}

/**
 * Find favorite by video ID
 * Used in: databaseHandlers.ts
 */
export async function findFavoriteByVideoId(
  db: DatabaseService,
  videoId: string
): Promise<Favorite | null> {
  return db.get<Favorite>(
    `SELECT id, video_id, source_id, date_added, created_at
     FROM favorites WHERE video_id = ?`,
    [videoId]
  );
}
