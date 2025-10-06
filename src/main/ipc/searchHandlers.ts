import { ipcMain } from 'electron';
import log from '../logger';
import DatabaseService from '../services/DatabaseService';
import { SearchService } from '../services/searchService';
import { IPC } from '../../shared/ipc-channels';
import { Search, SearchResult } from '../../shared/types';

// Types for IPC database operations
interface DatabaseResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Search IPC Handlers
 * Wire up search functionality for database and YouTube search
 */
export function registerSearchHandlers() {
  const db = DatabaseService.getInstance();
  const searchService = new SearchService(db);

  // Search database using FTS5
  ipcMain.handle(
    IPC.SEARCH.DATABASE,
    async (_, query: string, sourceId?: string): Promise<DatabaseResponse<SearchResult[]>> => {
      try {
        const logMessage = sourceId 
          ? `[Search IPC] Database search request: "${query}" in source "${sourceId}"`
          : `[Search IPC] Database search request: "${query}"`;
        log.info(logMessage);
        
        const results = await searchService.searchDatabase(query, sourceId);
        return {
          success: true,
          data: results
        };
      } catch (error) {
        log.error('[Search IPC] Database search failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Database search failed',
          code: 'SEARCH_DATABASE_FAILED'
        };
      }
    }
  );

  // Search YouTube with caching
  ipcMain.handle(
    IPC.SEARCH.YOUTUBE,
    async (_, query: string): Promise<DatabaseResponse<SearchResult[]>> => {
      try {
        log.info(`[Search IPC] YouTube search request: "${query}"`);
        const results = await searchService.searchYouTube(query);
        return {
          success: true,
          data: results
        };
      } catch (error) {
        log.error('[Search IPC] YouTube search failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'YouTube search failed',
          code: 'SEARCH_YOUTUBE_FAILED'
        };
      }
    }
  );

  // Get search history
  ipcMain.handle(
    IPC.SEARCH.HISTORY_GET,
    async (_, limit?: number): Promise<DatabaseResponse<Search[]>> => {
      try {
        log.debug(`[Search IPC] Get search history request (limit: ${limit || 100})`);
        const history = await searchService.getSearchHistory(limit);
        return {
          success: true,
          data: history
        };
      } catch (error) {
        log.error('[Search IPC] Get search history failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get search history',
          code: 'GET_SEARCH_HISTORY_FAILED'
        };
      }
    }
  );

  // Get cached search results by search query and type
  ipcMain.handle(
    IPC.SEARCH.CACHED_RESULTS_GET,
    async (_, query: string, searchType: 'database' | 'youtube'): Promise<DatabaseResponse<SearchResult[]>> => {
      try {
        log.debug(`[Search IPC] Get cached results request: "${query}" (${searchType})`);
        const results = await searchService.getCachedResults(query, searchType);
        return {
          success: true,
          data: results
        };
      } catch (error) {
        log.error('[Search IPC] Get cached results failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get cached results',
          code: 'GET_CACHED_RESULTS_FAILED'
        };
      }
    }
  );

  log.info('[Search IPC] Search handlers registered');
}

export default registerSearchHandlers;
