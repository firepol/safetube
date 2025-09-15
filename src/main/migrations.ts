import { readWatchedVideos, writeWatchedVideos } from './fileUtils';
import { WatchedVideo } from '../shared/types';
import { parseVideoId, isEncodedFilePath, decodeFilePath, createLocalVideoId } from '../shared/fileUtils';
import { logVerbose } from '../shared/logging';
import fs from 'fs';
import path from 'path';

interface MigrationResult {
  totalVideos: number;
  migratedVideos: number;
  skippedVideos: number;
  errors: string[];
}

/**
 * Migrate existing watched.json entries to new video ID format and enhanced metadata
 */
export async function migrateWatchedHistory(): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalVideos: 0,
    migratedVideos: 0,
    skippedVideos: 0,
    errors: []
  };

  try {
    logVerbose('[Migration] Starting watched history migration...');
    const watchedVideos = await readWatchedVideos();
    result.totalVideos = watchedVideos.length;

    if (watchedVideos.length === 0) {
      logVerbose('[Migration] No watched videos to migrate');
      return result;
    }

    const migratedVideos: WatchedVideo[] = [];
    const backupPath = `${process.cwd()}/config/watched.json.backup.${Date.now()}`;

    // Create backup before migration
    try {
      const originalPath = `${process.cwd()}/config/watched.json`;
      if (fs.existsSync(originalPath)) {
        fs.copyFileSync(originalPath, backupPath);
        logVerbose(`[Migration] Created backup: ${backupPath}`);
      }
    } catch (error) {
      result.errors.push(`Failed to create backup: ${error}`);
    }

    for (const video of watchedVideos) {
      try {
        const migratedVideo = await migrateVideoEntry(video);
        migratedVideos.push(migratedVideo);

        if (migratedVideo.videoId !== video.videoId) {
          result.migratedVideos++;
          logVerbose(`[Migration] Migrated: ${video.videoId} -> ${migratedVideo.videoId}`);
        } else if (hasEnhancedMetadata(migratedVideo) && !hasEnhancedMetadata(video)) {
          result.migratedVideos++;
          logVerbose(`[Migration] Enhanced metadata for: ${video.videoId}`);
        } else {
          result.skippedVideos++;
        }
      } catch (error) {
        result.errors.push(`Failed to migrate ${video.videoId}: ${error}`);
        result.skippedVideos++;
        // Keep original entry on error
        migratedVideos.push(video);
      }
    }

    // Write migrated data
    await writeWatchedVideos(migratedVideos);
    logVerbose(`[Migration] Migration complete: ${result.migratedVideos} migrated, ${result.skippedVideos} skipped, ${result.errors.length} errors`);

  } catch (error) {
    result.errors.push(`Migration failed: ${error}`);
    logVerbose(`[Migration] Migration failed: ${error}`);
  }

  return result;
}

/**
 * Migrate a single video entry
 */
async function migrateVideoEntry(video: WatchedVideo): Promise<WatchedVideo> {
  const parseResult = parseVideoId(video.videoId);

  // If already in new format and has metadata, no migration needed
  if (parseResult.success && hasEnhancedMetadata(video)) {
    return video;
  }

  // Try to convert legacy encoded local video IDs
  if (!parseResult.success && isEncodedFilePath(video.videoId)) {
    try {
      const filePath = decodeFilePath(video.videoId);
      const newVideoId = createLocalVideoId(filePath);

      logVerbose(`[Migration] Converting encoded ID: ${video.videoId} -> ${newVideoId}`);

      return {
        ...video,
        videoId: newVideoId,
        // Try to add metadata if not present
        title: video.title || path.basename(filePath, path.extname(filePath)),
        thumbnail: video.thumbnail || findThumbnailForLocalVideo(filePath),
        source: video.source || 'local',
        firstWatched: video.firstWatched || video.lastWatched
      };
    } catch (error) {
      logVerbose(`[Migration] Failed to decode legacy ID ${video.videoId}: ${error}`);
      // Fall through to try metadata enhancement
    }
  }

  // Enhance metadata for existing entries that lack it
  if (!hasEnhancedMetadata(video)) {
    const enhancedVideo = await enhanceVideoMetadata(video);
    return enhancedVideo;
  }

  // Return as-is if no migration needed
  return video;
}

/**
 * Check if video entry has enhanced metadata
 */
function hasEnhancedMetadata(video: WatchedVideo): boolean {
  return !!(video.title || video.thumbnail || video.source);
}

/**
 * Enhance video entry with metadata
 */
async function enhanceVideoMetadata(video: WatchedVideo): Promise<WatchedVideo> {
  const parseResult = parseVideoId(video.videoId);

  if (parseResult.success && parseResult.parsed?.type === 'local') {
    const filePath = parseResult.parsed.path;
    if (filePath) {
      return {
        ...video,
        title: video.title || path.basename(filePath, path.extname(filePath)),
        thumbnail: video.thumbnail || findThumbnailForLocalVideo(filePath),
        source: video.source || 'local',
        firstWatched: video.firstWatched || video.lastWatched
      };
    }
  }

  // For YouTube videos, try to get metadata from global cache
  if (parseResult.success && parseResult.parsed?.type === 'youtube') {
    const globalVideo = global.currentVideos?.find((v: any) => v.id === video.videoId);
    if (globalVideo) {
      return {
        ...video,
        title: video.title || globalVideo.title || `Video ${video.videoId}`,
        thumbnail: video.thumbnail || globalVideo.thumbnail || '',
        source: video.source || globalVideo.sourceId || 'youtube',
        firstWatched: video.firstWatched || video.lastWatched
      };
    }
  }

  // Fallback: add basic metadata
  return {
    ...video,
    title: video.title || `Video ${video.videoId}`,
    thumbnail: video.thumbnail || '',
    source: video.source || 'unknown',
    firstWatched: video.firstWatched || video.lastWatched
  };
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
 * Check if migration is needed for watched history
 */
export async function needsHistoryMigration(): Promise<boolean> {
  try {
    const watchedVideos = await readWatchedVideos();

    // Check if any entries need migration
    for (const video of watchedVideos) {
      const parseResult = parseVideoId(video.videoId);

      // Legacy encoded format needs migration
      if (!parseResult.success && isEncodedFilePath(video.videoId)) {
        return true;
      }

      // Missing metadata needs enhancement
      if (!hasEnhancedMetadata(video)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    logVerbose(`[Migration] Error checking migration needs: ${error}`);
    return false;
  }
}