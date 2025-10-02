import { logVerbose } from './logging';

// Import IPC constants
const IPC = {
  YOUTUBE_CACHE_DB: {
    GET_PAGE: 'youtube-cache:get-page',
  },
  YOUTUBE_CACHE: {
    CLEAR_EXPIRED: 'youtube-cache:clear-expired',
  },
} as const;

// Note: 'youtube-cache:save-page' and 'youtube-cache:clear-source' are not in the IPC constants yet
// They should be added to src/shared/ipc-channels.ts
const YOUTUBE_CACHE_SAVE_PAGE = 'youtube-cache:save-page';
const YOUTUBE_CACHE_CLEAR_SOURCE = 'youtube-cache:clear-source';

interface CachedYouTubePage {
  videos: any[];
  pageNumber: number;
  totalResults: number;
  timestamp: number;
  sourceId: string;
  sourceType: 'youtube_channel' | 'youtube_playlist';
  nextPageToken?: string; // Token to fetch the next page
}

// In-memory cache for page tokens to enable direct page jumping
const pageTokenCache = new Map<string, Map<number, string>>(); // sourceId -> (pageNumber -> token for that page)


export class YouTubePageCache {
  /**
   * Get the page token for a specific page (to enable direct page access)
   */
  static getPageToken(sourceId: string, pageNumber: number): string | undefined {
    return pageTokenCache.get(sourceId)?.get(pageNumber);
  }

  /**
   * Set the page token for a specific page
   */
  static setPageToken(sourceId: string, pageNumber: number, token: string): void {
    if (!pageTokenCache.has(sourceId)) {
      pageTokenCache.set(sourceId, new Map());
    }
    pageTokenCache.get(sourceId)!.set(pageNumber, token);
  }

