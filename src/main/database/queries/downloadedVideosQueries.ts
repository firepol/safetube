import DatabaseService from '../../services/DatabaseService';

/**
 * Type-safe query helpers for downloaded_videos table
 * Downloaded videos table maintains permanent registry of successfully downloaded videos
 */

export interface DownloadedVideo {
  id: number;
  video_id: string | null;
  source_id: string;
  title: string;
  file_path: string;
  thumbnail_path: string | null;
  duration: number | null;
  downloaded_at: string;
  file_size: number | null;
  format: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDownloadedVideoInput {
  videoId: string;
  sourceId: string;
  title: string;
  filePath: string;
  thumbnailPath?: string | null;
  duration?: number | null;
  fileSize?: number | null;
  format?: string | null;
}

/**
 * Get all downloaded videos
 */
export async function getAllDownloadedVideos(db: DatabaseService): Promise<DownloadedVideo[]> {
  return db.all<DownloadedVideo>(
    `SELECT id, video_id, source_id, title, file_path, thumbnail_path,
            duration, downloaded_at, file_size, format, created_at, updated_at
     FROM downloaded_videos
     ORDER BY downloaded_at DESC`
  );
}

/**
 * Get downloaded videos for a specific source
 */
export async function getDownloadedVideosBySource(
  db: DatabaseService,
  sourceId: string
): Promise<DownloadedVideo[]> {
  return db.all<DownloadedVideo>(
    `SELECT id, video_id, source_id, title, file_path, thumbnail_path,
            duration, downloaded_at, file_size, format, created_at, updated_at
     FROM downloaded_videos
     WHERE source_id = ?
     ORDER BY downloaded_at DESC`,
    [sourceId]
  );
}

/**
 * Get single downloaded video by video ID
 */
export async function getDownloadedVideoById(
  db: DatabaseService,
  videoId: string
): Promise<DownloadedVideo | null> {
  return db.get<DownloadedVideo>(
    `SELECT id, video_id, source_id, title, file_path, thumbnail_path,
            duration, downloaded_at, file_size, format, created_at, updated_at
     FROM downloaded_videos
     WHERE video_id = ?`,
    [videoId]
  );
}

/**
 * Create new downloaded video record
 */
export async function createDownloadedVideo(
  db: DatabaseService,
  input: CreateDownloadedVideoInput
): Promise<void> {
  await db.run(
    `INSERT INTO downloaded_videos (
      video_id, source_id, title, file_path, thumbnail_path,
      duration, downloaded_at, file_size, format, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      input.videoId,
      input.sourceId,
      input.title,
      input.filePath,
      input.thumbnailPath || null,
      input.duration || null,
      new Date().toISOString(),
      input.fileSize || null,
      input.format || null
    ]
  );
}

/**
 * Check if video is already downloaded
 */
export async function isVideoDownloaded(db: DatabaseService, videoId: string): Promise<boolean> {
  const result = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM downloaded_videos WHERE video_id = ?',
    [videoId]
  );
  return (result?.count || 0) > 0;
}

/**
 * Get total file size of downloaded videos (optionally filtered by source)
 */
export async function getTotalDownloadedSize(
  db: DatabaseService,
  sourceId?: string
): Promise<number> {
  if (sourceId) {
    const result = await db.get<{ total: number }>(
      `SELECT COALESCE(SUM(file_size), 0) as total
       FROM downloaded_videos
       WHERE source_id = ?`,
      [sourceId]
    );
    return result?.total || 0;
  }

  const result = await db.get<{ total: number }>(
    'SELECT COALESCE(SUM(file_size), 0) as total FROM downloaded_videos'
  );
  return result?.total || 0;
}

/**
 * Count downloaded videos (optionally filtered by source)
 */
export async function countDownloadedVideos(
  db: DatabaseService,
  sourceId?: string
): Promise<number> {
  if (sourceId) {
    const result = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM downloaded_videos WHERE source_id = ?',
      [sourceId]
    );
    return result?.count || 0;
  }

  const result = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM downloaded_videos'
  );
  return result?.count || 0;
}

/**
 * Delete downloaded video record
 */
export async function deleteDownloadedVideo(
  db: DatabaseService,
  videoId: string
): Promise<void> {
  await db.run('DELETE FROM downloaded_videos WHERE video_id = ?', [videoId]);
}

/**
 * Update downloaded video file size (useful if calculated after download)
 */
export async function updateDownloadedVideoFileSize(
  db: DatabaseService,
  videoId: string,
  fileSize: number
): Promise<void> {
  await db.run(
    `UPDATE downloaded_videos
     SET file_size = ?, updated_at = CURRENT_TIMESTAMP
     WHERE video_id = ?`,
    [fileSize, videoId]
  );
}

/**
 * Get downloaded videos by format
 */
export async function getDownloadedVideosByFormat(
  db: DatabaseService,
  format: string
): Promise<DownloadedVideo[]> {
  return db.all<DownloadedVideo>(
    `SELECT id, video_id, source_id, title, file_path, thumbnail_path,
            duration, downloaded_at, file_size, format, created_at, updated_at
     FROM downloaded_videos
     WHERE format = ?
     ORDER BY downloaded_at DESC`,
    [format]
  );
}

/**
 * Get recently downloaded videos (last N videos)
 */
export async function getRecentDownloadedVideos(
  db: DatabaseService,
  limit: number = 10
): Promise<DownloadedVideo[]> {
  return db.all<DownloadedVideo>(
    `SELECT id, video_id, source_id, title, file_path, thumbnail_path,
            duration, downloaded_at, file_size, format, created_at, updated_at
     FROM downloaded_videos
     ORDER BY downloaded_at DESC
     LIMIT ?`,
    [limit]
  );
}
