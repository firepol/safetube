import DatabaseService from '../../services/DatabaseService';
import { ViewRecord, ViewRecordWithVideo } from './types';

/**
 * Type-safe query helpers for view_records table
 * Consolidates watch history queries from multiple files
 */

/**
 * Find view record by video ID
 * Used in: timeTracking.ts, ipcHandlerRegistry.ts, databaseHandlers.ts
 */
export async function findViewRecordByVideoId(
  db: DatabaseService,
  videoId: string
): Promise<ViewRecord | null> {
  return db.get<ViewRecord>(
    `SELECT id, video_id, source_id, position, time_watched, duration, watched,
            first_watched, last_watched, created_at, updated_at
     FROM view_records WHERE video_id = ?`,
    [videoId]
  );
}

/**
 * Get watch history with video details (for history page)
 * Used in: ipcHandlerRegistry.ts, databaseHandlers.ts
 */
export async function findWatchHistory(
  db: DatabaseService,
  limit: number = 50
): Promise<ViewRecordWithVideo[]> {
  return db.all<ViewRecordWithVideo>(
    `SELECT vr.id, vr.video_id, vr.source_id, vr.position, vr.time_watched,
            vr.duration, vr.watched, vr.first_watched, vr.last_watched,
            vr.created_at, vr.updated_at,
            v.title as video_title,
            v.thumbnail as video_thumbnail,
            v.duration as video_duration
     FROM view_records vr
     LEFT JOIN videos v ON vr.video_id = v.id
     ORDER BY vr.last_watched DESC
     LIMIT ?`,
    [limit]
  );
}

/**
 * Get recently watched videos (with time_watched > 0)
 * Used in: databaseHandlers.ts
 */
export async function findRecentlyWatched(
  db: DatabaseService,
  limit: number = 20
): Promise<ViewRecordWithVideo[]> {
  return db.all<ViewRecordWithVideo>(
    `SELECT vr.id, vr.video_id, vr.source_id, vr.position, vr.time_watched,
            vr.duration, vr.watched, vr.first_watched, vr.last_watched,
            vr.created_at, vr.updated_at,
            v.title as video_title,
            v.thumbnail as video_thumbnail,
            v.duration as video_duration
     FROM view_records vr
     LEFT JOIN videos v ON vr.video_id = v.id
     WHERE vr.time_watched > 0
     ORDER BY vr.last_watched DESC
     LIMIT ?`,
    [limit]
  );
}

/**
 * Get last watched video with source info
 * Used in: ipcHandlerRegistry.ts
 */
export async function findLastWatchedVideo(db: DatabaseService): Promise<any | null> {
  return db.get(
    `SELECT vr.video_id as videoId, vr.position, vr.last_watched as lastWatched,
            vr.time_watched as timeWatched, vr.duration, vr.watched, vr.source_id as source,
            v.title, v.thumbnail
     FROM view_records vr
     LEFT JOIN videos v ON vr.video_id = v.id
     ORDER BY vr.last_watched DESC
     LIMIT 1`
  );
}

/**
 * Upsert view record (insert or update if exists)
 * Used in: timeTracking.ts, databaseHandlers.ts
 */
export async function upsertViewRecord(
  db: DatabaseService,
  videoId: string,
  sourceId: string,
  position: number,
  timeWatched: number,
  duration: number | null,
  watched: boolean,
  firstWatched: string,
  lastWatched: string
): Promise<void> {
  await db.run(
    `INSERT OR REPLACE INTO view_records (
       video_id, source_id, position, time_watched, duration, watched,
       first_watched, last_watched
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [videoId, sourceId, position, timeWatched, duration, watched ? 1 : 0, firstWatched, lastWatched]
  );
}

/**
 * Get first watched timestamp for a video (preserve on upsert)
 * Used in: timeTracking.ts
 */
export async function getFirstWatchedTimestamp(
  db: DatabaseService,
  videoId: string
): Promise<string | null> {
  const result = await db.get<{ first_watched: string }>(
    'SELECT first_watched FROM view_records WHERE video_id = ?',
    [videoId]
  );
  return result?.first_watched || null;
}

/**
 * Delete view records by source (cascade cleanup)
 * Used in: databaseHandlers.ts
 */
export async function deleteViewRecordsBySource(
  db: DatabaseService,
  sourceId: string
): Promise<void> {
  await db.run('DELETE FROM view_records WHERE source_id = ?', [sourceId]);
}
