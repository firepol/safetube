import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDatabase, useDatabaseVideos, useDatabaseFavorites, useDatabaseHistory, useDatabaseCache } from '../useDatabase';
import { DatabaseClient } from '../../services/DatabaseClient';

// Mock the DatabaseClient
vi.mock('../../services/DatabaseClient', () => ({
  DatabaseClient: {
    healthCheck: vi.fn(),

    verifyMigration: vi.fn(),
    searchVideos: vi.fn(),
    getVideosBySource: vi.fn(),
    getVideoById: vi.fn(),
    updateVideoMetadata: vi.fn(),
    getFavorites: vi.fn(),
    isFavorite: vi.fn(),
    toggleFavorite: vi.fn(),
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
    getViewingHistory: vi.fn(),
    getRecentlyWatched: vi.fn(),
    updateViewRecord: vi.fn(),
    getViewRecord: vi.fn(),
    getCachedResults: vi.fn(),
    setCachedResults: vi.fn(),
    clearCache: vi.fn()
  }
}));

// Mock console methods to avoid test output noise
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  vi.clearAllMocks();
});

describe('useDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should check health on mount', async () => {
    const mockHealthResult = { isHealthy: true, version: '1.0.0' };
    (DatabaseClient.healthCheck as any).mockResolvedValue(mockHealthResult);

    const { result } = renderHook(() => useDatabase());

    expect(result.current.isLoading).toBe(true);
    expect(DatabaseClient.healthCheck).toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isHealthy).toBe(true);
    expect(result.current.isInitialized).toBe(true);
    expect(result.current.error).toBeNull();
  });

  test('should handle health check failure', async () => {
    (DatabaseClient.healthCheck as any).mockResolvedValue(null);

    const { result } = renderHook(() => useDatabase());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isHealthy).toBe(false);
    expect(result.current.isInitialized).toBe(false);
    expect(result.current.error).toBe('Database health check failed');
  });

  test('should handle health check error', async () => {
    (DatabaseClient.healthCheck as any).mockRejectedValue(new Error('Connection error'));

    const { result } = renderHook(() => useDatabase());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isHealthy).toBe(false);
    expect(result.current.error).toBe('Failed to connect to database');
  });
});

describe('useDatabaseVideos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should search videos', async () => {
    const mockResults = [
      { id: 'video1', title: 'Matching Video 1' },
      { id: 'video2', title: 'Matching Video 2' }
    ];
    (DatabaseClient.searchVideos as any).mockResolvedValue(mockResults);

    const { result } = renderHook(() => useDatabaseVideos());

    let searchResults: any;
    await act(async () => {
      searchResults = await result.current.searchVideos('test query', 'source1');
    });

    expect(searchResults).toEqual(mockResults);
    expect(DatabaseClient.searchVideos).toHaveBeenCalledWith('test query', 'source1');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('should handle search errors', async () => {
    (DatabaseClient.searchVideos as any).mockRejectedValue(new Error('Search failed'));

    const { result } = renderHook(() => useDatabaseVideos());

    let searchResults: any;
    await act(async () => {
      searchResults = await result.current.searchVideos('test query');
    });

    expect(searchResults).toEqual([]);
    expect(result.current.error).toBe('Search failed');
  });

  test('should get videos by source', async () => {
    const mockVideos = [
      { id: 'video1', title: 'Video 1', source_id: 'source1' }
    ];
    (DatabaseClient.getVideosBySource as any).mockResolvedValue(mockVideos);

    const { result } = renderHook(() => useDatabaseVideos());

    let videos: any;
    await act(async () => {
      videos = await result.current.getVideosBySource('source1');
    });

    expect(videos).toEqual(mockVideos);
    expect(DatabaseClient.getVideosBySource).toHaveBeenCalledWith('source1');
  });

  test('should get video by ID', async () => {
    const mockVideo = { id: 'video1', title: 'Test Video' };
    (DatabaseClient.getVideoById as any).mockResolvedValue(mockVideo);

    const { result } = renderHook(() => useDatabaseVideos());

    let video: any;
    await act(async () => {
      video = await result.current.getVideoById('video1');
    });

    expect(video).toEqual(mockVideo);
    expect(DatabaseClient.getVideoById).toHaveBeenCalledWith('video1');
  });

  test('should update video metadata', async () => {
    (DatabaseClient.updateVideoMetadata as any).mockResolvedValue(true);

    const { result } = renderHook(() => useDatabaseVideos());

    let success: any;
    await act(async () => {
      success = await result.current.updateVideoMetadata('video1', { title: 'New Title' });
    });

    expect(success).toBe(true);
    expect(DatabaseClient.updateVideoMetadata).toHaveBeenCalledWith('video1', { title: 'New Title' });
  });
});

