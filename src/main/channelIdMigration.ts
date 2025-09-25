import fs from 'fs';
import { AppPaths } from './appPaths';
import { readMainSettings } from './fileUtils';
import { YouTubeAPI } from './youtube-api';
import { extractChannelId } from '../shared/videoSourceUtils';
import { logVerbose } from '../shared/logging';
import log from './logger';

/**
 * Background migration to populate channelId for YouTube channel sources
 * Runs on app startup, non-blocking, with error tolerance
 */
export async function migrateChannelIds(): Promise<void> {
  try {
    logVerbose('[ChannelMigration] Starting channelId migration...');

    const sourcesPath = AppPaths.getConfigPath('videoSources.json');

    // Check if sources file exists
    if (!fs.existsSync(sourcesPath)) {
      logVerbose('[ChannelMigration] No video sources file found, skipping migration');
      return;
    }

    // Load sources
    const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));

    // Find YouTube channel sources without channelId
    const sourcesToMigrate = sources.filter((source: any) =>
      source.type === 'youtube_channel' && !source.channelId
    );

    if (sourcesToMigrate.length === 0) {
      logVerbose('[ChannelMigration] All YouTube channel sources already have channelId, skipping');
      return;
    }

    logVerbose(`[ChannelMigration] Found ${sourcesToMigrate.length} sources needing channelId`);

    // Get YouTube API key
    let settings;
    try {
      settings = await readMainSettings();
    } catch (error) {
      logVerbose('[ChannelMigration] Could not read main settings, skipping migration:', error);
      return;
    }

    const apiKey = settings.youtubeApiKey;
    if (!apiKey) {
      logVerbose('[ChannelMigration] No YouTube API key configured, skipping migration');
      return;
    }

    // Process sources in background (non-blocking)
    setTimeout(async () => {
      await processSources(sources, sourcesToMigrate, apiKey, sourcesPath);
    }, 2000); // Delay 2 seconds to not block startup

  } catch (error) {
    // Silent failure - don't block app startup
    logVerbose('[ChannelMigration] Migration failed, continuing app startup:', error);
  }
}

async function processSources(
  allSources: any[],
  sourcesToMigrate: any[],
  apiKey: string,
  sourcesPath: string
): Promise<void> {
  try {
    const youtubeApi = new YouTubeAPI(apiKey);
    let updatedCount = 0;

    for (const source of sourcesToMigrate) {
      try {
        let channelId: string | null = null;

        // Try to extract channelId directly from URL first (for /channel/UC... URLs)
        channelId = extractChannelId(source.url);

        if (!channelId) {
          // For @username URLs, use YouTube API to resolve
          const match = source.url.match(/youtube\.com\/@([^\/]+)/);
          if (match) {
            const username = match[1];
            logVerbose(`[ChannelMigration] Resolving channelId for @${username}`);

            try {
              const searchResult = await youtubeApi.searchChannelByUsername(username);
              if (searchResult && searchResult.id && searchResult.id.channelId) {
                channelId = searchResult.id.channelId;
              }
            } catch (apiError) {
              logVerbose(`[ChannelMigration] API error for ${username}:`, apiError);
              // Continue with next source - don't fail the whole migration
              continue;
            }
          }
        }

        if (channelId) {
          source.channelId = channelId;
          updatedCount++;
          logVerbose(`[ChannelMigration] Added channelId ${channelId} to source ${source.title}`);
        } else {
          logVerbose(`[ChannelMigration] Could not resolve channelId for ${source.title} (${source.url})`);
        }
      } catch (error) {
        logVerbose(`[ChannelMigration] Error processing source ${source.title}:`, error);
        // Continue with next source
      }
    }

    // Save updated sources if any changes were made
    if (updatedCount > 0) {
      try {
        fs.writeFileSync(sourcesPath, JSON.stringify(allSources, null, 2));
        logVerbose(`[ChannelMigration] Successfully populated ${updatedCount} channelIds`);
      } catch (writeError) {
        log.error('[ChannelMigration] Failed to save updated sources:', writeError);
      }
    } else {
      logVerbose('[ChannelMigration] No channelIds could be resolved');
    }

  } catch (error) {
    logVerbose('[ChannelMigration] Background processing failed:', error);
  }
}