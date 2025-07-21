import { logVerboseRenderer } from '@/shared/logging';

interface CachedVideoStreams {
  videoId: string;
  timestamp: number;
  videoStreams: any[];
  audioTracks: any[];
}

interface CachedVideoDetails {
  videoId: string;
  timestamp: number;
  details: any;
}

class TestCache {
  private static instance: TestCache;
  private streamCache: Map<string, CachedVideoStreams> = new Map();
  private detailsCache: Map<string, CachedVideoDetails> = new Map();
  private cacheExpiryMs = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {
    // In-memory only - no file operations
  }

  static getInstance(): TestCache {
    if (!TestCache.instance) {
      TestCache.instance = new TestCache();
    }
    return TestCache.instance;
  }

  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.cacheExpiryMs;
  }

  getVideoStreams(videoId: string): { videoStreams: any[]; audioTracks: any[] } | null {
    const cached = this.streamCache.get(videoId);
    if (cached && !this.isExpired(cached.timestamp)) {
      logVerboseRenderer(`[CACHE HIT] Using cached video streams for ${videoId}`);
      return {
        videoStreams: cached.videoStreams,
        audioTracks: cached.audioTracks
      };
    }
    logVerboseRenderer(`[CACHE MISS] No cached video streams for ${videoId}`);
    return null;
  }

  setVideoStreams(videoId: string, videoStreams: any[], audioTracks: any[]): void {
    logVerboseRenderer(`[CACHE SET] Caching video streams for ${videoId}`);
    this.streamCache.set(videoId, {
      videoId,
      timestamp: Date.now(),
      videoStreams,
      audioTracks
    });
  }

  getVideoDetails(videoId: string): any | null {
    const cached = this.detailsCache.get(videoId);
    if (cached && !this.isExpired(cached.timestamp)) {
      logVerboseRenderer(`[CACHE HIT] Using cached video details for ${videoId}`);
      return cached.details;
    }
    logVerboseRenderer(`[CACHE MISS] No cached video details for ${videoId}`);
    return null;
  }

  setVideoDetails(videoId: string, details: any): void {
    logVerboseRenderer(`[CACHE SET] Caching video details for ${videoId}`);
    this.detailsCache.set(videoId, {
      videoId,
      timestamp: Date.now(),
      details
    });
  }

  clearCache(): void {
    logVerboseRenderer('[CACHE CLEAR] Clearing all cached data');
    this.streamCache.clear();
    this.detailsCache.clear();
  }

  getCacheStats(): { streams: number; details: number } {
    return {
      streams: this.streamCache.size,
      details: this.detailsCache.size
    };
  }

  // Debug method to see what's cached
  debugCache(): void {
    logVerboseRenderer('[CACHE DEBUG] Current cache contents:');
    logVerboseRenderer('Stream cache keys:', Array.from(this.streamCache.keys()));
    logVerboseRenderer('Details cache keys:', Array.from(this.detailsCache.keys()));
  }
}

export const testCache = TestCache.getInstance(); 