describe('useDatabaseFavorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should load favorites on mount', async () => {
    const mockFavorites = [
      { video_id: 'video1', title: 'Favorite 1' },
      { video_id: 'video2', title: 'Favorite 2' }
    ];
    (DatabaseClient.getFavorites as any).mockResolvedValue(mockFavorites);

    const { result } = renderHook(() => useDatabaseFavorites());

    expect(DatabaseClient.getFavorites).toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.favorites).toEqual(mockFavorites);
      expect(result.current.isLoading).toBe(false);
    });
  });

  test('should handle load favorites error', async () => {
    (DatabaseClient.getFavorites as any).mockRejectedValue(new Error('Load failed'));

    const { result } = renderHook(() => useDatabaseFavorites());

    await waitFor(() => {
      expect(result.current.error).toBe('Load failed');
      expect(result.current.favorites).toEqual([]);
    });
  });

  test('should check if video is favorite', async () => {
    (DatabaseClient.getFavorites as any).mockResolvedValue([]);
    (DatabaseClient.isFavorite as any).mockResolvedValue(true);

    const { result } = renderHook(() => useDatabaseFavorites());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let isFavorite: any;
    await act(async () => {
      isFavorite = await result.current.isFavorite('video1');
    });

    expect(isFavorite).toBe(true);
    expect(DatabaseClient.isFavorite).toHaveBeenCalledWith('video1');
  });

  test('should toggle favorite status', async () => {
    (DatabaseClient.getFavorites as any).mockResolvedValue([]);
    (DatabaseClient.toggleFavorite as any).mockResolvedValue({ isFavorite: true });

    const { result } = renderHook(() => useDatabaseFavorites());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let newStatus: any;
    await act(async () => {
      newStatus = await result.current.toggleFavorite('video1', 'source1');
    });

    expect(newStatus).toBe(true);
    expect(DatabaseClient.toggleFavorite).toHaveBeenCalledWith('video1', 'source1');
    expect(DatabaseClient.getFavorites).toHaveBeenCalledTimes(2); // Once on mount, once after toggle
  });

  test('should add favorite', async () => {
    (DatabaseClient.getFavorites as any).mockResolvedValue([]);
    (DatabaseClient.addFavorite as any).mockResolvedValue(true);

    const { result } = renderHook(() => useDatabaseFavorites());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success: any;
    await act(async () => {
      success = await result.current.addFavorite('video1', 'source1');
    });

    expect(success).toBe(true);
    expect(DatabaseClient.addFavorite).toHaveBeenCalledWith('video1', 'source1');
    expect(DatabaseClient.getFavorites).toHaveBeenCalledTimes(2); // Once on mount, once after add
  });

  test('should remove favorite', async () => {
    (DatabaseClient.getFavorites as any).mockResolvedValue([]);
    (DatabaseClient.removeFavorite as any).mockResolvedValue(true);

    const { result } = renderHook(() => useDatabaseFavorites());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success: any;
    await act(async () => {
      success = await result.current.removeFavorite('video1');
    });

    expect(success).toBe(true);
    expect(DatabaseClient.removeFavorite).toHaveBeenCalledWith('video1');
    expect(DatabaseClient.getFavorites).toHaveBeenCalledTimes(2); // Once on mount, once after remove
  });
});

