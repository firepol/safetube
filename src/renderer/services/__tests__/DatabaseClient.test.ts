import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseClient } from '../DatabaseClient';

// Mock the electron API
const mockElectron = {
  invoke: vi.fn()
};

// Mock window.electron
Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true
});

// Mock console methods to avoid test output noise
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

describe('DatabaseClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Health Check', () => {
    test('should return health check result on success', async () => {
      const mockHealthData = { isHealthy: true, version: '1.0.0' };
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: mockHealthData
      });

      const result = await DatabaseClient.healthCheck();

      expect(result).toEqual(mockHealthData);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:health-check');
    });

    test('should return null on health check failure', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: false,
        error: 'Connection failed'
      });

      const result = await DatabaseClient.healthCheck();

      expect(result).toBeNull();
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:health-check');
    });

    test('should handle health check errors', async () => {
      mockElectron.invoke.mockRejectedValue(new Error('IPC error'));

      const result = await DatabaseClient.healthCheck();

      expect(result).toBeNull();
    });
  });

  describe('Video Operations', () => {
    test('should get videos by source', async () => {
      const mockVideos = [
        { id: 'video1', title: 'Test Video 1', source_id: 'source1' },
        { id: 'video2', title: 'Test Video 2', source_id: 'source1' }
      ];
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: mockVideos
      });

      const result = await DatabaseClient.getVideosBySource('source1');

      expect(result).toEqual(mockVideos);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:videos:get-by-source', 'source1');
    });

    test('should return empty array on get videos error', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: false,
        error: 'Database error'
      });

      const result = await DatabaseClient.getVideosBySource('source1');

      expect(result).toEqual([]);
    });

    test('should get video by ID', async () => {
      const mockVideo = { id: 'video1', title: 'Test Video', source_id: 'source1' };
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: mockVideo
      });

      const result = await DatabaseClient.getVideoById('video1');

      expect(result).toEqual(mockVideo);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:videos:get-by-id', 'video1');
    });

    test('should return null when video not found', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: null
      });

      const result = await DatabaseClient.getVideoById('nonexistent');

      expect(result).toBeNull();
    });

    test('should search videos', async () => {
      const mockResults = [
        { id: 'video1', title: 'Matching Video 1' },
        { id: 'video2', title: 'Matching Video 2' }
      ];
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: mockResults
      });

      const result = await DatabaseClient.searchVideos('test query', 'source1');

      expect(result).toEqual(mockResults);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:videos:search', 'test query', 'source1');
    });

    test('should search videos without source filter', async () => {
      const mockResults = [{ id: 'video1', title: 'Global Result' }];
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: mockResults
      });

      const result = await DatabaseClient.searchVideos('global query');

      expect(result).toEqual(mockResults);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:videos:search', 'global query', undefined);
    });

    test('should update video metadata', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: true
      });

      const metadata = { title: 'Updated Title', description: 'New description' };
      const result = await DatabaseClient.updateVideoMetadata('video1', metadata);

      expect(result).toBe(true);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:videos:update-metadata', 'video1', metadata);
    });

    test('should update video availability', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: true
      });

      const result = await DatabaseClient.updateVideoAvailability('video1', false);

      expect(result).toBe(true);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:videos:update-availability', 'video1', false);
    });
  });

  describe('View Records Operations', () => {
    test('should get view record', async () => {
      const mockRecord = {
        video_id: 'video1',
        source_id: 'source1',
        position: 120,
        time_watched: 300,
        watched: false
      };
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: mockRecord
      });

      const result = await DatabaseClient.getViewRecord('video1');

      expect(result).toEqual(mockRecord);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:view-records:get', 'video1');
    });

    test('should update view record', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: true
      });

      const update = {
        source_id: 'source1',
        position: 150,
        time_watched: 400,
        watched: false
      };
      const result = await DatabaseClient.updateViewRecord('video1', update);

      expect(result).toBe(true);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:view-records:update', 'video1', update);
    });

    test('should get viewing history', async () => {
      const mockHistory = [
        { video_id: 'video1', title: 'Video 1', last_watched: '2023-01-01' },
        { video_id: 'video2', title: 'Video 2', last_watched: '2023-01-02' }
      ];
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: mockHistory
      });

      const result = await DatabaseClient.getViewingHistory(25);

      expect(result).toEqual(mockHistory);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:view-records:get-history', 25);
    });

    test('should get viewing history with default limit', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: []
      });

      await DatabaseClient.getViewingHistory();

      expect(mockElectron.invoke).toHaveBeenCalledWith('database:view-records:get-history', 50);
    });

    test('should get recently watched videos', async () => {
      const mockRecent = [
        { video_id: 'video1', title: 'Recent Video', time_watched: 300 }
      ];
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: mockRecent
      });

      const result = await DatabaseClient.getRecentlyWatched(10);

      expect(result).toEqual(mockRecent);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:view-records:get-recently-watched', 10);
    });
  });

  describe('Favorites Operations', () => {
    test('should get all favorites', async () => {
      const mockFavorites = [
        { video_id: 'video1', title: 'Favorite 1', date_added: '2023-01-01' },
        { video_id: 'video2', title: 'Favorite 2', date_added: '2023-01-02' }
      ];
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: mockFavorites
      });

      const result = await DatabaseClient.getFavorites();

      expect(result).toEqual(mockFavorites);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:favorites:get-all');
    });

    test('should add favorite', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: true
      });

      const result = await DatabaseClient.addFavorite('video1', 'source1');

      expect(result).toBe(true);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:favorites:add', 'video1', 'source1');
    });

    test('should remove favorite', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: true
      });

      const result = await DatabaseClient.removeFavorite('video1');

      expect(result).toBe(true);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:favorites:remove', 'video1');
    });

    test('should check if video is favorite', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: true
      });

      const result = await DatabaseClient.isFavorite('video1');

      expect(result).toBe(true);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:favorites:is-favorite', 'video1');
    });

    test('should toggle favorite status', async () => {
      const mockToggleResult = { isFavorite: true };
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: mockToggleResult
      });

      const result = await DatabaseClient.toggleFavorite('video1', 'source1');

      expect(result).toEqual(mockToggleResult);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:favorites:toggle', 'video1', 'source1');
    });

    test('should return null on toggle favorite failure', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: false,
        error: 'Toggle failed'
      });

      const result = await DatabaseClient.toggleFavorite('video1', 'source1');

      expect(result).toBeNull();
    });
  });

  describe('Sources Operations', () => {
    test('should get all sources', async () => {
      const mockSources = [
        { id: 'source1', type: 'youtube_channel', title: 'Channel 1' },
        { id: 'source2', type: 'local', title: 'Local Videos' }
      ];
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: mockSources
      });

      const result = await DatabaseClient.getSources();

      expect(result).toEqual(mockSources);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:sources:get-all');
    });

    test('should get source by ID', async () => {
      const mockSource = { id: 'source1', type: 'youtube_channel', title: 'Channel 1' };
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: mockSource
      });

      const result = await DatabaseClient.getSourceById('source1');

      expect(result).toEqual(mockSource);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:sources:get-by-id', 'source1');
    });

    test('should create new source', async () => {
      const newSourceId = 'source_12345';
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: newSourceId
      });

      const newSource = {
        type: 'youtube_channel',
        title: 'New Channel',
        url: 'https://youtube.com/channel/UC123'
      };
      const result = await DatabaseClient.createSource(newSource);

      expect(result).toBe(newSourceId);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:sources:create', newSource);
    });

    test('should update existing source', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: true
      });

      const updates = { title: 'Updated Channel' };
      const result = await DatabaseClient.updateSource('source1', updates);

      expect(result).toBe(true);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:sources:update', 'source1', updates);
    });

    test('should delete source', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: true
      });

      const result = await DatabaseClient.deleteSource('source1');

      expect(result).toBe(true);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:sources:delete', 'source1');
    });
  });

  describe('YouTube Cache Operations', () => {
    test('should get cached results', async () => {
      const mockVideoIds = ['video1', 'video2', 'video3'];
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: mockVideoIds
      });

      const result = await DatabaseClient.getCachedResults('source1', 2);

      expect(result).toEqual(mockVideoIds);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:youtube-cache:get-cached-results', 'source1', 2);
    });

    test('should get cached results with default page', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: ['video1']
      });

      await DatabaseClient.getCachedResults('source1');

      expect(mockElectron.invoke).toHaveBeenCalledWith('database:youtube-cache:get-cached-results', 'source1', 1);
    });

    test('should set cached results', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: true
      });

      const videoIds = ['video1', 'video2'];
      const result = await DatabaseClient.setCachedResults('source1', 1, videoIds);

      expect(result).toBe(true);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:youtube-cache:set-cached-results', 'source1', 1, videoIds);
    });

    test('should clear cache', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: true
      });

      const result = await DatabaseClient.clearCache('source1');

      expect(result).toBe(true);
      expect(mockElectron.invoke).toHaveBeenCalledWith('database:youtube-cache:clear-cache', 'source1');
    });
  });

  describe('Error Handling', () => {
    test('should handle IPC errors gracefully', async () => {
      mockElectron.invoke.mockRejectedValue(new Error('IPC communication failed'));

      const result = await DatabaseClient.getVideosBySource('source1');

      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalledWith('[DatabaseClient] Get videos by source error:', expect.any(Error));
    });

    test('should handle failed responses consistently', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: false,
        error: 'Database operation failed',
        code: 'OPERATION_FAILED'
      });

      const result = await DatabaseClient.addFavorite('video1', 'source1');

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });

    test('should handle null/undefined data in responses', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: true,
        data: null
      });

      const result = await DatabaseClient.getVideosBySource('source1');

      expect(result).toEqual([]);
    });

    test('should handle missing data property', async () => {
      mockElectron.invoke.mockResolvedValue({
        success: true
        // Missing data property
      });

      const result = await DatabaseClient.getSources();

      expect(result).toEqual([]);
    });
  });
});