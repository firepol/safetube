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

      if (isLocalVideo) {
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
 * Record video watching time with enhanced metadata
 */
export async function recordVideoWatching(
  videoId: string,
  position: number,
  timeWatched: number,
  duration?: number
): Promise<void> {
  try {
    // Get video metadata for enhanced history storage
    const videoMetadata = await getVideoMetadata(videoId);

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
      source: videoMetadata.source,
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

    // Also record in usage log
    await recordUsageTime(timeWatched);
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
    const timeExtra = await readTimeExtra();
    const today = new Date().toISOString().split('T')[0];
    
    if (!timeExtra[today]) {
      timeExtra[today] = 0;
    }
    
    timeExtra[today] += minutes;
    
    await writeTimeExtra(timeExtra);
    
    logVerbose(`[TimeTracking] Added ${minutes} minutes extra time for ${today}`);
  } catch (error) {
    logVerbose(`[TimeTracking] Error adding extra time: ${error}`);
    throw error;
  }
}