describe('useDatabaseHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should load viewing history', async () => {
    const mockHistory = [
      { video_id: 'video1', title: 'Video 1', last_watched: '2023-01-01' }
    ];
    (DatabaseClient.getViewingHistory as any).mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useDatabaseHistory());

    let history: any;
    await act(async () => {
      history = await result.current.loadHistory(25);
    });

    expect(history).toEqual(mockHistory);
    expect(result.current.history).toEqual(mockHistory);
    expect(DatabaseClient.getViewingHistory).toHaveBeenCalledWith(25);
  });

  test('should load recently watched videos', async () => {
    const mockRecent = [
      { video_id: 'video1', title: 'Recent Video', time_watched: 300 }
    ];
    (DatabaseClient.getRecentlyWatched as any).mockResolvedValue(mockRecent);

    const { result } = renderHook(() => useDatabaseHistory());

    let recent: any;
    await act(async () => {
      recent = await result.current.loadRecentlyWatched(10);
    });

    expect(recent).toEqual(mockRecent);
    expect(result.current.recentlyWatched).toEqual(mockRecent);
    expect(DatabaseClient.getRecentlyWatched).toHaveBeenCalledWith(10);
  });

  test('should update view record', async () => {
    (DatabaseClient.updateViewRecord as any).mockResolvedValue(true);

    const { result } = renderHook(() => useDatabaseHistory());

    let success: any;
    await act(async () => {
      success = await result.current.updateViewRecord('video1', { position: 150 });
    });

    expect(success).toBe(true);
    expect(DatabaseClient.updateViewRecord).toHaveBeenCalledWith('video1', { position: 150 });
  });

  test('should get view record', async () => {
    const mockRecord = { video_id: 'video1', position: 120 };
    (DatabaseClient.getViewRecord as any).mockResolvedValue(mockRecord);

    const { result } = renderHook(() => useDatabaseHistory());

    let record: any;
    await act(async () => {
      record = await result.current.getViewRecord('video1');
    });

    expect(record).toEqual(mockRecord);
    expect(DatabaseClient.getViewRecord).toHaveBeenCalledWith('video1');
  });

  test('should handle history errors', async () => {
    (DatabaseClient.getViewingHistory as any).mockRejectedValue(new Error('History load failed'));

    const { result } = renderHook(() => useDatabaseHistory());

    let history: any;
    await act(async () => {
      history = await result.current.loadHistory();
    });

    expect(history).toEqual([]);
    expect(result.current.error).toBe('History load failed');
  });
});

describe('useDatabaseCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should get cached results', async () => {
    const mockResults = ['video1', 'video2', 'video3'];
    (DatabaseClient.getCachedResults as any).mockResolvedValue(mockResults);

    const { result } = renderHook(() => useDatabaseCache());

    let results: any;
    await act(async () => {
      results = await result.current.getCachedResults('source1', 2);
    });

    expect(results).toEqual(mockResults);
    expect(DatabaseClient.getCachedResults).toHaveBeenCalledWith('source1', 2);
  });

  test('should set cached results', async () => {
    (DatabaseClient.setCachedResults as any).mockResolvedValue(true);

    const { result } = renderHook(() => useDatabaseCache());

    let success: any;
    await act(async () => {
      success = await result.current.setCachedResults('source1', 1, ['video1', 'video2']);
    });

    expect(success).toBe(true);
    expect(DatabaseClient.setCachedResults).toHaveBeenCalledWith('source1', 1, ['video1', 'video2']);
  });

  test('should clear cache', async () => {
    (DatabaseClient.clearCache as any).mockResolvedValue(true);

    const { result } = renderHook(() => useDatabaseCache());

    let success: any;
    await act(async () => {
      success = await result.current.clearCache('source1');
    });

    expect(success).toBe(true);
    expect(DatabaseClient.clearCache).toHaveBeenCalledWith('source1');
  });

  test('should handle cache errors', async () => {
    (DatabaseClient.getCachedResults as any).mockRejectedValue(new Error('Cache error'));

    const { result } = renderHook(() => useDatabaseCache());

    let results: any;
    await act(async () => {
      results = await result.current.getCachedResults('source1');
    });

    expect(results).toEqual([]);
    expect(result.current.error).toBe('Cache error');
  });
});