import path from 'path'
import { app, BrowserWindow, ipcMain } from 'electron'
import log from './logger'
import { Client } from 'node-ssdp'
import { setupYouTubeHandlers } from './youtube'
import { YouTubeAPI } from './youtube-api'
import fs from 'fs'
import { recordVideoWatching, getTimeTrackingState } from './timeTracking'
import { readTimeLimits } from './fileUtils'
import { createLocalVideoId } from '../shared/fileUtils'

// Load environment variables from .env file
import dotenv from 'dotenv'
import { logVerbose } from '../shared/logging'
import { AppPaths } from './appPaths'

// Load .env file from multiple possible locations
const possibleEnvPaths = [
  '.env', // Project root (for development)
  path.join(AppPaths.getUserDataDir(), '.env') // Production location
];

for (const envPath of possibleEnvPaths) {
  const result = dotenv.config({ path: envPath });
  if (result.parsed && Object.keys(result.parsed).length > 0) {
    logVerbose(`[Main] Loaded environment variables from: ${envPath}`);
    break;
  }
}

// Debug: Log environment variables
logVerbose('[Main] Environment variables loaded');
logVerbose('[Main] YouTube API key will be loaded from mainSettings.json');
logVerbose('[Main] ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD ? '***configured***' : 'NOT configured');
logVerbose('[Main] NODE_ENV:', process.env.NODE_ENV);

// Global type declaration for current videos
declare global {
  var currentVideos: any[];
}

// Background thumbnail generation queue
const thumbnailGenerationQueue = new Set<string>();
const thumbnailGenerationInProgress = new Set<string>();

// Schedule thumbnail generation in background
function scheduleBackgroundThumbnailGeneration(videoId: string, videoPath: string): void {
  const key = `${videoId}:${videoPath}`;

  // Don't queue if already queued or in progress
  if (thumbnailGenerationQueue.has(key) || thumbnailGenerationInProgress.has(key)) {
    return;
  }

  thumbnailGenerationQueue.add(key);
  logVerbose('[Main] Scheduled background thumbnail generation for:', videoId);

  // Process queue asynchronously
  setImmediate(() => processNextThumbnailInQueue());
}

// Process thumbnail generation queue
async function processNextThumbnailInQueue(): Promise<void> {
  if (thumbnailGenerationQueue.size === 0 || thumbnailGenerationInProgress.size >= 2) {
    return; // Limit concurrent generation to 2
  }

  const next = thumbnailGenerationQueue.values().next().value;
  if (!next) return;

  thumbnailGenerationQueue.delete(next);
  thumbnailGenerationInProgress.add(next);

  const [videoId, videoPath] = next.split(':', 2);

  try {
    logVerbose('[Main] Starting background thumbnail generation for:', videoId);
    const { ThumbnailGenerator } = await import('./thumbnailGenerator');
    const generatedThumbnail = await ThumbnailGenerator.generateCachedThumbnail(videoId, videoPath);

    if (generatedThumbnail) {
      const relativeThumbnail = path.relative(path.join(process.cwd(), 'public'), generatedThumbnail);
      const thumbnailUrl = `/${relativeThumbnail.replace(/\\/g, '/')}`;
      logVerbose('[Main] Background thumbnail generated:', videoId, '->', thumbnailUrl);

      // Notify renderer about thumbnail update
      notifyThumbnailReady(videoId, thumbnailUrl);
    }
  } catch (error) {
    logVerbose('[Main] Background thumbnail generation failed for:', videoId, error);
  } finally {
    thumbnailGenerationInProgress.delete(next);
    // Process next item in queue
    setImmediate(() => processNextThumbnailInQueue());
  }
}

// Notify renderer that thumbnail is ready
function notifyThumbnailReady(videoId: string, thumbnailUrl: string): void {
  // Find all browser windows and send thumbnail update
  const { BrowserWindow } = require('electron');
  const windows = BrowserWindow.getAllWindows();

  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send('thumbnail-ready', { videoId, thumbnailUrl });
      logVerbose('[Main] Sent thumbnail-ready event for:', videoId);
    }
  }
}

// Helper function to filter out converted videos when original exists
function filterDuplicateVideos(videos: any[]): any[] {
  const filteredVideos: any[] = [];
  const originalVideos = new Set<string>();

  // First pass: collect all original video paths
  for (const video of videos) {
    const isConverted = video.url.includes('.converted/') || video.url.includes('\\.converted\\') || video.url.includes('.converted\\');
    if (!isConverted) {
      originalVideos.add(video.url);
      logVerbose('[Main] Found original video:', video.url);
    }
  }

  // Second pass: only include videos that are either original or have no original
  for (const video of videos) {
    const isConverted = video.url.includes('.converted/') || video.url.includes('\\.converted\\') || video.url.includes('.converted\\');
    if (isConverted) {
      // Check if original exists - try multiple path patterns
      let originalPath = video.url.replace(/\.converted[\\/].*/, '');
      // Also try replacing .converted\ pattern
      if (originalPath === video.url) {
        originalPath = video.url.replace(/\.converted\\.*/, '');
      }

      // Try to find the original video by checking if any original video starts with the base path
      let hasOriginal = false;
      for (const originalUrl of originalVideos) {
        if (originalUrl.startsWith(originalPath) && originalUrl !== video.url) {
          hasOriginal = true;
          break;
        }
      }

      logVerbose('[Main] Checking converted video:', {
        converted: video.url,
        originalPath,
        hasOriginal,
        allOriginals: Array.from(originalVideos)
      });

      if (!hasOriginal) {
        filteredVideos.push(video); // Include converted only if no original
        logVerbose('[Main] Including converted video (no original):', video.url);
      } else {
        logVerbose('[Main] Hiding converted video (original exists):', video.url, '->', originalPath);
      }
      // Skip converted videos that have originals
    } else {
      filteredVideos.push(video); // Always include original videos
      logVerbose('[Main] Including original video:', video.url);
    }
  }

  logVerbose('[Main] Video filtering result:', {
    total: videos.length,
    filtered: filteredVideos.length,
    hidden: videos.length - filteredVideos.length,
    originalCount: originalVideos.size
  });

  return filteredVideos;
}

// Helper function to find thumbnail file for a video
function findThumbnailForVideo(videoFilePath: string): string {
  const videoDir = path.dirname(videoFilePath);
  const baseName = path.basename(videoFilePath, path.extname(videoFilePath));
  const thumbnailExtensions = ['.webp', '.jpg', '.jpeg', '.png'];
  
  for (const ext of thumbnailExtensions) {
    const thumbnailPath = path.join(videoDir, baseName + ext);
    if (fs.existsSync(thumbnailPath)) {
      logVerbose('[Main] Found thumbnail for video:', thumbnailPath);
      return `file://${thumbnailPath}`;
    }
  }
  
  return ''; // No thumbnail found
}

// Helper function for scanning local folders
async function scanLocalFolder(folderPath: string, maxDepth: number): Promise<any[]> {
  const videos: any[] = [];
  const supportedExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];

  try {
    // Resolve relative paths from project root
    const absolutePath = path.isAbsolute(folderPath) ? folderPath : path.join(process.cwd(), folderPath);

    logVerbose('[Main] Scanning local folder:', absolutePath, 'with maxDepth:', maxDepth);

    if (!fs.existsSync(absolutePath)) {
      log.warn('[Main] Local folder does not exist:', absolutePath);
      return videos;
    }

    // Recursive function to scan folders with flattening behavior
    const scanFolder = async (currentPath: string, depth: number): Promise<void> => {
      try {
        const items = fs.readdirSync(currentPath);

        for (const item of items) {
          const itemPath = path.join(currentPath, item);
          const stat = fs.statSync(itemPath);

          if (stat.isDirectory()) {
            // If we're at maxDepth, flatten all content from this directory
            if (depth === maxDepth) {
              logVerbose('[Main] At maxDepth', depth, 'flattening content from:', itemPath);
              // Recursively scan deeper content but mark it as being at maxDepth
              await scanFolderDeeper(itemPath, depth + 1);
            } else {
              // Continue scanning normally
              await scanFolder(itemPath, depth + 1);
            }
          } else if (stat.isFile()) {
            const ext = path.extname(item).toLowerCase();
            if (supportedExtensions.includes(ext)) {
              // Generate URI-style ID for local video
              const videoId = createLocalVideoId(itemPath);
              logVerbose('[Main] Found video at depth', depth, ':', itemPath);

              // Find thumbnail file with same name as video
              let thumbnailUrl = findThumbnailForVideo(itemPath);

              // Check if thumbnail already exists in cache
              if (!thumbnailUrl) {
                const { getThumbnailCacheKey } = await import('../shared/thumbnailUtils');
                const cacheKey = getThumbnailCacheKey(videoId, 'local');
                const cachedThumbnailPath = path.join(process.cwd(), 'public', 'thumbnails', `${cacheKey}.jpg`);

                if (fs.existsSync(cachedThumbnailPath)) {
                  const relativeThumbnail = path.relative(path.join(process.cwd(), 'public'), cachedThumbnailPath);
                  thumbnailUrl = `/${relativeThumbnail.replace(/\\/g, '/')}`;
                  logVerbose('[Main] Using existing cached thumbnail:', thumbnailUrl);
                } else {
                  // Schedule thumbnail generation in background (non-blocking)
                  scheduleBackgroundThumbnailGeneration(videoId, itemPath);
                }
              }

              videos.push({
                id: videoId,
                title: path.basename(item, ext),
                thumbnail: thumbnailUrl,
                duration: 0, // Will be extracted lazily when needed
                url: itemPath,
                video: itemPath,
                audio: undefined,
                preferredLanguages: ['en'],
                type: 'local', // Add explicit type for routing
                depth: depth, // Track the depth where this video was found
                relativePath: path.relative(absolutePath, itemPath) // Track relative path for debugging
              });
            }
          }
        }
      } catch (error) {
        log.warn('[Main] Error scanning folder:', currentPath, error);
      }
    };

    // Function to scan deeper content when flattening at maxDepth
    const scanFolderDeeper = async (currentPath: string, depth: number): Promise<void> => {
      try {
        const items = fs.readdirSync(currentPath);

        for (const item of items) {
          const itemPath = path.join(currentPath, item);
          const stat = fs.statSync(itemPath);

          if (stat.isDirectory()) {
            // Continue scanning deeper recursively
            await scanFolderDeeper(itemPath, depth + 1);
          } else if (stat.isFile()) {
            const ext = path.extname(item).toLowerCase();
            if (supportedExtensions.includes(ext)) {
              // Generate URI-style ID for local video
              const videoId = createLocalVideoId(itemPath);
              logVerbose('[Main] Found video at depth', depth, 'flattened to maxDepth:', maxDepth);

              // Find thumbnail file with same name as video
              let thumbnailUrl = findThumbnailForVideo(itemPath);

              // Check if thumbnail already exists in cache
              if (!thumbnailUrl) {
                const { getThumbnailCacheKey } = await import('../shared/thumbnailUtils');
                const cacheKey = getThumbnailCacheKey(videoId, 'local');
                const cachedThumbnailPath = path.join(process.cwd(), 'public', 'thumbnails', `${cacheKey}.jpg`);

                if (fs.existsSync(cachedThumbnailPath)) {
                  const relativeThumbnail = path.relative(path.join(process.cwd(), 'public'), cachedThumbnailPath);
                  thumbnailUrl = `/${relativeThumbnail.replace(/\\/g, '/')}`;
                  logVerbose('[Main] Using existing cached thumbnail for flattened video:', thumbnailUrl);
                } else {
                  // Schedule thumbnail generation in background (non-blocking)
                  scheduleBackgroundThumbnailGeneration(videoId, itemPath);
                }
              }

              videos.push({
                id: videoId,
                title: path.basename(item, ext),
                thumbnail: thumbnailUrl,
                duration: 0, // Will be extracted lazily when needed
                url: itemPath,
                video: itemPath,
                audio: undefined,
                preferredLanguages: ['en'],
                type: 'local', // Add explicit type for routing
                depth: maxDepth, // Mark as being at maxDepth (flattened)
                relativePath: path.relative(absolutePath, itemPath), // Track relative path for debugging
                flattened: true // Mark as flattened content
              });
            }
          }
        }
      } catch (error) {
        log.warn('[Main] Error scanning deeper folder for flattening:', currentPath, error);
      }
    };

    // Start scanning from the root folder (depth 1)
    await scanFolder(absolutePath, 1);
    logVerbose('[Main] Found videos in local folder:', videos.length, 'with maxDepth:', maxDepth);

  } catch (error) {
    log.error('[Main] Error scanning local folder:', error);
  }

  // Filter out converted videos when original exists
  const filteredVideos = filterDuplicateVideos(videos);
  logVerbose('[Main] Filtered videos:', { original: videos.length, filtered: filteredVideos.length });

  return filteredVideos;
}