  /**
   * Clear page tokens for a source
   */
  static clearPageTokens(sourceId: string): void {
    pageTokenCache.delete(sourceId);
  }
  /**
   * Get cached page from database
   */
  static async getCachedPage(sourceId: string, pageNumber: number): Promise<CachedYouTubePage | null> {
    try {
      if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
        // Renderer process: use IPC
        const result = await (window as any).electron.invoke(IPC.YOUTUBE_CACHE_DB.GET_PAGE, sourceId, pageNumber);
        if (result && result.videos) {
          logVerbose(`[YouTubePageCache] Using database cache for ${sourceId} page ${pageNumber}`);
          return result;
        }
      } else if (typeof process !== 'undefined' && process.type === 'browser') {
        // Main process: use direct database access
        try {
          const { DatabaseService } = await import('../main/services/DatabaseService');
          const dbService = DatabaseService.getInstance();

          // Calculate page range for the query
          const pageSize = 50;
          const start = (pageNumber - 1) * pageSize + 1;
          const end = start + pageSize - 1;
          const pageRange = `${start}-${end}`;

          // Query all video info for this page range
          const rows = await dbService.all<any>(
            `SELECT v.id, v.title, v.published_at, v.thumbnail, v.duration, v.url, v.is_available, v.description, y.position, y.fetch_timestamp
             FROM youtube_api_results y
             JOIN videos v ON y.video_id = v.id
             WHERE y.source_id = ? AND y.page_range = ?
             ORDER BY y.position ASC`,
            [sourceId, pageRange]
          );

          if (!rows || rows.length === 0) {
            return null;
          }

          // Compose the CachedYouTubePage object
          const videos = rows.map(r => ({
            id: r.id,
            title: r.title,
            publishedAt: r.published_at,
            thumbnail: r.thumbnail,
            duration: r.duration,
            url: r.url,
            isAvailable: r.is_available,
            description: r.description
          }));

          const fetchTimestamps = rows.map(r => new Date(r.fetch_timestamp).getTime());
          const timestamp = fetchTimestamps.length > 0 ? Math.max(...fetchTimestamps) : Date.now();

          // Use cached data and batch operations for better performance
          const { DataCacheService } = await import('../main/services/DataCacheService');
          const cacheService = DataCacheService.getInstance();

          // Get total video count from source (not cached count)
          let totalResults: number;
          let sourceData = cacheService.getSource(sourceId);
          if (!sourceData) {
            const sourceMap = await dbService.batchGetSourcesData([sourceId]);
            sourceData = sourceMap.get(sourceId);
            if (sourceData) {
              cacheService.setSource(sourceId, sourceData);
            }
          }
          totalResults = sourceData?.total_videos || 0;

          const sourceType = sourceData?.type || 'youtube_channel';

          logVerbose(`[YouTubePageCache] Using database cache for ${sourceId} page ${pageNumber} (main process)`);

          return {
            videos,
            pageNumber,
            totalResults,
            timestamp,
            sourceId,
            sourceType: sourceType as 'youtube_channel' | 'youtube_playlist'
          };
        } catch (error) {
          logVerbose(`[YouTubePageCache] Error reading database cache in main process: ${error}`);
          return null;
        }
      }
    } catch (error) {
      console.warn(`[YouTubePageCache] Error reading database cache for ${sourceId} page ${pageNumber}:`, error);
    }
    return null;
  }

  /**
   * Get cached page even if expired (for fallback when API fails)
   */
  static async getCachedPageFallback(sourceId: string, pageNumber: number): Promise<CachedYouTubePage | null> {
    // With database caching, we use the same method for fallback
    // The database will return any available data regardless of age
    return this.getCachedPage(sourceId, pageNumber);
  }

  /**
   * Cache a page result to database
   */
  static async cachePage(sourceId: string, pageNumber: number, videos: any[], totalResults: number, sourceType: 'youtube_channel' | 'youtube_playlist'): Promise<void> {
    try {
      const cacheData: CachedYouTubePage = {
        videos,
        pageNumber,
        totalResults,
        timestamp: Date.now(),
        sourceId,
        sourceType
      };

      if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
        // Renderer process: use IPC
        await (window as any).electron.invoke(YOUTUBE_CACHE_SAVE_PAGE, sourceId, pageNumber, cacheData);
        logVerbose(`[YouTubePageCache] Cached page ${pageNumber} for ${sourceId} (${videos.length} videos) in database via IPC`);
      } else if (typeof process !== 'undefined' && process.type === 'browser') {
        // Main process: use direct database access
        try {
          const { DatabaseService } = await import('../main/services/DatabaseService');
          const dbService = DatabaseService.getInstance();

          // Calculate page range for the youtube_api_results table
          const startPosition = (pageNumber - 1) * 50 + 1;
          const endPosition = startPosition + videos.length - 1;
          const pageRange = `${startPosition}-${endPosition}`;

          // Prepare batch transaction for better performance
          const queries = [];
          const timestamp = new Date().toISOString();

          // First, clear existing cache for this source and page range
          queries.push({
            sql: 'DELETE FROM youtube_api_results WHERE source_id = ? AND page_range = ?',
            params: [sourceId, pageRange]
          });

          // Then, batch insert all new cache entries
          for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            const position = startPosition + i;
            queries.push({
              sql: 'INSERT INTO youtube_api_results (source_id, video_id, position, page_range, fetch_timestamp) VALUES (?, ?, ?, ?, ?)',
              params: [sourceId, video.id, position, pageRange, timestamp]
            });
          }

          // Execute all operations in a single transaction
          await dbService.executeTransaction(queries, { silent: true });

          logVerbose(`[YouTubePageCache] Cached page ${pageNumber} for ${sourceId} (${videos.length} videos) in database via main process`);
        } catch (error) {
          logVerbose(`[YouTubePageCache] Error caching page in main process: ${error}`);
        }
      }
    } catch (error) {
      console.warn(`[YouTubePageCache] Error caching page ${pageNumber} for ${sourceId} in database:`, error);
    }
  }

  /**
   * Clear all cached pages for a specific source from database
   */
  static async clearSourcePages(sourceId: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
        await (window as any).electron.invoke(YOUTUBE_CACHE_CLEAR_SOURCE, sourceId);
        logVerbose(`[YouTubePageCache] Cleared all page cache for source ${sourceId} from database`);
      }
    } catch (error) {
      console.warn(`[YouTubePageCache] Error clearing page cache for ${sourceId} from database:`, error);
    }
  }

  /**
   * Clear all expired cached pages from database
   */
  static async clearExpiredPages(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
        await (window as any).electron.invoke(IPC.YOUTUBE_CACHE.CLEAR_EXPIRED);
        logVerbose(`[YouTubePageCache] Cleared expired page cache from database`);
      }
    } catch (error) {
      console.warn('[YouTubePageCache] Error clearing expired page cache from database:', error);
    }
  }
}