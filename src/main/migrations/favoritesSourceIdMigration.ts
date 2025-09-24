import { FavoriteVideo, WatchedVideo, VideoSource, FavoritesConfig } from '../../shared/types';
import { readFavoritesConfig, writeFavoritesConfig, readWatchedVideos, readVideoSources } from '../fileUtils';
import { logger } from '../logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AppPaths } from '../appPaths';

/**
 * Migration script to populate sourceId field in favorites
 *
 * Strategy:
 * 1. Check if favorites already have sourceId (skip if already migrated)
 * 2. Create backup of favorites before migration
 * 3. Try to match favorites with watch history source field
 * 4. For YouTube videos without history match, try to match by channel
 * 5. Mark unmatchable favorites with sourceId: 'unknown'
 */

export interface MigrationResult {
  success: boolean;
  migrated: number;
  matched: number;
  unknown: number;
  errors: string[];
}

/**
 * Execute the favorites sourceId migration
 */
export async function migrateFavoritesSourceId(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    migrated: 0,
    matched: 0,
    unknown: 0,
    errors: []
  };

  try {
    logger.info('Starting favorites sourceId migration...');

    // Load favorites
    const favoritesConfig = await readFavoritesConfig();
    const favorites = favoritesConfig.favorites || [];

    // Check if migration is needed
    const needsMigration = favorites.some(fav => !fav.sourceId);
    if (!needsMigration) {
      logger.info('All favorites already have sourceId, skipping migration');
      return result;
    }

    // Create backup before migration
    await createBackup(favoritesConfig);

    // Load watch history and sources
    const watchHistory = await readWatchedVideos();
    const sources = await readVideoSources();

    // Create lookup maps for faster matching
    const historyMap = new Map<string, WatchedVideo>();
    for (const entry of watchHistory) {
      historyMap.set(entry.videoId, entry);
    }

    // Migrate each favorite
    let modified = false;
    for (const favorite of favorites) {
      // Skip if already has sourceId
      if (favorite.sourceId) {
        continue;
      }

      let sourceId: string | undefined;

      // Try to match with watch history
      const historyEntry = historyMap.get(favorite.videoId);
      if (historyEntry?.source) {
        sourceId = historyEntry.source;
        result.matched++;
        logger.verbose(`Matched favorite ${favorite.videoId} with history source: ${sourceId}`);
      }

      // If no match found, try source-based matching for YouTube videos
      if (!sourceId && favorite.sourceType === 'youtube') {
        sourceId = await matchYouTubeVideoToSource(favorite, sources);
        if (sourceId) {
          result.matched++;
          logger.verbose(`Matched YouTube favorite ${favorite.videoId} to source: ${sourceId}`);
        }
      }

      // If still no match, mark as unknown
      if (!sourceId) {
        sourceId = 'unknown';
        result.unknown++;
        logger.warn(`Could not match favorite ${favorite.videoId} to any source, marking as unknown`);
      }

      // Update the favorite
      favorite.sourceId = sourceId;
      result.migrated++;
      modified = true;
    }

    // Save updated favorites if any changes were made
    if (modified) {
      await writeFavoritesConfig({
        ...favoritesConfig,
        favorites,
        lastModified: new Date().toISOString()
      });

      logger.info(`Favorites migration complete: ${result.migrated} migrated, ${result.matched} matched, ${result.unknown} unknown`);
    } else {
      logger.info('No favorites needed migration');
    }

    return result;
  } catch (error) {
    result.success = false;
    const errorMsg = `Favorites migration failed: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMsg);
    logger.error(errorMsg);
    return result;
  }
}

/**
 * Try to match a YouTube video to a source based on available metadata
 * Note: This is a best-effort match without YouTube API (API integration in Phase 8)
 */
async function matchYouTubeVideoToSource(
  favorite: FavoriteVideo,
  sources: VideoSource[]
): Promise<string | undefined> {
  // For now, we can't reliably match YouTube videos without the YouTube API
  // This will be enhanced when the YouTube API integration is added in Phase 8

  // Try to match by checking if the video ID is in any YouTube source
  // This is a fallback and may not work for all cases
  const youtubeSources = sources.filter(s => s.type === 'youtube_channel' || s.type === 'youtube_playlist');

  // If there's only one YouTube source, use it as a best guess
  if (youtubeSources.length === 1) {
    logger.verbose(`Only one YouTube source exists, using it for favorite ${favorite.videoId}`);
    return youtubeSources[0].id;
  }

  // Otherwise, we can't determine the source without API
  return undefined;
}

/**
 * Create a backup of favorites before migration
 */
async function createBackup(favoritesConfig: FavoritesConfig): Promise<void> {
  try {
    const configDir = AppPaths.getConfigDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(configDir, `favorites.backup.${timestamp}.json`);

    await fs.writeFile(backupPath, JSON.stringify(favoritesConfig, null, 2), 'utf-8');
    logger.info(`Created favorites backup at: ${backupPath}`);
  } catch (error) {
    logger.error(`Failed to create favorites backup: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Rollback migration by restoring from the most recent backup
 */
export async function rollbackFavoritesMigration(): Promise<boolean> {
  try {
    const configDir = AppPaths.getConfigDir();
    const files = await fs.readdir(configDir);

    // Find the most recent backup
    const backupFiles = files
      .filter(f => f.startsWith('favorites.backup.') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (backupFiles.length === 0) {
      logger.error('No backup file found for rollback');
      return false;
    }

    const latestBackup = backupFiles[0];
    const backupPath = path.join(configDir, latestBackup);
    const favoritesPath = path.join(configDir, 'favorites.json');

    // Read backup and restore
    const backupData = await fs.readFile(backupPath, 'utf-8');
    await fs.writeFile(favoritesPath, backupData, 'utf-8');

    logger.info(`Rolled back favorites from backup: ${latestBackup}`);
    return true;
  } catch (error) {
    logger.error(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}