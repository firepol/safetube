import fs from 'fs';
import path from 'path';

import { createLocalVideoId } from '../../shared/fileUtils';
import { logVerbose } from '../../shared/logging';
import { AppPaths } from '../appPaths';
import log from '../logger';

// Helper function to filter out converted videos when original exists
export function filterDuplicateVideos(videos: any[]): any[] {
  const filteredVideos: any[] = [];
  const originalVideos = new Set<string>();

  // First pass: collect all original video paths
  for (const video of videos) {
    const isConverted = video.url.includes('.converted/') || video.url.includes('\\.converted\\') || video.url.includes('.converted\\');
    if (!isConverted) {
      originalVideos.add(video.url);
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

      if (!hasOriginal) {
        filteredVideos.push(video); // Include converted only if no original
      }
      // Skip converted videos that have originals
    } else {
      filteredVideos.push(video); // Always include original videos
    }
  }

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
      return `file://${thumbnailPath}`;
    }
  }

  return ''; // No thumbnail found
}

// Helper function to get thumbnail URL for custom protocol
function getThumbnailUrl(thumbnailPath: string): string {
  const filename = path.basename(thumbnailPath);
  // Encode filename to handle spaces, emojis, and special characters
  const encodedFilename = encodeURIComponent(filename);
  return `safetube-thumbnails://${encodedFilename}`;
}

// Schedule thumbnail generation in background - imported from main
let scheduleBackgroundThumbnailGeneration: (videoId: string, videoPath: string) => void;

// Set the thumbnail scheduler function
export function setThumbnailScheduler(scheduler: (videoId: string, videoPath: string) => void) {
  scheduleBackgroundThumbnailGeneration = scheduler;
}

