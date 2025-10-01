import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ipcMain } from 'electron';
import registerDatabaseHandlers from '../databaseHandlers';
import DatabaseService from '../../services/DatabaseService';

// Mock the dependencies
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}));

vi.mock('../../services/DatabaseService');
vi.mock('../../database/MigrationService');
vi.mock('../../database/SimpleSchemaManager');
vi.mock('../../services/DatabaseErrorHandler');
vi.mock('../../logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

describe('Database IPC Handlers', () => {
  let mockDatabaseService: any;
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Track registered IPC handlers
    registeredHandlers = new Map();
    (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    // Mock DatabaseService instance
    mockDatabaseService = {
      healthCheck: vi.fn(),
      all: vi.fn(),
      get: vi.fn(),
      run: vi.fn(),
      executeTransaction: vi.fn()
    };
    (DatabaseService.getInstance as any).mockReturnValue(mockDatabaseService);

    // Register the database handlers
    registerDatabaseHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Handler Registration', () => {
    test('should register all database handlers', () => {
      const expectedHandlers = [
        'database:health-check',
        'database:migrate-phase1',
        'database:verify-migration',
        'database:videos:get-by-source',
        'database:videos:get-by-id',
        'database:videos:search',
        'database:videos:update-metadata',
        'database:videos:update-availability',
        'database:view-records:get',
        'database:view-records:update',
        'database:view-records:get-history',
        'database:view-records:get-recently-watched',
        'database:favorites:get-all',
        'database:favorites:add',
        'database:favorites:remove',
        'database:favorites:is-favorite',
        'database:favorites:toggle',
        'database:sources:get-all',
        'database:sources:get-by-id',
        'database:sources:create',
        'database:sources:update',
        'database:sources:delete',
        'database:youtube-cache:get-cached-results',
        'database:youtube-cache:set-cached-results',
        'database:youtube-cache:clear-cache'
      ];

      for (const handler of expectedHandlers) {
        expect(registeredHandlers.has(handler)).toBe(true);
      }

      expect(registeredHandlers.size).toBe(expectedHandlers.length);
    });
  });

  describe('Health Check Handler', () => {
    test('should return healthy status', async () => {
      const mockHealthResult = { isHealthy: true, version: '1.0.0' };
      mockDatabaseService.healthCheck.mockResolvedValue(mockHealthResult);

      const handler = registeredHandlers.get('database:health-check');
      const result = await handler();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockHealthResult);
      expect(mockDatabaseService.healthCheck).toHaveBeenCalled();
    });

    test('should handle health check failure', async () => {
      mockDatabaseService.healthCheck.mockRejectedValue(new Error('Connection failed'));

      const handler = registeredHandlers.get('database:health-check');
      const result = await handler();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
      expect(result.code).toBe('HEALTH_CHECK_FAILED');
    });
  });

  describe('Video Handlers', () => {
    test('should get videos by source', async () => {
      const mockVideos = [
        { id: 'video1', title: 'Test Video 1', source_id: 'source1' },
        { id: 'video2', title: 'Test Video 2', source_id: 'source1' }
      ];
      mockDatabaseService.all.mockResolvedValue(mockVideos);

      const handler = registeredHandlers.get('database:videos:get-by-source');
      const result = await handler({}, 'source1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockVideos);
      expect(mockDatabaseService.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM videos'),
        ['source1']
      );
    });

    test('should get video by ID', async () => {
      const mockVideo = { id: 'video1', title: 'Test Video', source_id: 'source1' };
      mockDatabaseService.get.mockResolvedValue(mockVideo);

      const handler = registeredHandlers.get('database:videos:get-by-id');
      const result = await handler({}, 'video1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockVideo);
      expect(mockDatabaseService.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM videos WHERE id = ?'),
        ['video1']
      );
    });

    test('should search videos', async () => {
      const mockResults = [
        { id: 'video1', title: 'Test Video 1' }
      ];
      mockDatabaseService.all.mockResolvedValue(mockResults);

      const handler = registeredHandlers.get('database:videos:search');
      const result = await handler({}, 'test', 'source1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResults);
      expect(mockDatabaseService.all).toHaveBeenCalledWith(
        expect.stringContaining('videos_fts MATCH ?'),
        ['test', 'source1']
      );
    });

    test('should update video metadata', async () => {
      mockDatabaseService.run.mockResolvedValue({ changes: 1 });

      const handler = registeredHandlers.get('database:videos:update-metadata');
      const result = await handler({}, 'video1', { title: 'Updated Title' });

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE videos SET'),
        ['Updated Title', 'video1']
      );
    });

    test('should update video availability', async () => {
      mockDatabaseService.run.mockResolvedValue({ changes: 1 });

      const handler = registeredHandlers.get('database:videos:update-availability');
      const result = await handler({}, 'video1', true);

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE videos SET is_available = ?'),
        [1, 'video1']
      );
    });

    test('should handle video operation errors', async () => {
      mockDatabaseService.all.mockRejectedValue(new Error('Database error'));

      const handler = registeredHandlers.get('database:videos:get-by-source');
      const result = await handler({}, 'source1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
      expect(result.code).toBe('GET_VIDEOS_FAILED');
    });
  });

  describe('View Records Handlers', () => {
    test('should get view record', async () => {
      const mockRecord = {
        video_id: 'video1',
        source_id: 'source1',
        position: 120,
        time_watched: 300,
        watched: false
      };
      mockDatabaseService.get.mockResolvedValue(mockRecord);

      const handler = registeredHandlers.get('database:view-records:get');
      const result = await handler({}, 'video1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRecord);
      expect(mockDatabaseService.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM view_records WHERE video_id = ?'),
        ['video1']
      );
    });

    test('should update view record', async () => {
      mockDatabaseService.run.mockResolvedValue({ changes: 1 });

      const handler = registeredHandlers.get('database:view-records:update');
      const update = {
        source_id: 'source1',
        position: 150,
        time_watched: 400,
        watched: false
      };
      const result = await handler({}, 'video1', update);

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO view_records'),
        expect.arrayContaining(['video1', 'source1', 150, 400])
      );
    });

    test('should get viewing history', async () => {
      const mockHistory = [
        { video_id: 'video1', title: 'Video 1', last_watched: '2023-01-01' },
        { video_id: 'video2', title: 'Video 2', last_watched: '2023-01-02' }
      ];
      mockDatabaseService.all.mockResolvedValue(mockHistory);

      const handler = registeredHandlers.get('database:view-records:get-history');
      const result = await handler({}, 25);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockHistory);
      expect(mockDatabaseService.all).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY vr.last_watched DESC'),
        [25]
      );
    });

    test('should get recently watched videos', async () => {
      const mockRecent = [
        { video_id: 'video1', title: 'Video 1', time_watched: 300 }
      ];
      mockDatabaseService.all.mockResolvedValue(mockRecent);

      const handler = registeredHandlers.get('database:view-records:get-recently-watched');
      const result = await handler({}, 10);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRecent);
      expect(mockDatabaseService.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE vr.time_watched > 0'),
        [10]
      );
    });
  });

  describe('Favorites Handlers', () => {
    test('should get all favorites', async () => {
      const mockFavorites = [
        { video_id: 'video1', title: 'Favorite 1', date_added: '2023-01-01' },
        { video_id: 'video2', title: 'Favorite 2', date_added: '2023-01-02' }
      ];
      mockDatabaseService.all.mockResolvedValue(mockFavorites);

      const handler = registeredHandlers.get('database:favorites:get-all');
      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockFavorites);
      expect(mockDatabaseService.all).toHaveBeenCalledWith(
        expect.stringContaining('FROM favorites f JOIN videos v')
      );
    });

    test('should add favorite', async () => {
      mockDatabaseService.run.mockResolvedValue({ changes: 1 });

      const handler = registeredHandlers.get('database:favorites:add');
      const result = await handler({}, 'video1', 'source1');

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO favorites'),
        expect.arrayContaining(['video1', 'source1'])
      );
    });

    test('should remove favorite', async () => {
      mockDatabaseService.run.mockResolvedValue({ changes: 1 });

      const handler = registeredHandlers.get('database:favorites:remove');
      const result = await handler({}, 'video1');

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM favorites WHERE video_id = ?'),
        ['video1']
      );
    });

    test('should check if video is favorite', async () => {
      mockDatabaseService.get.mockResolvedValue({ count: 1 });

      const handler = registeredHandlers.get('database:favorites:is-favorite');
      const result = await handler({}, 'video1');

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockDatabaseService.get).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) as count FROM favorites'),
        ['video1']
      );
    });

    test('should toggle favorite status', async () => {
      // Mock checking existing favorite (not found)
      mockDatabaseService.get.mockResolvedValue({ count: 0 });
      // Mock adding favorite
      mockDatabaseService.run.mockResolvedValue({ changes: 1 });

      const handler = registeredHandlers.get('database:favorites:toggle');
      const result = await handler({}, 'video1', 'source1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ isFavorite: true });
      expect(mockDatabaseService.get).toHaveBeenCalled();
      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO favorites'),
        expect.arrayContaining(['video1', 'source1'])
      );
    });

    test('should toggle favorite status (remove existing)', async () => {
      // Mock checking existing favorite (found)
      mockDatabaseService.get.mockResolvedValue({ count: 1 });
      // Mock removing favorite
      mockDatabaseService.run.mockResolvedValue({ changes: 1 });

      const handler = registeredHandlers.get('database:favorites:toggle');
      const result = await handler({}, 'video1', 'source1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ isFavorite: false });
      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM favorites WHERE video_id = ?'),
        ['video1']
      );
    });
  });

  describe('Sources Handlers', () => {
    test('should get all sources', async () => {
      const mockSources = [
        { id: 'source1', type: 'youtube_channel', title: 'Channel 1' },
        { id: 'source2', type: 'local', title: 'Local Videos' }
      ];
      mockDatabaseService.all.mockResolvedValue(mockSources);

      const handler = registeredHandlers.get('database:sources:get-all');
      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSources);
      expect(mockDatabaseService.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM sources ORDER BY position')
      );
    });

    test('should get source by ID', async () => {
      const mockSource = { id: 'source1', type: 'youtube_channel', title: 'Channel 1' };
      mockDatabaseService.get.mockResolvedValue(mockSource);

      const handler = registeredHandlers.get('database:sources:get-by-id');
      const result = await handler({}, 'source1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSource);
      expect(mockDatabaseService.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM sources WHERE id = ?'),
        ['source1']
      );
    });

    test('should create new source', async () => {
      mockDatabaseService.run.mockResolvedValue({ changes: 1 });

      const handler = registeredHandlers.get('database:sources:create');
      const newSource = {
        type: 'youtube_channel',
        title: 'New Channel',
        url: 'https://youtube.com/channel/UC123'
      };
      const result = await handler({}, newSource);

      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string'); // Should return generated ID
      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sources'),
        expect.arrayContaining(['youtube_channel', 'New Channel', 'https://youtube.com/channel/UC123'])
      );
    });

    test('should update existing source', async () => {
      mockDatabaseService.run.mockResolvedValue({ changes: 1 });

      const handler = registeredHandlers.get('database:sources:update');
      const updates = { title: 'Updated Channel' };
      const result = await handler({}, 'source1', updates);

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sources SET'),
        ['Updated Channel', 'source1']
      );
    });

    test('should delete source and related data', async () => {
      mockDatabaseService.executeTransaction.mockResolvedValue(true);

      const handler = registeredHandlers.get('database:sources:delete');
      const result = await handler({}, 'source1');

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockDatabaseService.executeTransaction).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ sql: expect.stringContaining('DELETE FROM youtube_api_results') }),
          expect.objectContaining({ sql: expect.stringContaining('DELETE FROM favorites') }),
          expect.objectContaining({ sql: expect.stringContaining('DELETE FROM view_records') }),
          expect.objectContaining({ sql: expect.stringContaining('DELETE FROM videos') }),
          expect.objectContaining({ sql: expect.stringContaining('DELETE FROM sources') })
        ])
      );
    });
  });

  describe('YouTube Cache Handlers', () => {
    test('should get cached results', async () => {
      const mockResults = [
        { video_id: 'video1' },
        { video_id: 'video2' }
      ];
      mockDatabaseService.all.mockResolvedValue(mockResults);

      const handler = registeredHandlers.get('database:youtube-cache:get-cached-results');
      const result = await handler({}, 'source1', 2);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(['video1', 'video2']);
      expect(mockDatabaseService.all).toHaveBeenCalledWith(
        expect.stringContaining('FROM youtube_api_results'),
        ['source1', 51, 101] // Page 2 with page size 50
      );
    });

    test('should set cached results', async () => {
      mockDatabaseService.run.mockResolvedValue({ changes: 1 });
      mockDatabaseService.executeTransaction.mockResolvedValue(true);

      const handler = registeredHandlers.get('database:youtube-cache:set-cached-results');
      const result = await handler({}, 'source1', 1, ['video1', 'video2']);

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM youtube_api_results'),
        ['source1', 1, 51] // Clear existing page 1 results
      );
      expect(mockDatabaseService.executeTransaction).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            sql: expect.stringContaining('INSERT INTO youtube_api_results'),
            params: expect.arrayContaining(['source1', 'video1', 1])
          }),
          expect.objectContaining({
            sql: expect.stringContaining('INSERT INTO youtube_api_results'),
            params: expect.arrayContaining(['source1', 'video2', 2])
          })
        ])
      );
    });

    test('should clear cache for source', async () => {
      mockDatabaseService.run.mockResolvedValue({ changes: 2 });

      const handler = registeredHandlers.get('database:youtube-cache:clear-cache');
      const result = await handler({}, 'source1');

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM youtube_api_results WHERE source_id = ?'),
        ['source1']
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors consistently', async () => {
      const testError = new Error('Database connection lost');
      mockDatabaseService.all.mockRejectedValue(testError);

      const handler = registeredHandlers.get('database:videos:get-by-source');
      const result = await handler({}, 'source1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection lost');
      expect(result.code).toBe('GET_VIDEOS_FAILED');
    });

    test('should handle unknown errors', async () => {
      mockDatabaseService.get.mockRejectedValue('Unknown error');

      const handler = registeredHandlers.get('database:videos:get-by-id');
      const result = await handler({}, 'video1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get video');
    });
  });
});