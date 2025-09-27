/**
 * Navigation Performance Cache
 * Implements aggressive caching for instant page navigation
 */

interface CachedPageData {
  source: any;
  videos: any[];
  paginationState: any;
  timestamp: number;
  sourceId: string;
  page: number;
}

interface CachedSourceMetadata {
  source: any;
  timestamp: number;
}

export class NavigationCache {
  private static readonly PAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly SOURCE_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  private static pageCache = new Map<string, CachedPageData>();
  private static sourceCache = new Map<string, CachedSourceMetadata>();
  private static prefetchQueue = new Set<string>();

  /**
   * Generate cache key for page data
   */
  private static getPageCacheKey(sourceId: string, page: number): string {
    return `${sourceId}:page:${page}`;
  }

  /**
   * Check if cached data is still valid
   */
  private static isValidCache(timestamp: number, ttl: number): boolean {
    return Date.now() - timestamp < ttl;
  }

  /**
   * Get cached page data if available and valid
   */
  static getCachedPageData(sourceId: string, page: number): CachedPageData | null {
    const key = this.getPageCacheKey(sourceId, page);
    const cached = this.pageCache.get(key);

    if (cached && this.isValidCache(cached.timestamp, this.PAGE_CACHE_TTL)) {
      console.log(`🚀 [NavigationCache] Cache HIT for ${key} (${Date.now() - cached.timestamp}ms old)`);
      return cached;
    }

    if (cached) {
      console.log(`🚀 [NavigationCache] Cache EXPIRED for ${key}, removing`);
      this.pageCache.delete(key);
    }

    return null;
  }

  /**
   * Cache page data for future use
   */
  static cachePageData(sourceId: string, page: number, source: any, videos: any[], paginationState: any): void {
    const key = this.getPageCacheKey(sourceId, page);
    const cached: CachedPageData = {
      source,
      videos,
      paginationState,
      timestamp: Date.now(),
      sourceId,
      page
    };

    this.pageCache.set(key, cached);
    console.log(`🚀 [NavigationCache] Cached page data for ${key} (${videos.length} videos)`);

    // Also cache source metadata separately
    this.cacheSourceMetadata(sourceId, source);

    // Limit cache size to prevent memory issues
    this.cleanupOldEntries();
  }

  /**
   * Get cached source metadata
   */
  static getCachedSourceMetadata(sourceId: string): any | null {
    const cached = this.sourceCache.get(sourceId);

    if (cached && this.isValidCache(cached.timestamp, this.SOURCE_CACHE_TTL)) {
      console.log(`🚀 [NavigationCache] Source metadata cache HIT for ${sourceId}`);
      return cached.source;
    }

    if (cached) {
      this.sourceCache.delete(sourceId);
    }

    return null;
  }

  /**
   * Cache source metadata
   */
  static cacheSourceMetadata(sourceId: string, source: any): void {
    this.sourceCache.set(sourceId, {
      source,
      timestamp: Date.now()
    });
  }

  /**
   * Prefetch next/previous pages in background
   */
  static prefetchAdjacentPages(sourceId: string, currentPage: number, totalPages: number): void {
    const pagesToPrefetch = [];

    // Prefetch next page
    if (currentPage < totalPages) {
      pagesToPrefetch.push(currentPage + 1);
    }

    // Prefetch previous page
    if (currentPage > 1) {
      pagesToPrefetch.push(currentPage - 1);
    }

    for (const page of pagesToPrefetch) {
      const key = this.getPageCacheKey(sourceId, page);

      if (!this.pageCache.has(key) && !this.prefetchQueue.has(key)) {
        this.prefetchQueue.add(key);

        // Prefetch in background without blocking UI
        setTimeout(async () => {
          try {
            console.log(`🚀 [NavigationCache] Prefetching ${key} in background`);

            if (window.electron?.getPaginatedVideos) {
              const result = await window.electron.getPaginatedVideos(sourceId, page);

              if (result.videos && result.paginationState) {
                // Get source from existing cache or a lightweight call
                const source = this.getCachedSourceMetadata(sourceId);
                if (source) {
                  this.cachePageData(sourceId, page, source, result.videos, result.paginationState);
                }
              }
            }
          } catch (error) {
            console.warn(`🚀 [NavigationCache] Prefetch failed for ${key}:`, error);
          } finally {
            this.prefetchQueue.delete(key);
          }
        }, 100); // Small delay to not interfere with current navigation
      }
    }
  }

  /**
   * Clean up old cache entries to prevent memory leaks
   */
  private static cleanupOldEntries(): void {
    const now = Date.now();

    // Clean page cache
    for (const [key, data] of this.pageCache.entries()) {
      if (!this.isValidCache(data.timestamp, this.PAGE_CACHE_TTL)) {
        this.pageCache.delete(key);
      }
    }

    // Clean source cache
    for (const [key, data] of this.sourceCache.entries()) {
      if (!this.isValidCache(data.timestamp, this.SOURCE_CACHE_TTL)) {
        this.sourceCache.delete(key);
      }
    }

    // Limit total cache size (max 50 pages, 20 sources)
    if (this.pageCache.size > 50) {
      const sortedPages = Array.from(this.pageCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);

      for (let i = 0; i < sortedPages.length - 50; i++) {
        this.pageCache.delete(sortedPages[i][0]);
      }
    }

    if (this.sourceCache.size > 20) {
      const sortedSources = Array.from(this.sourceCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);

      for (let i = 0; i < sortedSources.length - 20; i++) {
        this.sourceCache.delete(sortedSources[i][0]);
      }
    }
  }

  /**
   * Clear all cache (for testing or manual refresh)
   */
  static clearCache(): void {
    this.pageCache.clear();
    this.sourceCache.clear();
    this.prefetchQueue.clear();
    console.log(`🚀 [NavigationCache] All cache cleared`);
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { pages: number; sources: number; prefetching: number } {
    return {
      pages: this.pageCache.size,
      sources: this.sourceCache.size,
      prefetching: this.prefetchQueue.size
    };
  }
}