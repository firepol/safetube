import { YouTubeAPI } from './youtube';
import { YouTubePageCache } from './youtubePageCache';
import { VideoSource } from './types';
import { logVerbose } from './logging';

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

    // Check for valid cache first
    const cachedPage = YouTubePageCache.getCachedPage(sourceId, pageNumber);
    if (cachedPage) {
      return {
        videos: cachedPage.videos,
        pageNumber: cachedPage.pageNumber,
        totalResults: cachedPage.totalResults,
        fromCache: true,
        fallback: false
      };
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
      const fallbackCache = YouTubePageCache.getCachedPageFallback(sourceId, pageNumber);
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
    // Handle @username format (e.g., https://www.youtube.com/@skypaul77)
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