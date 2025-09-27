import { logVerbose } from '../../shared/logging';
import log from '../logger';

/**
 * Lightweight source resolver that avoids full batch loading
 * Optimized for SourcePage navigation performance
 */
export class LightweightSourceResolver {
  private static sourceCache = new Map<string, any>();
  private static cacheTimestamp = 0;
  private static readonly CACHE_TTL = 30000; // 30 seconds

  /**
   * Get source metadata without loading videos
   * Uses aggressive caching to avoid repeated database calls
   */
  static async getSourceMetadata(sourceId: string): Promise<any | null> {
    const now = Date.now();

    // Return cached source if available and fresh
    if (this.sourceCache.has(sourceId) && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.sourceCache.get(sourceId);
    }

    try {
      const { DatabaseService } = await import('./DatabaseService');
      const dbService = DatabaseService.getInstance();

      // Single source query - not batch loading
      const source = await dbService.get<any>(`
        SELECT id, type, title, sort_order, url, channel_id, path, max_depth, thumbnail, total_videos
        FROM sources
        WHERE id = ?
      `, [sourceId]);

      if (source) {
        const resolvedSource = {
          id: source.id,
          type: source.type,
          title: source.title,
          sortOrder: source.sort_order || 'newestFirst',
          url: source.url,
          channelId: source.channel_id,
          path: source.path,
          maxDepth: source.max_depth,
          thumbnail: source.thumbnail,
          videoCount: source.total_videos || 0
        };

        // Cache the result
        this.sourceCache.set(sourceId, resolvedSource);
        this.cacheTimestamp = now;

        return resolvedSource;
      }

      return null;
    } catch (error) {
      log.error('[LightweightSourceResolver] Error resolving source:', sourceId, error);
      return null;
    }
  }

  /**
   * Get all sources metadata (for fallback compatibility)
   * Uses cached results when possible
   */
  static async getAllSourcesMetadata(): Promise<any[]> {
    const now = Date.now();

    // Check if we have cached all sources
    if (this.sourceCache.size > 0 && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return Array.from(this.sourceCache.values());
    }

    try {
      const { DatabaseService } = await import('./DatabaseService');
      const dbService = DatabaseService.getInstance();

      const sources = await dbService.all<any>(`
        SELECT id, type, title, sort_order, url, channel_id, path, max_depth, thumbnail, total_videos
        FROM sources
        ORDER BY sort_order ASC, title ASC
      `);

      // Cache all sources
      this.sourceCache.clear();
      const resolvedSources = sources.map(source => {
        const resolved = {
          id: source.id,
          type: source.type,
          title: source.title,
          sortOrder: source.sort_order || 'newestFirst',
          url: source.url,
          channelId: source.channel_id,
          path: source.path,
          maxDepth: source.max_depth,
          thumbnail: source.thumbnail,
          videoCount: source.total_videos || 0
        };
        this.sourceCache.set(source.id, resolved);
        return resolved;
      });

      this.cacheTimestamp = now;
      return resolvedSources;
    } catch (error) {
      log.error('[LightweightSourceResolver] Error loading sources:', error);
      return [];
    }
  }

  /**
   * Clear cache (for testing or forced refresh)
   */
  static clearCache(): void {
    this.sourceCache.clear();
    this.cacheTimestamp = 0;
  }
}