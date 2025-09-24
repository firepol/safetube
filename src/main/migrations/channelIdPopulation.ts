import { VideoSource, YouTubeChannelSource } from '../../shared/types';
import { readVideoSources, writeVideoSources } from '../fileUtils';
import { logger } from '../logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AppPaths } from '../appPaths';

/**
 * Migration script to populate channelId field in YouTube channel sources
 *
 * Strategy:
 * 1. Check if YouTube sources already have channelId (skip if already populated)
 * 2. Create backup of video sources before migration
 * 3. Extract channel ID from /channel/UC... URLs (direct extraction)
 * 4. For @username URLs, note that YouTube API will be needed (Phase 8)
 * 5. Update sources with extracted channel IDs
 */

export interface ChannelIdMigrationResult {
  success: boolean;
  populated: number;
  failed: number;
  errors: string[];
}

/**
 * Execute the channel ID population migration
 */
export async function populateChannelIds(): Promise<ChannelIdMigrationResult> {
  const result: ChannelIdMigrationResult = {
    success: true,
    populated: 0,
    failed: 0,
    errors: []
  };

  try {
    logger.info('Starting channel ID population migration...');

    // Load video sources
    const sources = await readVideoSources();

    // Check if migration is needed
    const youtubeChannels = sources.filter(s => s.type === 'youtube_channel') as YouTubeChannelSource[];
    const needsMigration = youtubeChannels.some(ch => !ch.channelId);

    if (!needsMigration) {
      logger.info('All YouTube channels already have channelId, skipping migration');
      return result;
    }

    // Create backup before migration
    await createSourcesBackup(sources);

    // Populate channel IDs
    let modified = false;
    for (const source of sources) {
      if (source.type === 'youtube_channel') {
        const channelSource = source as YouTubeChannelSource;

        // Skip if already has channelId
        if (channelSource.channelId) {
          continue;
        }

        try {
          const channelId = await extractChannelIdFromUrl(channelSource.url);

          if (channelId) {
            channelSource.channelId = channelId;
            result.populated++;
            modified = true;
            logger.info(`Populated channel ID for source ${source.id}: ${channelId}`);
          } else {
            result.failed++;
            result.errors.push(`Could not extract channel ID from URL: ${channelSource.url}`);
            logger.warn(`Failed to extract channel ID from URL: ${channelSource.url}`);
          }
        } catch (error) {
          result.failed++;
          const errorMsg = `Error extracting channel ID for ${source.id}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }
    }

    // Save updated sources if any changes were made
    if (modified) {
      await writeVideoSources(sources);
      logger.info(`Channel ID population complete: ${result.populated} populated, ${result.failed} failed`);
    } else {
      logger.info('No channel IDs needed population');
    }

    return result;
  } catch (error) {
    result.success = false;
    const errorMsg = `Channel ID migration failed: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMsg);
    logger.error(errorMsg);
    return result;
  }
}

/**
 * Extract channel ID from YouTube URL
 *
 * Supported formats:
 * - https://www.youtube.com/channel/UC... (direct channel ID)
 * - https://www.youtube.com/c/ChannelName (requires API - will fail for now)
 * - https://www.youtube.com/@username (requires API - will fail for now)
 */
async function extractChannelIdFromUrl(url: string): Promise<string | null> {
  try {
    // Handle /channel/UC... format (direct extraction)
    const channelMatch = url.match(/\/channel\/([^\/\?#]+)/);
    if (channelMatch) {
      const channelId = channelMatch[1];
      // Validate it looks like a channel ID (starts with UC)
      if (channelId.startsWith('UC')) {
        return channelId;
      }
    }

    // Handle custom URLs and @username format
    // These require YouTube API which will be implemented in Phase 8
    if (url.includes('/@') || url.includes('/c/')) {
      logger.warn(`URL requires YouTube API for channel ID extraction: ${url}`);
      logger.warn('This will be supported in Phase 8 when YouTube API integration is added');
      return null;
    }

    logger.warn(`Unsupported YouTube URL format: ${url}`);
    return null;
  } catch (error) {
    logger.error(`Error parsing YouTube URL ${url}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Create a backup of video sources before migration
 */
async function createSourcesBackup(sources: VideoSource[]): Promise<void> {
  try {
    const configDir = AppPaths.getConfigDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(configDir, `videoSources.backup.${timestamp}.json`);

    await fs.writeFile(backupPath, JSON.stringify(sources, null, 2), 'utf-8');
    logger.info(`Created video sources backup at: ${backupPath}`);
  } catch (error) {
    logger.error(`Failed to create video sources backup: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Rollback migration by restoring from the most recent backup
 */
export async function rollbackChannelIdMigration(): Promise<boolean> {
  try {
    const configDir = AppPaths.getConfigDir();
    const files = await fs.readdir(configDir);

    // Find the most recent backup
    const backupFiles = files
      .filter(f => f.startsWith('videoSources.backup.') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (backupFiles.length === 0) {
      logger.error('No backup file found for rollback');
      return false;
    }

    const latestBackup = backupFiles[0];
    const backupPath = path.join(configDir, latestBackup);
    const sourcesPath = path.join(configDir, 'videoSources.json');

    // Read backup and restore
    const backupData = await fs.readFile(backupPath, 'utf-8');
    await fs.writeFile(sourcesPath, backupData, 'utf-8');

    logger.info(`Rolled back video sources from backup: ${latestBackup}`);
    return true;
  } catch (error) {
    logger.error(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}