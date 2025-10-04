import DatabaseService from '../../services/DatabaseService';

/**
 * Type-safe query helpers for downloads table
 * Downloads table tracks active and recent download operations (transient data)
 */

export interface Download {
  id: number;
  video_id: string;
  source_id: string | null;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;
  start_time: number | null;
  end_time: number | null;
  error_message: string | null;
  file_path: string | null;
  created_at: string;
  updated_at: string;
}

export type DownloadStatus = Download['status'];

/**
 * Get download status for a specific video
 */
export async function getDownloadStatus(
  db: DatabaseService,
  videoId: string
): Promise<Download | null> {
  return db.get<Download>(
    `SELECT id, video_id, source_id, status, progress, start_time, end_time,
            error_message, file_path, created_at, updated_at
     FROM downloads WHERE video_id = ?`,
    [videoId]
  );
}

/**
 * Get all downloads with optional status filter
 */
export async function getAllDownloads(
  db: DatabaseService,
  status?: DownloadStatus
): Promise<Download[]> {
  if (status) {
    return db.all<Download>(
      `SELECT id, video_id, source_id, status, progress, start_time, end_time,
              error_message, file_path, created_at, updated_at
       FROM downloads WHERE status = ?
       ORDER BY created_at DESC`,
      [status]
    );
  }

  return db.all<Download>(
    `SELECT id, video_id, source_id, status, progress, start_time, end_time,
            error_message, file_path, created_at, updated_at
     FROM downloads
     ORDER BY id DESC`
  );
}

/**
 * Get all active downloads (pending or downloading)
 */
export async function getActiveDownloads(db: DatabaseService): Promise<Download[]> {
  return db.all<Download>(
    `SELECT id, video_id, source_id, status, progress, start_time, end_time,
            error_message, file_path, created_at, updated_at
     FROM downloads
     WHERE status IN ('pending', 'downloading')
     ORDER BY start_time ASC`
  );
}

/**
 * Create new download record with pending status
 */
export async function createDownload(
  db: DatabaseService,
  videoId: string,
  sourceId: string
): Promise<void> {
  await db.run(
    `INSERT OR REPLACE INTO downloads (video_id, source_id, status, progress, start_time, updated_at)
     VALUES (?, ?, 'pending', 0, ?, CURRENT_TIMESTAMP)`,
    [videoId, sourceId, Date.now()]
  );
}

/**
 * Update download progress (0-100)
 */
export async function updateDownloadProgress(
  db: DatabaseService,
  videoId: string,
  progress: number
): Promise<void> {
  await db.run(
    `UPDATE downloads
     SET progress = ?, status = 'downloading', updated_at = CURRENT_TIMESTAMP
     WHERE video_id = ?`,
    [Math.max(0, Math.min(100, progress)), videoId]
  );
}

/**
 * Mark download as completed
 */
export async function markDownloadCompleted(
  db: DatabaseService,
  videoId: string,
  filePath: string
): Promise<void> {
  await db.run(
    `UPDATE downloads
     SET status = 'completed', progress = 100, end_time = ?, file_path = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE video_id = ?`,
    [Date.now(), filePath, videoId]
  );
}

/**
 * Mark download as failed with error message
 */
export async function markDownloadFailed(
  db: DatabaseService,
  videoId: string,
  errorMessage: string
): Promise<void> {
  await db.run(
    `UPDATE downloads
     SET status = 'failed', end_time = ?, error_message = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE video_id = ?`,
    [Date.now(), errorMessage, videoId]
  );
}

/**
 * Delete download record
 */
export async function deleteDownload(db: DatabaseService, videoId: string): Promise<void> {
  await db.run('DELETE FROM downloads WHERE video_id = ?', [videoId]);
}

/**
 * Cleanup old download records
 * - Remove completed downloads older than 7 days
 * - Remove failed downloads older than 30 days
 */
export async function cleanupOldDownloads(db: DatabaseService): Promise<{ removed: number }> {
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

  // Delete completed downloads older than 7 days
  const completedResult = await db.run(
    `DELETE FROM downloads
     WHERE status = 'completed' AND end_time < ?`,
    [sevenDaysAgo]
  );

  // Delete failed downloads older than 30 days
  const failedResult = await db.run(
    `DELETE FROM downloads
     WHERE status = 'failed' AND end_time < ?`,
    [thirtyDaysAgo]
  );

  const totalRemoved = (completedResult.changes || 0) + (failedResult.changes || 0);

  return { removed: totalRemoved };
}

/**
 * Count downloads by status
 */
export async function countDownloadsByStatus(
  db: DatabaseService,
  status: DownloadStatus
): Promise<number> {
  const result = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM downloads WHERE status = ?',
    [status]
  );
  return result?.count || 0;
}

/**
 * Check if video is currently being downloaded
 */
export async function isDownloading(db: DatabaseService, videoId: string): Promise<boolean> {
  const result = await db.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM downloads
     WHERE video_id = ? AND status IN ('pending', 'downloading')`,
    [videoId]
  );
  return (result?.count || 0) > 0;
}
