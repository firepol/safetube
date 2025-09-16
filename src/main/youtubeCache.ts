import fs from 'fs';
import path from 'path';
import { logVerbose } from '../shared/logging';
import { AppPaths } from './appPaths';

// Cache configuration
let CACHE_DIR: string;
let CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes default

// Initialize cache directory
function initializeCacheDir() {
  CACHE_DIR = AppPaths.getCacheDir();

  // Ensure cache directory exists
  if (!fs.existsSync(CACHE_DIR)) {
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      logVerbose(`[YouTubeCache] Created cache directory: ${CACHE_DIR}`);
    } catch (e) {
      console.warn('[YouTubeCache] Could not create cache directory:', e);
    }
  } else {
    logVerbose(`[YouTubeCache] Using cache directory: ${CACHE_DIR}`);
  }
}

// Initialize cache directory on module load
initializeCacheDir();

export class YouTubeCache {
  /**
   * Generate cache key from endpoint and parameters
   */
  static getCacheKey(endpoint: string, params: Record<string, string>): string {
    const sortedParams = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
    return `${endpoint}_${sortedParams}`;
  }

  /**
   * Get cache file path for a given cache key
   */
  static getCacheFilePath(cacheKey: string): string {
    const safeKey = cacheKey.replace(/[^a-zA-Z0-9]/g, '_');
    return path.join(CACHE_DIR, `youtube_api_${safeKey}.json`);
  }

  /**
   * Check if cache data is still valid
   */
  static isCacheValid(cacheData: any): boolean {
    if (!cacheData || !cacheData.timestamp) return false;
    const age = Date.now() - cacheData.timestamp;
    const currentCacheDuration = this.getCacheDuration();
    return age < currentCacheDuration;
  }

  /**
   * Get cached result if valid
   */
  static async getCachedResult(cacheKey: string): Promise<any | null> {
    try {
      const cacheFile = this.getCacheFilePath(cacheKey);
      if (fs.existsSync(cacheFile)) {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        if (this.isCacheValid(cacheData)) {
          logVerbose(`[YouTubeCache] Using cached result for ${cacheKey}`);
          return cacheData.data;
        } else {
          logVerbose(`[YouTubeCache] Cache expired for ${cacheKey}`);
        }
      }
    } catch (e) {
      console.warn(`[YouTubeCache] Error reading cache for ${cacheKey}:`, e);
    }
    return null;
  }

  /**
   * Set cached result
   */
  static async setCachedResult(cacheKey: string, data: any): Promise<void> {
    try {
      const cacheFile = this.getCacheFilePath(cacheKey);
      const cacheData = {
        timestamp: Date.now(),
        data: data
      };
      fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2), 'utf-8');
      logVerbose(`[YouTubeCache] Cached result for ${cacheKey}`);
    } catch (e) {
      console.warn(`[YouTubeCache] Error writing cache for ${cacheKey}:`, e);
    }
  }

  /**
   * Clear expired cache files
   */
  static async clearExpiredCache(): Promise<void> {
    try {
      if (!fs.existsSync(CACHE_DIR)) return;

      const files = fs.readdirSync(CACHE_DIR);
      let clearedCount = 0;

      for (const file of files) {
        if (file.startsWith('youtube_api_') && file.endsWith('.json')) {
          try {
            const filePath = path.join(CACHE_DIR, file);
            const cacheData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            if (!this.isCacheValid(cacheData)) {
              fs.unlinkSync(filePath);
              clearedCount++;
            }
          } catch (e) {
            // Remove corrupted cache files
            try {
              fs.unlinkSync(path.join(CACHE_DIR, file));
              clearedCount++;
            } catch (unlinkError) {
              console.warn(`[YouTubeCache] Could not remove corrupted cache file ${file}:`, unlinkError);
            }
          }
        }
      }

      if (clearedCount > 0) {
        logVerbose(`[YouTubeCache] Cleared ${clearedCount} expired cache files`);
      }
    } catch (e) {
      console.warn('[YouTubeCache] Error clearing expired cache:', e);
    }
  }

  /**
   * Load cache configuration from pagination.json
   */
  static async loadCacheConfig(): Promise<void> {
    try {
      const configPath = path.join('.', 'config', 'pagination.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const cacheDurationMinutes = config.cacheDurationMinutes || 30;
        // Update the module-level variable
        CACHE_DURATION_MS = cacheDurationMinutes * 60 * 1000;
        logVerbose(`[YouTubeCache] Cache duration set to ${cacheDurationMinutes} minutes (${CACHE_DURATION_MS}ms)`);
      }
    } catch (e) {
      console.warn('[YouTubeCache] Could not load cache config, using default 30 minutes:', e);
    }
  }

  /**
   * Get current cache duration from configuration
   */
  static getCacheDuration(): number {
    try {
      const configPath = path.join('.', 'config', 'pagination.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const cacheDurationMinutes = config.cacheDurationMinutes || 30;
        return cacheDurationMinutes * 60 * 1000;
      }
    } catch (e) {
      // Fall back to current value
    }
    return CACHE_DURATION_MS;
  }
}