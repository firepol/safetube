import {
  readTimeLimits,
  readUsageLog,
  writeUsageLog,
  readTimeExtra,
  writeTimeExtra,
  readVideoSources
} from './fileUtils';
import { TimeLimits, UsageLog, WatchedVideo, TimeExtra } from '../shared/types';
import { logVerbose } from '../shared/logging';
import { parseVideoId, extractPathFromVideoId } from '../shared/fileUtils';
import { SourceTimeState, SourceTimeEnforcement } from './database/queries/types';
import fs from 'fs';
import path from 'path';

interface VideoMetadata {
  title: string;
  thumbnail: string;
  source: string;
  duration: number;
}

/**
 * Write view record to database for persistence and history tracking
 */
async function writeViewRecordToDatabase(watchedEntry: WatchedVideo): Promise<void> {
  try {
    const { DatabaseService } = await import('./services/DatabaseService');
    const dbService = DatabaseService.getInstance();

    // Ensure video exists in videos table before creating view record
    const sourceId = watchedEntry.source || 'unknown';

    logVerbose(`[TimeTracking] writeViewRecordToDatabase called for videoId: ${watchedEntry.videoId}, sourceId: ${sourceId}`);
    logVerbose(`[TimeTracking] watchedEntry:`, JSON.stringify(watchedEntry, null, 2));

    // Ensure source exists FIRST (because videos table has FK to sources)
    const sourceExists = await dbService.get<any>(
      'SELECT id FROM sources WHERE id = ?',
      [sourceId]
    );
    logVerbose(`[TimeTracking] Source exists check for ${sourceId}:`, sourceExists);

    if (!sourceExists) {
      // Create a placeholder source for unknown videos
      logVerbose(`[TimeTracking] Creating placeholder source for ${sourceId}`);

      // Determine type based on videoId to satisfy CHECK constraint
      const parseResult = parseVideoId(watchedEntry.videoId);
      const isLocalVideo = parseResult.success && parseResult.parsed?.type === 'local';

      if (sourceId === 'wishlist') {
        // For wishlist videos, create a wishlist source with placeholder URL
        await dbService.run(`
          INSERT INTO sources (id, type, title, position, url)
          VALUES (?, 'youtube_channel', 'Wishlist', 999, ?)
        `, [sourceId, 'https://safetube.app/wishlist']);
      } else if (isLocalVideo) {
        // For local videos, extract directory path from videoId
        const videoPath = extractPathFromVideoId(watchedEntry.videoId);
        const directoryPath = videoPath ? path.dirname(videoPath) : '/unknown';

        await dbService.run(`
          INSERT INTO sources (id, type, title, position, path)
          VALUES (?, 'local', ?, 999, ?)
        `, [sourceId, sourceId, directoryPath]);
      } else {
        // For YouTube videos, use youtube_channel type with url
        await dbService.run(`
          INSERT INTO sources (id, type, title, position, url)
          VALUES (?, 'youtube_channel', ?, 999, ?)
        `, [sourceId, sourceId, `https://youtube.com/watch?v=${watchedEntry.videoId}`]);
      }

      logVerbose(`[TimeTracking] Created placeholder source for ${sourceId}`);
    }

    // Check if video exists
    const videoExists = await dbService.get<any>(
      'SELECT id FROM videos WHERE id = ?',
      [watchedEntry.videoId]
    );
    logVerbose(`[TimeTracking] Video exists check for ${watchedEntry.videoId}:`, videoExists);

    if (!videoExists) {
      // Insert video into videos table
      logVerbose(`[TimeTracking] Creating video entry for ${watchedEntry.videoId} with sourceId: ${sourceId}`);
      await dbService.run(`
        INSERT INTO videos (
          id, title, thumbnail, duration, url, source_id, is_available
        ) VALUES (?, ?, ?, ?, ?, ?, 1)
      `, [
        watchedEntry.videoId,
        watchedEntry.title || `Video ${watchedEntry.videoId}`,
        watchedEntry.thumbnail || '',
        watchedEntry.duration || 0,
        watchedEntry.videoId, // URL is the video ID for local videos
        sourceId
      ]);
      logVerbose(`[TimeTracking] Created video entry for ${watchedEntry.videoId}`);
    }

    // Insert or update view record
    logVerbose(`[TimeTracking] Inserting/updating view record for ${watchedEntry.videoId}`);
    await dbService.run(`
      INSERT OR REPLACE INTO view_records (
        video_id, source_id, position, time_watched, duration, watched,
        first_watched, last_watched
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      watchedEntry.videoId,
      sourceId,
      watchedEntry.position,
      watchedEntry.timeWatched,
      watchedEntry.duration,
      watchedEntry.watched ? 1 : 0,
      watchedEntry.firstWatched,
      watchedEntry.lastWatched
    ]);

    logVerbose(`[TimeTracking] Written view record for ${watchedEntry.videoId} to database`);
  } catch (error) {
    logVerbose(`[TimeTracking] Error writing view record to database: ${error}`);
    logVerbose(`[TimeTracking] Error stack:`, error);
    throw error;
  }
}

/**
 * Get video metadata for enhanced history storage
 */
async function getVideoMetadata(videoId: string): Promise<VideoMetadata> {
  try {
    const parseResult = parseVideoId(videoId);

    // Handle local videos
    if (parseResult.success && parseResult.parsed?.type === 'local') {
      const filePath = extractPathFromVideoId(videoId);
      if (filePath) {
        // Extract title from filename
        const title = path.basename(filePath, path.extname(filePath));

        // Find thumbnail for local video
        const thumbnail = findThumbnailForLocalVideo(filePath);

        // Try to determine source from video sources config
        const source = await findSourceForLocalVideo(filePath);

        // Extract duration
        let duration = 0;
        try {
          const { extractVideoDuration } = await import('../shared/videoDurationUtils');
          duration = await extractVideoDuration(filePath);
        } catch (error) {
          logVerbose(`[TimeTracking] Could not extract duration for ${filePath}:`, error);
        }

        return {
          title,
          thumbnail,
          source: source || 'local',
          duration
        };
      }
    }

    // Handle YouTube videos - check global videos cache
    if (parseResult.success && parseResult.parsed?.type === 'youtube') {
      const video = global.currentVideos?.find((v: any) => v.id === videoId);
      if (video) {
        return {
          title: video.title || `Video ${videoId}`,
          thumbnail: video.thumbnail || '',
          source: video.sourceId || 'youtube',
          duration: video.duration || 0
        };
      }
    }

    // Check if video is in wishlist (approved videos from wishlist)
    try {
      const { DatabaseService } = await import('./services/DatabaseService');
      const dbService = DatabaseService.getInstance();
      const wishlistVideo = await dbService.get<any>(
        'SELECT video_id, title, thumbnail, duration FROM wishlist WHERE video_id = ? AND status = ?',
        [videoId, 'approved']
      );

      if (wishlistVideo) {
        return {
          title: wishlistVideo.title || `Video ${videoId}`,
          thumbnail: wishlistVideo.thumbnail || '',
          source: 'wishlist',
          duration: wishlistVideo.duration || 0
        };
      }
    } catch (error) {
      logVerbose(`[TimeTracking] Could not check wishlist for ${videoId}:`, error);
    }

    // Fallback for unknown or legacy videos
    return {
      title: `Video ${videoId}`,
      thumbnail: '',
      source: 'unknown',
      duration: 0
    };
  } catch (error) {
    logVerbose(`[TimeTracking] Error getting video metadata for ${videoId}:`, error);
    return {
      title: `Video ${videoId}`,
      thumbnail: '',
      source: 'unknown',
      duration: 0
    };
  }
}

/**
 * Find thumbnail file for a local video
 */
function findThumbnailForLocalVideo(videoPath: string): string {
  try {
    const videoDir = path.dirname(videoPath);
    const videoName = path.basename(videoPath, path.extname(videoPath));
    const thumbnailExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

    for (const ext of thumbnailExtensions) {
      const thumbnailPath = path.join(videoDir, videoName + ext);
      if (fs.existsSync(thumbnailPath)) {
        return thumbnailPath;
      }
    }
    return '';
  } catch (error) {
    return '';
  }
}

/**
 * Find which source a local video belongs to
 */
async function findSourceForLocalVideo(videoPath: string): Promise<string | null> {
  try {
    // Try database first (new system)
    try {
      const { DatabaseService } = await import('./services/DatabaseService');
      const dbService = DatabaseService.getInstance();

      const sources = await dbService.all<any>(`
        SELECT id, path FROM sources WHERE type = 'local' ORDER BY LENGTH(path) DESC
      `);

      for (const source of sources) {
        if (source.path && videoPath.startsWith(source.path)) {
          logVerbose(`[TimeTracking] Found source ${source.id} for ${videoPath}`);
          return source.id;
        }
      }
    } catch (dbError) {
      logVerbose(`[TimeTracking] Database query failed, falling back to JSON:`, dbError);
    }

    // Fallback to JSON file (old system)
    const sources = await readVideoSources();
    for (const source of sources) {
      if (source.type === 'local' && source.path && videoPath.startsWith(source.path)) {
        logVerbose(`[TimeTracking] Found source ${source.id} for ${videoPath} (from JSON)`);
        return source.id;
      }
    }

    logVerbose(`[TimeTracking] No source found for ${videoPath}`);
    return null;
  } catch (error) {
    logVerbose(`[TimeTracking] Error finding source for local video:`, error);
    return null;
  }
}

/**
 * Record video watching time with enhanced metadata and optional source-level tracking
 * @returns Object with global tracking state and optional source-level state
 */
export async function recordVideoWatching(
  videoId: string,
  position: number,
  timeWatched: number,
  duration?: number,
  sourceId?: string
): Promise<{
  success?: boolean;
  globalTimeState?: { timeUsedToday: number; timeRemaining: number; isLimitReached: boolean };
  sourceBlocked?: boolean;
  blockedSourceId?: string;
  sourceTimeState?: SourceTimeState;
}> {
  try {
    // Get video metadata for enhanced history storage
    const videoMetadata = await getVideoMetadata(videoId);
    const finalSourceId = sourceId || videoMetadata.source;

    const watchedEntry: WatchedVideo = {
      videoId,
      position,
      lastWatched: new Date().toISOString(),
      timeWatched,
      duration: duration || videoMetadata.duration,
      watched: (duration || videoMetadata.duration) ? position >= (duration || videoMetadata.duration) * 0.9 : false,
      // Enhanced metadata for faster history loading
      title: videoMetadata.title,
      thumbnail: videoMetadata.thumbnail,
      source: finalSourceId,
      firstWatched: new Date().toISOString() // Will be overridden for existing entries
    };

    // Check if this video already exists in the database
    try {
      const { DatabaseService } = await import('./services/DatabaseService');
      const dbService = DatabaseService.getInstance();
      const existing = await dbService.get<any>('SELECT first_watched FROM view_records WHERE video_id = ?', [videoId]);
      if (existing && existing.first_watched) {
        watchedEntry.firstWatched = existing.first_watched;
      }
    } catch (error) {
      logVerbose(`[TimeTracking] Could not check existing first_watched date: ${error}`);
    }

    // Write to database (primary storage)
    await writeViewRecordToDatabase(watchedEntry);

    // Record global usage time
    await recordUsageTime(timeWatched);

    // Record source-specific watch time if sourceId is available
    let sourceTimeState: SourceTimeState | undefined;
    let sourceBlocked = false;
    let blockedSourceId: string | undefined;

    if (finalSourceId && finalSourceId !== 'unknown') {
      try {
        await recordSourceWatchTime(finalSourceId, timeWatched);

        // Check source time limit enforcement
        const enforcement = await enforceSourceTimeLimit(finalSourceId);
        if (!enforcement.canWatch) {
          sourceBlocked = true;
          blockedSourceId = enforcement.blockedSourceId;
        }

        // Get current source time state
        sourceTimeState = await getSourceTimeState(finalSourceId);
      } catch (error) {
        logVerbose(`[TimeTracking] Non-fatal error recording source time for ${finalSourceId}: ${error}`);
        // Don't throw - continue with global tracking only
      }
    }

    // Return object with tracking results (backward compatible with void expectations)
    return {
      success: true,
      sourceBlocked,
      blockedSourceId,
      sourceTimeState
    };
  } catch (error) {
    logVerbose(`[TimeTracking] Error recording video watching: ${error}`);
    throw error;
  }
}

/**
 * Record usage time in the daily log
 */
async function recordUsageTime(timeWatchedSeconds: number): Promise<void> {
  try {
    const usageLog = await readUsageLog();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    if (!usageLog[today]) {
      usageLog[today] = 0;
    }

    usageLog[today] += timeWatchedSeconds;

    await writeUsageLog(usageLog);
  } catch (error) {
    logVerbose(`[TimeTracking] Error recording usage time: ${error}`);
    throw error;
  }
}

/**
 * Get time tracking state
 */
export async function getTimeTrackingState(): Promise<{
  currentDate: string;
  timeUsedToday: number;
  timeLimitToday: number;
  timeRemaining: number;
  isLimitReached: boolean;
  extraTimeToday?: number;
}> {
  try {
    const [timeLimits, usageLog, timeExtra] = await Promise.all([
      readTimeLimits(),
      readUsageLog(),
      readTimeExtra()
    ]);

    const currentDate = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    const timeLimitMinutes = (timeLimits[dayOfWeek as keyof TimeLimits] as number) || 0;
    const extraTimeMinutes = timeExtra[currentDate] || 0;
    const timeLimitSeconds = (timeLimitMinutes + extraTimeMinutes) * 60;
    const timeUsedToday = usageLog[currentDate] || 0;
    const timeRemaining = Math.max(0, timeLimitSeconds - timeUsedToday);
    const isLimitReached = timeUsedToday >= timeLimitSeconds;

    return {
      currentDate,
      timeUsedToday,
      timeLimitToday: timeLimitSeconds,
      timeRemaining,
      isLimitReached,
      extraTimeToday: extraTimeMinutes
    };
  } catch (error) {
    logVerbose(`[TimeTracking] Error getting time tracking state: ${error}`);
    throw error;
  }
}

/**
 * Add extra time for today
 */
export async function addExtraTime(minutes: number): Promise<void> {
  try {
    const { DatabaseService } = await import('./services/DatabaseService');
    const dbService = DatabaseService.getInstance();
    const today = new Date().toISOString().split('T')[0];

    // Insert into usage_extras table directly (append-only log)
    await dbService.run(`
      INSERT INTO usage_extras (date, minutes_added, reason, added_by)
      VALUES (?, ?, ?, ?)
    `, [today, minutes, 'Manual addition', 'system']);

    logVerbose(`[TimeTracking] Added ${minutes} minutes extra time for ${today}`);
  } catch (error) {
    logVerbose(`[TimeTracking] Error adding extra time: ${error}`);
    throw error;
  }
}

/**
 * Get current time state for a specific source
 * Calculates remaining time, checks if limit is exceeded
 * @param sourceId - Source ID to check
 * @returns SourceTimeState with current usage and limit info
 */
export async function getSourceTimeState(sourceId: string): Promise<SourceTimeState> {
  try {
    const { DatabaseService } = await import('./services/DatabaseService');
    const dbService = DatabaseService.getInstance();

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Query source table for daily_time_limit_minutes
    const source = await dbService.get<any>(
      'SELECT daily_time_limit_minutes FROM sources WHERE id = ?',
      [sourceId]
    );

    if (!source) {
      logVerbose(`[TimeTracking] Source ${sourceId} not found`);
      throw new Error(`Source ${sourceId} not found`);
    }

    const dailyLimitMinutes = source.daily_time_limit_minutes;

    // Query usage_logs for today's usage for this source
    const usageResult = await dbService.get<any>(
      'SELECT SUM(seconds_used) as total_seconds FROM usage_logs WHERE source_id = ? AND date = ?',
      [sourceId, today]
    );

    const secondsUsedToday = usageResult?.total_seconds || 0;

    // Query usage_extras for today's extensions for this source
    const extrasResult = await dbService.get<any>(
      'SELECT SUM(minutes_added) as total_minutes FROM usage_extras WHERE source_id = ? AND date = ?',
      [sourceId, today]
    );

    const extensionMinutes = extrasResult?.total_minutes || 0;
    const extensionSeconds = extensionMinutes * 60;

    // Calculate remaining time
    let secondsRemainingToday: number | null = null;
    let isLimitExceeded = false;

    if (dailyLimitMinutes === null) {
      // No limit (unlimited)
      secondsRemainingToday = null;
      isLimitExceeded = false;
    } else {
      const totalAllowedSeconds = (dailyLimitMinutes * 60) + extensionSeconds;
      secondsRemainingToday = Math.max(0, totalAllowedSeconds - secondsUsedToday);
      isLimitExceeded = secondsUsedToday >= totalAllowedSeconds;
    }

    return {
      sourceId,
      dailyLimitMinutes,
      secondsUsedToday,
      secondsRemainingToday,
      isLimitExceeded,
      lastResetDate: today
    };
  } catch (error) {
    logVerbose(`[TimeTracking] Error getting source time state for ${sourceId}: ${error}`);
    throw error;
  }
}

/**
 * Record watch time for a specific source
 * @param sourceId - Source ID to record time for
 * @param secondsWatched - Time watched in seconds
 */
export async function recordSourceWatchTime(sourceId: string, secondsWatched: number): Promise<void> {
  try {
    const { DatabaseService } = await import('./services/DatabaseService');
    const dbService = DatabaseService.getInstance();

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Round seconds to nearest second
    const roundedSeconds = Math.round(secondsWatched);

    // Check if today's entry exists in usage_logs for this source
    const existing = await dbService.get<any>(
      'SELECT id, seconds_used FROM usage_logs WHERE source_id = ? AND date = ?',
      [sourceId, today]
    );

    if (existing) {
      // Increment seconds_used
      await dbService.run(
        'UPDATE usage_logs SET seconds_used = seconds_used + ? WHERE source_id = ? AND date = ?',
        [roundedSeconds, sourceId, today]
      );

      logVerbose(`[TimeTracking] Updated source usage for ${sourceId} on ${today}: +${roundedSeconds} seconds`);
    } else {
      // Create new entry with today's date
      await dbService.run(
        'INSERT INTO usage_logs (date, seconds_used, source_id) VALUES (?, ?, ?)',
        [today, roundedSeconds, sourceId]
      );

      logVerbose(`[TimeTracking] Created new usage entry for ${sourceId} on ${today}: ${roundedSeconds} seconds`);
    }
  } catch (error) {
    logVerbose(`[TimeTracking] Error recording source watch time for ${sourceId}: ${error}`);
    throw error;
  }
}

/**
 * Check if source daily time limit has been exceeded
 * @param sourceId - Source ID to check
 * @returns Enforcement decision object
 */
export async function enforceSourceTimeLimit(sourceId: string): Promise<SourceTimeEnforcement> {
  try {
    const sourceTimeState = await getSourceTimeState(sourceId);

    // If no limit (NULL), can watch
    if (sourceTimeState.dailyLimitMinutes === null) {
      return { canWatch: true };
    }

    // Check if limit exceeded
    if (sourceTimeState.isLimitExceeded) {
      return {
        canWatch: false,
        blockedSourceId: sourceId,
        blockedReason: 'source_limit'
      };
    }

    // Under limit, can watch
    return {
      canWatch: true,
      secondsRemaining: sourceTimeState.secondsRemainingToday || 0,
      minutesRemaining: sourceTimeState.secondsRemainingToday !== null
        ? Math.floor(sourceTimeState.secondsRemainingToday / 60)
        : undefined
    };
  } catch (error) {
    logVerbose(`[TimeTracking] Error enforcing source time limit for ${sourceId}: ${error}`);
    throw error;
  }
}

/**
 * Grant temporary time extension for a specific source
 * @param sourceId - Source ID to extend
 * @param minutesAdded - Minutes to add to today's limit (1-60)
 * @param reason - Reason for extension
 * @param addedBy - Parent name/identifier
 */
export async function grantSourceTimeExtension(
  sourceId: string,
  minutesAdded: number,
  reason: string,
  addedBy: string
): Promise<void> {
  try {
    const { DatabaseService } = await import('./services/DatabaseService');
    const dbService = DatabaseService.getInstance();

    // Validate sourceId exists
    const source = await dbService.get<any>(
      'SELECT id FROM sources WHERE id = ?',
      [sourceId]
    );

    if (!source) {
      throw new Error(`Source ${sourceId} not found`);
    }

    // Validate minutesAdded is -60 to 60 (but not 0)
    if (!Number.isInteger(minutesAdded) || Math.abs(minutesAdded) > 60 || minutesAdded === 0) {
      throw new Error(`Extension duration must be between -60 and 60 minutes (non-zero), got: ${minutesAdded}`);
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Insert into usage_extras table
    await dbService.run(
      'INSERT INTO usage_extras (date, source_id, minutes_added, reason, added_by) VALUES (?, ?, ?, ?, ?)',
      [today, sourceId, minutesAdded, reason, addedBy]
    );

    logVerbose(`[TimeTracking] Extension granted: source=${sourceId}, +${minutesAdded} min, reason=${reason}, addedBy=${addedBy}`);
  } catch (error) {
    logVerbose(`[TimeTracking] Error granting source time extension for ${sourceId}: ${error}`);
    throw error;
  }
}

/**
 * Reset daily source usage at midnight
 *
 * NOTE: Source usage is automatically reset via date-based queries in the usage_logs table.
 * Each day is tracked separately by the date column (YYYY-MM-DD format).
 * When a new day begins, queries for today's usage return no results (since there are no records for the new date),
 * effectively resetting the daily tracking automatically.
 *
 * This function is a no-op that documents this behavior and can be called by the daily reset mechanism
 * if additional logic is needed in the future.
 *
 * @example
 * // Called at midnight as part of the existing daily reset mechanism
 * await resetDailySourceUsage();
 * // Result: New day automatically has 0 usage for all sources (date-based queries find no records)
 */
export async function resetDailySourceUsage(): Promise<void> {
  try {
    logVerbose(`[TimeTracking] Daily source usage reset: automatic via date-based queries`);
    // No action needed - source usage resets automatically via date column
    // usage_logs and usage_extras use YYYY-MM-DD format, so new day = new entries
  } catch (error) {
    logVerbose(`[TimeTracking] Error resetting daily source usage: ${error}`);
    throw error;
  }
}


/**
 * Request time extension (called from Kid Screen/Time Up Page)
 */
export async function requestTimeExtension(sourceId: string | null, minutes: number): Promise<boolean> {
  try {
    const { DatabaseService } = await import('./services/DatabaseService');
    const dbService = DatabaseService.getInstance();

    await dbService.run(
      'INSERT INTO extension_requests (source_id, minutes_requested, status) VALUES (?, ?, ?)',
      [sourceId, minutes, 'pending']
    );

    logVerbose(`[TimeTracking] Created extension request: source=${sourceId || 'global'}, minutes=${minutes}`);
    return true;
  } catch (error) {
    logVerbose(`[TimeTracking] Error creating extension request: ${error}`);
    return false;
  }
}

/**
 * Get all pending extension requests
 */
export async function getPendingExtensionRequests(): Promise<any[]> {
  try {
    const { DatabaseService } = await import('./services/DatabaseService');
    const dbService = DatabaseService.getInstance();

    const rows = await dbService.all<any>(`
       SELECT r.id, r.source_id, r.minutes_requested, r.status, r.created_at, s.title as source_title
       FROM extension_requests r
       LEFT JOIN sources s ON r.source_id = s.id
       WHERE r.status = 'pending'
       ORDER BY r.created_at DESC
     `);

    return rows.map(row => ({
      id: row.id,
      sourceId: row.source_id,
      sourceName: row.source_title || (row.source_id ? 'Unknown Source' : 'Global Time'),
      minutesRequested: row.minutes_requested,
      status: row.status,
      createdAt: row.created_at
    }));
  } catch (error) {
    logVerbose(`[TimeTracking] Error getting pending requests: ${error}`);
    return [];
  }
}

/**
 * Resolve an extension request (approve/deny)
 */
export async function resolveExtensionRequest(requestId: number, approved: boolean, approvedBy?: string): Promise<void> {
  try {
    const { DatabaseService } = await import('./services/DatabaseService');
    const dbService = DatabaseService.getInstance();

    const status = approved ? 'approved' : 'denied';
    const now = new Date().toISOString();

    // Start transaction
    await dbService.run('BEGIN TRANSACTION');

    try {
      // Update request status
      await dbService.run(
        'UPDATE extension_requests SET status = ?, resolved_at = ? WHERE id = ?',
        [status, now, requestId]
      );

      if (approved) {
        // Get request details
        const request = await dbService.get<any>(
          'SELECT source_id, minutes_requested FROM extension_requests WHERE id = ?',
          [requestId]
        );

        if (request) {
          if (request.source_id) {
            await grantSourceTimeExtension(request.source_id, request.minutes_requested, 'Request Approved', approvedBy || 'Admin');
          } else {
            // Global time extension
            await addExtraTime(request.minutes_requested);
          }
        }
      }

      await dbService.run('COMMIT');
      logVerbose(`[TimeTracking] Resolved request ${requestId}: ${status}`);
    } catch (err) {
      await dbService.run('ROLLBACK');
      throw err;
    }

  } catch (error) {
    logVerbose(`[TimeTracking] Error resolving request ${requestId}: ${error}`);
    throw error;
  }
}