// Helper function for scanning local folders
export async function scanLocalFolder(folderPath: string, maxDepth: number): Promise<any[]> {
  const videos: any[] = [];
  const supportedExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];

  try {
    // Resolve relative paths from project root
    const absolutePath = path.isAbsolute(folderPath) ? folderPath : path.join(process.cwd(), folderPath);

    if (!fs.existsSync(absolutePath)) {
      log.warn('[LocalVideoService] Local folder does not exist:', absolutePath);
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

              // Find thumbnail file with same name as video
              let thumbnailUrl = findThumbnailForVideo(itemPath);

              // Check if thumbnail already exists in cache
              if (!thumbnailUrl) {
                const { getThumbnailCacheKey } = await import('../../shared/thumbnailUtils');
                const cacheKey = getThumbnailCacheKey(videoId, 'local');
                const cachedThumbnailPath = AppPaths.getThumbnailPath(`${cacheKey}.jpg`);

                if (fs.existsSync(cachedThumbnailPath)) {
                  thumbnailUrl = getThumbnailUrl(cachedThumbnailPath);
                } else {
                  // Schedule thumbnail generation in background (non-blocking)
                  if (scheduleBackgroundThumbnailGeneration) {
                    scheduleBackgroundThumbnailGeneration(videoId, itemPath);
                  }
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
        log.warn('[LocalVideoService] Error scanning folder:', currentPath, error);
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

              // Find thumbnail file with same name as video
              let thumbnailUrl = findThumbnailForVideo(itemPath);

              // Check if thumbnail already exists in cache
              if (!thumbnailUrl) {
                const { getThumbnailCacheKey } = await import('../../shared/thumbnailUtils');
                const cacheKey = getThumbnailCacheKey(videoId, 'local');
                const cachedThumbnailPath = AppPaths.getThumbnailPath(`${cacheKey}.jpg`);

                if (fs.existsSync(cachedThumbnailPath)) {
                  thumbnailUrl = getThumbnailUrl(cachedThumbnailPath);
                } else {
                  // Schedule thumbnail generation in background (non-blocking)
                  if (scheduleBackgroundThumbnailGeneration) {
                    scheduleBackgroundThumbnailGeneration(videoId, itemPath);
                  }
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
        log.warn('[LocalVideoService] Error scanning deeper folder for flattening:', currentPath, error);
      }
    };

    // Start scanning from the root folder (depth 1)
    await scanFolder(absolutePath, 1);
    logVerbose('[LocalVideoService] Found videos in local folder:', videos.length, 'with maxDepth:', maxDepth);

  } catch (error) {
    log.error('[LocalVideoService] Error scanning local folder:', error);
  }

  // Filter out converted videos when original exists
  const filteredVideos = filterDuplicateVideos(videos);
  logVerbose('[LocalVideoService] Filtered videos:', { original: videos.length, filtered: filteredVideos.length });

  return filteredVideos;
}

// New function to get folder contents for navigation (not flattened)
export async function getLocalFolderContents(folderPath: string, maxDepth: number, currentDepth: number = 1): Promise<{ folders: any[], videos: any[], depth: number }> {
  const folders: any[] = [];
  const videos: any[] = [];
  const supportedExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];

  try {
    // Resolve relative paths from project root
    const absolutePath = path.isAbsolute(folderPath) ? folderPath : path.join(process.cwd(), folderPath);

    if (!fs.existsSync(absolutePath)) {
      log.warn('[LocalVideoService] Local folder does not exist:', absolutePath);
      return { folders, videos, depth: currentDepth };
    }

    const items = fs.readdirSync(absolutePath);

    for (const item of items) {
      const itemPath = path.join(absolutePath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        // Show folders if we haven't reached maxDepth
        if (currentDepth < maxDepth) {
          folders.push({
            name: item,
            path: itemPath,
            type: 'folder',
            depth: currentDepth + 1
          });
        } else if (currentDepth === maxDepth) {
          // At maxDepth, flatten deeper content from this directory
          const flattenedContent = await getFlattenedContent(itemPath, currentDepth + 1);
          videos.push(...flattenedContent);
        }
        // If currentDepth > maxDepth, skip (shouldn't happen in normal flow)
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (supportedExtensions.includes(ext)) {
          // Generate URI-style ID for local video
          const videoId = createLocalVideoId(itemPath);

          // Find thumbnail file with same name as video
          let thumbnailUrl = findThumbnailForVideo(itemPath);

          // Check if thumbnail already exists in cache
          if (!thumbnailUrl) {
            const { getThumbnailCacheKey } = await import('../../shared/thumbnailUtils');
            const cacheKey = getThumbnailCacheKey(videoId, 'local');
            const cachedThumbnailPath = AppPaths.getThumbnailPath(`${cacheKey}.jpg`);

            if (fs.existsSync(cachedThumbnailPath)) {
              thumbnailUrl = getThumbnailUrl(cachedThumbnailPath);
            } else {
              // Schedule thumbnail generation in background (non-blocking)
              if (scheduleBackgroundThumbnailGeneration) {
                scheduleBackgroundThumbnailGeneration(videoId, itemPath);
              }
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

    logVerbose('[LocalVideoService] Folder contents result:', { folders: folders.length, videos: videos.length, depth: currentDepth });

  } catch (error) {
    log.error('[LocalVideoService] Error getting folder contents:', error);
  }

  // Filter out converted videos when original exists
  const filteredVideos = filterDuplicateVideos(videos);
  logVerbose('[LocalVideoService] Filtered folder videos:', { original: videos.length, filtered: filteredVideos.length });

  return { folders, videos: filteredVideos, depth: currentDepth };
}

// Helper function to count total videos in a folder recursively (with filtering)
export async function countVideosInFolder(folderPath: string, maxDepth: number, currentDepth: number = 1): Promise<number> {
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

    return filteredVideos.length;

  } catch (error) {
    log.warn('[LocalVideoService] Error counting videos in folder:', folderPath, error);
    return 0;
  }
}

// Helper function to count videos recursively (for flattening at maxDepth) with filtering
export async function countVideosRecursively(folderPath: string): Promise<number> {
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

  } catch (error) {
    log.warn('[LocalVideoService] Error counting videos recursively:', folderPath, error);
  }

  return totalCount;
}

// Helper function to get flattened content from deeper levels
export async function getFlattenedContent(folderPath: string, depth: number): Promise<any[]> {
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

          // Find thumbnail file with same name as video
          let thumbnailUrl = findThumbnailForVideo(itemPath);

          // Check if thumbnail already exists in cache
          if (!thumbnailUrl) {
            const { getThumbnailCacheKey } = await import('../../shared/thumbnailUtils');
            const cacheKey = getThumbnailCacheKey(videoId, 'local');
            const cachedThumbnailPath = AppPaths.getThumbnailPath(`${cacheKey}.jpg`);

            if (fs.existsSync(cachedThumbnailPath)) {
              thumbnailUrl = getThumbnailUrl(cachedThumbnailPath);
            } else {
              // Schedule thumbnail generation in background (non-blocking)
              if (scheduleBackgroundThumbnailGeneration) {
                scheduleBackgroundThumbnailGeneration(videoId, itemPath);
              }
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
    log.warn('[LocalVideoService] Error getting flattened content:', error);
  }

  // Filter out converted videos when original exists
  const filteredVideos = filterDuplicateVideos(videos);

  return filteredVideos;
}