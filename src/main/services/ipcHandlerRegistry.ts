import fs from 'fs';
import path from 'path';

import { ipcMain } from 'electron';

import { createLocalVideoId } from '../../shared/fileUtils';
import { logVerbose } from '../../shared/logging';
import { AppPaths } from '../appPaths';
import { readTimeLimits, readMainSettings, writeMainSettings } from '../fileUtils';
import log from '../logger';
import { recordVideoWatching, getTimeTrackingState } from '../timeTracking';
import { YouTubeAPI } from '../youtube-api';
import registerDatabaseHandlers from '../ipc/databaseHandlers';
import { extractChannelId, extractPlaylistId } from '../../shared/videoSourceUtils';
import {
  scanLocalFolder,
  getLocalFolderContents,
  countVideosInFolder,
  countVideosRecursively,
  getFlattenedContent,
  filterDuplicateVideos
} from './localVideoService';
import { getDlnaFile } from './networkService';
import { IPC } from '../../shared/ipc-channels';
import * as videoCodecUtils from '../videoCodecUtils';

// Video Data Handlers
export function registerVideoDataHandlers() {
  // Get local file handler
  ipcMain.handle(IPC.LOCAL_FILES.GET_LOCAL_FILE, async (event, filePath: string) => {
    try {
      // Convert file:// URL to actual file path
      let decodedPath = decodeURIComponent(filePath.replace('file://', ''));

      // Normalize Windows paths - convert backslashes to forward slashes for file:// URLs
      if (process.platform === 'win32') {
        decodedPath = decodedPath.replace(/\\/g, '/');
      }


      // Check if file exists (use original path for filesystem operations)
      const originalPath = filePath.replace('file://', '');
      if (!fs.existsSync(originalPath)) {
        log.error('[IPC] File not found:', originalPath);
        throw new Error('File not found');
      }

      // Return the file:// URL for the video element with normalized path
      const fileUrl = `file://${decodedPath}`;
      return fileUrl;
    } catch (error) {
      log.error('[IPC] Error accessing local file:', error);
      throw error;
    }
  });

  // Get DLNA file handler
  ipcMain.handle(IPC.DLNA.GET_DLNA_FILE, async (event, server: string, port: number, path: string) => {
    return getDlnaFile(server, port, path);
  });

  // Test handler
  ipcMain.handle(IPC.TEST.TEST_HANDLER, async () => {
    return { message: 'Hello from main process!' };
  });

  // Get player config
  ipcMain.handle(IPC.PLAYBACK.GET_PLAYER_CONFIG, async () => {
    try {
      const { default: DatabaseService } = await import('../services/DatabaseService');
      const db = DatabaseService.getInstance();

      const rows = await db.all(
        "SELECT key, value FROM settings WHERE key LIKE 'youtube_player.%'"
      ) as Array<{ key: string; value: string }>;

      if (rows.length === 0) {
        // Return defaults if not in database
        return {
          youtubePlayerType: 'iframe',
          youtubePlayerConfig: {
            iframe: {
              showRelatedVideos: false,
              customEndScreen: true,
              qualityControls: true,
              autoplay: true,
              controls: true
            },
            mediasource: {
              maxQuality: '1080p',
              preferredLanguages: ['en'],
              fallbackToLowerQuality: true
            }
          },
          perVideoOverrides: {}
        };
      }

      // Build config object from database rows
      const config: any = {};
      for (const row of rows) {
        const key = row.key.replace('youtube_player.', '');
        const value = JSON.parse(row.value);

        // Handle nested keys like 'youtubePlayerConfig.iframe.autoplay'
        const parts = key.split('.');
        let current = config;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
            current[parts[i]] = {};
          }
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
      }

      return config;
    } catch (error) {
      log.error('[IPC] Error reading player config:', error);
      return {
        youtubePlayerType: 'iframe',
        youtubePlayerConfig: {
          iframe: {
            showRelatedVideos: false,
            customEndScreen: true,
            qualityControls: true,
            autoplay: true,
            controls: true
          },
          mediasource: {
            maxQuality: '1080p',
            preferredLanguages: ['en'],
            fallbackToLowerQuality: true
          }
        },
        perVideoOverrides: {}
      };
    }
  });
}