// New function to get folder contents for navigation (not flattened)
async function getLocalFolderContents(folderPath: string, maxDepth: number, currentDepth: number = 1): Promise<{ folders: any[], videos: any[], depth: number }> {
  const folders: any[] = [];
  const videos: any[] = [];
  const supportedExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];

  try {
    // Resolve relative paths from project root
    const absolutePath = path.isAbsolute(folderPath) ? folderPath : path.join(process.cwd(), folderPath);

    logVerbose('[Main] Getting folder contents:', absolutePath, 'at depth:', currentDepth, 'with maxDepth:', maxDepth);
    logVerbose('[Main] Folder navigation logic: currentDepth < maxDepth?', currentDepth < maxDepth, 'currentDepth === maxDepth?', currentDepth === maxDepth);

    if (!fs.existsSync(absolutePath)) {
      log.warn('[Main] Local folder does not exist:', absolutePath);
      return { folders, videos, depth: currentDepth };
    }

    const items = fs.readdirSync(absolutePath);
    logVerbose('[Main] Items in folder:', items);

    for (const item of items) {
      const itemPath = path.join(absolutePath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        logVerbose('[Main] Found directory:', item, 'currentDepth:', currentDepth, 'maxDepth:', maxDepth);
        // Show folders if we haven't reached maxDepth
        if (currentDepth < maxDepth) {
          logVerbose('[Main] Adding folder to list:', item);
          folders.push({
            name: item,
            path: itemPath,
            type: 'folder',
            depth: currentDepth + 1
          });
        } else if (currentDepth === maxDepth) {
          // At maxDepth, flatten deeper content from this directory
          logVerbose('[Main] At maxDepth', currentDepth, 'flattening content from:', itemPath);
          const flattenedContent = await getFlattenedContent(itemPath, currentDepth + 1);
          videos.push(...flattenedContent);
        }
        // If currentDepth > maxDepth, skip (shouldn't happen in normal flow)
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (supportedExtensions.includes(ext)) {
          // Generate URI-style ID for local video
          const videoId = createLocalVideoId(itemPath);
          logVerbose('[Main] Found video at depth', currentDepth, ':', itemPath);

          // Find thumbnail file with same name as video
          let thumbnailUrl = findThumbnailForVideo(itemPath);

          // Check if thumbnail already exists in cache
          if (!thumbnailUrl) {
            const { getThumbnailCacheKey } = await import('../shared/thumbnailUtils');
            const cacheKey = getThumbnailCacheKey(videoId, 'local');
            const cachedThumbnailPath = path.join(process.cwd(), 'public', 'thumbnails', `${cacheKey}.jpg`);

            if (fs.existsSync(cachedThumbnailPath)) {
              const relativeThumbnail = path.relative(path.join(process.cwd(), 'public'), cachedThumbnailPath);
              thumbnailUrl = `/${relativeThumbnail.replace(/\\/g, '/')}`;
              logVerbose('[Main] Using existing cached thumbnail for folder contents video:', thumbnailUrl);
            } else {
              // Schedule thumbnail generation in background (non-blocking)
              scheduleBackgroundThumbnailGeneration(videoId, itemPath);
            }
          }

          videos.push({
            id: videoId,
            title: path.basename(item, ext),
            thumbnail: thumbnailUrl,
            duration: 0, // Will be extracted lazily when needed
            url: itemPath,
            video: itemPath,
            audio: undefined,
            preferredLanguages: ['en'],
            type: 'local',
            depth: currentDepth,
            relativePath: path.relative(absolutePath, itemPath)
          });
        }
      }
    }

    logVerbose('[Main] Folder contents result:', { folders: folders.length, videos: videos.length, depth: currentDepth });

  } catch (error) {
    log.error('[Main] Error getting folder contents:', error);
  }

  // Filter out converted videos when original exists
  const filteredVideos = filterDuplicateVideos(videos);
  logVerbose('[Main] Filtered folder videos:', { original: videos.length, filtered: filteredVideos.length });

  return { folders, videos: filteredVideos, depth: currentDepth };
}

// Helper function to count total videos in a folder recursively (with filtering)
async function countVideosInFolder(folderPath: string, maxDepth: number, currentDepth: number = 1): Promise<number> {
  const supportedExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];

  try {
    // Collect all videos recursively first, then apply filtering
    const allVideos: any[] = [];

    const collectVideos = async (currentPath: string, depth: number): Promise<void> => {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          if (depth < maxDepth) {
            // Continue collecting in subfolders
            await collectVideos(itemPath, depth + 1);
          } else if (depth === maxDepth) {
            // At maxDepth, get flattened content
            const flattenedVideos = await getFlattenedContent(itemPath, depth + 1);
            allVideos.push(...flattenedVideos);
          }
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (supportedExtensions.includes(ext)) {
            allVideos.push({
              url: itemPath,
              // Other properties not needed for counting
            });
          }
        }
      }
    };

    // Collect all videos
    await collectVideos(folderPath, currentDepth);

    // Apply filtering to all collected videos
    const filteredVideos = filterDuplicateVideos(allVideos);

    logVerbose('[Main] Video count filtering result:', {
      folder: folderPath,
      totalVideos: allVideos.length,
      filteredVideos: filteredVideos.length,
      hidden: allVideos.length - filteredVideos.length
    });

    return filteredVideos.length;

  } catch (error) {
    log.warn('[Main] Error counting videos in folder:', folderPath, error);
    return 0;
  }
}

// Helper function to count videos recursively (for flattening at maxDepth) with filtering
async function countVideosRecursively(folderPath: string): Promise<number> {
  let totalCount = 0;
  const supportedExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];

  try {
    const items = fs.readdirSync(folderPath);
    const videos: any[] = [];

    for (const item of items) {
      const itemPath = path.join(folderPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        // Continue counting deeper
        const subCount = await countVideosRecursively(itemPath);
        totalCount += subCount;
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (supportedExtensions.includes(ext)) {
          videos.push({
            url: itemPath,
            // Other properties not needed for counting
          });
        }
      }
    }

    // Apply filtering to videos in current directory
    const filteredVideos = filterDuplicateVideos(videos);
    totalCount += filteredVideos.length;

    logVerbose('[Main] Recursive video count filtering result:', {
      folder: folderPath,
      currentDirVideos: videos.length,
      currentDirFiltered: filteredVideos.length,
      totalCount: totalCount
    });

  } catch (error) {
    log.warn('[Main] Error counting videos recursively:', folderPath, error);
  }

  return totalCount;
}

// Helper function to get flattened content from deeper levels
async function getFlattenedContent(folderPath: string, depth: number): Promise<any[]> {
  const videos: any[] = [];
  const supportedExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];

  try {
    const items = fs.readdirSync(folderPath);

    for (const item of items) {
      const itemPath = path.join(folderPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        // Continue scanning deeper recursively
        const deeperVideos = await getFlattenedContent(itemPath, depth + 1);
        videos.push(...deeperVideos);
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (supportedExtensions.includes(ext)) {
          // Generate URI-style ID for local video
          const videoId = createLocalVideoId(itemPath);
          logVerbose('[Main] Found flattened video at depth', depth, ':', itemPath);

          // Find thumbnail file with same name as video
          let thumbnailUrl = findThumbnailForVideo(itemPath);

          // Check if thumbnail already exists in cache
          if (!thumbnailUrl) {
            const { getThumbnailCacheKey } = await import('../shared/thumbnailUtils');
            const cacheKey = getThumbnailCacheKey(videoId, 'local');
            const cachedThumbnailPath = path.join(process.cwd(), 'public', 'thumbnails', `${cacheKey}.jpg`);

            if (fs.existsSync(cachedThumbnailPath)) {
              const relativeThumbnail = path.relative(path.join(process.cwd(), 'public'), cachedThumbnailPath);
              thumbnailUrl = `/${relativeThumbnail.replace(/\\/g, '/')}`;
              logVerbose('[Main] Using existing cached thumbnail for getFlattenedContent video:', thumbnailUrl);
            } else {
              // Schedule thumbnail generation in background (non-blocking)
              scheduleBackgroundThumbnailGeneration(videoId, itemPath);
            }
          }

          videos.push({
            id: videoId,
            title: path.basename(item, ext),
            thumbnail: thumbnailUrl,
            duration: 0, // Will be extracted lazily when needed
            url: itemPath,
            video: itemPath,
            audio: undefined,
            preferredLanguages: ['en'],
            type: 'local',
            depth: depth - 1, // Mark as being at the previous depth (flattened)
            relativePath: path.relative(folderPath, itemPath),
            flattened: true
          });
        }
      }
    }
  } catch (error) {
    log.warn('[Main] Error getting flattened content:', error);
  }

  // Filter out converted videos when original exists
  const filteredVideos = filterDuplicateVideos(videos);
  logVerbose('[Main] Filtered flattened videos:', { original: videos.length, filtered: filteredVideos.length });

  return filteredVideos;
}

