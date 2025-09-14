import fs from 'fs';
import path from 'path';
import { logVerbose } from './logging';

interface CachedYouTubePage {
  videos: any[];
  pageNumber: number;
  totalResults: number;
  timestamp: number;
  sourceId: string;
  sourceType: 'youtube_channel' | 'youtube_playlist';
}

const CACHE_DIR = path.join('.', '.cache');

export class YouTubePageCache {
  /**
   * Get cache file path for a specific source page
   */
  static getCacheFilePath(sourceId: string, pageNumber: number): string {
    return path.join(CACHE_DIR, `youtube-pages-${sourceId}-page-${pageNumber}.json`);
  }

  /**
   * Check if cache is valid based on configuration
   */
  static isCacheValid(cacheData: CachedYouTubePage): boolean {
    if (!cacheData || !cacheData.timestamp) return false;

    const age = Date.now() - cacheData.timestamp;

    // Load cache duration from pagination config
    let cacheDurationMs = 30 * 60 * 1000; // 30 minutes default
    try {
      const configPath = path.join('.', 'config', 'pagination.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        cacheDurationMs = (config.cacheDurationMinutes || 30) * 60 * 1000;
      }
    } catch (error) {
      console.warn('[YouTubePageCache] Failed to load cache duration config:', error);
    }

    return age < cacheDurationMs;
  }

  /**
   * Get cached page if valid
   */
  static getCachedPage(sourceId: string, pageNumber: number): CachedYouTubePage | null {
    try {
      const cacheFile = this.getCacheFilePath(sourceId, pageNumber);
      if (fs.existsSync(cacheFile)) {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        if (this.isCacheValid(cacheData)) {
          logVerbose(`[YouTubePageCache] Using valid cache for ${sourceId} page ${pageNumber}`);
          return cacheData;
        } else {
          logVerbose(`[YouTubePageCache] Cache expired for ${sourceId} page ${pageNumber}`);
        }
      }
    } catch (e) {
      console.warn(`[YouTubePageCache] Error reading cache for ${sourceId} page ${pageNumber}:`, e);
    }
    return null;
  }

  /**
   * Get cached page even if expired (for fallback when API fails)
   */
  static getCachedPageFallback(sourceId: string, pageNumber: number): CachedYouTubePage | null {
    try {
      const cacheFile = this.getCacheFilePath(sourceId, pageNumber);
      if (fs.existsSync(cacheFile)) {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        logVerbose(`[YouTubePageCache] Using fallback cache for ${sourceId} page ${pageNumber} (API failed)`);
        return cacheData;
      }
    } catch (e) {
      console.warn(`[YouTubePageCache] Error reading fallback cache for ${sourceId} page ${pageNumber}:`, e);
    }
    return null;
  }

  /**
   * Cache a page result
   */
  static cachePage(sourceId: string, pageNumber: number, videos: any[], totalResults: number, sourceType: 'youtube_channel' | 'youtube_playlist'): void {
    try {
      // Ensure cache directory exists
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }

      const cacheFile = this.getCacheFilePath(sourceId, pageNumber);
      const cacheData: CachedYouTubePage = {
        videos,
        pageNumber,
        totalResults,
        timestamp: Date.now(),
        sourceId,
        sourceType
      };

      fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2), 'utf-8');
      logVerbose(`[YouTubePageCache] Cached page ${pageNumber} for ${sourceId} (${videos.length} videos)`);
    } catch (e) {
      console.warn(`[YouTubePageCache] Error caching page ${pageNumber} for ${sourceId}:`, e);
    }
  }

  /**
   * Clear all cached pages for a specific source
   */
  static clearSourcePages(sourceId: string): void {
    try {
      if (!fs.existsSync(CACHE_DIR)) return;

      const files = fs.readdirSync(CACHE_DIR);
      let clearedCount = 0;

      for (const file of files) {
        // Match pattern: youtube-pages-{sourceId}-page-*.json
        if (file.startsWith(`youtube-pages-${sourceId}-page-`) && file.endsWith('.json')) {
          const filePath = path.join(CACHE_DIR, file);
          fs.unlinkSync(filePath);
          clearedCount++;
          logVerbose(`[YouTubePageCache] Cleared page cache file: ${file}`);
        }
      }

      if (clearedCount > 0) {
        logVerbose(`[YouTubePageCache] Cleared ${clearedCount} page cache files for source ${sourceId}`);
      }
    } catch (error) {
      console.warn(`[YouTubePageCache] Error clearing page cache for ${sourceId}:`, error);
    }
  }

  /**
   * Clear all expired cached pages across all sources
   */
  static clearExpiredPages(): void {
    try {
      if (!fs.existsSync(CACHE_DIR)) return;

      const files = fs.readdirSync(CACHE_DIR);
      let clearedCount = 0;

      for (const file of files) {
        if (file.startsWith('youtube-pages-') && file.endsWith('.json')) {
          try {
            const filePath = path.join(CACHE_DIR, file);
            const cacheData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            if (!this.isCacheValid(cacheData)) {
              fs.unlinkSync(filePath);
              clearedCount++;
              logVerbose(`[YouTubePageCache] Cleared expired page cache file: ${file}`);
            }
          } catch (e) {
            // Remove corrupted cache files
            try {
              fs.unlinkSync(path.join(CACHE_DIR, file));
              clearedCount++;
              logVerbose(`[YouTubePageCache] Removed corrupted page cache file: ${file}`);
            } catch (unlinkError) {
              console.warn(`[YouTubePageCache] Could not remove corrupted cache file ${file}:`, unlinkError);
            }
          }
        }
      }

      if (clearedCount > 0) {
        logVerbose(`[YouTubePageCache] Cleared ${clearedCount} expired/corrupted page cache files`);
      }
    } catch (e) {
      console.warn('[YouTubePageCache] Error clearing expired page cache:', e);
    }
  }
}