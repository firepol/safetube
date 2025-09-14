import fs from 'fs';
import path from 'path';
import { logVerbose } from './logging';

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
  thumbnail: '';
  duration: number; // Will be 0 initially, can be filled later
  depth: number;
  relativePath: string;
}

const CACHE_DIR = path.join('.', '.cache');
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];

export class LocalVideoScanner {
  /**
   * Get cache file path for a local source
   */
  static getCacheFilePath(sourceId: string): string {
    return path.join(CACHE_DIR, `local-videos-${sourceId}.json`);
  }

  /**
   * Check if cached scan is valid based on configuration
   */
  static isCacheValid(cacheData: LocalVideoScanResult): boolean {
    if (!cacheData || !cacheData.scannedAt) return false;

    const age = Date.now() - cacheData.scannedAt;

    // Load cache duration from pagination config
    let cacheDurationMs = 30 * 60 * 1000; // 30 minutes default
    try {
      const configPath = path.join('.', 'config', 'pagination.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        cacheDurationMs = (config.cacheDurationMinutes || 30) * 60 * 1000;
      }
    } catch (error) {
      console.warn('[LocalVideoScanner] Failed to load cache duration config:', error);
    }

    return age < cacheDurationMs;
  }

  /**
   * Get cached scan result if valid
   */
  static getCachedScan(sourceId: string): LocalVideoScanResult | null {
    try {
      const cacheFile = this.getCacheFilePath(sourceId);
      if (fs.existsSync(cacheFile)) {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        if (this.isCacheValid(cacheData)) {
          logVerbose(`[LocalVideoScanner] Using valid cache for local source ${sourceId}`);
          return cacheData;
        } else {
          logVerbose(`[LocalVideoScanner] Cache expired for local source ${sourceId}`);
        }
      }
    } catch (e) {
      console.warn(`[LocalVideoScanner] Error reading cache for local source ${sourceId}:`, e);
    }
    return null;
  }

  /**
   * Scan a local folder for video files
   */
  static async scanFolder(sourceId: string, sourcePath: string, maxDepth: number = 3): Promise<LocalVideoScanResult> {
    // Check cache first
    const cachedScan = this.getCachedScan(sourceId);
    if (cachedScan) {
      return cachedScan;
    }

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

    // Cache the result
    this.cacheScanResult(result);

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
          // Generate encoded ID for local video
          const videoId = `local_${Buffer.from(fullPath).toString('base64').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16)}`;
          const relativePath = path.relative(basePath, fullPath);

          videos.push({
            id: videoId,
            title: path.basename(entry.name, path.extname(entry.name)),
            url: fullPath,
            type: 'local',
            thumbnail: '',
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
   * Cache scan result to disk
   */
  private static cacheScanResult(result: LocalVideoScanResult): void {
    try {
      // Ensure cache directory exists
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }

      const cacheFile = this.getCacheFilePath(result.sourceId);
      fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2), 'utf-8');
      logVerbose(`[LocalVideoScanner] Cached scan result for ${result.sourceId} (${result.totalVideos} videos)`);
    } catch (e) {
      console.warn(`[LocalVideoScanner] Error caching scan result for ${result.sourceId}:`, e);
    }
  }

  /**
   * Clear cached scan for a specific source
   */
  static clearCache(sourceId: string): void {
    try {
      const cacheFile = this.getCacheFilePath(sourceId);
      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
        logVerbose(`[LocalVideoScanner] Cleared cache for local source ${sourceId}`);
      }
    } catch (error) {
      console.warn(`[LocalVideoScanner] Error clearing cache for local source ${sourceId}:`, error);
    }
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