// Helper function to fix downloaded videos with missing file paths
async function fixDownloadedVideosPaths(downloadedVideos: any[]): Promise<any[]> {
  const { readMainSettings, getDefaultDownloadPath } = await import('./fileUtils');
  const settings = await readMainSettings();
  const downloadPath = settings.downloadPath || await getDefaultDownloadPath();

  let hasUpdates = false;
  const fixedVideos = [];

  for (const dv of downloadedVideos) {
    let fixedVideo = { ...dv };

    // If filePath is missing, try to find it
    if (!dv.filePath || dv.filePath === '') {
      // Reconstruct the expected path based on source info and title
      const folderName = dv.playlistTitle || dv.channelTitle || 'Unknown';
      const sanitizedFolderName = folderName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').substring(0, 100);
      const sanitizedTitle = dv.title
        .replace(/[\/\\]/g, ' - ')
        .replace(/:/g, ' -')
        .replace(/[<>"|?*]/g, '')
        .replace(/\|/g, ' - ')
        .replace(/\s+/g, ' ')
        .replace(/^[\s.]+|[\s.]+$/g, '')
        .substring(0, 200)
        .trim();

      const expectedDir = path.join(downloadPath, sanitizedFolderName);
      const videoExtensions = ['.mp4', '.webm', '.mkv', '.avi', '.mov'];

      for (const ext of videoExtensions) {
        const expectedPath = path.join(expectedDir, sanitizedTitle + ext);
        if (fs.existsSync(expectedPath)) {
          fixedVideo.filePath = expectedPath;
          hasUpdates = true;
          logVerbose(`[Main] Fixed missing filePath for ${dv.videoId}: ${expectedPath}`);
          break;
        }
      }
    }

    // If thumbnail is missing, try to find it
    if ((!dv.thumbnail || dv.thumbnail === '') && fixedVideo.filePath) {
      const videoDir = path.dirname(fixedVideo.filePath);
      const baseName = path.basename(fixedVideo.filePath, path.extname(fixedVideo.filePath));
      const thumbnailExtensions = ['.webp', '.jpg', '.jpeg', '.png'];

      for (const ext of thumbnailExtensions) {
        const expectedThumbnail = path.join(videoDir, baseName + ext);
        if (fs.existsSync(expectedThumbnail)) {
          fixedVideo.thumbnail = expectedThumbnail;
          hasUpdates = true;
          logVerbose(`[Main] Fixed missing thumbnail for ${dv.videoId}: ${expectedThumbnail}`);
          break;
        }
      }
    }

    fixedVideos.push(fixedVideo);
  }

  // If we made updates, save them back to the file
  if (hasUpdates) {
    try {
      const { writeDownloadedVideos } = await import('./fileUtils');
      await writeDownloadedVideos(fixedVideos);
      logVerbose(`[Main] Updated downloadedVideos.json with fixed paths`);
    } catch (error) {
      logVerbose(`[Main] Failed to update downloadedVideos.json: ${error}`);
    }
  }

  return fixedVideos;
}

// Helper function to resolve username to channel ID
async function resolveUsernameToChannelId(username: string, apiKey: string): Promise<string | null> {
  try {
    const youtubeAPI = new YouTubeAPI(apiKey);
    const channelDetails = await youtubeAPI.searchChannelByUsername(username);
    return channelDetails.channelId;
  } catch (error) {
    log.warn('[Main] Could not resolve username to channel ID:', username, error);
    return null;
  }
}

// Force TypeScript to include these functions by exporting them (even if not used elsewhere)
export { resolveUsernameToChannelId, loadAllVideosFromSourcesMain, getLocalFolderContents };

// Helper functions for parsing YouTube URLs
function extractChannelId(url: string): string | null {
  try {
    if (url.includes('/@')) {
      const match = url.match(/\/@([^\/\?]+)/);
      return match ? `@${match[1]}` : null; // Return with @ prefix for usernames
    } else if (url.includes('/channel/')) {
      const match = url.match(/\/channel\/([^\/\?]+)/);
      return match ? match[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

function extractPlaylistId(url: string): string | null {
  try {
    const match = url.match(/[?&]list=([^&]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (process.platform === 'win32') {
  try {
    if (require('electron-squirrel-startup')) {
      app.quit();
    }
  } catch (error) {
    // electron-squirrel-startup not available on non-Windows platforms
    logVerbose('electron-squirrel-startup not available on this platform');
  }
}

const isDev = process.env.NODE_ENV === 'development'

// Initialize SSDP client
const ssdpClient = new Client()

// Handle local file access
ipcMain.handle('get-local-file', async (event, filePath: string) => {
  try {
    // Convert file:// URL to actual file path
    let decodedPath = decodeURIComponent(filePath.replace('file://', ''))

    // Normalize Windows paths - convert backslashes to forward slashes for file:// URLs
    if (process.platform === 'win32') {
      decodedPath = decodedPath.replace(/\\/g, '/')
    }

    logVerbose('Accessing local file:', decodedPath)

    // Check if file exists (use original path for filesystem operations)
    const originalPath = filePath.replace('file://', '')
    if (!fs.existsSync(originalPath)) {
      log.error('File not found:', originalPath)
      throw new Error('File not found')
    }

    // Return the file:// URL for the video element with normalized path
    const fileUrl = `file://${decodedPath}`
    logVerbose('Returning file URL:', fileUrl)
    return fileUrl
  } catch (error) {
    log.error('Error accessing local file:', error)
    throw error
  }
})

// Handle DLNA file access
ipcMain.handle('get-dlna-file', async (event, server: string, port: number, path: string) => {
  try {
    logVerbose('Searching for DLNA server:', server)

    // Search for DLNA servers
    const devices = await new Promise<any[]>((resolve) => {
      const foundDevices: any[] = []

      ssdpClient.on('response', (headers: any) => {
        if (headers.ST === 'urn:schemas-upnp-org:service:ContentDirectory:1') {
          foundDevices.push(headers)
        }
      })

      ssdpClient.search('urn:schemas-upnp-org:service:ContentDirectory:1')

      // Wait for 5 seconds to collect responses
      setTimeout(() => {
        resolve(foundDevices)
      }, 5000)
    })

    // Find our target server
    const targetDevice = devices.find(device => device.LOCATION.includes(server))
    if (!targetDevice) {
      throw new Error(`DLNA server ${server} not found`)
    }

    logVerbose('Found DLNA server:', targetDevice.LOCATION)

    // For now, just return the direct URL since we know the server and path
    // In a real implementation, we would:
    // 1. Parse the device description XML from LOCATION
    // 2. Find the ContentDirectory service
    // 3. Browse the content directory to find the video
    // 4. Get the direct media URL
    const url = `http://${server}:${port}${path}`
    logVerbose('Using media URL:', url)

    return url
  } catch (error) {
    log.error('Error accessing DLNA file:', error)
    throw error
  }
})

// Test handler to verify IPC is working
ipcMain.handle('test-handler', async () => {
  logVerbose('Test handler called successfully')
  return 'test-success'
})

// Handle player configuration loading
ipcMain.handle('get-player-config', async () => {
  try {
    const configPath = AppPaths.getConfigPath('youtubePlayer.json')
    logVerbose('Loading player config from:', configPath)

    if (!fs.existsSync(configPath)) {
      log.error('Player configuration file not found:', configPath)
      throw new Error('Player configuration file not found')
    }

    const configData = fs.readFileSync(configPath, 'utf8')
    const config = JSON.parse(configData)
    logVerbose('Player config loaded successfully')
    return config
  } catch (error) {
    log.error('Error loading player config:', error)
    throw error
  }
})

// Handle video data loading - ONLY from new source system
ipcMain.handle('get-video-data', async (_, videoId: string) => {
  try {
    logVerbose('[Main] Loading video data for:', videoId);

    // Parse the video ID to determine its type
    const { parseVideoId, extractPathFromVideoId } = await import('../shared/fileUtils');
    const parseResult = parseVideoId(videoId);

    // Handle local videos (both new URI-style and legacy encoded)
    let localFilePath: string | null = null;

    if (parseResult.success && parseResult.parsed?.type === 'local') {
      // New URI-style local video ID
      localFilePath = extractPathFromVideoId(videoId);
      if (localFilePath) {
        logVerbose('[Main] Parsed URI-style local video path:', localFilePath);
      }
    }

    // If we have a local file path, process it
    if (localFilePath) {
      try {
        // Check if file exists
        if (!fs.existsSync(localFilePath)) {
          logVerbose('[Main] Local video file not found, returning null:', localFilePath);
          return null; // Return null instead of throwing error for missing files
        }

        // Extract video duration using ffprobe
        const { extractVideoDuration } = await import('../shared/videoDurationUtils');
        const duration = await extractVideoDuration(localFilePath);

        // Create video object for local video
        const video = {
          id: videoId,
          type: 'local',
          title: path.basename(localFilePath, path.extname(localFilePath)),
          thumbnail: '',
          duration,
          url: localFilePath,
          video: localFilePath,
          audio: undefined,
          preferredLanguages: ['en'],
          sourceId: 'local', // We'll need to determine the actual source ID
          sourceTitle: 'Local Video',
          sourceThumbnail: '',
          resumeAt: undefined as number | undefined, // Add resumeAt property
        };

        // Merge with watched data to populate resumeAt
        const { mergeWatchedData } = await import('./fileUtils');
        const videosWithWatchedData = await mergeWatchedData([video]);
        const videoWithResume = videosWithWatchedData[0];

        logVerbose('[Main] Created local video object with resume data:', {
          id: videoWithResume.id,
          type: videoWithResume.type,
          title: videoWithResume.title,
          resumeAt: videoWithResume.resumeAt
        });
        return videoWithResume;
      } catch (error) {
        log.error('[Main] Error handling local video:', error);
        return null; // Return null instead of throwing error for missing files
      }
    }

    // For non-local videos (including YouTube), use the existing logic
    if (!global.currentVideos || global.currentVideos.length === 0) {
      log.error('[Main] No videos loaded from source system. Video sources may not be initialized.');
      throw new Error('Video sources not initialized. Please restart the app.');
    }

    logVerbose('[Main] Checking global.currentVideos:', {
      exists: !!global.currentVideos,
      length: global.currentVideos.length,
      videoIds: global.currentVideos.map((v: any) => v.id).slice(0, 5) // Show first 5 IDs
    });

    const video = global.currentVideos.find((v: any) => v.id === videoId);
    if (video) {
      logVerbose('[Main] Video found in source system:', { id: video.id, type: video.type, title: video.title });

      // Merge with watched data to populate resumeAt for all video types
      const { mergeWatchedData } = await import('./fileUtils');
      const videosWithWatchedData = await mergeWatchedData([video]);
      const videoWithResume = videosWithWatchedData[0];

      logVerbose('[Main] Merged video with watched data:', {
        id: videoWithResume.id,
        type: videoWithResume.type,
        title: videoWithResume.title,
        resumeAt: videoWithResume.resumeAt
      });

      return videoWithResume;
    } else {
      // Check if this might be a raw filename that needs to be matched by file path
      // This handles cases where old watched data contains raw filenames instead of encoded IDs
      if (videoId.includes('/') || videoId.startsWith('_') || videoId.endsWith('.mp4') || videoId.endsWith('.mkv') || videoId.endsWith('.webm') || videoId.endsWith('.avi') || videoId.endsWith('.mov') || videoId.endsWith('.m4v')) {
        logVerbose('[Main] Attempting to find video by file path for raw filename:', videoId);

        // Try to find the video by matching the file path
        const videoByPath = global.currentVideos.find((v: any) => {
          if (v.type === 'local' && v.url) {
            // Check if the video's URL matches the videoId (possibly with path reconstruction)
            return v.url === videoId ||
              v.url.endsWith(videoId) ||
              v.url.includes(videoId) ||
              (videoId.startsWith('_') && v.url.endsWith(videoId.substring(1))) ||
              (videoId.includes('_') && v.url.includes(videoId.replace(/_/g, '/')));
          }
          return false;
        });

        if (videoByPath) {
          logVerbose('[Main] Found video by path matching:', { id: videoByPath.id, url: videoByPath.url, title: videoByPath.title });

          // Merge with watched data to populate resumeAt for path-matched videos
          const { mergeWatchedData } = await import('./fileUtils');
          const videosWithWatchedData = await mergeWatchedData([videoByPath]);
          const videoWithResume = videosWithWatchedData[0];

          logVerbose('[Main] Merged path-matched video with watched data:', {
            id: videoWithResume.id,
            type: videoWithResume.type,
            title: videoWithResume.title,
            resumeAt: videoWithResume.resumeAt
          });

          return videoWithResume;
        }
      }

      // Don't log as error for YouTube videos or other expected non-local videos
      // Only log as verbose for debugging
      logVerbose('[Main] Video not found in global source system:', videoId);
      logVerbose('[Main] Available video IDs:', global.currentVideos.map((v: any) => v.id));

      // For YouTube videos and other non-local videos, return null instead of throwing error
      // This prevents error spam in the console
      if (videoId.length === 11 || videoId.startsWith('example-') || videoId.startsWith('local-')) {
        logVerbose('[Main] Returning null for non-local video:', videoId);
        return null;
      }

      throw new Error(`Video with ID '${videoId}' not found in any source`);
    }
  } catch (error) {
    log.error('[Main] Error loading video data:', error);
    throw error;
  }
})

// Time tracking IPC handlers
ipcMain.handle('time-tracking:record-video-watching', async (_, videoId: string, position: number, timeWatched: number, duration?: number) => {
  try {
    await recordVideoWatching(videoId, position, timeWatched, duration);
  } catch (error) {
    log.error('Error recording video watching:', error);
    throw error;
  }
});

ipcMain.handle('time-tracking:get-time-tracking-state', async () => {
  try {
    return await getTimeTrackingState();
  } catch (error) {
    log.error('Error getting time tracking state:', error);
    throw error;
  }
});

ipcMain.handle('get-watched-videos', async () => {
  try {
    const { readWatchedVideos } = await import('./fileUtils');
    return await readWatchedVideos();
  } catch (error) {
    log.error('Error getting watched videos:', error);
    throw error;
  }
});

ipcMain.handle('time-tracking:get-time-limits', async () => {
  try {
    return await readTimeLimits();
  } catch (error) {
    log.error('Error reading time limits:', error);
    throw error;
  }
});

// New admin IPC handlers
ipcMain.handle('admin:authenticate', async (_, password: string) => {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      throw new Error('Admin password not configured');
    }

    const isAuthenticated = password === adminPassword;
    logVerbose('[Admin] Authentication attempt:', { success: isAuthenticated });

    return { isAuthenticated };
  } catch (error) {
    log.error('Error during admin authentication:', error);
    throw error;
  }
});

ipcMain.handle('admin:add-extra-time', async (_, minutes: number) => {
  try {
    // Import the function here to avoid circular dependencies
    const { addExtraTime } = await import('./timeTracking');
    await addExtraTime(minutes);

    logVerbose('[Admin] Extra time added:', { minutes });
    return { success: true };
  } catch (error) {
    log.error('Error adding extra time:', error);
    throw error;
  }
});

ipcMain.handle('admin:get-time-extra', async () => {
  try {
    // Import the function here to avoid circular dependencies
    const { readTimeExtra } = await import('./fileUtils');
    return await readTimeExtra();
  } catch (error) {
    log.error('Error reading time extra:', error);
    throw error;
  }
});

ipcMain.handle('admin:write-time-limits', async (_, timeLimits: any) => {
  try {
    // Import the function here to avoid circular dependencies
    const { writeTimeLimits } = await import('./fileUtils');
    await writeTimeLimits(timeLimits);

    logVerbose('[Admin] Time limits updated:', timeLimits);
    return { success: true };
  } catch (error) {
    log.error('Error writing time limits:', error);
    throw error;
  }
});

ipcMain.handle('admin:get-last-watched-video-with-source', async () => {
  try {
    // Import the function here to avoid circular dependencies
    const { getWatchedVideosWithSource } = await import('./timeTracking');
    const watchedVideos = await getWatchedVideosWithSource();
    return watchedVideos[0] || null; // Return the first (most recent) watched video
  } catch (error) {
    log.error('Error getting last watched video with source:', error);
    throw error;
  }
});

// Video source management handlers
ipcMain.handle('video-sources:get-all', async () => {
  try {
    const { readVideoSources } = await import('./fileUtils');
    return await readVideoSources();
  } catch (error) {
    log.error('Error reading video sources:', error);
    throw error;
  }
});

ipcMain.handle('video-sources:save-all', async (_, sources: any[]) => {
  try {
    const { writeVideoSources } = await import('./fileUtils');
    await writeVideoSources(sources);
    logVerbose('[Main] Video sources saved successfully');
    return { success: true };
  } catch (error) {
    log.error('Error saving video sources:', error);
    throw error;
  }
});

ipcMain.handle('video-sources:validate-youtube-url', async (_, url: string, type: 'youtube_channel' | 'youtube_playlist') => {
  try {
    const { validateVideoSource, cleanYouTubePlaylistUrl } = await import('../shared/videoSourceUtils');

    // Clean the URL if it's a playlist watch URL
    const cleanedUrl = type === 'youtube_playlist' ? cleanYouTubePlaylistUrl(url) : url;

    // Basic validation
    const validation = validateVideoSource(type, cleanedUrl, undefined, 'Test Title');

    if (!validation.isValid) {
      return {
        isValid: false,
        errors: validation.errors,
        cleanedUrl
      };
    }

    // For now, return basic validation success
    // TODO: Add actual YouTube API validation when API key is available
    return {
      isValid: true,
      cleanedUrl,
      message: 'URL format is valid (API validation not implemented yet)'
    };
  } catch (error) {
    log.error('Error validating YouTube URL:', error);
    return {
      isValid: false,
      errors: ['Validation failed: ' + (error instanceof Error ? error.message : String(error))]
    };
  }
});

ipcMain.handle('video-sources:validate-local-path', async (_, path: string) => {
  try {
    const fs = await import('fs');
    const pathModule = await import('path');

    // Check if path exists and is a directory
    const stats = fs.statSync(path);
    if (!stats.isDirectory()) {
      return {
        isValid: false,
        errors: ['Path exists but is not a directory']
      };
    }

    return {
      isValid: true,
      message: 'Path is valid and accessible'
    };
  } catch (error) {
    return {
      isValid: false,
      errors: ['Path does not exist or is not accessible: ' + (error instanceof Error ? error.message : String(error))]
    };
  }
});

// Handle getting local folder contents for navigation
ipcMain.handle('get-local-folder-contents', async (event, folderPath: string, maxDepth: number, currentDepth: number = 1) => {
  try {
    logVerbose('[Main] IPC: get-local-folder-contents called with:', { folderPath, maxDepth, currentDepth });

    if (!folderPath) {
      throw new Error('Folder path is required');
    }

    const contents = await getLocalFolderContents(folderPath, maxDepth, currentDepth);
    logVerbose('[Main] IPC: get-local-folder-contents result:', contents);

    return contents;
  } catch (error) {
    log.error('[Main] IPC: get-local-folder-contents error:', error);
    throw error;
  }
});

// Cache for video counts to avoid repeated calculations
const videoCountCache = new Map<string, { count: number; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for video durations to avoid repeated ffprobe calls
const videoDurationCache = new Map<string, { duration: number; timestamp: number }>();
const DURATION_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes (durations don't change often)

// Handle getting video count for a local source (lazy counting with caching)
ipcMain.handle('get-local-source-video-count', async (event, sourcePath: string, maxDepth: number) => {
  try {
    logVerbose('[Main] IPC: get-local-source-video-count called with:', { sourcePath, maxDepth });

    if (!sourcePath) {
      throw new Error('Source path is required');
    }

    // Check cache first
    const cacheKey = `${sourcePath}:${maxDepth}`;
    const cached = videoCountCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      logVerbose('[Main] IPC: get-local-source-video-count cache hit:', cached.count);
      return cached.count;
    }

    // Calculate video count
    const videoCount = await countVideosInFolder(sourcePath, maxDepth);

    // Cache the result
    videoCountCache.set(cacheKey, { count: videoCount, timestamp: now });

    logVerbose('[Main] IPC: get-local-source-video-count result:', videoCount);

    return videoCount;
  } catch (error) {
    log.error('[Main] IPC: get-local-source-video-count error:', error);
    throw error;
  }
});

// Handle getting video count for a specific folder (for subfolder counts)
ipcMain.handle('get-folder-video-count', async (event, folderPath: string, maxDepth: number) => {
  try {
    logVerbose('[Main] IPC: get-folder-video-count called with:', { folderPath, maxDepth });

    if (!folderPath) {
      throw new Error('Folder path is required');
    }

    // Check cache first
    const cacheKey = `folder:${folderPath}:${maxDepth}`;
    const cached = videoCountCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      logVerbose('[Main] IPC: get-folder-video-count cache hit:', cached.count);
      return cached.count;
    }

    // Calculate video count for this specific folder
    const videoCount = await countVideosInFolder(folderPath, maxDepth);

    // Cache the result
    videoCountCache.set(cacheKey, { count: videoCount, timestamp: now });

    logVerbose('[Main] IPC: get-folder-video-count result:', videoCount);

    return videoCount;
  } catch (error) {
    log.error('[Main] IPC: get-folder-video-count error:', error);
    throw error;
  }
});

// Handle getting video duration for a local video (lazy duration extraction with caching)
ipcMain.handle('get-local-video-duration', async (event, videoPath: string) => {
  try {
    logVerbose('[Main] IPC: get-local-video-duration called with:', videoPath);

    if (!videoPath) {
      throw new Error('Video path is required');
    }

    // Check cache first
    const cached = videoDurationCache.get(videoPath);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < DURATION_CACHE_DURATION) {
      logVerbose('[Main] IPC: get-local-video-duration cache hit:', cached.duration);
      return cached.duration;
    }

    // Extract video duration
    const { extractVideoDuration } = await import('../shared/videoDurationUtils');
    const duration = await extractVideoDuration(videoPath);

    // Cache the result
    videoDurationCache.set(videoPath, { duration, timestamp: now });

    logVerbose('[Main] IPC: get-local-video-duration result:', duration);

    return duration;
  } catch (error) {
    // Don't log errors if they're due to cancellation
    if (error instanceof Error && error.name === 'AbortError') {
      logVerbose('[Main] IPC: get-local-video-duration cancelled');
      throw error;
    }
    log.error('[Main] IPC: get-local-video-duration error:', error);
    throw error;
  }
});

// Handle video codec detection and conversion
ipcMain.handle('get-video-codec-info', async (_, filePath: string) => {
  try {
    logVerbose('[Main] get-video-codec-info called with:', filePath);
    const { getVideoCodecInfo } = await import('./videoCodecUtils');
    const codecInfo = await getVideoCodecInfo(filePath);
    logVerbose('[Main] Codec info result:', codecInfo);
    return codecInfo;
  } catch (error) {
    log.error('[Main] Error getting video codec info:', error);
    throw error;
  }
});

ipcMain.handle('get-existing-converted-video-path', async (_, originalPath: string, cacheDir?: string) => {
  try {
    logVerbose('[Main] get-existing-converted-video-path called with:', { originalPath, cacheDir });
    const { getExistingConvertedVideoPath } = await import('./videoCodecUtils');
    const convertedPath = await getExistingConvertedVideoPath(originalPath, cacheDir);
    logVerbose('[Main] Existing converted video path result:', convertedPath);
    return convertedPath;
  } catch (error) {
    log.error('[Main] Error getting existing converted video path:', error);
    throw error;
  }
});

ipcMain.handle('needs-video-conversion', async (_, filePath: string) => {
  try {
    logVerbose('[Main] needs-video-conversion called with:', filePath);
    const { needsVideoConversion } = await import('./videoCodecUtils');
    const needsConversion = await needsVideoConversion(filePath);
    logVerbose('[Main] Needs conversion result:', needsConversion);
    return needsConversion;
  } catch (error) {
    log.error('[Main] Error checking if video needs conversion:', error);
    throw error;
  }
});

ipcMain.handle('has-converted-video', async (_, filePath: string, cacheDir?: string) => {
  try {
    logVerbose('[Main] has-converted-video called with:', { filePath, cacheDir });
    const { hasConvertedVideo } = await import('./videoCodecUtils');
    const hasConverted = await hasConvertedVideo(filePath, cacheDir);
    logVerbose('[Main] Has converted video result:', hasConverted);
    return hasConverted;
  } catch (error) {
    log.error('[Main] Error checking if converted video exists:', error);
    throw error;
  }
});

ipcMain.handle('get-conversion-status', async (_, filePath: string) => {
  try {
    logVerbose('[Main] get-conversion-status called with:', filePath);
    const { getConversionStatus } = await import('./videoCodecUtils');
    const status = getConversionStatus(filePath);
    logVerbose('[Main] Conversion status result:', status);
    return status;
  } catch (error) {
    log.error('[Main] Error getting conversion status:', error);
    throw error;
  }
});

ipcMain.handle('start-video-conversion', async (_, filePath: string, options?: any) => {
  try {
    logVerbose('[Main] start-video-conversion called with:', { filePath, options });
    const { startVideoConversion } = await import('./videoCodecUtils');
    await startVideoConversion(filePath, options);
    logVerbose('[Main] Video conversion started successfully');
    return { success: true };
  } catch (error) {
    log.error('[Main] Error starting video conversion:', error);
    throw error;
  }
});

// Handle loading videos from sources
ipcMain.handle('load-all-videos-from-sources', async () => {
  try {
    logVerbose('[Main] load-all-videos-from-sources handler called');
    logVerbose('[Main] Helper functions available:', {
      resolveUsernameToChannelId: typeof resolveUsernameToChannelId,
      extractChannelId: typeof extractChannelId,
      scanLocalFolder: typeof scanLocalFolder
    });

    // Step 1: Read and parse videoSources.json configuration
    const configPath = AppPaths.getConfigPath('videoSources.json');
    logVerbose('[Main] Reading video sources config from:', configPath);

    if (!fs.existsSync(configPath)) {
      log.warn('[Main] videoSources.json not found, returning empty result');
      return {
        videos: [],
        sources: [],
        debug: [
          '[Main] videoSources.json not found at: ' + configPath,
          '[Main] Please create videoSources.json in your config directory'
        ]
      };
    }

    const configData = fs.readFileSync(configPath, 'utf8');
    const videoSources = JSON.parse(configData);

    logVerbose('[Main] Successfully parsed video sources config:', {
      sourceCount: videoSources.length,
      sourceTypes: videoSources.map((s: any) => s.type)
    });

    // Step 2: Parse each source into structured objects
    const parsedSources = videoSources.map((source: any) => {
      const parsed: any = {
        id: source.id,
        type: source.type,
        title: source.title,
        sortOrder: source.sortOrder
      };

      // Parse type-specific fields
      if (source.type === 'skypaul77' || source.type === 'youtube_channel') {
        parsed.url = source.url;
        parsed.channelId = extractChannelId(source.url);
        parsed.sourceType = 'youtube_channel';
      } else if (source.type === 'youtube_playlist') {
        parsed.url = source.url;
        parsed.playlistId = extractPlaylistId(source.url);
        parsed.sourceType = 'youtube_playlist';
      } else if (source.type === 'local') {
        parsed.path = source.path;
        parsed.maxDepth = source.maxDepth || 2; // Default to 2 if not specified
        parsed.sourceType = 'local_folder';
      } else if (source.type === 'dlna') {
        parsed.url = source.url;
        parsed.allowedFolder = source.allowedFolder;
        parsed.sourceType = 'dlna_server';
        // Note: DLNA will be deferred for now
      }

      return parsed;
    });

    logVerbose('[Main] Successfully parsed sources:', parsedSources.map((s: any) => ({
      id: s.id,
      type: s.type,
      sourceType: s.sourceType
    })));

    // Step 3: Load videos from local sources
    const allVideos: any[] = [];
    const debugInfo: string[] = [
      '[Main] IPC handler working correctly',
      '[Main] Successfully loaded videoSources.json',
      '[Main] Found ' + videoSources.length + ' video sources',
      '[Main] Successfully parsed ' + parsedSources.length + ' sources',
      '[Main] Source types: ' + parsedSources.map((s: any) => s.sourceType).join(', ')
    ];

    // Process each source type
    for (const source of parsedSources) {
      try {
        if (source.sourceType === 'local_folder') {
          logVerbose('[Main] Scanning local folder:', source.path);
          const localVideos = await scanLocalFolder(source.path, source.maxDepth);
          logVerbose('[Main] Found', localVideos.length, 'videos in local folder');

          // Debug: Log the first few local video IDs
          if (localVideos.length > 0) {
            logVerbose('[Main] Sample local video IDs:', localVideos.slice(0, 3).map(v => ({ id: v.id, title: v.title, url: v.url })));
          }

          // Add source info to each video
          const videosWithSource = localVideos.map(video => ({
            ...video,
            sourceId: source.id,
            sourceTitle: source.title,
            sourceType: 'local'
          }));

          allVideos.push(...videosWithSource);
          debugInfo.push(`[Main] Loaded ${localVideos.length} videos from local source: ${source.title}`);

        } else if (source.sourceType === 'youtube_channel' || source.sourceType === 'youtube_playlist') {
          try {
            // Initialize YouTube API (you'll need to add your API key to config)
            // Read API key from mainSettings.json
            let apiKey = 'your-api-key-here';
            try {
              const { readMainSettings } = await import('./fileUtils');
              const mainSettings = await readMainSettings();
              apiKey = mainSettings.youtubeApiKey || 'your-api-key-here';
            } catch (error) {
              log.warn('[Main] Could not read mainSettings, trying environment variables:', error);
              apiKey = 'your-api-key-here';
            }
            if (apiKey === 'your-api-key-here') {
              debugInfo.push(`[Main] YouTube source ${source.title} - API key not configured`);
              continue;
            }

            const youtubeAPI = new YouTubeAPI(apiKey);
            let youtubeVideos: any[] = [];

            // Read page size from pagination config once for both channel and playlist
            let pageSize = 50; // Default fallback
            try {
              const { readPaginationConfig } = await import('./fileUtils');
              const paginationConfig = await readPaginationConfig();
              pageSize = paginationConfig.pageSize;
              logVerbose('[Main] Using page size from config for YouTube API:', pageSize);
            } catch (error) {
              log.warn('[Main] Could not read pagination config, using default page size:', error);
            }

            if (source.sourceType === 'youtube_channel') {
              let actualChannelId = source.channelId;

              logVerbose('[Main] Processing YouTube channel source:', {
                sourceId: source.id,
                channelId: source.channelId,
                startsWithAt: source.channelId?.startsWith('@'),
                type: typeof source.channelId
              });

              // If it's a username (starts with @), resolve it to channel ID
              if (source.channelId && source.channelId.startsWith('@')) {
                logVerbose('[Main] Resolving username to channel ID:', source.channelId);
                logVerbose('[Main] About to call resolveUsernameToChannelId function');
                try {
                  actualChannelId = await resolveUsernameToChannelId(source.channelId, apiKey);
                  logVerbose('[Main] Username resolution result:', { username: source.channelId, resolvedId: actualChannelId });
                  if (!actualChannelId) {
                    debugInfo.push(`[Main] Could not resolve username ${source.channelId} to channel ID`);
                    continue;
                  }
                  logVerbose('[Main] Resolved username to channel ID:', actualChannelId);
                } catch (error) {
                  log.error('[Main] Error resolving username:', error);
                  debugInfo.push(`[Main] Error resolving username ${source.channelId}: ${error}`);
                  continue;
                }
              } else {
                logVerbose('[Main] Not a username, using channel ID directly:', source.channelId);
              }

              logVerbose('[Main] Fetching videos from YouTube channel:', actualChannelId);
              youtubeVideos = await youtubeAPI.getChannelVideos(actualChannelId, pageSize); // Fetch videos using config page size

              // Get channel details if title/thumbnail are missing
              if (!source.title || !source.thumbnail) {
                try {
                  const channelDetails = await youtubeAPI.getChannelDetails(actualChannelId);
                  if (!source.title) source.title = channelDetails.title;
                  if (!source.thumbnail) source.thumbnail = channelDetails.thumbnail;
                } catch (error) {
                  log.warn('[Main] Could not fetch channel details:', error);
                }
              }

            } else if (source.sourceType === 'youtube_playlist') {
              logVerbose('[Main] Fetching videos from YouTube playlist:', source.playlistId);
              youtubeVideos = await youtubeAPI.getPlaylistVideos(source.playlistId, pageSize); // Fetch videos using config page size

              // Get playlist details if title/thumbnail are missing
              if (!source.title || !source.thumbnail) {
                try {
                  const playlistDetails = await youtubeAPI.getPlaylistDetails(source.playlistId);
                  if (!source.title) source.title = playlistDetails.title;
                  if (!source.thumbnail) source.thumbnail = playlistDetails.thumbnail;
                } catch (error) {
                  log.warn('[Main] Could not fetch playlist details:', error);
                }
              }
            }

            // Add source info to each video
            const videosWithSource = youtubeVideos.map(video => ({
              ...video,
              sourceId: source.id,
              sourceTitle: source.title,
              sourceType: source.sourceType, // Keep original source type (youtube_channel or youtube_playlist)
              // Add duration placeholder (will be extracted in next phase)
              duration: 0
            }));

            allVideos.push(...videosWithSource);
            debugInfo.push(`[Main] Loaded ${youtubeVideos.length} videos from YouTube source: ${source.title}`);

          } catch (error) {
            log.error('[Main] Error loading YouTube videos:', error);
            debugInfo.push(`[Main] Error loading YouTube source ${source.title}: ${error}`);
          }

        } else if (source.sourceType === 'dlna_server') {
          // TODO: Implement DLNA video loading in next phase
          debugInfo.push(`[Main] DLNA source ${source.title} - TODO: implement in next phase`);
        }
      } catch (error) {
        log.error('[Main] Error processing source:', source.id, error);
        debugInfo.push(`[Main] Error processing source ${source.title}: ${error}`);
      }
    }

    // If no videos found, return empty result
    if (allVideos.length === 0) {
      return {
        videos: [],
        sources: parsedSources,
        debug: [
          ...debugInfo,
          '[Main] No videos found from any sources'
        ]
      };
    }

    // Store videos globally so the player can access them
    global.currentVideos = allVideos;

    // Debug: Log some sample video IDs from global.currentVideos
    if (allVideos.length > 0) {
      const sampleVideos = allVideos.slice(0, 5);
      logVerbose('[Main] Sample videos in global.currentVideos:', sampleVideos.map(v => ({ id: v.id, type: v.type, title: v.title, sourceId: v.sourceId })));
    }

    // Group videos by source for the UI
    const videosBySource = parsedSources.map((source: any) => {
      const sourceVideos = allVideos.filter(video => video.sourceId === source.id);
      return {
        ...source,
        videos: sourceVideos,
        videoCount: sourceVideos.length
      };
    });

    return {
      videos: allVideos, // Keep flat list for backward compatibility
      sources: parsedSources,
      videosBySource, // New grouped structure for UI
      debug: debugInfo
    };
  } catch (error) {
    log.error('[Main] Error loading videos from sources:', error);
    throw error;
  }
});

// Handle getting paginated videos from a specific source
ipcMain.handle('get-paginated-videos', async (event, sourceId: string, pageNumber: number) => {
  try {
    console.log(`[PAGINATION] get-paginated-videos handler called: sourceId=${sourceId}, pageNumber=${pageNumber}`);
    logVerbose('[Main] get-paginated-videos handler called:', { sourceId, pageNumber });

    // Read page size from pagination config first (needed for downloaded source)
    let pageSize = 50; // Default fallback
    try {
      const { readPaginationConfig } = await import('./fileUtils');
      const paginationConfig = await readPaginationConfig();
      pageSize = paginationConfig.pageSize;
      logVerbose('[Main] Using page size from config:', pageSize);
    } catch (error) {
      log.warn('[Main] Could not read pagination config, using default page size:', error);
    }

    // Read API key from mainSettings.json
    let apiKey = '';
    try {
      const { readMainSettings } = await import('./fileUtils');
      const mainSettings = await readMainSettings();
      apiKey = mainSettings.youtubeApiKey || '';
      logVerbose('[Main] API key loaded for pagination:', apiKey ? '***configured***' : 'NOT configured');
    } catch (error) {
      log.warn('[Main] Could not read mainSettings for pagination:', error);
    }

    // Read source configuration directly (don't load all videos)
    let sources = [];
    try {
      const sourcesPath = AppPaths.getConfigPath('videoSources.json');
      logVerbose('[Main] Reading source config from:', sourcesPath);
      const sourcesData = fs.readFileSync(sourcesPath, 'utf-8');
      sources = JSON.parse(sourcesData);
      logVerbose('[Main] Loaded source configs:', sources.length);
    } catch (error) {
      log.error('[Main] Error reading videoSources.json:', error);
      throw new Error('Failed to read video sources configuration');
    }

    // Handle special "downloaded" source
    if (sourceId === 'downloaded') {
      logVerbose('[Main] Downloaded source requested, treating as local folder');

      try {
        // Get download path
        const { readMainSettings, getDefaultDownloadPath } = await import('./fileUtils');
        const settings = await readMainSettings();
        const downloadPath = settings.downloadPath || await getDefaultDownloadPath();
        
        logVerbose('[Main] Scanning download folder as local source:', downloadPath);

        // Use the same scanLocalFolder logic that handles durations and thumbnails properly
        const allVideos = await scanLocalFolder(downloadPath, 2); // maxDepth 2 for subfolders

        // Add source metadata to videos for compatibility
        const videosWithMetadata = allVideos.map(video => ({
          ...video,
          sourceId: 'downloaded',
          sourceTitle: 'Downloaded Videos',
          sourceThumbnail: '',
          sourceType: 'local', // Use 'local' type for proper playback
          type: 'local' // Ensure type is 'local' for PlayerRouter
        }));

        // Store videos in global.currentVideos so the player can access them
        if (!global.currentVideos) {
          global.currentVideos = [];
        }

        // Add new videos to global.currentVideos, avoiding duplicates
        videosWithMetadata.forEach(video => {
          const existingIndex = global.currentVideos.findIndex((v: any) => v.id === video.id);
          if (existingIndex >= 0) {
            // Update existing video with new data
            global.currentVideos[existingIndex] = video;
          } else {
            // Add new video
            global.currentVideos.push(video);
          }
        });

        // Apply pagination manually
        const totalVideos = videosWithMetadata.length;
        const totalPages = Math.ceil(totalVideos / pageSize);
        const startIndex = (pageNumber - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedVideos = videosWithMetadata.slice(startIndex, endIndex);

        logVerbose('[Main] Downloaded videos treated as local source:', {
          totalVideos,
          totalPages,
          currentPage: pageNumber,
          pageSize,
          returnedVideos: paginatedVideos.length
        });

        return {
          videos: paginatedVideos,
          pagination: {
            currentPage: pageNumber,
            totalPages: totalPages,
            totalVideos: totalVideos,
            pageSize: pageSize
          }
        };
      } catch (error) {
        log.error('[Main] Error loading downloaded videos as local source:', error);
        // Return empty result instead of throwing
        return {
          videos: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalVideos: 0,
            pageSize: pageSize
          }
        };
      }
    }

    // Find the specific source
    const source = sources.find((s: any) => s.id === sourceId);
    if (!source) {
      log.error('[Main] Source not found:', sourceId);
      log.error('[Main] Available sources:', sources.map((s: any) => ({ id: s.id, type: s.type, title: s.title })));
      throw new Error('Source not found');
    }

    logVerbose('[Main] Found source:', { id: source.id, type: source.type, title: source.title });

    // For local sources, use local video scanner with pagination
    if (source.type === 'local') {
      logVerbose('[Main] Local source detected, using local video pagination');

      const { LocalVideoScanner } = await import('../preload/localVideoScanner');

      // Check if source should use pagination vs folder navigation
      // Use pagination if maxDepth is 1 or if usePagination is explicitly set
      const usePagination = source.maxDepth === 1 || source.usePagination === true;

      if (!usePagination) {
        // Use folder navigation (existing behavior)
        logVerbose('[Main] Local source using folder navigation (maxDepth > 1)');
        return {
          videos: [],
          paginationState: {
            currentPage: 1,
            totalPages: 1,
            totalVideos: 0,
            pageSize: pageSize
          }
        };
      }

      // Use pagination
      try {
        const scanResult = await LocalVideoScanner.scanFolder(
          source.id,
          source.path,
          source.maxDepth || 2
        );

        const paginatedResult = LocalVideoScanner.getPaginatedVideos(scanResult, pageNumber, pageSize);

        // Add source metadata to videos for compatibility
        const videosWithMetadata = paginatedResult.videos.map(video => ({
          ...video,
          sourceId: sourceId,
          sourceTitle: source.title,
          sourceThumbnail: '',
          sourceType: 'local'
        }));

        // Store videos in global.currentVideos so the player can access them
        if (!global.currentVideos) {
          global.currentVideos = [];
        }

        // Add new videos to global.currentVideos, avoiding duplicates
        videosWithMetadata.forEach(video => {
          const existingIndex = global.currentVideos.findIndex((v: any) => v.id === video.id);
          if (existingIndex >= 0) {
            // Update existing video with new data
            global.currentVideos[existingIndex] = video;
          } else {
            // Add new video
            global.currentVideos.push(video);
          }
        });

        logVerbose('[Main] Local pagination result:', {
          sourceId,
          pageNumber,
          videosReturned: videosWithMetadata.length,
          totalVideos: paginatedResult.paginationState.totalVideos,
          totalPages: paginatedResult.paginationState.totalPages,
          pageSize
        });

        logVerbose('[Main] Updated global.currentVideos with local videos:', {
          newVideos: videosWithMetadata.length,
          totalGlobalVideos: global.currentVideos.length
        });

        return {
          videos: videosWithMetadata,
          paginationState: paginatedResult.paginationState
        };
      } catch (error) {
        console.error('[Main] Error scanning local source:', error);
        return {
          videos: [],
          paginationState: {
            currentPage: 1,
            totalPages: 1,
            totalVideos: 0,
            pageSize: pageSize
          }
        };
      }
    } else if (source.type === 'youtube_channel' || source.type === 'youtube_playlist') {
      // For YouTube sources, use smart page fetching with caching
      if (!apiKey) {
        throw new Error('YouTube API key not configured for pagination');
      }

      const { YouTubeAPI } = await import('../preload/youtube');
      const { YouTubePageFetcher } = await import('../preload/youtubePageFetcher');

      YouTubeAPI.setApiKey(apiKey);
      await YouTubeAPI.loadCacheConfig(); // Load cache configuration

      const pageResult = await YouTubePageFetcher.fetchPage(source, pageNumber, pageSize);

      // Calculate total pages from total results
      const totalPages = Math.ceil(pageResult.totalResults / pageSize);

      logVerbose('[Main] YouTube pagination result:', {
        sourceId,
        pageNumber,
        videosReturned: pageResult.videos.length,
        totalVideos: pageResult.totalResults,
        totalPages,
        pageSize,
        fromCache: pageResult.fromCache,
        fallback: pageResult.fallback
      });

      // Add source metadata to videos for compatibility
      const videosWithMetadata = pageResult.videos.map(video => ({
        ...video,
        sourceId: sourceId,
        sourceTitle: source.title,
        sourceThumbnail: source.thumbnail || '',
        sourceType: source.type
      }));

      // Store videos in global.currentVideos so the player can access them
      // This is critical for fallback videos to work properly
      if (!global.currentVideos) {
        global.currentVideos = [];
      }

      // Add new videos to global.currentVideos, avoiding duplicates
      videosWithMetadata.forEach(video => {
        const existingIndex = global.currentVideos.findIndex((v: any) => v.id === video.id);
        if (existingIndex >= 0) {
          // Update existing video with new data
          global.currentVideos[existingIndex] = video;
        } else {
          // Add new video
          global.currentVideos.push(video);
        }
      });

      logVerbose('[Main] Updated global.currentVideos with paginated videos:', {
        newVideos: videosWithMetadata.length,
        totalGlobalVideos: global.currentVideos.length,
        sampleIds: videosWithMetadata.slice(0, 3).map(v => v.id)
      });

      return {
        videos: videosWithMetadata,
        paginationState: {
          currentPage: pageNumber,
          totalPages,
          totalVideos: pageResult.totalResults,
          pageSize
        }
      };
    } else {
      throw new Error(`Unsupported source type: ${source.type}`);
    }
  } catch (error) {
    log.error('[Main] Error getting paginated videos:', error);
    throw error;
  }
});



// Helper function to fetch videos for a specific page
async function fetchVideosForPage(source: any, pageNumber: number, pageSize: number, pageToken: string | undefined): Promise<any[]> {
  try {
    // Read API key from mainSettings.json
    let apiKey = '';
    try {
      const { readMainSettings } = await import('./fileUtils');
      const mainSettings = await readMainSettings();
      apiKey = mainSettings.youtubeApiKey || '';
    } catch (error) {
      log.warn('[Main] Could not read mainSettings, trying environment variables:', error);
      apiKey = '';
    }
    if (!apiKey) {
      log.warn('[Main] YouTube API key not available for fetching videos');
      return [];
    }

    const { YouTubeAPI } = await import('../preload/youtube');
    YouTubeAPI.setApiKey(apiKey);
    await YouTubeAPI.loadCacheConfig();

    let videoIds: string[] = [];

    if (source.type === 'youtube_channel') {
      const channelId = extractChannelId(source.url);
      if (!channelId) {
        log.warn(`[Main] Could not extract channel ID from URL: ${source.url}`);
        return [];
      }

      let actualChannelId = channelId;

      if (channelId.startsWith('@')) {
        try {
          const channelDetails = await YouTubeAPI.searchChannelByUsername(channelId);
          actualChannelId = channelDetails.channelId;
        } catch (error) {
          log.warn(`[Main] Could not resolve username ${channelId} to channel ID:`, error);
          actualChannelId = channelId;
        }
      }

      const result = await YouTubeAPI.getChannelVideos(actualChannelId, pageSize, pageToken);
      videoIds = result.videoIds;
    } else if (source.type === 'youtube_playlist') {
      const playlistId = extractPlaylistId(source.url);
      if (!playlistId) {
        log.warn(`[Main] Could not extract playlist ID from URL: ${source.url}`);
        return [];
      }

      const result = await YouTubeAPI.getPlaylistVideos(playlistId, pageSize, pageToken);
      videoIds = result.videoIds;
    }

    // Enhanced batch processing with Promise.allSettled for graceful failure handling
    const videoResults = await Promise.allSettled(
      videoIds.map(async (videoId): Promise<{ success: boolean; video?: any; videoId: string; error?: any }> => {
        const video = await YouTubeAPI.getVideoDetails(videoId);
        if (video) {
          return { success: true, video, videoId };
        } else {
          return { success: false, videoId };
        }
      })
    );

    // Import fallback video creation function
    const { createFallbackVideo, classifyVideoError } = await import('../shared/videoErrorHandling');

    // Process results and create fallback entries for failed videos
    const videoDetails = videoResults.map((result, index) => {
      const videoId = videoIds[index];

      if (result.status === 'fulfilled' && result.value.success && result.value.video) {
        // Successful video load
        return result.value.video;
      } else {
        // Failed video load - create fallback entry using shared implementation
        let errorInfo;
        if (result.status === 'rejected') {
          errorInfo = classifyVideoError(result.reason, videoId);
        }
        return createFallbackVideo(videoId, errorInfo);
      }
    });

    // Calculate success/failure metrics
    const successfulLoads = videoDetails.filter((v: any) => v.isAvailable !== false).length;
    const failedLoads = videoDetails.length - successfulLoads;

    if (videoDetails.length === 0) {
      log.warn(`[Main] No videos found for page ${pageNumber} of source ${source.id}`);
    } else {
      logVerbose(`[Main] Fetched ${videoDetails.length} videos for page ${pageNumber} (${successfulLoads} available, ${failedLoads} fallback)`);
    }

    // Transform to the expected video format
    return videoDetails.map(v => ({
      id: v.id,
      type: 'youtube' as const,
      title: v.snippet.title,
      thumbnail: v.snippet.thumbnails.high.url || '',
      duration: YouTubeAPI.parseDuration(v.contentDetails.duration),
      url: `https://www.youtube.com/watch?v=${v.id}`,
      preferredLanguages: ['en'],
      sourceId: source.id,
      sourceTitle: source.title,
      sourceThumbnail: source.thumbnail || '',
    }));
  } catch (error) {
    log.error(`[Main] Error fetching videos for page ${pageNumber}:`, error);
    return [];
  }
}

// Handle loading videos from new source system
ipcMain.handle('load-videos-from-sources', async () => {
  try {
    logVerbose('[Main] load-videos-from-sources handler called');

    // Read API key from mainSettings.json
    let apiKey = '';
    try {
      const { readMainSettings } = await import('./fileUtils');
      const mainSettings = await readMainSettings();
      apiKey = mainSettings.youtubeApiKey || '';
    } catch (error) {
      log.warn('[Main] Could not read mainSettings, trying environment variables:', error);
      apiKey = '';
    }
    if (!apiKey) {
      log.warn('[Main] YouTube API key not configured');
    } else {
      logVerbose('[Main] YouTube API key available');
    }

    // Import and use the main process version that has the encoded IDs
    const result = await loadAllVideosFromSourcesMain(AppPaths.getConfigPath('videoSources.json'), apiKey);

    // Extract all videos from the grouped structure and store them globally
    const allVideos: any[] = [];
    if (result.videosBySource) {
      for (const source of result.videosBySource) {
        if (source.videos && Array.isArray(source.videos)) {
          allVideos.push(...source.videos);
        }
      }
    }

    // Store videos globally so the player can access them
    global.currentVideos = allVideos;

    logVerbose('[Main] Loaded videos from new source system:', {
      totalVideos: allVideos.length,
      sources: result.videosBySource?.length || 0
    });

    return result;
  } catch (error) {
    log.error('[Main] Error loading videos from sources:', error);
    throw error;
  }
});

// Handle getting YouTube API key for preload script
ipcMain.handle('get-youtube-api-key', async () => {
  try {
    // Read API key from mainSettings.json
    let apiKey = '';
    try {
      const { readMainSettings } = await import('./fileUtils');
      const mainSettings = await readMainSettings();
      apiKey = mainSettings.youtubeApiKey || '';
    } catch (error) {
      log.warn('[Main] Could not read mainSettings, trying environment variables:', error);
      apiKey = '';
    }
    if (!apiKey) {
      log.warn('[Main] YouTube API key not configured');
      return null;
    }
    logVerbose('[Main] Providing YouTube API key to preload script');
    return apiKey;
  } catch (error) {
    log.error('[Main] Error getting YouTube API key:', error);
    return null;
  }
});

// Handle getting verbose logging setting for preload script
ipcMain.handle('logging:get-verbose', async () => {
  try {
    const isVerbose = process.env.ELECTRON_LOG_VERBOSE === 'true';
    logVerbose('[Main] Providing verbose logging setting to preload script:', isVerbose);
    return { verbose: isVerbose };
  } catch (error) {
    log.error('[Main] Error getting verbose logging setting:', error);
    return { verbose: false };
  }
});

// Handle setup status request
ipcMain.handle('get-setup-status', async () => {
  try {
    const { FirstRunSetup } = await import('./firstRunSetup');
    return await FirstRunSetup.getSetupStatus();
  } catch (error) {
    log.error('Error getting setup status:', error);
    throw error;
  }
});

// Handle logging from renderer process
ipcMain.handle('logging:log', async (_, level: string, ...args: any[]) => {
  try {
    const isVerbose = process.env.ELECTRON_LOG_VERBOSE === 'true';
    if (level === 'verbose' && !isVerbose) {
      return; // Don't log verbose messages if verbose logging is disabled
    }

    // Log to main process console
    if (level === 'verbose') {
      logVerbose('[Renderer]', ...args);
    } else if (level === 'error') {
      log.error('[Renderer]', ...args);
    } else if (level === 'warn') {
      log.warn('[Renderer]', ...args);
    } else {
      logVerbose('[Renderer]', ...args);
    }
  } catch (error) {
    log.error('[Main] Error handling renderer log:', error);
  }
});

// Handle clearing cache for a specific source (smart cache management)
ipcMain.handle('clear-source-cache', async (_, sourceId: string) => {
  try {
    logVerbose('[Main] Smart cache clearing for source:', sourceId);

    // First, read source configuration to determine source type
    let sources = [];
    try {
      const sourcesPath = AppPaths.getConfigPath('videoSources.json');
      const sourcesData = fs.readFileSync(sourcesPath, 'utf-8');
      sources = JSON.parse(sourcesData);
    } catch (error) {
      log.error('[Main] Error reading videoSources.json:', error);
      throw new Error('Failed to read video sources configuration');
    }

    const source = sources.find((s: any) => s.id === sourceId);
    if (!source) {
      log.error('[Main] Source not found for cache clearing:', sourceId);
      throw new Error('Source not found');
    }

    logVerbose('[Main] Found source for cache clearing:', { id: source.id, type: source.type, title: source.title });

    // Handle different source types
    if (source.type === 'local') {
      // For local sources, always safe to clear cache (no API dependency)
      try {
        const { LocalVideoScanner } = await import('../preload/localVideoScanner');
        LocalVideoScanner.clearCache(sourceId);
        logVerbose('[Main] Cleared local video cache for source:', sourceId);
        return { success: true, message: 'Local source cache cleared successfully' };
      } catch (error) {
        log.warn('[Main] Error clearing local video cache:', error);
        throw new Error('Failed to clear local source cache');
      }
    } else if (source.type === 'youtube_channel' || source.type === 'youtube_playlist') {
      // For YouTube sources, test API first before clearing cache
      logVerbose('[Main] Testing YouTube API before clearing cache...');

      // Read API key
      let apiKey = '';
      try {
        const { readMainSettings } = await import('./fileUtils');
        const mainSettings = await readMainSettings();
        apiKey = mainSettings.youtubeApiKey || '';
      } catch (error) {
        log.warn('[Main] Could not read mainSettings for API test:', error);
      }

      if (!apiKey) {
        throw new Error('YouTube API key not configured. Cannot test API before clearing cache.');
      }

      // Test the API with a minimal request
      try {
        const { YouTubeAPI } = await import('../preload/youtube');
        YouTubeAPI.setApiKey(apiKey);

        // Test with a simple API call
        logVerbose('[Main] Testing YouTube API availability...');
        if (source.type === 'youtube_channel') {
          // For channels, test with a basic channel info request
          let channelId = '';
          if (source.url.includes('/@')) {
            // Handle @username format
            const username = source.url.split('/@')[1];
            const result = await YouTubeAPI.searchChannelByUsername(username);
            channelId = result.channelId;
          } else {
            // Handle direct channel URL format
            channelId = source.url.split('/channel/')[1] || source.url.split('c/')[1];
          }

          if (!channelId) {
            throw new Error('Could not extract channel ID for API test');
          }

          // Make a minimal API call to test connectivity and quota
          await YouTubeAPI.getChannelBasicInfo(channelId);
        } else if (source.type === 'youtube_playlist') {
          // For playlists, test with a basic playlist info request
          const playlistId = source.url.split('list=')[1];
          if (!playlistId) {
            throw new Error('Could not extract playlist ID for API test');
          }

          // Make a minimal API call to test connectivity and quota
          await YouTubeAPI.getPlaylistBasicInfo(playlistId);
        }

        logVerbose('[Main] YouTube API test successful, proceeding with cache clearing...');

        // API test succeeded, safe to clear cache
        const cacheDir = path.join('.', '.cache');

        // Clear YouTube source cache
        const sourceCacheFile = path.join(cacheDir, `youtube-${sourceId}.json`);
        if (fs.existsSync(sourceCacheFile)) {
          fs.unlinkSync(sourceCacheFile);
          logVerbose('[Main] Deleted YouTube source cache file:', sourceCacheFile);
        }

        // Clear YouTube page cache files for this specific source
        try {
          const { YouTubePageCache } = await import('../preload/youtubePageCache');
          YouTubePageCache.clearSourcePages(sourceId);
          logVerbose('[Main] Cleared YouTube page cache for source:', sourceId);
        } catch (error) {
          log.warn('[Main] Error clearing YouTube page cache:', error);
        }

        return {
          success: true,
          message: 'YouTube source cache cleared successfully after API test passed'
        };

      } catch (error) {
        // API test failed - keep existing cache
        log.warn('[Main] YouTube API test failed, keeping existing cache:', error);

        const isRateLimitError = error instanceof Error && (
          error.message.includes('quotaExceeded') ||
          error.message.includes('quota') ||
          error.message.includes('rate limit') ||
          error.message.includes('403')
        );

        if (isRateLimitError) {
          return {
            success: false,
            error: 'rate_limit',
            message: 'YouTube API quota exceeded. Keeping existing cache to avoid data loss. Please try again later or check your API quota.',
            keepCache: true
          };
        } else {
          return {
            success: false,
            error: 'api_error',
            message: `YouTube API error: ${error instanceof Error ? error.message : String(error)}. Keeping existing cache.`,
            keepCache: true
          };
        }
      }
    } else {
      throw new Error(`Unsupported source type for cache clearing: ${source.type}`);
    }
  } catch (error) {
    log.error('[Main] Error in smart cache clearing:', error);

    return {
      success: false,
      error: 'general_error',
      message: error instanceof Error ? error.message : String(error)
    };
  }
});

// Helper function to parse ISO duration
function parseISODuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (parseInt(h || '0') * 3600) + (parseInt(m || '0') * 60) + parseInt(s || '0');
}

// Main process version of loadAllVideosFromSources that uses local scanLocalFolder
async function loadAllVideosFromSourcesMain(configPath = AppPaths.getConfigPath('videoSources.json'), apiKey?: string | null) {
  const debug: string[] = [
    '[Main] IPC handler working correctly',
    '[Main] Successfully loaded videoSources.json',
    '[Main] Found 0 video sources' // Will be updated after loading
  ];
  let sources: any[] = [];

  try {
    logVerbose('[Main] Loading video sources from:', configPath);
    logVerbose('[Main] API key provided:', apiKey ? '***configured***' : 'NOT configured');
    sources = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    logVerbose('[Main] Loaded sources:', sources.length);
    logVerbose('[Main] Source IDs:', sources.map(s => s.id));
    debug[2] = '[Main] Found ' + sources.length + ' video sources'; // Update with actual count
  } catch (err) {
    log.error('[Main] ERROR loading videoSources.json:', err);
    return { videosBySource: [], debug };
  }

  const videosBySource: any[] = [];

  for (const source of sources) {
    if (!source.id || !source.type || !source.title) {
      log.warn('[Main] WARNING: Skipping invalid source entry:', source);
      continue;
    }

    logVerbose('[Main] Processing source:', source.id, '(', source.type, ')');
    debug.push(`[Main] Processing source: ${source.id} (${source.type})`);

    if (source.type === 'youtube_channel' || source.type === 'youtube_playlist') {
      // For YouTube sources, use the cached version directly in main process
      try {
        const { CachedYouTubeSources } = await import('../preload/cached-youtube-sources');

        // Set up YouTube API using the preload context (matching the expected pattern)
        logVerbose('[Main] Loading YouTube source:', source.id, source.title);

        let cache;
        if (apiKey) {
          const { YouTubeAPI } = await import('../preload/youtube');
          YouTubeAPI.setApiKey(apiKey);
          await YouTubeAPI.loadCacheConfig();
          logVerbose('[Main] YouTube API configured for source:', source.id);
          cache = await CachedYouTubeSources.loadSourceVideos(source);
        } else {
          log.warn('[Main] No API key provided for YouTube source:', source.id);
          // Try to load from cache without API key (cache-only mode)
          cache = await CachedYouTubeSources.loadSourceVideos(source);
        }

        logVerbose('[Main] Cache loaded for source:', source.id, 'videos:', cache.videos?.length || 0, 'cached:', cache.usingCachedData);

        // Add source metadata to each video for global.currentVideos compatibility
        const videosWithMetadata = cache.videos.map(video => ({
          ...video,
          type: 'youtube',  // PlayerRouter expects this for YouTube videos
          sourceId: source.id,
          sourceType: source.type,  // Use original type (youtube_channel/youtube_playlist)
          sourceTitle: source.title
        }));

        videosBySource.push({
          id: source.id,
          type: source.type,
          title: source.title,
          thumbnail: cache.thumbnail || '',
          videoCount: cache.totalVideos || cache.videos.length,
          videos: videosWithMetadata,  // Use videos with added metadata
          paginationState: {
            currentPage: 1,
            totalPages: Math.ceil((cache.totalVideos || cache.videos.length) / 50),
            totalVideos: cache.totalVideos || cache.videos.length,
            pageSize: 50
          },
          usingCachedData: cache.usingCachedData
        });

        debug.push(`[Main] Successfully loaded YouTube source: ${source.id} with ${cache.videos?.length || 0} videos (cached: ${cache.usingCachedData})`);
      } catch (err) {
        log.error('[Main] ERROR loading YouTube source:', source.id, err);
        debug.push(`[Main] ERROR loading YouTube source: ${source.id} - ${err}`);
        videosBySource.push({
          id: source.id,
          type: source.type,
          title: source.title,
          thumbnail: '',
          videoCount: 0,
          videos: [],
          paginationState: { currentPage: 1, totalPages: 1, totalVideos: 0, pageSize: 50 },
          maxDepth: source.maxDepth,
          path: source.path
        });
      }
    } else if (source.type === 'local') {
      try {
        // For local sources, don't scan videos upfront - let the LocalFolderNavigator handle it dynamically
        // This allows proper folder structure navigation instead of flattening
        debug.push(`[Main] Local source ${source.id}: Using folder navigation (not scanning videos upfront).`);
        logVerbose(`[Main] Local source ${source.id}: Using folder navigation (not scanning videos upfront).`);

        // For local sources, don't count videos upfront to avoid performance issues
        // Video count will be calculated lazily when needed
        videosBySource.push({
          id: source.id,
          type: source.type,
          title: source.title,
          thumbnail: '',
          videoCount: 0, // Will be calculated lazily
          videos: [], // Empty - LocalFolderNavigator will load videos dynamically
          paginationState: { currentPage: 1, totalPages: 1, totalVideos: 0, pageSize: 50 },
          maxDepth: source.maxDepth, // Pass through maxDepth for navigation
          path: source.path // Pass through path for navigation
        });
      } catch (err) {
        log.error('[Main] ERROR scanning local source:', source.id, err);
        debug.push(`[Main] ERROR scanning local source: ${source.id} - ${err}`);
        videosBySource.push({
          id: source.id,
          type: source.type,
          title: source.title,
          thumbnail: '',
          videoCount: 0,
          videos: [],
          paginationState: { currentPage: 1, totalPages: 1, totalVideos: 0, pageSize: 50 }, // Will be updated with actual config
          maxDepth: source.maxDepth, // Pass through maxDepth for navigation
          path: source.path // Pass through path for navigation
        });
      }
    } else {
      debug.push(`[Main] WARNING: Unsupported source type: ${source.type}`);
    }
  }

  // Add downloaded videos as a special source
  try {
    const { readDownloadedVideos } = await import('./fileUtils');
    const downloadedVideos = await readDownloadedVideos();

    if (downloadedVideos.length > 0) {
      // Group downloaded videos by source
      const downloadedVideosBySource = new Map<string, any[]>();

      for (const downloadedVideo of downloadedVideos) {
        const key = downloadedVideo.sourceId;
        if (!downloadedVideosBySource.has(key)) {
          downloadedVideosBySource.set(key, []);
        }
        downloadedVideosBySource.get(key)!.push(downloadedVideo);
      }

      // Create a source entry for downloaded videos
      videosBySource.push({
        id: 'downloaded',
        type: 'downloaded',
        title: 'Downloaded Videos',
        thumbnail: '', // Could add a download icon
        videoCount: downloadedVideos.length,
        videos: downloadedVideos.map(dv => ({
          id: dv.videoId,
          type: 'downloaded' as const,
          title: dv.title,
          thumbnail: dv.thumbnail,
          duration: dv.duration,
          url: `file://${dv.filePath}`,
          sourceId: dv.sourceId,
          sourceTitle: dv.channelTitle || dv.playlistTitle || 'Unknown Source',
          sourceType: dv.sourceType,
          sourceThumbnail: '',
          downloadedAt: dv.downloadedAt,
          filePath: dv.filePath
        })),
        paginationState: { currentPage: 1, totalPages: 1, totalVideos: downloadedVideos.length, pageSize: 50 },
        downloadedVideosBySource: Object.fromEntries(downloadedVideosBySource)
      });

      debug.push(`[Main] Added downloaded videos source with ${downloadedVideos.length} videos`);
    }
  } catch (err) {
    log.error('[Main] ERROR loading downloaded videos:', err);
    debug.push(`[Main] ERROR loading downloaded videos: ${err}`);
  }

  // Collect all videos for global access (needed for video playback)
  const allVideos: any[] = [];
  for (const source of videosBySource) {
    if (source.videos && source.videos.length > 0) {
      allVideos.push(...source.videos);
    }
  }

  // Store videos globally so the player can access them
  global.currentVideos = allVideos;
  logVerbose('[Main] Set global.currentVideos with', allVideos.length, 'videos');

  if (allVideos.length > 0) {
    const sampleVideos = allVideos.slice(0, 5);
    logVerbose('[Main] Sample videos in global.currentVideos:', sampleVideos.map(v => ({ id: v.id, type: v.type, title: v.title, sourceId: v.sourceId })));
  }

  return { videosBySource, debug };
}

// Helper functions for parsing YouTube URLs
const createWindow = (): void => {
  logVerbose('[Main] Creating main window...');

  const preloadPath = path.join(__dirname, '../../preload/preload/index.js');
  logVerbose('[Main] Preload path:', preloadPath);
  logVerbose('[Main] Preload path exists:', fs.existsSync(preloadPath));
  logVerbose('[Main] __dirname:', __dirname);

  logVerbose('[Main] Creating main window...')
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      webSecurity: false, // Allow loading local files
    },
  })

  const devUrl = 'http://localhost:5173'
  const prodIndexPath = path.join(__dirname, '../../../dist/renderer/index.html');
  logVerbose('Loading production URL:', prodIndexPath);

  const waitForDevServer = async (retries = 5, delayMs = 200): Promise<boolean> => {
    logVerbose('[Main] Checking for development server...');
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(devUrl)
        if (res.ok) {
          logVerbose('[Main] Development server found');
          return true
        }
      } catch (error) {
        logVerbose(`[Main] Dev server check ${i + 1}/${retries} failed:`, error instanceof Error ? error.message : String(error));
      }
      await new Promise(r => setTimeout(r, delayMs))
    }
    logVerbose('[Main] Development server not found, using production mode');
    return false
  }

    ; (async () => {
      logVerbose('[Main] Starting HTML loading process...');

      const useDev = await waitForDevServer()
      if (useDev) {
        logVerbose('[Main] Loading development URL:', devUrl)
        await mainWindow.loadURL(devUrl)
        mainWindow.webContents.openDevTools()
      } else {
        logVerbose('[Main] Loading production URL:', prodIndexPath)
        logVerbose('[Main] Production file exists:', fs.existsSync(prodIndexPath))

        // Try multiple possible paths for the HTML file
        const possiblePaths = [
          path.join(__dirname, '../../../dist/renderer/index.html'),
          path.join(process.cwd(), 'dist/renderer/index.html'),
          path.join(process.resourcesPath, 'dist/renderer/index.html')
        ];

        let indexPath = null;
        for (const testPath of possiblePaths) {
          logVerbose('[Main] Checking path:', testPath);
          if (fs.existsSync(testPath)) {
            indexPath = testPath;
            logVerbose('[Main] Found HTML file at:', testPath);
            break;
          }
        }

        if (indexPath) {
          logVerbose('[Main] Loading HTML from:', indexPath);

          // Add debugging for renderer process BEFORE loading
          mainWindow.webContents.on('did-finish-load', () => {
            logVerbose('[Main] HTML finished loading');
          });

          mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            log.error('[Main] Failed to load HTML:', errorCode, errorDescription);
          });

          mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
            // Handle objects and arrays properly
            const messageStr = typeof message === 'object' ? JSON.stringify(message) : String(message);
            logVerbose(`[Main] Renderer console [${level}]: ${messageStr}`);
          });

          // Try loading as file:// URL instead of loadFile
          const fileUrl = `file://${indexPath.replace(/\\/g, '/')}`;
          logVerbose('[Main] Loading as file URL:', fileUrl);
          await mainWindow.loadURL(fileUrl);

          // Note: 'crashed' event is not available in this Electron version

        } else {
          log.error('[Main] Could not find index.html in any expected location');
          // Fallback: load a simple HTML page
          logVerbose('[Main] Loading fallback HTML page');
          await mainWindow.loadURL('data:text/html,<h1>SafeTube</h1><p>Loading...</p>');
        }
      }
    })()

  // Log any errors that occur during page load
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    log.error('Failed to load page:', { errorCode, errorDescription })
  })

  // Set up YouTube handlers (may already be registered)
  try {
    setupYouTubeHandlers()
  } catch (error) {
    log.warn('YouTube handlers may already be registered:', error)
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  logVerbose('[Main] App is ready')

  // Run first-time setup if needed
  try {
    logVerbose('[Main] Running first-time setup...');
    const { FirstRunSetup } = await import('./firstRunSetup');
    const setupResult = await FirstRunSetup.setupIfNeeded();

    if (setupResult.success) {
      logVerbose('[Main] First-time setup completed successfully');
      if (setupResult.createdDirs.length > 0) {
        logVerbose('[Main] Created directories:', setupResult.createdDirs);
      }
      if (setupResult.copiedFiles.length > 0) {
        logVerbose('[Main] Copied files:', setupResult.copiedFiles);
      }
    } else {
      log.error('[Main] First-time setup failed:', setupResult.errors);
    }
  } catch (error) {
    log.error('[Main] Error during first-time setup:', error);
  }


  logVerbose('[Main] About to call createWindow...');
  createWindow()
  logVerbose('[Main] createWindow called');
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  logVerbose('All windows closed')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  logVerbose('App activated')
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Download Management IPC Handlers
ipcMain.handle('download:start', async (_, videoId: string, videoTitle: string, sourceInfo: any) => {
  try {
    logVerbose('[Main] download:start called with:', { videoId, videoTitle, sourceInfo });
    const { DownloadManager } = await import('./downloadManager');
    await DownloadManager.startDownload(videoId, videoTitle, sourceInfo);
    return { success: true };
  } catch (error) {
    logVerbose('[Main] download:start error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('download:get-status', async (_, videoId: string) => {
  try {
    logVerbose('[Main] download:get-status called with:', videoId);
    const { DownloadManager } = await import('./downloadManager');
    return await DownloadManager.getDownloadProgress(videoId);
  } catch (error) {
    logVerbose('[Main] download:get-status error:', error);
    return null;
  }
});

ipcMain.handle('download:cancel', async (_, videoId: string) => {
  try {
    logVerbose('[Main] download:cancel called with:', videoId);
    const { DownloadManager } = await import('./downloadManager');
    await DownloadManager.cancelDownload(videoId);
    return { success: true };
  } catch (error) {
    logVerbose('[Main] download:cancel error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('download:is-downloading', async (_, videoId: string) => {
  try {
    const { DownloadManager } = await import('./downloadManager');
    return DownloadManager.isDownloading(videoId);
  } catch (error) {
    logVerbose('[Main] download:is-downloading error:', error);
    return false;
  }
});

// Main Settings IPC Handlers
ipcMain.handle('main-settings:read', async () => {
  try {
    logVerbose('[Main] main-settings:read called');
    const { readMainSettings } = await import('./fileUtils');
    return await readMainSettings();
  } catch (error) {
    logVerbose('[Main] main-settings:read error:', error);
    return {};
  }
});

ipcMain.handle('main-settings:write', async (_, settings: any) => {
  try {
    logVerbose('[Main] main-settings:write called with:', settings);
    const { writeMainSettings } = await import('./fileUtils');
    await writeMainSettings(settings);
    return { success: true };
  } catch (error) {
    logVerbose('[Main] main-settings:write error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('main-settings:get-default-download-path', async () => {
  try {
    logVerbose('[Main] main-settings:get-default-download-path called');
    const { getDefaultDownloadPath } = await import('./fileUtils');
    return await getDefaultDownloadPath();
  } catch (error) {
    logVerbose('[Main] main-settings:get-default-download-path error:', error);
    return '';
  }
});

// Downloaded Videos IPC Handlers
ipcMain.handle('downloaded-videos:get-all', async () => {
  try {
    logVerbose('[Main] downloaded-videos:get-all called');
    const { readDownloadedVideos } = await import('./fileUtils');
    return await readDownloadedVideos();
  } catch (error) {
    logVerbose('[Main] downloaded-videos:get-all error:', error);
    return [];
  }
});

ipcMain.handle('downloaded-videos:get-by-source', async (_, sourceId: string) => {
  try {
    logVerbose('[Main] downloaded-videos:get-by-source called with:', sourceId);
    const { readDownloadedVideos } = await import('./fileUtils');
    const allDownloaded = await readDownloadedVideos();
    return allDownloaded.filter(video => video.sourceId === sourceId);
  } catch (error) {
    logVerbose('[Main] downloaded-videos:get-by-source error:', error);
    return [];
  }
});

// YouTube Cache IPC Handlers
ipcMain.handle('youtube-cache:get', async (_, cacheKey: string) => {
  try {
    logVerbose('[Main] youtube-cache:get called with:', cacheKey);
    const { YouTubeCache } = await import('./youtubeCache');
    return await YouTubeCache.getCachedResult(cacheKey);
  } catch (error) {
    logVerbose('[Main] youtube-cache:get error:', error);
    return null;
  }
});

ipcMain.handle('youtube-cache:set', async (_, cacheKey: string, data: any) => {
  try {
    logVerbose('[Main] youtube-cache:set called with:', cacheKey);
    const { YouTubeCache } = await import('./youtubeCache');
    await YouTubeCache.setCachedResult(cacheKey, data);
    return true;
  } catch (error) {
    logVerbose('[Main] youtube-cache:set error:', error);
    return false;
  }
});

ipcMain.handle('youtube-cache:clear-expired', async () => {
  try {
    logVerbose('[Main] youtube-cache:clear-expired called');
    const { YouTubeCache } = await import('./youtubeCache');
    await YouTubeCache.clearExpiredCache();
    return true;
  } catch (error) {
    logVerbose('[Main] youtube-cache:clear-expired error:', error);
    return false;
  }
});

ipcMain.handle('youtube-cache:load-config', async () => {
  try {
    logVerbose('[Main] youtube-cache:load-config called');
    const { YouTubeCache } = await import('./youtubeCache');
    await YouTubeCache.loadCacheConfig();
    return true;
  } catch (error) {
    logVerbose('[Main] youtube-cache:load-config error:', error);
    return false;
  }
});

// Download Reset IPC Handlers
ipcMain.handle('download:reset-status', async (_, videoId: string) => {
  try {
    logVerbose('[Main] download:reset-status called with:', videoId);
    const { DownloadResetService } = await import('./downloadResetService');
    await DownloadResetService.resetDownloadStatus(videoId);
    return { success: true };
  } catch (error) {
    logVerbose('[Main] download:reset-status error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('download:check-downloaded', async (_, videoId: string) => {
  try {
    logVerbose('[Main] download:check-downloaded called with:', videoId);
    const { DownloadResetService } = await import('./downloadResetService');
    
    const isDownloaded = await DownloadResetService.isVideoDownloaded(videoId);
    const filePath = await DownloadResetService.getDownloadedVideoPath(videoId);
    const downloadedVideo = await DownloadResetService.getDownloadedVideo(videoId);
    
    return {
      isDownloaded,
      filePath,
      downloadedVideo,
      isAccessible: filePath !== null
    };
  } catch (error) {
    logVerbose('[Main] download:check-downloaded error:', error);
    return {
      isDownloaded: false,
      filePath: null,
      downloadedVideo: null,
      isAccessible: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});


// Log uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error)
})

// Log unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  log.error('Unhandled promise rejection:', reason)
}) 