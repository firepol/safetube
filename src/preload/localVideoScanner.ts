import fs from 'fs';
import path from 'path';
import { logVerbose } from './logging';
import { createLocalVideoId } from '../shared/fileUtils';
import { getBestThumbnail, normalizeThumbnailPath } from '../shared/thumbnailUtils';
import { ThumbnailGenerator } from '../main/thumbnailGenerator';

interface LocalVideoScanResult {
  videos: LocalVideoItem[];
  totalVideos: number;
  scannedAt: number;
  sourceId: string;
  sourcePath: string;
}

interface LocalVideoItem {
  id: string;
  title: string;
  url: string; // File path
  type: 'local';
  thumbnail: string;
  duration: number; // Will be 0 initially, can be filled later
  depth: number;
  relativePath: string;
}

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];
const THUMBNAIL_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

export class LocalVideoScanner {



  /**
   * Scan a local folder for video files (no caching - dynamic scanning)
   */
  static async scanFolder(sourceId: string, sourcePath: string, maxDepth: number = 3): Promise<LocalVideoScanResult> {
    logVerbose(`[LocalVideoScanner] Scanning local folder for ${sourceId}: ${sourcePath}`);

    const videos: LocalVideoItem[] = [];
    await this.scanFolderRecursive(sourcePath, sourcePath, videos, maxDepth, 1, sourceId);

    const result: LocalVideoScanResult = {
      videos,
      totalVideos: videos.length,
      scannedAt: Date.now(),
      sourceId,
      sourcePath
    };

    logVerbose(`[LocalVideoScanner] Found ${videos.length} videos in ${sourceId}`);
    return result;
  }

  /**
   * Recursively scan folder for video files
   */
  private static async scanFolderRecursive(
    currentPath: string,
    basePath: string,
    videos: LocalVideoItem[],
    maxDepth: number,
    currentDepth: number,
    sourceId: string
  ): Promise<void> {
    try {
      const absolutePath = path.isAbsolute(currentPath) ? currentPath : path.join(process.cwd(), currentPath);

      if (!fs.existsSync(absolutePath)) {
        console.warn(`[LocalVideoScanner] Path does not exist: ${absolutePath}`);
        return;
      }

      const entries = fs.readdirSync(absolutePath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(absolutePath, entry.name);

        if (entry.isDirectory()) {
          // Continue scanning subdirectories if within maxDepth
          if (currentDepth < maxDepth) {
            await this.scanFolderRecursive(fullPath, basePath, videos, maxDepth, currentDepth + 1, sourceId);
          }
        } else if (entry.isFile() && this.isVideoFile(entry.name)) {
          // Generate URI-style ID for local video using the new system
          const videoId = createLocalVideoId(fullPath);
          const relativePath = path.relative(basePath, fullPath);

          // Check for thumbnail file with same name
          const foundThumbnail = this.findThumbnailForVideo(fullPath);
          // Use thumbnail utilities to get the best thumbnail
          const thumbnail = normalizeThumbnailPath(foundThumbnail, 'local');

          videos.push({
            id: videoId,
            title: path.basename(entry.name, path.extname(entry.name)),
            url: fullPath,
            type: 'local',
            thumbnail: thumbnail,
            duration: 0, // Will be populated lazily when needed
            depth: currentDepth,
            relativePath
          });
        }
      }
    } catch (error) {
      console.error(`[LocalVideoScanner] Error scanning folder ${currentPath}:`, error);
    }
  }

  /**
   * Check if file is a video file based on extension
   */
  private static isVideoFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
  }

  /**
   * Find thumbnail file for a video (same filename but image extension)
   */
  private static findThumbnailForVideo(videoPath: string): string {
    try {
      const videoDir = path.dirname(videoPath);
      const videoName = path.basename(videoPath, path.extname(videoPath));

      // Check for thumbnail files with same name but different extension
      for (const thumbExt of THUMBNAIL_EXTENSIONS) {
        const thumbnailPath = path.join(videoDir, videoName + thumbExt);
        if (fs.existsSync(thumbnailPath)) {
          logVerbose(`[LocalVideoScanner] Found thumbnail for ${path.basename(videoPath)}: ${thumbnailPath}`);
          return thumbnailPath;
        }
      }

      // No thumbnail found
      return '';
    } catch (error) {
      console.warn(`[LocalVideoScanner] Error checking for thumbnail for ${videoPath}:`, error);
      return '';
    }
  }

  /**
   * Enhance videos with generated thumbnails (async background operation)
   */
  static async enhanceWithGeneratedThumbnails(videos: LocalVideoItem[]): Promise<LocalVideoItem[]> {
    const enhanced = [...videos];

    // Check if FFmpeg is available
    const ffmpegAvailable = await ThumbnailGenerator.isFFmpegAvailable();
    if (!ffmpegAvailable) {
      logVerbose('[LocalVideoScanner] FFmpeg not available, skipping thumbnail generation');
      return enhanced;
    }

    // Process videos that don't have thumbnails or only have fallbacks
    for (let i = 0; i < enhanced.length; i++) {
      const video = enhanced[i];

      // Skip if video already has a real thumbnail (not a fallback)
      if (video.thumbnail &&
          !video.thumbnail.includes('local-video-thumbnail.svg') &&
          !video.thumbnail.includes('placeholder-thumbnail.svg')) {
        continue;
      }

      try {
        // Try to generate thumbnail from video
        const generatedThumbnail = await ThumbnailGenerator.generateCachedThumbnail(video.id, video.url);

        if (generatedThumbnail) {
          // Update the video with generated thumbnail
          enhanced[i] = {
            ...video,
            thumbnail: generatedThumbnail
          };
          logVerbose(`[LocalVideoScanner] Generated thumbnail for ${video.title}`);
        }
      } catch (error) {
        logVerbose(`[LocalVideoScanner] Failed to generate thumbnail for ${video.title}: ${error}`);
      }
    }

    return enhanced;
  }



  /**
   * Get paginated videos from scan result
   */
  static getPaginatedVideos(scanResult: LocalVideoScanResult, pageNumber: number, pageSize: number): {
    videos: LocalVideoItem[];
    paginationState: {
      currentPage: number;
      totalPages: number;
      totalVideos: number;
      pageSize: number;
    };
  } {
    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageVideos = scanResult.videos.slice(startIndex, endIndex);
    const totalPages = Math.ceil(scanResult.totalVideos / pageSize);

    return {
      videos: pageVideos,
      paginationState: {
        currentPage: pageNumber,
        totalPages,
        totalVideos: scanResult.totalVideos,
        pageSize
      }
    };
  }
}