import { useState } from 'react';
import { Search, SearchResult, SearchType } from '@/shared/types';
import { useAdminDataAccess } from './useAdminDataAccess';

export interface UseSearchHistoryReturn {
  searchHistory: Search[];
  cachedResults: SearchResult[];
  isLoading: boolean;
  isLoadingResults: boolean;
  error: string | null;
  load: () => Promise<void>;
  loadCachedResults: (query: string, searchType: SearchType) => Promise<void>;
}

/**
 * Custom hook for managing search history data and cached search results
 * Provides methods for loading search history and viewing cached results
 */
export function useSearchHistory(limit: number = 100): UseSearchHistoryReturn {
  const dataAccess = useAdminDataAccess();
  const [searchHistory, setSearchHistory] = useState<Search[]>([]);
  const [cachedResults, setCachedResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const history = await dataAccess.getSearchHistory(limit);
      setSearchHistory(history);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load search history';
      setError(errorMessage);
      console.error('[useSearchHistory] Error loading search history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCachedResults = async (query: string, searchType: SearchType) => {
    try {
      setIsLoadingResults(true);
      setError(null);
      const results = await dataAccess.getCachedSearchResults(query, searchType);
      setCachedResults(results);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load cached results';
      setError(errorMessage);
      console.error('[useSearchHistory] Error loading cached results:', err);
    } finally {
      setIsLoadingResults(false);
    }
  };

  return {
    searchHistory,
    cachedResults,
    isLoading,
    isLoadingResults,
    error,
    load,
    loadCachedResults,
  };
}
