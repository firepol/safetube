import DatabaseService from './DatabaseService';
import log from '../logger';
import { Search, SearchResult, SearchType } from '../../shared/types';

/**
 * Search service for database full-text search using FTS5
 */
export class SearchService {
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
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
}

export default SearchService;