// Time Tracking Handlers
export function registerTimeTrackingHandlers() {
  // Record video watching
  ipcMain.handle(IPC.TIME_TRACKING.RECORD_VIDEO_WATCHING, async (_, videoId: string, position: number, timeWatched: number, duration?: number) => {
    try {
      await recordVideoWatching(videoId, position, timeWatched, duration);
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error recording video watching:', error);
      throw error;
    }
  });

  // Get time tracking state
  ipcMain.handle(IPC.TIME_TRACKING.GET_TIME_TRACKING_STATE, async () => {
    try {
      const state = await getTimeTrackingState();
      return state;
    } catch (error) {
      log.error('[IPC] Error getting time tracking state:', error);
      throw error;
    }
  });

  // Get watched videos - read from database
  ipcMain.handle(IPC.VIDEO_LOADING.GET_WATCHED_VIDEOS, async () => {
    try {
      const { DatabaseService } = await import('./DatabaseService');
      const dbService = DatabaseService.getInstance();

      // Get all view records from database
      const viewRecords = await dbService.all<any>(`
        SELECT
          vr.video_id as videoId,
          vr.position,
          vr.last_watched as lastWatched,
          vr.time_watched as timeWatched,
          vr.duration,
          vr.watched,
          vr.first_watched as firstWatched,
          v.title,
          v.thumbnail,
          vr.source_id as source
        FROM view_records vr
        LEFT JOIN videos v ON vr.video_id = v.id
        ORDER BY vr.last_watched DESC
      `);

      return viewRecords || [];
    } catch (error) {
      log.error('[IPC] Error reading watched videos from database:', error);
      // Fallback to JSON file
      try {
        const watchedPath = AppPaths.getConfigPath('watched.json');
        if (fs.existsSync(watchedPath)) {
          return JSON.parse(fs.readFileSync(watchedPath, 'utf8'));
        }
      } catch (jsonError) {
        log.error('[IPC] Error reading watched.json fallback:', jsonError);
      }
      return [];
    }
  });

  // Get time limits from database
  ipcMain.handle(IPC.TIME_TRACKING.GET_TIME_LIMITS, async () => {
    try {
      const { default: DatabaseService } = await import('../services/DatabaseService');
      const db = DatabaseService.getInstance();

      const result = await db.get(`
        SELECT monday, tuesday, wednesday, thursday, friday, saturday, sunday
        FROM time_limits
        WHERE id = 1
      `) as any;

      if (!result) {
        // Return default time limits if not found
        return {
          Monday: 30, Tuesday: 30, Wednesday: 30, Thursday: 30,
          Friday: 30, Saturday: 60, Sunday: 60
        };
      }

      // Convert to capitalized keys for compatibility
      return {
        Monday: result.monday,
        Tuesday: result.tuesday,
        Wednesday: result.wednesday,
        Thursday: result.thursday,
        Friday: result.friday,
        Saturday: result.saturday,
        Sunday: result.sunday
      };
    } catch (error) {
      log.error('[IPC] Error reading time limits from database:', error);
      throw error;
    }
  });
}

