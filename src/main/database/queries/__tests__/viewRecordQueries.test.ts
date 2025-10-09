import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DatabaseService from '../../../services/DatabaseService';
import { SimpleSchemaManager } from '../../SimpleSchemaManager';
import { resetDatabaseSingleton, createTestDatabase, cleanupTestDatabase } from '../../__tests__/testHelpers';
import { findLastWatchedVideo, upsertViewRecord } from '../viewRecordQueries';

// Mock Electron app for testing
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((type: string) => {
      if (type === 'userData') {
        return '/tmp/claude/test-userdata';
      }
      return '/tmp/claude';
    })
  }
}));

describe('viewRecordQueries', () => {
  let dbService: DatabaseService;
  let schemaManager: SimpleSchemaManager;

  beforeEach(async () => {
    // Reset singleton to ensure test isolation
    resetDatabaseSingleton();

    // Initialize in-memory database for faster tests
    dbService = await createTestDatabase({ useMemory: true });
    schemaManager = new SimpleSchemaManager(dbService);
    await schemaManager.initializeSchema();

    // Insert test source (youtube sources require url to pass CHECK constraint)
    await dbService.run(`
      INSERT INTO sources (id, type, title, sort_preference, position, url, channel_id)
      VALUES ('test_source', 'youtube_channel', 'Test Channel', 'newestFirst', 1, 'https://youtube.com/channel/UCtest', 'UCtest')
    `);
  });

  afterEach(async () => {
    await cleanupTestDatabase(dbService);
  });

  describe('findLastWatchedVideo', () => {
    it('should return null when no view records exist', async () => {
      const result = await findLastWatchedVideo(dbService);
      expect(result).toBeNull();
    });

    it('should return the most recently watched video', async () => {
      // Insert test videos
      await dbService.run(`
        INSERT INTO videos (id, source_id, title, url, duration, created_at)
        VALUES
          ('video1', 'test_source', 'Video 1', 'https://test.com/1', 300, datetime('now')),
          ('video2', 'test_source', 'Video 2', 'https://test.com/2', 400, datetime('now')),
          ('video3', 'test_source', 'Video 3', 'https://test.com/3', 500, datetime('now'))
      `);

      // Insert view records with different timestamps
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();

      await upsertViewRecord(dbService, 'video1', 'test_source', 100, 150, 300, false, threeHoursAgo, threeHoursAgo);
      await upsertViewRecord(dbService, 'video2', 'test_source', 200, 250, 400, false, twoHoursAgo, twoHoursAgo);
      await upsertViewRecord(dbService, 'video3', 'test_source', 300, 350, 500, false, oneHourAgo, oneHourAgo);

      // Get the last watched video
      const result = await findLastWatchedVideo(dbService);

      expect(result).toBeDefined();
      expect(result?.videoId).toBe('video3');
      expect(result?.title).toBe('Video 3');
      expect(result?.source).toBe('test_source');
      expect(result?.position).toBe(300);
      expect(result?.timeWatched).toBe(350);
    });

    it('should return correct data when only one video has been watched', async () => {
      // Insert test video
      await dbService.run(`
        INSERT INTO videos (id, source_id, title, url, duration, thumbnail, created_at)
        VALUES ('single_video', 'test_source', 'Single Video', 'https://test.com/single', 600, 'thumb.jpg', datetime('now'))
      `);

      // Insert view record
      const now = new Date().toISOString();
      await upsertViewRecord(dbService, 'single_video', 'test_source', 450, 500, 600, false, now, now);

      // Get the last watched video
      const result = await findLastWatchedVideo(dbService);

      expect(result).toBeDefined();
      expect(result?.videoId).toBe('single_video');
      expect(result?.title).toBe('Single Video');
      expect(result?.thumbnail).toBe('thumb.jpg');
      expect(result?.duration).toBe(600);
      expect(result?.position).toBe(450);
      expect(result?.timeWatched).toBe(500);
      expect(result?.source).toBe('test_source');
    });

    it('should work correctly when video has minimal metadata', async () => {
      // Insert video with minimal required fields (empty strings for title and thumbnail)
      await dbService.run(`
        INSERT INTO videos (id, source_id, title, url, duration, created_at)
        VALUES ('minimal_video', 'test_source', '', 'https://test.com/minimal', 300, datetime('now'))
      `);

      // Insert view record
      const now = new Date().toISOString();
      await upsertViewRecord(dbService, 'minimal_video', 'test_source', 100, 150, 300, false, now, now);

      // Get the last watched video
      const result = await findLastWatchedVideo(dbService);

      expect(result).toBeDefined();
      expect(result?.videoId).toBe('minimal_video');
      expect(result?.title).toBe(''); // Empty title
      expect(result?.thumbnail).toBeNull(); // No thumbnail was provided
      expect(result?.position).toBe(100);
      expect(result?.timeWatched).toBe(150);
      expect(result?.source).toBe('test_source');
    });
  });
});
