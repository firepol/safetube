import { YouTubeAPI } from './youtube';
import { YouTubePageCache } from './youtubePageCache';
import { VideoSource } from './types';
import { logVerbose } from './logging';
import { PaginationService } from './paginationService';

export interface YouTubePageResult {
  videos: any[];
  pageNumber: number;
  totalResults: number;
  fromCache: boolean;
  fallback: boolean; // True if using expired cache due to API failure
}

export class YouTubePageFetcher {
  /**
   * Fetch a specific page for a YouTube source (channel or playlist)
   * Uses cache when valid, fetches from API when needed, falls back to expired cache on API failure
   */
  static async fetchPage(source: VideoSource, pageNumber: number, pageSize: number = 50): Promise<YouTubePageResult> {
    if (source.type !== 'youtube_channel' && source.type !== 'youtube_playlist') {
      throw new Error('Invalid source type for YouTube page fetching');
    }

    const sourceId = source.id;
    logVerbose(`[YouTubePageFetcher] Fetching page ${pageNumber} for ${sourceId} (${source.type})`);

    // Use PaginationService for cache config
    const cacheDurationMinutes = PaginationService.getInstance().getConfig().cacheDurationMinutes;

    // Check for valid cache first
    const cachedPage = await YouTubePageCache.getCachedPage(sourceId, pageNumber);
    if (cachedPage && cachedPage.timestamp) {
      const cacheAge = Date.now() - cachedPage.timestamp;
      const cacheDurationMs = cacheDurationMinutes * 60 * 1000;
      if (cacheAge < cacheDurationMs) {
        logVerbose(`[YouTubePageFetcher] Using valid cache for ${sourceId} page ${pageNumber} (age: ${Math.round(cacheAge / 60000)} minutes)`);
        return {
          videos: cachedPage.videos,
          pageNumber: cachedPage.pageNumber,
          totalResults: cachedPage.totalResults,
          fromCache: true,
          fallback: false
        };
      } else {
        logVerbose(`[YouTubePageFetcher] Cache expired for ${sourceId} page ${pageNumber} (age: ${Math.round(cacheAge / 60000)} minutes), fetching fresh data`);
      }
    }

    // Cache is expired or missing, try to fetch from API
    try {
      let result: { videos: any[], totalResults: number, pageNumber: number };

      if (source.type === 'youtube_channel') {
        const channelId = this.extractChannelId(source.url);
        let actualChannelId = channelId;

        // Handle @username format
        if (channelId.startsWith('@')) {
          try {
            const channelDetails = await YouTubeAPI.searchChannelByUsername(channelId);
            actualChannelId = channelDetails.channelId;
          } catch (error) {
            console.warn(`[YouTubePageFetcher] Could not resolve username ${channelId}:`, error);
            actualChannelId = channelId;
          }
        }

        result = await YouTubeAPI.getChannelVideosPage(actualChannelId, pageNumber, pageSize);
      } else {
        const playlistId = this.extractPlaylistId(source.url);
        result = await YouTubeAPI.getPlaylistVideosPage(playlistId, pageNumber, pageSize);
      }

      // Add sourceId to each video for database insertion
      const videosWithSourceId = result.videos.map(video => ({
        ...video,
        sourceId: sourceId
      }));

      // Insert videos into database first (required for foreign key constraints)
      try {
        if (typeof process !== 'undefined' && process.type === 'browser') {
          // Main process: direct database access
          const { writeVideosToDatabase } = await import('../main/services/videoDataService');
          await writeVideosToDatabase(videosWithSourceId);
        } else if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
          // Renderer process: use IPC (if handler exists)
          // For now, just log that we'd need an IPC handler for this
          logVerbose(`[YouTubePageFetcher] Videos would need to be inserted via IPC for ${sourceId} page ${pageNumber}`);
        }
      } catch (error) {
        logVerbose(`[YouTubePageFetcher] Error inserting videos into database: ${error}`);
      }

      // Cache the successful result
      YouTubePageCache.cachePage(sourceId, pageNumber, result.videos, result.totalResults, source.type);

      logVerbose(`[YouTubePageFetcher] Successfully fetched page ${pageNumber} for ${sourceId} (${result.videos.length} videos)`);

      return {
        videos: result.videos,
        pageNumber: result.pageNumber,
        totalResults: result.totalResults,
        fromCache: false,
        fallback: false
      };

    } catch (error) {
      console.warn(`[YouTubePageFetcher] YouTube API failed for ${sourceId} page ${pageNumber}:`, error);

      // API failed, try to use expired cache as fallback
      const fallbackCache = await YouTubePageCache.getCachedPageFallback(sourceId, pageNumber);
      if (fallbackCache) {
        logVerbose(`[YouTubePageFetcher] Using expired cache as fallback for ${sourceId} page ${pageNumber}`);
        return {
          videos: fallbackCache.videos,
          pageNumber: fallbackCache.pageNumber,
          totalResults: fallbackCache.totalResults,
          fromCache: true,
          fallback: true
        };
      }

      // No cache available, throw the original error
      throw error;
    }
  }

  /**
   * Extract channel ID from YouTube channel URL
   */
  private static extractChannelId(url: string): string {
    // Handle @username format (e.g., https://www.youtube.com/@TEDEd)
    if (url.includes('/@')) {
      const match = url.match(/\/@([^\/\?]+)/);
      if (match) return `@${match[1]}`; // Return with @ prefix for usernames
    }

    // Handle /channel/ format (e.g., https://www.youtube.com/channel/UC...)
    const match = url.match(/channel\/([\w-]+)/);
    if (match) return match[1];

    throw new Error('Unsupported channel URL format');
  }

  /**
   * Extract playlist ID from YouTube playlist URL
   */
  private static extractPlaylistId(url: string): string {
    const match = url.match(/[?&]list=([\w-]+)/);
    if (match) return match[1];
    throw new Error('Invalid playlist URL format');
  }
}