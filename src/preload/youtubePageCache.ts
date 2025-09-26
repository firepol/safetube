import { logVerbose } from './logging';

interface CachedYouTubePage {
  videos: any[];
  pageNumber: number;
  totalResults: number;
  timestamp: number;
  sourceId: string;
  sourceType: 'youtube_channel' | 'youtube_playlist';
}


export class YouTubePageCache {
  /**
   * Get cached page from database
   */
  static async getCachedPage(sourceId: string, pageNumber: number): Promise<CachedYouTubePage | null> {
    try {
      if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
        const result = await (window as any).electron.invoke('youtube-cache:get-page', sourceId, pageNumber);
        if (result && result.videos) {
          logVerbose(`[YouTubePageCache] Using database cache for ${sourceId} page ${pageNumber}`);
          return result;
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
      if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
        const cacheData: CachedYouTubePage = {
          videos,
          pageNumber,
          totalResults,
          timestamp: Date.now(),
          sourceId,
          sourceType
        };

        await (window as any).electron.invoke('youtube-cache:save-page', sourceId, pageNumber, cacheData);
        logVerbose(`[YouTubePageCache] Cached page ${pageNumber} for ${sourceId} (${videos.length} videos) in database`);
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
        await (window as any).electron.invoke('youtube-cache:clear-source', sourceId);
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
        await (window as any).electron.invoke('youtube-cache:clear-expired');
        logVerbose(`[YouTubePageCache] Cleared expired page cache from database`);
      }
    } catch (error) {
      console.warn('[YouTubePageCache] Error clearing expired page cache from database:', error);
    }
  }
}