// Admin Handlers
export function registerAdminHandlers() {
  // Admin authentication
  ipcMain.handle(IPC.ADMIN.AUTHENTICATE, async (_, password: string) => {
    try {
      // Read password hash from mainSettings
      const mainSettings = await readMainSettings();
      const passwordHash = mainSettings.adminPassword;

      if (!passwordHash) {
        log.error('[IPC] Admin password not configured in mainSettings');
        return { success: false, error: 'Admin password not configured' };
      }

      const bcrypt = require('bcrypt');
      const isValid = await bcrypt.compare(password, passwordHash);

      if (isValid) {
        log.info('[IPC] Admin authentication successful');
        return { success: true };
      } else {
        log.warn('[IPC] Admin authentication failed');
        return { success: false, error: 'Invalid password' };
      }
    } catch (error) {
      log.error('[IPC] Error during admin authentication:', error);
      return { success: false, error: 'Authentication error' };
    }
  });

  // Change admin password
  ipcMain.handle(IPC.ADMIN.CHANGE_PASSWORD, async (_, currentPassword: string, newPassword: string) => {
    try {
      // First authenticate with current password
      const mainSettings = await readMainSettings();
      const currentPasswordHash = mainSettings.adminPassword;

      if (!currentPasswordHash) {
        log.error('[IPC] Admin password not configured in mainSettings');
        return { success: false, error: 'Admin password not configured' };
      }

      const bcrypt = require('bcrypt');
      const isCurrentValid = await bcrypt.compare(currentPassword, currentPasswordHash);

      if (!isCurrentValid) {
        log.warn('[IPC] Admin password change failed - invalid current password');
        return { success: false, error: 'Current password is incorrect' };
      }

      // Hash the new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Update mainSettings with new password hash
      const updatedSettings = {
        ...mainSettings,
        adminPassword: newPasswordHash
      };

      await writeMainSettings(updatedSettings);

      log.info('[IPC] Admin password changed successfully');
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error changing admin password:', error);
      return { success: false, error: 'Failed to change password' };
    }
  });

  // Hash password utility for main settings
  ipcMain.handle(IPC.ADMIN.HASH_PASSWORD, async (_, password: string) => {
    try {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);
      return { success: true, hashedPassword };
    } catch (error) {
      log.error('[IPC] Error hashing password:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Add extra time (write to database)
  ipcMain.handle(IPC.ADMIN.ADD_EXTRA_TIME, async (_, minutes: number) => {
    try {
      const { default: DatabaseService } = await import('../services/DatabaseService');
      const db = DatabaseService.getInstance();

      const today = new Date().toISOString().split('T')[0];

      // Insert or update usage_extras table
      await db.run(`
        INSERT INTO usage_extras (date, minutes_added, reason, added_by)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          minutes_added = minutes_added + excluded.minutes_added,
          updated_at = CURRENT_TIMESTAMP
      `, [today, minutes, 'Manual addition from admin panel', 'admin']);

      return { success: true };
    } catch (error) {
      log.error('[IPC] Error adding extra time to database:', error);
      throw error;
    }
  });

  // Get extra time
  ipcMain.handle(IPC.ADMIN.GET_TIME_EXTRA, async () => {
    try {
      const usageLogPath = AppPaths.getConfigPath('usageLog.json');
      if (!fs.existsSync(usageLogPath)) {
        return { extraTime: 0 };
      }

      const usageLog = JSON.parse(fs.readFileSync(usageLogPath, 'utf8'));
      const today = new Date().toISOString().split('T')[0];
      const todayData = (usageLog as any)[today] || { totalTime: 0, extraTime: 0 };

      return { extraTime: todayData.extraTime || 0 };
    } catch (error) {
      log.error('[IPC] Error getting extra time:', error);
      return { extraTime: 0 };
    }
  });

  // Write time limits (write to database)
  ipcMain.handle(IPC.ADMIN.WRITE_TIME_LIMITS, async (_, timeLimits: any) => {
    try {
      const { default: DatabaseService } = await import('../services/DatabaseService');
      const db = DatabaseService.getInstance();

      await db.run(`
        INSERT OR REPLACE INTO time_limits (
          id, monday, tuesday, wednesday, thursday, friday, saturday, sunday
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
      `, [
        timeLimits.Monday || timeLimits.monday || 0,
        timeLimits.Tuesday || timeLimits.tuesday || 0,
        timeLimits.Wednesday || timeLimits.wednesday || 0,
        timeLimits.Thursday || timeLimits.thursday || 0,
        timeLimits.Friday || timeLimits.friday || 0,
        timeLimits.Saturday || timeLimits.saturday || 0,
        timeLimits.Sunday || timeLimits.sunday || 0
      ]);

      return { success: true };
    } catch (error) {
      log.error('[IPC] Error writing time limits to database:', error);
      throw error;
    }
  });

  // Get last watched video with source - read from database
  ipcMain.handle(IPC.ADMIN.GET_LAST_WATCHED_VIDEO_WITH_SOURCE, async () => {
    try {
      const { DatabaseService } = await import('../services/DatabaseService');
      const dbService = DatabaseService.getInstance();

      // Get the most recently watched video
      const result = await dbService.get<any>(`
        SELECT
          vr.video_id as videoId,
          vr.position,
          vr.last_watched as lastWatched,
          vr.time_watched as timeWatched,
          vr.duration,
          vr.watched,
          vr.source_id as source,
          v.title,
          v.thumbnail
        FROM view_records vr
        LEFT JOIN videos v ON vr.video_id = v.id
        ORDER BY vr.last_watched DESC
        LIMIT 1
      `);

      return result || null;
    } catch (error) {
      log.error('[IPC] Error getting last watched video from database:', error);
      // Fallback to JSON file
      try {
        const watchedPath = AppPaths.getConfigPath('watched.json');
        if (!fs.existsSync(watchedPath)) {
          return null;
        }

        const watched = JSON.parse(fs.readFileSync(watchedPath, 'utf8'));
        let lastWatched = null;
        let lastTime = 0;

        for (const [videoId, data] of Object.entries(watched)) {
          const videoData = data as any;
          if (videoData.lastWatched && videoData.lastWatched > lastTime) {
            lastTime = videoData.lastWatched;
            lastWatched = { videoId, ...videoData };
          }
        }

        return lastWatched;
      } catch (jsonError) {
        log.error('[IPC] Error reading watched.json fallback:', jsonError);
        return null;
      }
    }
  });
}

// Video Source Handlers
export function registerVideoSourceHandlers() {
  // Get all video sources
  ipcMain.handle(IPC.VIDEO_SOURCES.GET_ALL, async () => {
    // Only use the database for video sources
    try {
      const DatabaseService = await import('../services/DatabaseService');
      const dbService = DatabaseService.default.getInstance();
      const status = await dbService.getHealthStatus();
      if (dbService && status.initialized) {
        const sources = await dbService.all<any>(`
          SELECT id, type, title, sort_preference, position, url, channel_id, path, max_depth
          FROM sources
          ORDER BY position ASC, title ASC
        `);
        log.info('[IPC] Retrieved sources from database:', sources.length);
        return sources || [];
      }
      // If DB is not initialized, return empty (migration/first-run will handle JSON)
      return [];
    } catch (error) {
      log.error('[IPC] Error reading video sources:', error);
      return [];
    }
  });

  // Save all video sources
  ipcMain.handle(IPC.VIDEO_SOURCES.SAVE_ALL, async (_, sources: any[]) => {
    // Only use the database for saving video sources
    try {
      const DatabaseService = await import('../services/DatabaseService');
      const dbService = DatabaseService.default.getInstance();
      const status = await dbService.getHealthStatus();
      if (dbService && status.initialized) {
        // Get existing sources to preserve metadata like total_videos and updated_at
        const existingSourcesQuery = await dbService.all<any>(`
          SELECT id, total_videos, thumbnail, updated_at FROM sources
        `);
        const existingSourcesMap = new Map(
          existingSourcesQuery.map(s => [s.id, s])
        );

        // Clear existing sources and insert new ones in a transaction
        await dbService.run('BEGIN TRANSACTION');
        try {
          await dbService.run('DELETE FROM sources');
          for (const source of sources) {
            const existingSource = existingSourcesMap.get(source.id);

            // Determine total_videos based on source type
            let totalVideos = null;
            if (source.type === 'local' && source.path) {
              // Count videos for local sources
              try {
                const { countVideosInFolder } = await import('./localVideoService');
                const maxDepth = source.maxDepth || 2; // Default to 2 if not specified
                totalVideos = await countVideosInFolder(source.path, maxDepth, 1);
                log.info(`[IPC] Counted ${totalVideos} videos for local source ${source.id}`);
              } catch (countError) {
                log.error('[IPC] Error counting videos for local source:', countError);
                totalVideos = 0;
              }
            } else if (existingSource) {
              // Preserve existing total_videos for YouTube sources
              totalVideos = existingSource.total_videos;
            }

            // Preserve thumbnail and updated_at if they exist
            const thumbnail = existingSource?.thumbnail || null;
            const updatedAt = existingSource?.updated_at || null;

            await dbService.run(`
              INSERT OR REPLACE INTO sources (id, type, title, sort_preference, position, url, channel_id, path, max_depth, total_videos, thumbnail, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              source.id,
              source.type,
              source.title,
              source.sortPreference || 'newestFirst',
              null, // position will be set by admin panel
              source.url || null,
              source.channelId || null,
              source.path || null,
              source.maxDepth || null,
              totalVideos,
              thumbnail,
              updatedAt
            ]);
          }
          await dbService.run('COMMIT');
          log.info('[IPC] Saved sources to database:', sources.length);

          // Clear all relevant caches so changes take effect immediately
          try {
            const { DataCacheService } = await import('./DataCacheService');
            const cacheService = DataCacheService.getInstance();
            const { YouTubePageCache } = await import('../../preload/youtubePageCache');

            // Clear cache for each source
            for (const source of sources) {
              cacheService.clearSourceCache(source.id);
              YouTubePageCache.clearSourcePages(source.id);
            }
            logVerbose('[IPC] Cleared caches for all updated sources');
          } catch (cacheError) {
            log.error('[IPC] Error clearing caches after save:', cacheError);
          }

          return { success: true };
        } catch (dbError) {
          await dbService.run('ROLLBACK');
          throw dbError;
        }
      }
      // If DB is not initialized, return error (migration/first-run will handle JSON)
      throw new Error('Database not initialized');
    } catch (error) {
      log.error('[IPC] Error saving video sources:', error);
      throw error;
    }
  });

  // Validate YouTube URL
  ipcMain.handle(IPC.VIDEO_SOURCES.VALIDATE_YOUTUBE_URL, async (_, url: string, type: 'youtube_channel' | 'youtube_playlist') => {
    try {
      if (type === 'youtube_channel') {
        // Validate YouTube channel URL format
        const channelMatch = url.match(/(?:youtube\.com\/(?:c\/|channel\/|user\/|@))([\w-]+)/);
        if (!channelMatch) {
          return { isValid: false, errors: ['Invalid YouTube channel URL format'] };
        }

        // Try to fetch channel details with API if available
        let apiKey: string | null = null;
        try {
          // First check environment variable
          const envApiKey = process.env.YOUTUBE_API_KEY;
          if (envApiKey) {
            apiKey = envApiKey;
          } else {
            // Then check mainSettings.json
            const mainSettings = await readMainSettings();
            if (mainSettings.youtubeApiKey) {
              apiKey = mainSettings.youtubeApiKey;
            }
          }
        } catch (error) {
          log.warn('[IPC] Error getting YouTube API key:', error);
        }
        if (apiKey) {
          try {
            const channelId = extractChannelId(url);
            if (channelId) {
              const youtubeApi = new YouTubeAPI(apiKey);
              const channelDetails = await youtubeApi.getChannelDetails(channelId);
              return {
                isValid: true,
                title: channelDetails.title,
                channelId: channelId
              };
            } else {
              // If we can't extract channel ID, try searching by username for @ URLs
              const usernameMatch = url.match(/@([^/]+)/);
              if (usernameMatch) {
                const youtubeApi = new YouTubeAPI(apiKey);
                const searchResult = await youtubeApi.searchChannelByUsername(usernameMatch[1]);
                return {
                  isValid: true,
                  title: searchResult.title,
                  channelId: searchResult.channelId
                };
              }
            }
          } catch (apiError) {
            log.warn('[IPC] YouTube API error for channel, falling back to format validation:', apiError);
            // Fall back to format validation if API fails
          }
        }

        // Fallback: just validate format without fetching title
        return { isValid: true };

      } else if (type === 'youtube_playlist') {
        // Validate YouTube playlist URL format
        const playlistMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
        if (!playlistMatch) {
          return { isValid: false, errors: ['Invalid YouTube playlist URL format'] };
        }

        // Check if it's a watch URL that should be cleaned to a proper playlist URL
        const isWatchUrl = url.includes('/watch?') && url.includes('list=');
        let cleanedUrl: string | undefined;

        if (isWatchUrl) {
          const listId = playlistMatch[1];
          cleanedUrl = `https://www.youtube.com/playlist?list=${listId}`;
        }

        // Try to fetch playlist details with API if available
        let apiKey: string | null = null;
        try {
          // First check environment variable
          const envApiKey = process.env.YOUTUBE_API_KEY;
          if (envApiKey) {
            apiKey = envApiKey;
          } else {
            // Then check mainSettings.json
            const mainSettings = await readMainSettings();
            if (mainSettings.youtubeApiKey) {
              apiKey = mainSettings.youtubeApiKey;
            }
          }
        } catch (error) {
          log.warn('[IPC] Error getting YouTube API key:', error);
        }
        if (apiKey) {
          try {
            const playlistId = extractPlaylistId(url);
            if (playlistId) {
              const youtubeApi = new YouTubeAPI(apiKey);
              const playlistDetails = await youtubeApi.getPlaylistDetails(playlistId);
              return {
                isValid: true,
                title: playlistDetails.title,
                cleanedUrl
              };
            }
          } catch (apiError) {
            log.warn('[IPC] YouTube API error for playlist, falling back to format validation:', apiError);
            // Fall back to format validation if API fails
          }
        }

        // Fallback: just validate format without fetching title
        return {
          isValid: true,
          cleanedUrl
        };
      }

      return { isValid: false, errors: ['Unknown URL type'] };
    } catch (error) {
      log.error('[IPC] Error validating YouTube URL:', error);
      return { isValid: false, errors: ['Validation error'] };
    }
  });

  // Validate local path
  ipcMain.handle(IPC.VIDEO_SOURCES.VALIDATE_LOCAL_PATH, async (_, path: string) => {
    try {
      // Check if path exists and is accessible
      if (!fs.existsSync(path)) {
        return { isValid: false, errors: ['Path does not exist'] };
      }

      const stats = fs.statSync(path);
      if (!stats.isDirectory()) {
        return { isValid: false, errors: ['Path is not a directory'] };
      }

      // Check if directory is readable
      try {
        fs.accessSync(path, fs.constants.R_OK);
        return { isValid: true };
      } catch (accessError) {
        return { isValid: false, errors: ['Directory is not readable'] };
      }
    } catch (error) {
      log.error('[IPC] Error validating local path:', error);
      return { isValid: false, errors: ['Validation error'] };
    }
  });
}

// Local Video Handlers
export function registerLocalVideoHandlers() {
  // Get local folder contents
  ipcMain.handle(IPC.LOCAL_FILES.GET_LOCAL_FOLDER_CONTENTS, async (event, folderPath: string, maxDepth: number, currentDepth: number = 1) => {
    try {
      const result = await getLocalFolderContents(folderPath, maxDepth, currentDepth);
      return result;
    } catch (error) {
      log.error('[IPC] Error getting local folder contents:', error);
      throw error;
    }
  });

  // Get local source video count
  ipcMain.handle(IPC.LOCAL_FILES.GET_LOCAL_SOURCE_VIDEO_COUNT, async (event, sourcePath: string, maxDepth: number) => {
    try {
      const count = await countVideosInFolder(sourcePath, maxDepth, 1);
      return count;
    } catch (error) {
      log.error('[IPC] Error counting videos in local source:', error);
      return 0;
    }
  });

  // Get folder video count
  ipcMain.handle(IPC.LOCAL_FILES.GET_FOLDER_VIDEO_COUNT, async (event, folderPath: string, maxDepth: number) => {
    try {
      const count = await countVideosInFolder(folderPath, maxDepth, 1);
      return count;
    } catch (error) {
      log.error('[IPC] Error counting videos in folder:', error);
      return 0;
    }
  });

  // Get local video duration
  ipcMain.handle(IPC.LOCAL_FILES.GET_LOCAL_VIDEO_DURATION, async (event, videoPath: string) => {
    try {
      const { spawn } = require('child_process');

      return new Promise((resolve, reject) => {
        // Use ffprobe to get video duration
        const ffprobe = spawn('ffprobe', [
          '-v', 'quiet',
          '-show_entries', 'format=duration',
          '-of', 'csv=p=0',
          videoPath
        ]);

        let output = '';
        let errorOutput = '';

        ffprobe.stdout.on('data', (data: any) => {
          output += data.toString();
        });

        ffprobe.stderr.on('data', (data: any) => {
          errorOutput += data.toString();
        });

        ffprobe.on('close', (code: any) => {
          if (code === 0) {
            const duration = parseFloat(output.trim());
            if (!isNaN(duration)) {
              resolve(Math.round(duration));
            } else {
              resolve(0);
            }
          } else {
            log.error('[IPC] ffprobe error:', errorOutput);
            resolve(0);
          }
        });

        ffprobe.on('error', (error: any) => {
          log.error('[IPC] Error spawning ffprobe:', error);
          resolve(0);
        });
      });
    } catch (error) {
      log.error('[IPC] Error getting video duration:', error);
      return 0;
    }
  });
}

// Video Processing Handlers
export function registerVideoProcessingHandlers() {
  // Get video codec info
  ipcMain.handle(IPC.CONVERSION.GET_VIDEO_CODEC_INFO, async (_, filePath: string) => {
    try {
      return await videoCodecUtils.getVideoCodecInfo(filePath);
    } catch (error) {
      log.error('[IPC] Error getting codec info:', error);
      return null;
    }
  });

  // Get existing converted video path
  ipcMain.handle(IPC.CONVERSION.GET_EXISTING_CONVERTED_VIDEO_PATH, async (_, originalPath: string, cacheDir?: string) => {
    try {
      return await videoCodecUtils.getExistingConvertedVideoPath(originalPath, cacheDir);
    } catch (error) {
      log.error('[IPC] Error checking converted video path:', error);
      return null;
    }
  });

  // Check if video needs conversion
  ipcMain.handle(IPC.CONVERSION.NEEDS_VIDEO_CONVERSION, async (_, filePath: string) => {
    try {
      return await videoCodecUtils.needsVideoConversion(filePath);
    } catch (error) {
      log.error('[IPC] Error checking if conversion needed:', error);
      return false;
    }
  });

  // Check if converted video exists
  ipcMain.handle(IPC.CONVERSION.HAS_CONVERTED_VIDEO, async (_, filePath: string, cacheDir?: string) => {
    try {
      return await videoCodecUtils.hasConvertedVideo(filePath, cacheDir);
    } catch (error) {
      log.error('[IPC] Error checking converted video:', error);
      return false;
    }
  });

  // Get conversion status
  ipcMain.handle(IPC.CONVERSION.GET_CONVERSION_STATUS, async (_, filePath: string) => {
    try {
      return videoCodecUtils.getConversionStatus(filePath);
    } catch (error) {
      log.error('[IPC] Error getting conversion status:', error);
      return { status: 'error', progress: 0 };
    }
  });

  // Start video conversion
  ipcMain.handle(IPC.CONVERSION.START_VIDEO_CONVERSION, async (_, filePath: string, options?: any) => {
    try {
      await videoCodecUtils.startVideoConversion(filePath, options);
      return { success: true, message: 'Conversion started' };
    } catch (error) {
      log.error('[IPC] Error starting video conversion:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Conversion failed to start' };
    }
  });
}

// System and Utility Handlers
export function registerSystemHandlers() {
  // Get YouTube API key
  ipcMain.handle(IPC.YOUTUBE.GET_API_KEY, async () => {
    try {
      // First check environment variable
      const envApiKey = process.env.YOUTUBE_API_KEY;
      if (envApiKey) {
        return envApiKey;
      }

      // Then check mainSettings.json
      const mainSettings = await readMainSettings();
      if (mainSettings.youtubeApiKey) {
        return mainSettings.youtubeApiKey;
      }

      return null;
    } catch (error) {
      log.error('[IPC] Error getting YouTube API key:', error);
      return null;
    }
  });

  // Get YouTube video info (for source validation)
  ipcMain.handle(IPC.YOUTUBE.GET_VIDEO_INFO, async (_, videoId: string) => {
    try {
      // Get API key
      let apiKey: string | null = null;
      const envApiKey = process.env.YOUTUBE_API_KEY;
      if (envApiKey) {
        apiKey = envApiKey;
      } else {
        const mainSettings = await readMainSettings();
        if (mainSettings.youtubeApiKey) {
          apiKey = mainSettings.youtubeApiKey;
        }
      }

      if (!apiKey) {
        log.error('[IPC] YouTube API key not found');
        return null;
      }

      // Fetch video details including channelId
      const youtubeApi = new YouTubeAPI(apiKey);
      const videoDetails = await youtubeApi.getVideoDetails(videoId);

      if (!videoDetails) {
        return null;
      }

      // Return simplified video info with channelId
      return {
        videoId: videoDetails.id,
        title: videoDetails.snippet?.title || '',
        channelId: videoDetails.snippet?.channelId || '',
        channelTitle: videoDetails.snippet?.channelTitle || '',
        thumbnail: videoDetails.snippet?.thumbnails?.default?.url || ''
      };
    } catch (error) {
      log.error('[IPC] Error getting YouTube video info:', error);
      return null;
    }
  });

  // Get verbose logging status
  ipcMain.handle(IPC.LOGGING.GET_VERBOSE, async () => {
    try {
      const verboseEnabled = process.env.ELECTRON_LOG_VERBOSE === 'true';
      return { verbose: verboseEnabled };
    } catch (error) {
      log.error('[IPC] Error getting verbose logging status:', error);
      return { verbose: false };
    }
  });

  // Get setup status
  ipcMain.handle(IPC.SETTINGS.GET_SETUP_STATUS, async () => {
    try {
      const hasApiKey = !!(process.env.YOUTUBE_API_KEY || fs.existsSync(AppPaths.getConfigPath('youtubeApiKey.json')));
      // Only check DB for video sources now (JSON is only for migration)
      const DatabaseService = await import('../services/DatabaseService');
      const dbService = DatabaseService.default.getInstance();
      const status = await dbService.getHealthStatus();
      let hasVideoSources = false;
      if (dbService && status.initialized) {
        const count = await dbService.get<{ count: number }>('SELECT COUNT(*) as count FROM sources');
        hasVideoSources = !!(count && count.count > 0);
      }

      return {
        hasApiKey,
        hasVideoSources,
        isSetupComplete: hasApiKey && hasVideoSources
      };
    } catch (error) {
      log.error('[IPC] Error getting setup status:', error);
      return { hasApiKey: false, hasVideoSources: false, isSetupComplete: false };
    }
  });

  // Log from renderer
  ipcMain.handle(IPC.LOGGING.LOG, async (_, level: string, ...args: any[]) => {
    try {
      switch (level) {
        case 'error':
          log.error('[Renderer]', ...args);
          break;
        case 'warn':
          log.warn('[Renderer]', ...args);
          break;
        case 'info':
          log.info('[Renderer]', ...args);
          break;
        case 'verbose':
          break;
        default:
          log.info('[Renderer]', ...args);
      }
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error logging from renderer:', error);
      return { success: false };
    }
  });

  // Clear source cache
  ipcMain.handle(IPC.CACHE.CLEAR_SOURCE_CACHE, async (_, sourceId: string) => {
    try {
      const { YouTubePageCache } = await import('../../preload/youtubePageCache');
      YouTubePageCache.clearSourcePages(sourceId);
      logVerbose(`[IPC] Cleared cache for source: ${sourceId}`);
      return { success: true, message: 'Cache cleared successfully' };
    } catch (error) {
      log.error('[IPC] Error clearing source cache:', error);
      return { success: false, message: 'Failed to clear cache', error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Path utilities for cross-platform compatibility
  ipcMain.handle(IPC.UTILS.PATH_JOIN, async (_, ...paths: string[]) => {
    try {
      const path = require('path');
      return path.join(...paths);
    } catch (error) {
      log.error('[IPC] Error joining paths:', error);
      throw error;
    }
  });
}

// Download Handlers
export function registerDownloadHandlers() {
  // Start download
  ipcMain.handle(IPC.DOWNLOADS.START, async (_, videoId: string, videoTitle: string, sourceInfo: any) => {
    try {
      const { DownloadManager } = await import('../downloadManager');
      await DownloadManager.startDownload(videoId, videoTitle, sourceInfo);
      return { success: true, message: 'Download started' };
    } catch (error) {
      log.error('[IPC] Error starting download:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Download failed to start' };
    }
  });

  // Get download status
  ipcMain.handle(IPC.DOWNLOADS.GET_STATUS, async (_, videoId: string) => {
    try {
      const { getDownloadStatus } = await import('../fileUtils');
      const status = await getDownloadStatus(videoId);
      return status || { status: 'idle', progress: 0 };
    } catch (error) {
      log.error('[IPC] Error getting download status:', error);
      return { status: 'idle', progress: 0 };
    }
  });

  // Cancel download
  ipcMain.handle(IPC.DOWNLOADS.CANCEL, async (_, videoId: string) => {
    try {
      const { DownloadManager } = await import('../downloadManager');
      await DownloadManager.cancelDownload(videoId);
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error cancelling download:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Cancel failed' };
    }
  });

  // Check if downloading
  ipcMain.handle(IPC.DOWNLOADS.IS_DOWNLOADING, async (_, videoId: string) => {
    try {
      const { getDownloadStatus } = await import('../fileUtils');
      const status = await getDownloadStatus(videoId);
      const isDownloading = status?.status === 'downloading' || status?.status === 'pending';
      return { isDownloading };
    } catch (error) {
      log.error('[IPC] Error checking download status:', error);
      return { isDownloading: false };
    }
  });

  // Reset download status
  ipcMain.handle(IPC.DOWNLOADS.RESET_STATUS, async (_, videoId: string) => {
    try {
      // Remove the download status entry completely to reset to "idle" state
      const { readDownloadStatus, writeDownloadStatus } = await import('../fileUtils');
      const statuses = await readDownloadStatus();
      const filteredStatuses = statuses.filter(s => s.videoId !== videoId);
      await writeDownloadStatus(filteredStatuses);
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error resetting download status:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Reset failed' };
    }
  });

  // Check if downloaded
  ipcMain.handle(IPC.DOWNLOADS.CHECK_DOWNLOADED, async (_, videoId: string) => {
    try {
      const downloadedVideosPath = AppPaths.getConfigPath('downloadedVideos.json');
      if (!fs.existsSync(downloadedVideosPath)) {
        return { isDownloaded: false };
      }

      const downloadedVideos = JSON.parse(fs.readFileSync(downloadedVideosPath, 'utf8'));
      const isDownloaded = downloadedVideos.some((video: any) => video.id === videoId);

      return { isDownloaded };
    } catch (error) {
      log.error('[IPC] Error checking downloaded status:', error);
      return { isDownloaded: false };
    }
  });
}

// Settings Handlers
export function registerSettingsHandlers() {
  // Read main settings from database
  ipcMain.handle(IPC.SETTINGS.READ_MAIN_SETTINGS, async () => {
    try {
      const { default: DatabaseService } = await import('../services/DatabaseService');
      const db = DatabaseService.getInstance();
      const rows = await db.all(
        "SELECT key, value FROM settings WHERE key LIKE 'main.%'"
      ) as Array<{ key: string; value: string }>;

      const settings: Record<string, any> = {};
      for (const row of rows) {
        // Remove 'main.' prefix from key
        const key = row.key.replace('main.', '');
        settings[key] = JSON.parse(row.value);
      }

      return settings;
    } catch (error) {
      log.error('[IPC] Error reading main settings from database:', error);
      return {};
    }
  });

  // Write main settings to database
  ipcMain.handle(IPC.SETTINGS.WRITE_MAIN_SETTINGS, async (_, settings: any) => {
    try {
      const { default: DatabaseService } = await import('../services/DatabaseService');
      const db = DatabaseService.getInstance();

      // Convert settings object to individual key-value pairs with 'main.' prefix
      const queries = Object.entries(settings).map(([key, value]) => ({
        sql: `
          INSERT OR REPLACE INTO settings (key, value, type)
          VALUES (?, ?, ?)
        `,
        params: [
          `main.${key}`,
          JSON.stringify(value),
          typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string'
        ]
      }));

      await db.executeTransaction(queries);
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error writing main settings to database:', error);
      throw error;
    }
  });

  // Get default download path
  ipcMain.handle(IPC.SETTINGS.GET_DEFAULT_DOWNLOAD_PATH, async () => {
    try {
      const { app } = require('electron');
      const defaultPath = path.join(app.getPath('downloads'), 'SafeTube');
      return { path: defaultPath };
    } catch (error) {
      log.error('[IPC] Error getting default download path:', error);
      return { path: '' };
    }
  });
}

// YouTube Cache Handlers
export function registerYouTubeCacheHandlers() {
  // Get from cache
  ipcMain.handle(IPC.YOUTUBE_CACHE.GET, async (_, cacheKey: string) => {
    try {
      const cachePath = AppPaths.getConfigPath('youtubeCache.json');
      if (!fs.existsSync(cachePath)) {
        return null;
      }

      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      const entry = (cache as any)[cacheKey];

      if (entry && entry.expiresAt > Date.now()) {
        return entry.data;
      }

      return null;
    } catch (error) {
      log.error('[IPC] Error getting from YouTube cache:', error);
      return null;
    }
  });

  // Set cache entry
  ipcMain.handle(IPC.YOUTUBE_CACHE.SET, async (_, cacheKey: string, data: any) => {
    try {
      const cachePath = AppPaths.getConfigPath('youtubeCache.json');
      let cache = {};

      if (fs.existsSync(cachePath)) {
        cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      }

      (cache as any)[cacheKey] = {
        data,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };

      fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error setting YouTube cache:', error);
      return { success: false };
    }
  });

  // Clear expired cache entries
  ipcMain.handle(IPC.YOUTUBE_CACHE.CLEAR_EXPIRED, async () => {
    try {
      const cachePath = AppPaths.getConfigPath('youtubeCache.json');
      if (!fs.existsSync(cachePath)) {
        return { success: true };
      }

      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      const now = Date.now();
      const cleanedCache = {};

      for (const [key, entry] of Object.entries(cache)) {
        if ((entry as any).expiresAt > now) {
          (cleanedCache as any)[key] = entry;
        }
      }

      fs.writeFileSync(cachePath, JSON.stringify(cleanedCache, null, 2));
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error clearing expired cache:', error);
      return { success: false };
    }
  });

  // Load cache config
  ipcMain.handle(IPC.YOUTUBE_CACHE.LOAD_CONFIG, async () => {
    try {
      // Return default cache configuration
      return {
        maxEntries: 1000,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        enabled: true
      };
    } catch (error) {
      log.error('[IPC] Error loading cache config:', error);
      return { enabled: false };
    }
  });

  // Save page cache (database-backed)
  ipcMain.handle(IPC.YOUTUBE_CACHE_DB.SAVE_PAGE, async (_, sourceId: string, pageNumber: number, cacheData: any) => {
    try {
      // This handler is called from the renderer process
      // The actual caching is handled in youtubePageCache.ts for the main process
      // For now, just acknowledge the request
      logVerbose(`[IPC] Received save page request for ${sourceId} page ${pageNumber}`);
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error saving page cache:', error);
      return { success: false };
    }
  });

  // Clear source cache (database-backed)
  ipcMain.handle(IPC.YOUTUBE_CACHE_DB.CLEAR_SOURCE, async (_, sourceId: string) => {
    try {
      // This handler is called from the renderer process
      // The actual cache clearing is handled in youtubePageCache.ts for the main process
      logVerbose(`[IPC] Received clear cache request for ${sourceId}`);
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error clearing source cache:', error);
      return { success: false };
    }
  });
}

// Downloaded Videos Handlers
export function registerDownloadedVideosHandlers() {
  // Get all downloaded videos
  ipcMain.handle(IPC.DOWNLOADED_VIDEOS.GET_ALL, async () => {
    try {
      const { readDownloadedVideos } = await import('../fileUtils');
      return await readDownloadedVideos();
    } catch (error) {
      log.error('[IPC] Error reading downloaded videos:', error);
      return [];
    }
  });

  // Get downloaded videos by source
  ipcMain.handle(IPC.DOWNLOADED_VIDEOS.GET_BY_SOURCE, async (_, sourceId: string) => {
    try {
      const { readDownloadedVideos } = await import('../fileUtils');
      const allDownloaded = await readDownloadedVideos();
      return allDownloaded.filter(video => video.sourceId === sourceId);
    } catch (error) {
      log.error('[IPC] Error reading downloaded videos by source:', error);
      return [];
    }
  });
}

// YouTube Playback Handlers
export function registerYouTubePlaybackHandlers() {
  // YouTube playback handlers are registered in youtube.ts via setupYouTubeHandlers()
  // Called from index.ts during app initialization
  // No stub needed here - the real handler will be registered directly
}

// Register all IPC handlers
export function registerAllHandlers() {
  registerVideoDataHandlers();
  registerTimeTrackingHandlers();
  registerAdminHandlers();
  registerVideoSourceHandlers();
  registerLocalVideoHandlers();
  registerVideoProcessingHandlers();
  registerSystemHandlers();
  registerDownloadHandlers();
  registerSettingsHandlers();
  registerYouTubeCacheHandlers();
  registerDownloadedVideosHandlers();
  registerDatabaseHandlers(); // Database handlers for SQLite (includes favorites)
  registerYouTubePlaybackHandlers(); // YouTube video streams handler (stub for tests, real impl in youtube.ts)
}