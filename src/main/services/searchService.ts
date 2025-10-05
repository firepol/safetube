import DatabaseService from './DatabaseService';
import log from '../logger';
import { Search, SearchResult, SearchType, VideoData, SearchResultsCacheEntry } from '../../shared/types';
import { YouTubeAPI } from '../youtube-api';
import { getSetting } from '../database/queries/settingsQueries';

/**
 * Search service for database full-text search using FTS5
 */
export class SearchService {
  private db: DatabaseService;
  private youtubeApi: YouTubeAPI | null = null;
  private quotaUsed: number = 0;
  private quotaLimit: number = 10000;
  private quotaResetDate: string = new Date().toISOString().split('T')[0];

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Initialize YouTube API client with API key from settings
   */
  private async initYouTubeApi(): Promise<void> {
    if (this.youtubeApi) return;

    const apiKey = await getSetting<string>(this.db, 'main.youtubeApiKey');
    if (!apiKey) {
      throw new Error('YouTube API key not configured');
    }

    this.youtubeApi = new YouTubeAPI(apiKey);
    log.debug('[SearchService] YouTube API client initialized');
  }

  /**
   * Escape FTS5 special characters in search query
   * FTS5 uses: " * AND OR NOT NEAR ( ) ^ - +
   */
  private escapeFts5Query(query: string): string {
    // Remove or escape FTS5 special characters
    // Keep spaces and alphanumeric characters
    return query
      .replace(/["*()^]/g, '') // Remove these characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Search videos in database using FTS5 full-text search
   * Returns results matching title or description
   */
  async searchDatabase(query: string): Promise<SearchResult[]> {
    try {
      log.info(`[SearchService] Searching database for: "${query}"`);

      if (!query || query.trim().length === 0) {
        log.warn('[SearchService] Empty query provided');
        return [];
      }

      // Escape query for FTS5
      const escapedQuery = this.escapeFts5Query(query);

      if (escapedQuery.length === 0) {
        log.warn('[SearchService] Query contains only special characters');
        return [];
      }

      // Search using FTS5 index
      const results = await this.db.all<any>(`
        SELECT
          v.id,
          v.title,
          v.thumbnail,
          v.description,
          v.duration,
          v.url,
          v.published_at,
          v.source_id,
          s.channel_id,
          s.title as channel_name
        FROM videos_fts vf
        JOIN videos v ON v.rowid = vf.rowid
        LEFT JOIN sources s ON v.source_id = s.id
        WHERE videos_fts MATCH ?
        ORDER BY vf.rank
        LIMIT 50
      `, [escapedQuery]);

      log.info(`[SearchService] Found ${results.length} results`);

      // Record search in history
      await this.recordSearch(query, 'database', results.length);

      // Transform to SearchResult format
      const searchResults: SearchResult[] = results.map(row => ({
        id: row.id,
        title: row.title,
        thumbnail: row.thumbnail || '',
        description: row.description || '',
        duration: row.duration || 0,
        channelId: row.channel_id || '',
        channelName: row.channel_name || '',
        url: row.url || '',
        publishedAt: row.published_at || '',
        isApprovedSource: true // All database results are from approved sources
      }));

      return searchResults;
    } catch (error) {
      log.error('[SearchService] Error searching database:', error);
      // Don't record failed searches
      throw new Error(`Database search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Record search in search history
   */
  private async recordSearch(
    query: string,
    searchType: SearchType,
    resultCount: number
  ): Promise<void> {
    try {
      await this.db.run(`
        INSERT INTO searches (query, search_type, result_count, timestamp)
        VALUES (?, ?, ?, datetime('now'))
      `, [query, searchType, resultCount]);

      log.debug(`[SearchService] Recorded search: ${query} (${searchType}, ${resultCount} results)`);
    } catch (error) {
      // Don't fail the search if recording fails
      log.warn('[SearchService] Failed to record search history:', error);
    }
  }

  /**
   * Get search history (most recent first)
   */
  async getSearchHistory(limit: number = 100): Promise<Search[]> {
    try {
      const history = await this.db.all<Search>(`
        SELECT * FROM searches
        ORDER BY timestamp DESC
        LIMIT ?
      `, [limit]);

      return history;
    } catch (error) {
      log.error('[SearchService] Error getting search history:', error);
      throw new Error(`Failed to get search history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search YouTube API with caching and quota monitoring
   * Returns max 50 results, enforces safeSearch='strict'
   */
  async searchYouTube(query: string): Promise<SearchResult[]> {
    try {
      log.info(`[SearchService] Searching YouTube for: "${query}"`);

      if (!query || query.trim().length === 0) {
        log.warn('[SearchService] Empty query provided');
        return [];
      }

      // Initialize YouTube API if needed
      await this.initYouTubeApi();

      // Check cache first
      const cached = await this.getSearchCache(query, 'youtube');
      if (cached && cached.length > 0) {
        log.info(`[SearchService] Found ${cached.length} results in cache`);
        // Still record search in history for audit trail
        await this.recordSearch(query, 'youtube', cached.length);
        return cached;
      }

      // Check quota before making API call
      this.checkQuota();

      // Call YouTube API with safe search
      if (!this.youtubeApi) {
        throw new Error('YouTube API not initialized');
      }

      const videos = await this.youtubeApi.searchVideos(query, 50);

      // Track quota usage (search = 100 units + videos.list = 1 unit)
      this.updateQuota(101);

      if (!videos || videos.length === 0) {
        log.info('[SearchService] No YouTube results found');
        await this.recordSearch(query, 'youtube', 0);
        return [];
      }

      // Transform to SearchResult format
      const searchResults: SearchResult[] = videos.map((video: any) => ({
        id: video.id,
        title: video.title,
        thumbnail: video.thumbnail || '',
        description: video.description || '',
        duration: video.duration || 0,
        channelId: video.channelId || '',
        channelName: video.channelTitle || '',
        url: video.url || `https://www.youtube.com/watch?v=${video.id}`,
        publishedAt: video.publishedAt || '',
        isApprovedSource: false // YouTube search results are not from approved sources
      }));

      log.info(`[SearchService] Found ${searchResults.length} YouTube results`);

      // Cache results for 24 hours
      await this.cacheSearchResults(query, 'youtube', searchResults);

      // Record search in history
      await this.recordSearch(query, 'youtube', searchResults.length);

      return searchResults;
    } catch (error) {
      log.error('[SearchService] Error searching YouTube:', error);

      // Handle quota exceeded
      if (error instanceof Error && error.message.includes('quotaExceeded')) {
        throw new Error('YouTube API quota exceeded. Please try again tomorrow.');
      }

      // Handle API errors gracefully
      if (error instanceof Error && error.message.includes('YouTube API key not configured')) {
        throw new Error('YouTube search is not available. Please configure API key in settings.');
      }

      throw new Error(`YouTube search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get cached search results for admin viewing (public method)
   */
  async getCachedResults(query: string, searchType: SearchType): Promise<SearchResult[]> {
    return this.getSearchCache(query, searchType);
  }

  /**
   * Get cached search results if available and not expired
   */
  private async getSearchCache(query: string, searchType: SearchType): Promise<SearchResult[]> {
    try {
      const now = new Date().toISOString();

      const cached = await this.db.all<SearchResultsCacheEntry>(`
        SELECT video_data, position
        FROM search_results_cache
        WHERE search_query = ?
          AND search_type = ?
          AND expires_at > ?
        ORDER BY position ASC
      `, [query, searchType, now]);

      if (cached.length === 0) {
        log.debug('[SearchService] No valid cache found');
        return [];
      }

      // Parse video data from JSON
      const results: SearchResult[] = cached.map(entry => {
        const videoData = JSON.parse(entry.video_data) as VideoData;
        return {
          ...videoData,
          isApprovedSource: false
        };
      });

      log.debug(`[SearchService] Retrieved ${results.length} results from cache`);
      return results;
    } catch (error) {
      log.warn('[SearchService] Error reading search cache:', error);
      return [];
    }
  }

  /**
   * Cache search results for 24 hours
   */
  private async cacheSearchResults(
    query: string,
    searchType: SearchType,
    results: SearchResult[]
  ): Promise<void> {
    try {
      const fetchTimestamp = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const videoData: VideoData = {
          id: result.id,
          title: result.title,
          thumbnail: result.thumbnail,
          description: result.description,
          duration: result.duration,
          channelId: result.channelId,
          channelName: result.channelName,
          url: result.url,
          publishedAt: result.publishedAt
        };

        await this.db.run(`
          INSERT INTO search_results_cache (
            search_query, video_id, video_data, position,
            search_type, fetch_timestamp, expires_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(search_query, video_id, search_type)
          DO UPDATE SET
            video_data = excluded.video_data,
            position = excluded.position,
            fetch_timestamp = excluded.fetch_timestamp,
            expires_at = excluded.expires_at
        `, [
          query,
          result.id,
          JSON.stringify(videoData),
          i,
          searchType,
          fetchTimestamp,
          expiresAt
        ]);
      }

      log.debug(`[SearchService] Cached ${results.length} search results`);
    } catch (error) {
      // Don't fail the search if caching fails
      log.warn('[SearchService] Failed to cache search results:', error);
    }
  }

  /**
   * Check if quota allows for API call
   */
  private checkQuota(): void {
    const today = new Date().toISOString().split('T')[0];

    // Reset quota if it's a new day
    if (this.quotaResetDate !== today) {
      this.quotaUsed = 0;
      this.quotaResetDate = today;
      log.info('[SearchService] Quota reset for new day');
    }

    // Check if quota exceeded (leave 200 units buffer)
    if (this.quotaUsed + 200 >= this.quotaLimit) {
      log.warn(`[SearchService] Quota near limit: ${this.quotaUsed}/${this.quotaLimit}`);
      throw new Error('quotaExceeded');
    }
  }

  /**
   * Update quota usage
   */
  private updateQuota(units: number): void {
    this.quotaUsed += units;
    log.debug(`[SearchService] Quota used: ${this.quotaUsed}/${this.quotaLimit} (${units} units)`);
  }

  /**
   * Clear search history older than specified days
   */
  async clearOldSearchHistory(daysToKeep: number = 90): Promise<number> {
    try {
      const result = await this.db.run(`
        DELETE FROM searches
        WHERE timestamp < datetime('now', '-' || ? || ' days')
      `, [daysToKeep]);

      const deletedCount = result.changes || 0;
      log.info(`[SearchService] Cleared ${deletedCount} old search records`);
      return deletedCount;
    } catch (error) {
      log.error('[SearchService] Error clearing old search history:', error);
      throw new Error(`Failed to clear search history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache(): Promise<number> {
    try {
      const now = new Date().toISOString();
      const result = await this.db.run(`
        DELETE FROM search_results_cache
        WHERE expires_at < ?
      `, [now]);

      const deletedCount = result.changes || 0;
      if (deletedCount > 0) {
        log.info(`[SearchService] Cleared ${deletedCount} expired cache entries`);
      }
      return deletedCount;
    } catch (error) {
      log.warn('[SearchService] Error clearing expired cache:', error);
      return 0;
    }
  }
}

export default SearchService;
