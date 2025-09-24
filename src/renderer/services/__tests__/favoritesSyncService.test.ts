import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FavoritesSyncService, FavoriteSyncEvent } from '../favoritesSyncService';
import { FavoritesService } from '../favoritesService';

// Mock the FavoritesService
vi.mock('../favoritesService');
vi.mock('../../lib/logging');

// Mock normalization utilities
vi.mock('../../../shared/favoritesUtils', () => ({
  normalizeVideoSource: vi.fn((source) => ({
    id: source.id,
    type: source.type || 'youtube',
    title: source.title || 'Test Video',
    thumbnail: source.thumbnail || '',
    duration: source.duration || 0,
    url: source.url || ''
  }))
}));

describe('FavoritesSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FavoritesSyncService.clearListeners();
  });

  afterEach(() => {
    FavoritesSyncService.clearListeners();
  });

  describe('subscription system', () => {
    it('should allow subscribing to favorite updates', () => {
      const callback = vi.fn();
      const unsubscribe = FavoritesSyncService.subscribe(callback);

      expect(FavoritesSyncService.getListenerCount()).toBe(1);

      unsubscribe();
      expect(FavoritesSyncService.getListenerCount()).toBe(0);
    });

    it('should call multiple listeners when broadcasting', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      FavoritesSyncService.subscribe(callback1);
      FavoritesSyncService.subscribe(callback2);

      const event: FavoriteSyncEvent = {
        videoId: 'test-video',
        isFavorite: true,
        timestamp: Date.now(),
        source: 'youtube',
        type: 'youtube',
        metadata: {
          title: 'Test Video',
          thumbnail: 'test.jpg',
          duration: 120
        }
      };

      FavoritesSyncService.broadcast(event);

      expect(callback1).toHaveBeenCalledWith(event);
      expect(callback2).toHaveBeenCalledWith(event);
    });

    it('should handle errors in listener callbacks gracefully', () => {
      const failingCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const workingCallback = vi.fn();

      FavoritesSyncService.subscribe(failingCallback);
      FavoritesSyncService.subscribe(workingCallback);

      const event: FavoriteSyncEvent = {
        videoId: 'test-video',
        isFavorite: true,
        timestamp: Date.now(),
        source: 'youtube',
        type: 'youtube'
      };

      // Should not throw, should call both callbacks
      expect(() => FavoritesSyncService.broadcast(event)).not.toThrow();
      expect(failingCallback).toHaveBeenCalled();
      expect(workingCallback).toHaveBeenCalled();
    });
  });

  describe('toggleFavoriteWithSync', () => {
    it('should toggle favorite and broadcast update', async () => {
      const mockResult = {
        favorite: {
          videoId: 'test-video',
          title: 'Test Video',
          dateAdded: '2023-01-01T00:00:00.000Z',
          sourceType: 'youtube' as const,
          sourceId: 'test-source'
        },
        isFavorite: true
      };

      vi.mocked(FavoritesService.toggleFavorite).mockResolvedValue(mockResult);

      const callback = vi.fn();
      FavoritesSyncService.subscribe(callback);

      const result = await FavoritesSyncService.toggleFavoriteWithSync(
        'test-video',
        'youtube',
        'youtube',
        'Test Video',
        'test.jpg',
        120
      );

      expect(result).toEqual(mockResult);
      expect(FavoritesService.toggleFavorite).toHaveBeenCalledWith(
        'test-video',
        'youtube',
        'youtube',
        'Test Video',
        'test.jpg',
        120,
        undefined
      );

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: 'test-video',
          isFavorite: true,
          source: 'youtube',
          type: 'youtube'
        })
      );
    });

    it('should handle errors in toggle operation', async () => {
      const error = new Error('Toggle failed');
      vi.mocked(FavoritesService.toggleFavorite).mockRejectedValue(error);

      await expect(
        FavoritesSyncService.toggleFavoriteWithSync(
          'test-video',
          'youtube',
          'youtube',
          'Test Video',
          'test.jpg',
          120
        )
      ).rejects.toThrow('Toggle failed');
    });
  });

  describe('loadAndSyncStatuses', () => {
    it('should load statuses without broadcasting to prevent loops', async () => {
      const statusMap = new Map([
        ['video1', true],
        ['video2', false],
        ['video3', true]
      ]);

      vi.mocked(FavoritesService.getFavoritesStatus).mockResolvedValue(statusMap);

      const callback = vi.fn();
      FavoritesSyncService.subscribe(callback);

      const result = await FavoritesSyncService.loadAndSyncStatuses(['video1', 'video2', 'video3']);

      expect(result).toEqual(statusMap);
      expect(FavoritesService.getFavoritesStatus).toHaveBeenCalledWith(['video1', 'video2', 'video3']);

      // Should NOT broadcast during bulk load to prevent infinite loops
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle errors in status loading', async () => {
      const error = new Error('Load failed');
      vi.mocked(FavoritesService.getFavoritesStatus).mockRejectedValue(error);

      await expect(
        FavoritesSyncService.loadAndSyncStatuses(['video1', 'video2'])
      ).rejects.toThrow('Load failed');
    });
  });

  describe('syncVideoStatus', () => {
    it('should sync single video status', async () => {
      vi.mocked(FavoritesService.isFavorite).mockResolvedValue(true);

      const callback = vi.fn();
      FavoritesSyncService.subscribe(callback);

      const result = await FavoritesSyncService.syncVideoStatus('test-video', 'youtube');

      expect(result).toBe(true);
      expect(FavoritesService.isFavorite).toHaveBeenCalledWith('test-video', 'youtube');
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: 'test-video',
          isFavorite: true,
          type: 'youtube'
        })
      );
    });

    it('should handle errors in video status sync', async () => {
      vi.mocked(FavoritesService.isFavorite).mockRejectedValue(new Error('Sync failed'));

      const result = await FavoritesSyncService.syncVideoStatus('test-video');

      expect(result).toBe(false); // Should return false on error
    });
  });

  describe('forceSyncAll', () => {
    it('should clear cache and sync all favorites', async () => {
      const favorites = [
        {
          videoId: 'video1',
          title: 'Video 1',
          dateAdded: '2023-01-01T00:00:00.000Z',
          sourceType: 'youtube' as const,
          sourceId: 'test-source',
          thumbnail: 'thumb1.jpg',
          duration: 120
        },
        {
          videoId: 'video2',
          title: 'Video 2',
          dateAdded: '2023-01-01T00:00:00.000Z',
          sourceType: 'local' as const,
          sourceId: 'test-source',
          thumbnail: 'thumb2.jpg',
          duration: 180
        }
      ];

      vi.mocked(FavoritesService.getFavorites).mockResolvedValue(favorites);
      vi.mocked(FavoritesService.clearCache).mockImplementation(() => {});

      const callback = vi.fn();
      FavoritesSyncService.subscribe(callback);

      await FavoritesSyncService.forceSyncAll();

      expect(FavoritesService.clearCache).toHaveBeenCalled();
      expect(FavoritesService.getFavorites).toHaveBeenCalledWith(true);

      // Should broadcast for each favorite
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: 'video1',
          isFavorite: true,
          source: 'force-sync',
          type: 'youtube'
        })
      );
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: 'video2',
          isFavorite: true,
          source: 'force-sync',
          type: 'local'
        })
      );
    });

    it('should handle errors in force sync', async () => {
      vi.mocked(FavoritesService.getFavorites).mockRejectedValue(new Error('Sync failed'));

      // Should not throw
      await expect(FavoritesSyncService.forceSyncAll()).resolves.toBeUndefined();
    });
  });

  describe('YouTube video handling', () => {
    it('should properly normalize YouTube video metadata', async () => {
      const mockResult = {
        favorite: {
          videoId: 'dQw4w9WgXcQ',
          title: 'Never Gonna Give You Up',
          dateAdded: '2023-01-01T00:00:00.000Z',
          sourceType: 'youtube' as const,
          sourceId: 'test-source'
        },
        isFavorite: true
      };

      vi.mocked(FavoritesService.toggleFavorite).mockResolvedValue(mockResult);

      const callback = vi.fn();
      FavoritesSyncService.subscribe(callback);

      await FavoritesSyncService.toggleFavoriteWithSync(
        'dQw4w9WgXcQ',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'youtube',
        'Never Gonna Give You Up',
        'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        213
      );

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: 'dQw4w9WgXcQ',
          isFavorite: true,
          type: 'youtube',
          metadata: expect.objectContaining({
            title: 'Never Gonna Give You Up',
            thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
            duration: 213
          })
        })
      );
    });

    it('should handle MediaSource YouTube videos', async () => {
      const mockResult = {
        favorite: {
          videoId: 'test-video',
          title: 'MediaSource Video',
          dateAdded: '2023-01-01T00:00:00.000Z',
          sourceType: 'youtube' as const,
          sourceId: 'test-source'
        },
        isFavorite: true
      };

      vi.mocked(FavoritesService.toggleFavorite).mockResolvedValue(mockResult);

      const callback = vi.fn();
      FavoritesSyncService.subscribe(callback);

      await FavoritesSyncService.toggleFavoriteWithSync(
        'test-video',
        'mediasource',
        'youtube',
        'MediaSource Video',
        '',
        300
      );

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: 'test-video',
          type: 'youtube',
          source: 'mediasource'
        })
      );
    });
  });

  describe('real-time synchronization', () => {
    it('should handle rapid successive updates', async () => {
      const callback = vi.fn();
      FavoritesSyncService.subscribe(callback);

      // Simulate rapid updates
      const events = [
        { videoId: 'video1', isFavorite: true, timestamp: 1000 },
        { videoId: 'video1', isFavorite: false, timestamp: 1001 },
        { videoId: 'video1', isFavorite: true, timestamp: 1002 },
        { videoId: 'video2', isFavorite: true, timestamp: 1003 }
      ];

      events.forEach(event => {
        FavoritesSyncService.broadcast({
          ...event,
          source: 'test',
          type: 'youtube'
        });
      });

      // All events should be broadcast
      expect(callback).toHaveBeenCalledTimes(4);
    });

    it('should maintain listener state across multiple operations', async () => {
      vi.mocked(FavoritesService.isFavorite).mockResolvedValue(true);

      const callback = vi.fn();
      const unsubscribe = FavoritesSyncService.subscribe(callback);

      // Multiple operations
      await FavoritesSyncService.syncVideoStatus('video1');
      await FavoritesSyncService.syncVideoStatus('video2');

      expect(callback).toHaveBeenCalledTimes(2);

      // Unsubscribe should stop notifications
      unsubscribe();
      await FavoritesSyncService.syncVideoStatus('video3');

      expect(callback).toHaveBeenCalledTimes(2); // No additional calls
    });
  });
});