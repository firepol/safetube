import { logVerbose } from '../../shared/logging';
import log from '../logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

/**
 * In-memory cache service for frequently accessed database data
 * Reduces repeated database queries for the same data
 */
export class DataCacheService {
  private static instance: DataCacheService;

  // Cache stores with TTL
  private videoCache = new Map<string, CacheEntry<any>>();
  private sourceCache = new Map<string, CacheEntry<any>>();
  private youtubeResultCountCache = new Map<string, CacheEntry<number>>();

  // Cache configuration
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes
  private readonly maxCacheSize = 1000; // Maximum entries per cache

  // Statistics
  private stats = {
    videoHits: 0,
    videoMisses: 0,
    sourceHits: 0,
    sourceMisses: 0,
    youtubeCountHits: 0,
    youtubeCountMisses: 0
  };

  private constructor() {
    // Start periodic cleanup
    setInterval(() => this.cleanup(), 2 * 60 * 1000); // Every 2 minutes
  }

  static getInstance(): DataCacheService {
    if (!DataCacheService.instance) {
      DataCacheService.instance = new DataCacheService();
    }
    return DataCacheService.instance;
  }

  /**
   * Get cached video data
   */
  getVideo(videoId: string): any | null {
    const entry = this.videoCache.get(videoId);
    if (entry && !this.isExpired(entry)) {
      entry.hits++;
      this.stats.videoHits++;
      return entry.data;
    }

    if (entry) {
      this.videoCache.delete(videoId);
    }
    this.stats.videoMisses++;
    return null;
  }

  /**
   * Cache video data
   */
  setVideo(videoId: string, data: any): void {
    this.ensureCacheSize(this.videoCache);
    this.videoCache.set(videoId, {
      data,
      timestamp: Date.now(),
      hits: 0
    });
  }

  /**
   * Get cached source data
   */
  getSource(sourceId: string): any | null {
    const entry = this.sourceCache.get(sourceId);
    if (entry && !this.isExpired(entry)) {
      entry.hits++;
      this.stats.sourceHits++;
      return entry.data;
    }

    if (entry) {
      this.sourceCache.delete(sourceId);
    }
    this.stats.sourceMisses++;
    return null;
  }

  /**
   * Cache source data
   */
  setSource(sourceId: string, data: any): void {
    this.ensureCacheSize(this.sourceCache);
    this.sourceCache.set(sourceId, {
      data,
      timestamp: Date.now(),
      hits: 0
    });
  }

  /**
   * Get cached YouTube result count
   */
  getYouTubeResultCount(sourceId: string): number | null {
    const entry = this.youtubeResultCountCache.get(sourceId);
    if (entry && !this.isExpired(entry)) {
      entry.hits++;
      this.stats.youtubeCountHits++;
      return entry.data;
    }

    if (entry) {
      this.youtubeResultCountCache.delete(sourceId);
    }
    this.stats.youtubeCountMisses++;
    return null;
  }

  /**
   * Cache YouTube result count
   */
  setYouTubeResultCount(sourceId: string, count: number): void {
    this.ensureCacheSize(this.youtubeResultCountCache);
    this.youtubeResultCountCache.set(sourceId, {
      data: count,
      timestamp: Date.now(),
      hits: 0
    });
  }

  /**
   * Batch get videos - returns map of found videos and list of missing IDs
   */
  batchGetVideos(videoIds: string[]): { found: Map<string, any>; missing: string[] } {
    const found = new Map<string, any>();
    const missing: string[] = [];

    for (const videoId of videoIds) {
      const cached = this.getVideo(videoId);
      if (cached) {
        found.set(videoId, cached);
      } else {
        missing.push(videoId);
      }
    }

    return { found, missing };
  }

  /**
   * Batch set videos
   */
  batchSetVideos(videos: Map<string, any>): void {
    for (const [videoId, data] of videos) {
      this.setVideo(videoId, data);
    }
  }

