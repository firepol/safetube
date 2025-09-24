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

// Video Data Handlers
export function registerVideoDataHandlers() {
  // Get local file handler
  ipcMain.handle('get-local-file', async (event, filePath: string) => {
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
  ipcMain.handle('get-dlna-file', async (event, server: string, port: number, path: string) => {
    return getDlnaFile(server, port, path);
  });

  // Test handler
  ipcMain.handle('test-handler', async () => {
    return { message: 'Hello from main process!' };
  });

  // Get player config
  ipcMain.handle('get-player-config', async () => {
    try {
      const configPath = AppPaths.getConfigPath('youtubePlayer.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return config;
      }
      return {
        quality: 'auto',
        volume: 1.0,
        muted: false,
        autoplay: false
      };
    } catch (error) {
      log.error('[IPC] Error reading player config:', error);
      return {
        quality: 'auto',
        volume: 1.0,
        muted: false,
        autoplay: false
      };
    }
  });
}

// Time Tracking Handlers
export function registerTimeTrackingHandlers() {
  // Record video watching
  ipcMain.handle('time-tracking:record-video-watching', async (_, videoId: string, position: number, timeWatched: number, duration?: number) => {
    try {
      await recordVideoWatching(videoId, position, timeWatched, duration);
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error recording video watching:', error);
      throw error;
    }
  });

  // Get time tracking state
  ipcMain.handle('time-tracking:get-time-tracking-state', async () => {
    try {
      const state = await getTimeTrackingState();
      return state;
    } catch (error) {
      log.error('[IPC] Error getting time tracking state:', error);
      throw error;
    }
  });

  // Get watched videos
  ipcMain.handle('get-watched-videos', async () => {
    try {
      const watchedPath = AppPaths.getConfigPath('watched.json');
      if (fs.existsSync(watchedPath)) {
        return JSON.parse(fs.readFileSync(watchedPath, 'utf8'));
      }
      return {};
    } catch (error) {
      log.error('[IPC] Error reading watched videos:', error);
      return {};
    }
  });

  // Get time limits
  ipcMain.handle('time-tracking:get-time-limits', async () => {
    try {
      const timeLimits = readTimeLimits();
      return timeLimits;
    } catch (error) {
      log.error('[IPC] Error reading time limits:', error);
      throw error;
    }
  });
}

// Admin Handlers
export function registerAdminHandlers() {
  // Admin authentication
  ipcMain.handle('admin:authenticate', async (_, password: string) => {
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
  ipcMain.handle('admin:change-password', async (_, currentPassword: string, newPassword: string) => {
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
  ipcMain.handle('admin:hash-password', async (_, password: string) => {
    try {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);
      return { success: true, hashedPassword };
    } catch (error) {
      log.error('[IPC] Error hashing password:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Add extra time
  ipcMain.handle('admin:add-extra-time', async (_, minutes: number) => {
    try {
      const usageLogPath = AppPaths.getConfigPath('usageLog.json');
      let usageLog = {};

      if (fs.existsSync(usageLogPath)) {
        usageLog = JSON.parse(fs.readFileSync(usageLogPath, 'utf8'));
      }

      const today = new Date().toISOString().split('T')[0];
      if (!(usageLog as any)[today]) {
        (usageLog as any)[today] = { totalTime: 0, extraTime: 0 };
      }

      (usageLog as any)[today].extraTime = ((usageLog as any)[today].extraTime || 0) + (minutes * 60 * 1000);
      fs.writeFileSync(usageLogPath, JSON.stringify(usageLog, null, 2));

      return { success: true };
    } catch (error) {
      log.error('[IPC] Error adding extra time:', error);
      throw error;
    }
  });

  // Get extra time
  ipcMain.handle('admin:get-time-extra', async () => {
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

  // Write time limits
  ipcMain.handle('admin:write-time-limits', async (_, timeLimits: any) => {
    try {
      const timeLimitsPath = AppPaths.getConfigPath('timeLimits.json');
      fs.writeFileSync(timeLimitsPath, JSON.stringify(timeLimits, null, 2));
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error writing time limits:', error);
      throw error;
    }
  });

  // Get last watched video with source
  ipcMain.handle('admin:get-last-watched-video-with-source', async () => {
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
    } catch (error) {
      log.error('[IPC] Error getting last watched video:', error);
      return null;
    }
  });
}

// Video Source Handlers
export function registerVideoSourceHandlers() {
  // Get all video sources
  ipcMain.handle('video-sources:get-all', async () => {
    try {
      const sourcesPath = AppPaths.getConfigPath('videoSources.json');
      if (fs.existsSync(sourcesPath)) {
        return JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
      }
      return [];
    } catch (error) {
      log.error('[IPC] Error reading video sources:', error);
      return [];
    }
  });

  // Save all video sources
  ipcMain.handle('video-sources:save-all', async (_, sources: any[]) => {
    try {
      const sourcesPath = AppPaths.getConfigPath('videoSources.json');
      fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2));
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error saving video sources:', error);
      throw error;
    }
  });

  // Validate YouTube URL
  ipcMain.handle('video-sources:validate-youtube-url', async (_, url: string, type: 'youtube_channel' | 'youtube_playlist') => {
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
                title: channelDetails.title
              };
            } else {
              // If we can't extract channel ID, try searching by username for @ URLs
              const usernameMatch = url.match(/@([^/]+)/);
              if (usernameMatch) {
                const youtubeApi = new YouTubeAPI(apiKey);
                const searchResult = await youtubeApi.searchChannelByUsername(usernameMatch[1]);
                return {
                  isValid: true,
                  title: searchResult.title
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
  ipcMain.handle('video-sources:validate-local-path', async (_, path: string) => {
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
  ipcMain.handle('get-local-folder-contents', async (event, folderPath: string, maxDepth: number, currentDepth: number = 1) => {
    try {
      const result = await getLocalFolderContents(folderPath, maxDepth, currentDepth);
      return result;
    } catch (error) {
      log.error('[IPC] Error getting local folder contents:', error);
      throw error;
    }
  });

  // Get local source video count
  ipcMain.handle('get-local-source-video-count', async (event, sourcePath: string, maxDepth: number) => {
    try {
      const count = await countVideosInFolder(sourcePath, maxDepth, 1);
      return count;
    } catch (error) {
      log.error('[IPC] Error counting videos in local source:', error);
      return 0;
    }
  });

  // Get folder video count
  ipcMain.handle('get-folder-video-count', async (event, folderPath: string, maxDepth: number) => {
    try {
      const count = await countVideosInFolder(folderPath, maxDepth, 1);
      return count;
    } catch (error) {
      log.error('[IPC] Error counting videos in folder:', error);
      return 0;
    }
  });

  // Get local video duration
  ipcMain.handle('get-local-video-duration', async (event, videoPath: string) => {
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
  ipcMain.handle('get-video-codec-info', async (_, filePath: string) => {
    try {
      const { spawn } = require('child_process');

      return new Promise((resolve) => {
        const ffprobe = spawn('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_streams', filePath]);

        let output = '';
        ffprobe.stdout.on('data', (data: any) => {
          output += data.toString();
        });

        ffprobe.on('close', () => {
          try {
            const data = JSON.parse(output);
            const videoStream = data.streams?.find((stream: any) => stream.codec_type === 'video');
            resolve(videoStream || null);
          } catch {
            resolve(null);
          }
        });

        ffprobe.on('error', () => resolve(null));
      });
    } catch (error) {
      log.error('[IPC] Error getting codec info:', error);
      return null;
    }
  });

  // Get existing converted video path
  ipcMain.handle('get-existing-converted-video-path', async (_, originalPath: string, cacheDir?: string) => {
    try {
      const actualCacheDir = cacheDir || path.join(path.dirname(originalPath), '.converted');
      const originalName = path.basename(originalPath);
      const convertedPath = path.join(actualCacheDir, `${originalName}.mp4`);

      if (fs.existsSync(convertedPath)) {
        return convertedPath;
      }
      return null;
    } catch (error) {
      log.error('[IPC] Error checking converted video path:', error);
      return null;
    }
  });

  // Check if video needs conversion
  ipcMain.handle('needs-video-conversion', async (_, filePath: string) => {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const needsConversion = !['.mp4', '.webm'].includes(ext);
      return needsConversion;
    } catch (error) {
      log.error('[IPC] Error checking if conversion needed:', error);
      return false;
    }
  });

  // Check if converted video exists
  ipcMain.handle('has-converted-video', async (_, filePath: string, cacheDir?: string) => {
    try {
      const actualCacheDir = cacheDir || path.join(path.dirname(filePath), '.converted');
      const originalName = path.basename(filePath);
      const convertedPath = path.join(actualCacheDir, `${originalName}.mp4`);

      return fs.existsSync(convertedPath);
    } catch (error) {
      log.error('[IPC] Error checking converted video:', error);
      return false;
    }
  });

  // Get conversion status
  ipcMain.handle('get-conversion-status', async (_, filePath: string) => {
    try {
      // This would integrate with a conversion queue/status system
      // For now, return a simple status
      return { status: 'idle', progress: 0 };
    } catch (error) {
      log.error('[IPC] Error getting conversion status:', error);
      return { status: 'error', progress: 0 };
    }
  });

  // Start video conversion
  ipcMain.handle('start-video-conversion', async (_, filePath: string, options?: any) => {
    try {
      // This would start actual video conversion
      // For now, just log and return success
      return { success: true, message: 'Conversion started' };
    } catch (error) {
      log.error('[IPC] Error starting video conversion:', error);
      return { success: false, error: 'Conversion failed to start' };
    }
  });
}

// System and Utility Handlers
export function registerSystemHandlers() {
  // Get YouTube API key
  ipcMain.handle('get-youtube-api-key', async () => {
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

  // Get verbose logging status
  ipcMain.handle('logging:get-verbose', async () => {
    try {
      const verboseEnabled = process.env.ELECTRON_LOG_VERBOSE === 'true';
      return { verbose: verboseEnabled };
    } catch (error) {
      log.error('[IPC] Error getting verbose logging status:', error);
      return { verbose: false };
    }
  });

  // Get setup status
  ipcMain.handle('get-setup-status', async () => {
    try {
      const hasApiKey = !!(process.env.YOUTUBE_API_KEY || fs.existsSync(AppPaths.getConfigPath('youtubeApiKey.json')));
      const hasVideoSources = fs.existsSync(AppPaths.getConfigPath('videoSources.json'));

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
  ipcMain.handle('logging:log', async (_, level: string, ...args: any[]) => {
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
  ipcMain.handle('clear-source-cache', async (_, sourceId: string) => {
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
  ipcMain.handle('path-join', async (_, ...paths: string[]) => {
    try {
      const path = require('path');
      return path.join(...paths);
    } catch (error) {
      log.error('[IPC] Error joining paths:', error);
      throw error;
    }
  });

  // App paths handlers
  ipcMain.handle('app-paths:get-cache-dir', async () => {
    try {
      return AppPaths.getCacheDir();
    } catch (error) {
      log.error('[IPC] Error getting cache directory:', error);
      throw error;
    }
  });

  // Synchronous cache directory handler for immediate access
  ipcMain.on('app-paths:get-cache-dir-sync', (event) => {
    try {
      event.returnValue = AppPaths.getCacheDir();
    } catch (error) {
      log.error('[IPC] Error getting cache directory synchronously:', error);
      event.returnValue = null;
    }
  });

  ipcMain.handle('app-paths:get-cache-path', async (_, filename: string) => {
    try {
      return AppPaths.getCachePath(filename);
    } catch (error) {
      log.error('[IPC] Error getting cache path:', error);
      throw error;
    }
  });

  // Synchronous cache path handler for immediate access
  ipcMain.on('app-paths:get-cache-path-sync', (event, filename: string) => {
    try {
      event.returnValue = AppPaths.getCachePath(filename);
    } catch (error) {
      log.error('[IPC] Error getting cache path synchronously:', error);
      event.returnValue = null;
    }
  });
}

// Download Handlers
export function registerDownloadHandlers() {
  // Start download
  ipcMain.handle('download:start', async (_, videoId: string, videoTitle: string, sourceInfo: any) => {
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
  ipcMain.handle('download:get-status', async (_, videoId: string) => {
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
  ipcMain.handle('download:cancel', async (_, videoId: string) => {
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
  ipcMain.handle('download:is-downloading', async (_, videoId: string) => {
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
  ipcMain.handle('download:reset-status', async (_, videoId: string) => {
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
  ipcMain.handle('download:check-downloaded', async (_, videoId: string) => {
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
  // Read main settings
  ipcMain.handle('main-settings:read', async () => {
    try {
      const settingsPath = AppPaths.getConfigPath('mainSettings.json');
      if (fs.existsSync(settingsPath)) {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      }
      return {};
    } catch (error) {
      log.error('[IPC] Error reading main settings:', error);
      return {};
    }
  });

  // Write main settings
  ipcMain.handle('main-settings:write', async (_, settings: any) => {
    try {
      const settingsPath = AppPaths.getConfigPath('mainSettings.json');
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error writing main settings:', error);
      throw error;
    }
  });

  // Get default download path
  ipcMain.handle('main-settings:get-default-download-path', async () => {
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
  ipcMain.handle('youtube-cache:get', async (_, cacheKey: string) => {
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
  ipcMain.handle('youtube-cache:set', async (_, cacheKey: string, data: any) => {
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
  ipcMain.handle('youtube-cache:clear-expired', async () => {
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
  ipcMain.handle('youtube-cache:load-config', async () => {
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
}

// Downloaded Videos Handlers
export function registerDownloadedVideosHandlers() {
  // Get all downloaded videos
  ipcMain.handle('downloaded-videos:get-all', async () => {
    try {
      const { readDownloadedVideos } = await import('../fileUtils');
      return await readDownloadedVideos();
    } catch (error) {
      log.error('[IPC] Error reading downloaded videos:', error);
      return [];
    }
  });

  // Get downloaded videos by source
  ipcMain.handle('downloaded-videos:get-by-source', async (_, sourceId: string) => {
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

// Favorites Handlers
export function registerFavoritesHandlers() {
  // Get all favorites
  ipcMain.handle('favorites:get-all', async () => {
    try {
      const favoritesPath = AppPaths.getConfigPath('favorites.json');
      if (fs.existsSync(favoritesPath)) {
        const favorites = JSON.parse(fs.readFileSync(favoritesPath, 'utf8'));
        return favorites.favorites || [];
      }
      return [];
    } catch (error) {
      log.error('[IPC] Error reading favorites:', error);
      return [];
    }
  });

  // Add favorite
  ipcMain.handle('favorites:add', async (_, metadata: { id: string, type: 'youtube' | 'local' | 'dlna', title: string, thumbnail?: string, duration?: number, url?: string }) => {
    try {
      const favoritesPath = AppPaths.getConfigPath('favorites.json');
      let favorites = { favorites: [], lastModified: new Date().toISOString() };

      if (fs.existsSync(favoritesPath)) {
        favorites = JSON.parse(fs.readFileSync(favoritesPath, 'utf8'));
      }

      if (!favorites.favorites) {
        favorites.favorites = [];
      }

      // Check if already exists
      const existingIndex = favorites.favorites.findIndex((fav: any) => fav.videoId === metadata.id);
      if (existingIndex === -1) {
        // Use correct FavoriteVideo structure
        (favorites.favorites as any[]).push({
          videoId: metadata.id,
          sourceType: metadata.type,
          title: metadata.title,
          thumbnail: metadata.thumbnail || '',
          duration: metadata.duration || 0,
          dateAdded: new Date().toISOString()
        });

        favorites.lastModified = new Date().toISOString();
        fs.writeFileSync(favoritesPath, JSON.stringify(favorites, null, 2));
        logVerbose('[IPC] Added to favorites:', metadata.id);
      }

      return { success: true };
    } catch (error) {
      log.error('[IPC] Error adding favorite:', error);
      throw error;
    }
  });

  // Remove favorite
  ipcMain.handle('favorites:remove', async (_, videoId: string) => {
    try {
      const favoritesPath = AppPaths.getConfigPath('favorites.json');
      if (!fs.existsSync(favoritesPath)) {
        return { success: true };
      }

      const favorites = JSON.parse(fs.readFileSync(favoritesPath, 'utf8'));
      favorites.favorites = (favorites.favorites || []).filter((fav: any) => fav.videoId !== videoId);
      favorites.lastModified = new Date().toISOString();

      fs.writeFileSync(favoritesPath, JSON.stringify(favorites, null, 2));
      logVerbose('[IPC] Removed from favorites:', videoId);
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error removing favorite:', error);
      throw error;
    }
  });

  // Check if favorite
  ipcMain.handle('favorites:is-favorite', async (_, videoId: string) => {
    try {
      const favoritesPath = AppPaths.getConfigPath('favorites.json');
      if (!fs.existsSync(favoritesPath)) {
        return { isFavorite: false };
      }

      const favorites = JSON.parse(fs.readFileSync(favoritesPath, 'utf8'));
      const isFavorite = (favorites.favorites || []).some((fav: any) => fav.videoId === videoId);

      return { isFavorite };
    } catch (error) {
      log.error('[IPC] Error checking favorite status:', error);
      return { isFavorite: false };
    }
  });

  // Toggle favorite
  ipcMain.handle('favorites:toggle', async (_, videoId: string, source: string, type: 'youtube' | 'local' | 'dlna', title: string, thumbnail: string, duration: number, lastWatched?: string) => {
    try {
      const favoritesPath = AppPaths.getConfigPath('favorites.json');
      let favorites = { favorites: [], lastModified: new Date().toISOString() };

      if (fs.existsSync(favoritesPath)) {
        favorites = JSON.parse(fs.readFileSync(favoritesPath, 'utf8'));
      }

      if (!favorites.favorites) {
        favorites.favorites = [];
      }

      const existingIndex = favorites.favorites.findIndex((fav: any) => fav.videoId === videoId);

      if (existingIndex >= 0) {
        // Remove from favorites
        favorites.favorites.splice(existingIndex, 1);
        favorites.lastModified = new Date().toISOString();
        fs.writeFileSync(favoritesPath, JSON.stringify(favorites, null, 2));
        logVerbose('[IPC] Removed from favorites:', videoId);

        // Trigger video sources refresh to update favorites source
        setTimeout(() => {
          const { loadAllVideosFromSources } = require('./videoDataService');
          loadAllVideosFromSources().catch((error: any) => {
            log.error('[IPC] Error refreshing video sources after favorite removal:', error);
          });
        }, 100);

        return { favorite: null, isFavorite: false };
      } else {
        // Add to favorites using correct FavoriteVideo structure
        (favorites.favorites as any[]).push({
          videoId: videoId,
          sourceType: type,
          title: title,
          thumbnail: thumbnail || '',
          duration: duration || 0,
          dateAdded: new Date().toISOString()
        });
        favorites.lastModified = new Date().toISOString();

        fs.writeFileSync(favoritesPath, JSON.stringify(favorites, null, 2));
        logVerbose('[IPC] Added to favorites:', videoId);

        // Trigger video sources refresh to update favorites source
        setTimeout(() => {
          const { loadAllVideosFromSources } = require('./videoDataService');
          loadAllVideosFromSources().catch((error: any) => {
            log.error('[IPC] Error refreshing video sources after favorite addition:', error);
          });
        }, 100);

        // Return the newly created favorite object
        const newFavorite = {
          videoId: videoId,
          sourceType: type,
          title: title,
          thumbnail: thumbnail || '',
          duration: duration || 0,
          dateAdded: new Date().toISOString()
        };

        return { favorite: newFavorite, isFavorite: true };
      }
    } catch (error) {
      log.error('[IPC] Error toggling favorite:', error);
      throw error;
    }
  });

  // Update favorite metadata
  ipcMain.handle('favorites:update-metadata', async (_, videoId: string, metadata: any) => {
    try {
      const favoritesPath = AppPaths.getConfigPath('favorites.json');
      if (!fs.existsSync(favoritesPath)) {
        return { success: false };
      }

      const favorites = JSON.parse(fs.readFileSync(favoritesPath, 'utf8'));
      const favoriteIndex = (favorites.favorites || []).findIndex((fav: any) => fav.videoId === videoId);

      if (favoriteIndex >= 0) {
        favorites.favorites[favoriteIndex] = { ...favorites.favorites[favoriteIndex], ...metadata };
        favorites.lastModified = new Date().toISOString();
        fs.writeFileSync(favoritesPath, JSON.stringify(favorites, null, 2));
        logVerbose('[IPC] Updated favorite metadata:', videoId);
        return { success: true };
      }

      return { success: false };
    } catch (error) {
      log.error('[IPC] Error updating favorite metadata:', error);
      throw error;
    }
  });

  // Get favorites by source
  ipcMain.handle('favorites:get-by-source', async (_, sourceId: string) => {
    try {
      const favoritesPath = AppPaths.getConfigPath('favorites.json');
      if (!fs.existsSync(favoritesPath)) {
        return [];
      }

      const favorites = JSON.parse(fs.readFileSync(favoritesPath, 'utf8'));
      return (favorites.favorites || []).filter((fav: any) => fav.sourceType === sourceId);
    } catch (error) {
      log.error('[IPC] Error getting favorites by source:', error);
      return [];
    }
  });

  // Get favorites config
  ipcMain.handle('favorites:get-config', async () => {
    try {
      const configPath = AppPaths.getConfigPath('favoritesConfig.json');
      if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
      return { maxFavorites: 1000, showThumbnails: true };
    } catch (error) {
      log.error('[IPC] Error reading favorites config:', error);
      return { maxFavorites: 1000, showThumbnails: true };
    }
  });

  // Update favorites config
  ipcMain.handle('favorites:update-config', async (_, config: any) => {
    try {
      const configPath = AppPaths.getConfigPath('favoritesConfig.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      logVerbose('[IPC] Favorites config updated');
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error updating favorites config:', error);
      throw error;
    }
  });

  // Cleanup orphaned favorites
  ipcMain.handle('favorites:cleanup-orphaned', async () => {
    try {
      logVerbose('[IPC] Cleaning up orphaned favorites');
      // This would implement cleanup logic
      return { success: true, cleaned: 0 };
    } catch (error) {
      log.error('[IPC] Error cleaning up favorites:', error);
      return { success: false };
    }
  });

  // Sync with watch history
  ipcMain.handle('favorites:sync-watch-history', async () => {
    try {
      logVerbose('[IPC] Syncing favorites with watch history');
      // This would implement sync logic
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error syncing favorites:', error);
      return { success: false };
    }
  });
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
  registerFavoritesHandlers();
}