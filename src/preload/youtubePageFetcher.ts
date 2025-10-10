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
   * Fetch and cache all pages from startPage to endPage
   * More efficient than fetching individual pages when multiple pages are needed
   */
  private static async fetchAndCachePageRange(
    source: VideoSource,
    startPage: number,
    endPage: number,
    pageSize: number = 50
  ): Promise<void> {
    const sourceId = source.id;
    logVerbose(`[YouTubePageFetcher] 📚 Fetching pages ${startPage}-${endPage} for ${sourceId}`);

    let currentToken: string | undefined = undefined;

    for (let page = startPage; page <= endPage; page++) {
      // Check if this page is already cached
      const cachedPage = await YouTubePageCache.getCachedPage(sourceId, page);
      if (cachedPage && cachedPage.timestamp) {
        const cacheDurationMinutes = PaginationService.getInstance().getConfig().cacheDurationMinutes;
        const cacheAge = Date.now() - cachedPage.timestamp;
        const cacheDurationMs = cacheDurationMinutes * 60 * 1000;

        if (cacheAge < cacheDurationMs) {
          logVerbose(`[YouTubePageFetcher] ⏭️  Skipping page ${page} (already cached)`);
          // Get token for next page from cache
          currentToken = YouTubePageCache.getPageToken(sourceId, page + 1);
          continue;
        }
      }

      // Fetch this page (don't fill intermediate pages to avoid recursion)
      logVerbose(`[YouTubePageFetcher] 📄 Fetching page ${page}...`);
      const result = await this.fetchPage(source, page, pageSize, false);

      // The fetchPage already caches the page and token
      currentToken = YouTubePageCache.getPageToken(sourceId, page + 1);
    }
  }

  /**
   * Fetch a specific page for a YouTube source (channel or playlist)
   * Uses cache when valid, fetches from API when needed, falls back to expired cache on API failure
   */
  static async fetchPage(source: VideoSource, pageNumber: number, pageSize: number = 50, fillIntermediatePages: boolean = true): Promise<YouTubePageResult> {
    if (source.type !== 'youtube_channel' && source.type !== 'youtube_playlist') {
      throw new Error('Invalid source type for YouTube page fetching');
    }

    const sourceId = source.id;
    const startTime = performance.now();
    logVerbose(`[YouTubePageFetcher] 🚀 Fetching page ${pageNumber} for ${sourceId} (${source.type})`);

    // Use PaginationService for cache config
    const cacheDurationMinutes = PaginationService.getInstance().getConfig().cacheDurationMinutes;

    // Check for valid cache first
    const cacheCheckStart = performance.now();
    const cachedPage = await YouTubePageCache.getCachedPage(sourceId, pageNumber);
    const cacheCheckTime = performance.now() - cacheCheckStart;
    logVerbose(`[YouTubePageFetcher] ⏱️ Cache check: ${cacheCheckTime.toFixed(1)}ms`);

    if (cachedPage && cachedPage.timestamp) {
      const cacheAge = Date.now() - cachedPage.timestamp;
      const cacheDurationMs = cacheDurationMinutes * 60 * 1000;
      if (cacheAge < cacheDurationMs) {
        const totalTime = performance.now() - startTime;
        logVerbose(`[YouTubePageFetcher] 🏁 Using valid cache for ${sourceId} page ${pageNumber} (age: ${Math.round(cacheAge / 60000)} minutes) - total: ${totalTime.toFixed(1)}ms`);
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

    // If requesting page > 1 and we should fill intermediate pages, check which pages are missing
    if (fillIntermediatePages && pageNumber > 1) {
      // Find the first uncached page
      let firstUncachedPage = 1;
      for (let p = 1; p < pageNumber; p++) {
        const cached = await YouTubePageCache.getCachedPage(sourceId, p);
        if (!cached || !cached.timestamp) {
          firstUncachedPage = p;
          break;
        }
        const cacheAge = Date.now() - cached.timestamp;
        const cacheDurationMs = cacheDurationMinutes * 60 * 1000;
        if (cacheAge >= cacheDurationMs) {
          firstUncachedPage = p;
          break;
        }
        firstUncachedPage = p + 1;
      }

      // If there are uncached pages before our target, fetch them all
      if (firstUncachedPage < pageNumber) {
        logVerbose(`[YouTubePageFetcher] 🔄 Filling pages ${firstUncachedPage}-${pageNumber} to maximize cache benefit`);
        await this.fetchAndCachePageRange(source, firstUncachedPage, pageNumber, pageSize);

        // Now return the cached target page
        const finalCached = await YouTubePageCache.getCachedPage(sourceId, pageNumber);
        if (finalCached) {
          return {
            videos: finalCached.videos,
            pageNumber: finalCached.pageNumber,
            totalResults: finalCached.totalResults,
            fromCache: true,
            fallback: false
          };
        }
      }
    }

    // Cache is expired or missing, try to fetch from API
    try {
      let result: { videos: any[], totalResults: number, pageNumber: number, nextPageToken?: string, collectedTokens?: { pageNumber: number; token: string }[] };

      const apiStart = performance.now();

      // Get the page token for this page (if we have it cached)
      const pageToken = YouTubePageCache.getPageToken(sourceId, pageNumber);

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

        result = await YouTubeAPI.getChannelVideosPage(actualChannelId, pageNumber, pageSize, undefined, pageToken);
      } else {
        const playlistId = this.extractPlaylistId(source.url);
        result = await YouTubeAPI.getPlaylistVideosPage(playlistId, pageNumber, pageSize, undefined, pageToken);
      }
      const apiTime = performance.now() - apiStart;
      logVerbose(`[YouTubePageFetcher] ⏱️ YouTube API call: ${apiTime.toFixed(1)}ms`);

      // Add sourceId to each video for database insertion
      const videosWithSourceId = result.videos.map(video => ({
        ...video,
        sourceId: sourceId
      }));

      // Insert videos into database first (required for foreign key constraints)
      const dbInsertStart = performance.now();
      try {
        if (typeof process !== 'undefined' && process.type === 'browser') {
          // Main process: direct database access
          const { writeVideosToDatabase } = await import('../main/services/videoDataService');
          await writeVideosToDatabase(videosWithSourceId);
        } else if (typeof window !== 'undefined' && (window as any).electron?.batchUpsertVideos) {
          // Renderer process: use IPC to write to database
          const result = await (window as any).electron.batchUpsertVideos(videosWithSourceId);
          if (!result.success) {
            logVerbose(`[YouTubePageFetcher] Failed to insert videos via IPC: ${result.error}`);
          } else {
            logVerbose(`[YouTubePageFetcher] Successfully inserted ${videosWithSourceId.length} videos via IPC for ${sourceId} page ${pageNumber}`);
          }
        }
      } catch (error) {
        logVerbose(`[YouTubePageFetcher] Error inserting videos into database: ${error}`);
      }
      const dbInsertTime = performance.now() - dbInsertStart;
      logVerbose(`[YouTubePageFetcher] ⏱️ Database insert: ${dbInsertTime.toFixed(1)}ms`);

      // Cache the successful result
      const cacheWriteStart = performance.now();
      YouTubePageCache.cachePage(sourceId, pageNumber, result.videos, result.totalResults, source.type);

      // Cache the next page token if available
      if (result.nextPageToken) {
        YouTubePageCache.setPageToken(sourceId, pageNumber + 1, result.nextPageToken);
      }

      // Cache any collected intermediate tokens from token collection
      if (result.collectedTokens) {
        for (const { pageNumber: tokenPageNum, token } of result.collectedTokens) {
          YouTubePageCache.setPageToken(sourceId, tokenPageNum, token);
          logVerbose(`[YouTubePageFetcher] 💾 Cached token for page ${tokenPageNum}`);
        }
      }

      const cacheWriteTime = performance.now() - cacheWriteStart;
      logVerbose(`[YouTubePageFetcher] ⏱️ Cache write: ${cacheWriteTime.toFixed(1)}ms`);

      const totalTime = performance.now() - startTime;
      logVerbose(`[YouTubePageFetcher] 🏁 Successfully fetched page ${pageNumber} for ${sourceId} (${result.videos.length} videos) - total: ${totalTime.toFixed(1)}ms`);

      // Prefetch next page in background for better user experience (only for page 1)
      if (pageNumber === 1 && result.totalResults > pageSize) {
        setTimeout(() => {
          logVerbose(`[YouTubePageFetcher] 🔮 Background prefetching page 2 for ${sourceId}`);
          this.fetchPage(source, 2, pageSize).catch(error => {
            logVerbose(`[YouTubePageFetcher] Background prefetch failed for page 2: ${error}`);
          });
        }, 100); // Small delay to not interfere with current request
      }

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