  /**
   * Batch get sources - returns map of found sources and list of missing IDs
   */
  batchGetSources(sourceIds: string[]): { found: Map<string, any>; missing: string[] } {
    const found = new Map<string, any>();
    const missing: string[] = [];

    for (const sourceId of sourceIds) {
      const cached = this.getSource(sourceId);
      if (cached) {
        found.set(sourceId, cached);
      } else {
        missing.push(sourceId);
      }
    }

    return { found, missing };
  }

  /**
   * Batch set sources
   */
  batchSetSources(sources: Map<string, any>): void {
    for (const [sourceId, data] of sources) {
      this.setSource(sourceId, data);
    }
  }

  /**
   * Clear cache for a specific source (when source is updated)
   */
  clearSourceCache(sourceId: string): void {
    this.sourceCache.delete(sourceId);
    this.youtubeResultCountCache.delete(sourceId);

    // Also clear videos from this source
    for (const [videoId, entry] of this.videoCache) {
      if (entry.data.source_id === sourceId) {
        this.videoCache.delete(videoId);
      }
    }

    logVerbose(`[DataCacheService] Cleared cache for source: ${sourceId}`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalVideoRequests = this.stats.videoHits + this.stats.videoMisses;
    const totalSourceRequests = this.stats.sourceHits + this.stats.sourceMisses;
    const totalYouTubeRequests = this.stats.youtubeCountHits + this.stats.youtubeCountMisses;

    return {
      video: {
        hits: this.stats.videoHits,
        misses: this.stats.videoMisses,
        hitRate: totalVideoRequests > 0 ? (this.stats.videoHits / totalVideoRequests * 100).toFixed(1) + '%' : '0%',
        cacheSize: this.videoCache.size
      },
      source: {
        hits: this.stats.sourceHits,
        misses: this.stats.sourceMisses,
        hitRate: totalSourceRequests > 0 ? (this.stats.sourceHits / totalSourceRequests * 100).toFixed(1) + '%' : '0%',
        cacheSize: this.sourceCache.size
      },
      youtubeCount: {
        hits: this.stats.youtubeCountHits,
        misses: this.stats.youtubeCountMisses,
        hitRate: totalYouTubeRequests > 0 ? (this.stats.youtubeCountHits / totalYouTubeRequests * 100).toFixed(1) + '%' : '0%',
        cacheSize: this.youtubeResultCountCache.size
      }
    };
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.videoCache.clear();
    this.sourceCache.clear();
    this.youtubeResultCountCache.clear();

    // Reset stats
    this.stats = {
      videoHits: 0,
      videoMisses: 0,
      sourceHits: 0,
      sourceMisses: 0,
      youtubeCountHits: 0,
      youtubeCountMisses: 0
    };

    logVerbose('[DataCacheService] All caches cleared');
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > this.defaultTTL;
  }

  private ensureCacheSize<T>(cache: Map<string, CacheEntry<T>>): void {
    if (cache.size >= this.maxCacheSize) {
      // Remove least recently used entries (lowest hit count and oldest)
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => {
        if (a[1].hits !== b[1].hits) {
          return a[1].hits - b[1].hits; // Fewer hits first
        }
        return a[1].timestamp - b[1].timestamp; // Older entries first
      });

      // Remove the oldest 10% of entries
      const toRemove = Math.floor(this.maxCacheSize * 0.1);
      for (let i = 0; i < toRemove; i++) {
        cache.delete(entries[i][0]);
      }
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;

    // Clean expired entries from all caches
    for (const [key, entry] of this.videoCache) {
      if (now - entry.timestamp > this.defaultTTL) {
        this.videoCache.delete(key);
        removedCount++;
      }
    }

    for (const [key, entry] of this.sourceCache) {
      if (now - entry.timestamp > this.defaultTTL) {
        this.sourceCache.delete(key);
        removedCount++;
      }
    }

    for (const [key, entry] of this.youtubeResultCountCache) {
      if (now - entry.timestamp > this.defaultTTL) {
        this.youtubeResultCountCache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logVerbose(`[DataCacheService] Cleanup removed ${removedCount} expired entries`);
    }
  }
}