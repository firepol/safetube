/**
 * Integration tests for database query helpers
 * Uses in-memory SQLite database for fast, isolated testing
 */

import './setup'; // Import mocks first
import DatabaseService from '../../../services/DatabaseService';
import SimpleSchemaManager from '../../SimpleSchemaManager';
import {
  findSourceById,
  findAllSources,
  deleteSource,
  updateSourceMetadata
} from '../../queries/sourceQueries';
import {
  findVideoById,
  findVideosBySource,
  searchVideos,
  batchUpsertVideos
} from '../../queries/videoQueries';
import {
  findViewRecordByVideoId,
  upsertViewRecord,
  findWatchHistory
} from '../../queries/viewRecordQueries';
import {
  isFavorite,
  toggleFavorite,
  findAllFavorites
} from '../../queries/favoriteQueries';
import {
  saveCachedPage,
  findCachedPage,
  clearSourceCache
} from '../../queries/youtubeCacheQueries';

describe('Database Query Helpers - Integration Tests', () => {
  let db: DatabaseService;
  let schemaManager: SimpleSchemaManager;

  beforeEach(async () => {
    // Create in-memory database for each test
    db = DatabaseService.getInstance();
    await db.initialize({ path: ':memory:' });
    schemaManager = new SimpleSchemaManager(db);
    await schemaManager.initializePhase1Schema();
  });

  afterEach(async () => {
    // Cleanup
    if (db) {
      await db.close();
    }
    // Reset singleton for next test
    (DatabaseService as any).instance = null;
  });

  describe('Source Queries', () => {
    it('should create and retrieve a YouTube source', async () => {
      // Insert test source
      await db.run(`
        INSERT INTO sources (id, type, title, url, channel_id)
        VALUES (?, ?, ?, ?, ?)
      `, ['yt-channel-1', 'youtube_channel', 'Test Channel', 'https://youtube.com/@test', 'UCtest123']);

      const source = await findSourceById(db, 'yt-channel-1');

      expect(source).not.toBeNull();
      expect(source?.id).toBe('yt-channel-1');
      expect(source?.type).toBe('youtube_channel');
      expect(source?.title).toBe('Test Channel');
      expect(source?.url).toBe('https://youtube.com/@test');
      expect(source?.channel_id).toBe('UCtest123');
    });

    it('should update source metadata', async () => {
      await db.run(`
        INSERT INTO sources (id, type, title, url)
        VALUES (?, ?, ?, ?)
      `, ['yt-playlist-1', 'youtube_playlist', 'Test Playlist', 'https://youtube.com/playlist?list=PLtest']);

      await updateSourceMetadata(db, 'yt-playlist-1', 42, 'https://i.ytimg.com/thumb.jpg');

      const source = await findSourceById(db, 'yt-playlist-1');
      expect(source?.total_videos).toBe(42);
      expect(source?.thumbnail).toBe('https://i.ytimg.com/thumb.jpg');
    });

    it('should delete source and cascade to related records', async () => {
      // Create source
      await db.run(`
        INSERT INTO sources (id, type, title, url)
        VALUES (?, ?, ?, ?)
      `, ['cascade-test', 'youtube_channel', 'Cascade Test', 'https://youtube.com/@cascade']);

      // Create video
      await db.run(`
        INSERT INTO videos (id, title, source_id)
        VALUES (?, ?, ?)
      `, ['video-1', 'Video 1', 'cascade-test']);

      // Create favorite
      await db.run(`
        INSERT INTO favorites (video_id, source_id, date_added)
        VALUES (?, ?, ?)
      `, ['video-1', 'cascade-test', new Date().toISOString()]);

      // Delete source (should cascade)
      await deleteSource(db, 'cascade-test');

      // Verify cascaded deletes
      const source = await findSourceById(db, 'cascade-test');
      expect(source).toBeNull();

      const video = await findVideoById(db, 'video-1');
      expect(video).toBeNull();

      const favorite = await db.get('SELECT * FROM favorites WHERE video_id = ?', ['video-1']);
      expect(favorite).toBeFalsy(); // Can be null or undefined
    });

    it('should retrieve all sources ordered by position', async () => {
      await db.run(`INSERT INTO sources (id, type, title, url, position) VALUES (?, ?, ?, ?, ?)`,
        ['src-1', 'youtube_channel', 'Channel B', 'https://yt.com/b', 2]);
      await db.run(`INSERT INTO sources (id, type, title, url, position) VALUES (?, ?, ?, ?, ?)`,
        ['src-2', 'youtube_channel', 'Channel A', 'https://yt.com/a', 1]);
      await db.run(`INSERT INTO sources (id, type, title, url, position) VALUES (?, ?, ?, ?, ?)`,
        ['src-3', 'youtube_channel', 'Channel C', 'https://yt.com/c', 3]);

      const sources = await findAllSources(db, 'position');

      expect(sources).toHaveLength(3);
      expect(sources[0].title).toBe('Channel A');
      expect(sources[1].title).toBe('Channel B');
      expect(sources[2].title).toBe('Channel C');
    });
  });

  describe('Video Queries', () => {
    beforeEach(async () => {
      // Create test source for video tests
      await db.run(`
        INSERT INTO sources (id, type, title, url)
        VALUES (?, ?, ?, ?)
      `, ['test-source', 'youtube_channel', 'Test Source', 'https://youtube.com/@test']);
    });

    it('should batch upsert videos', async () => {
      const videos = [
        {
          id: 'vid-1',
          title: 'Video 1',
          sourceId: 'test-source',
          publishedAt: '2025-01-01T00:00:00.000Z',
          thumbnail: 'https://thumb1.jpg',
          duration: 120,
          url: 'https://youtube.com/watch?v=vid-1'
        },
        {
          id: 'vid-2',
          title: 'Video 2',
          sourceId: 'test-source',
          publishedAt: '2025-01-02T00:00:00.000Z',
          thumbnail: 'https://thumb2.jpg',
          duration: 240,
          url: 'https://youtube.com/watch?v=vid-2'
        }
      ];

      await batchUpsertVideos(db, videos);

      const allVideos = await findVideosBySource(db, 'test-source');
      expect(allVideos).toHaveLength(2);
      expect(allVideos[0].title).toBe('Video 2'); // Ordered by published_at DESC
      expect(allVideos[1].title).toBe('Video 1');
    });

    it('should search videos using full-text search', async () => {
      await db.run(`
        INSERT INTO videos (id, title, description, source_id)
        VALUES (?, ?, ?, ?)
      `, ['search-1', 'React Tutorial', 'Learn React hooks and components', 'test-source']);

      await db.run(`
        INSERT INTO videos (id, title, description, source_id)
        VALUES (?, ?, ?, ?)
      `, ['search-2', 'Vue.js Guide', 'Complete Vue.js tutorial', 'test-source']);

      await db.run(`
        INSERT INTO videos (id, title, description, source_id)
        VALUES (?, ?, ?, ?)
      `, ['search-3', 'React Advanced', 'Advanced React patterns', 'test-source']);

      const results = await searchVideos(db, 'react');

      expect(results).toHaveLength(2);
      expect(results.some(v => v.id === 'search-1')).toBe(true);
      expect(results.some(v => v.id === 'search-3')).toBe(true);
    });
  });

  describe('View Record Queries', () => {
    beforeEach(async () => {
      await db.run(`INSERT INTO sources (id, type, title, url) VALUES (?, ?, ?, ?)`,
        ['vr-source', 'youtube_channel', 'VR Source', 'https://youtube.com/@vr']);
      await db.run(`INSERT INTO videos (id, title, source_id) VALUES (?, ?, ?)`,
        ['vr-video', 'VR Video', 'vr-source']);
    });

    it('should upsert view record and preserve first_watched', async () => {
      const firstWatched = '2025-01-01T10:00:00.000Z';
      const lastWatched1 = '2025-01-01T10:05:00.000Z';
      const lastWatched2 = '2025-01-02T15:00:00.000Z';

      // First watch
      await upsertViewRecord(db, 'vr-video', 'vr-source', 30, 60, 300, false, firstWatched, lastWatched1);

      let record = await findViewRecordByVideoId(db, 'vr-video');
      expect(record?.position).toBe(30);
      expect(record?.time_watched).toBe(60);
      expect(record?.first_watched).toBe(firstWatched);
      expect(record?.last_watched).toBe(lastWatched1);

      // Second watch (should preserve first_watched)
      await upsertViewRecord(db, 'vr-video', 'vr-source', 150, 180, 300, false, firstWatched, lastWatched2);

      record = await findViewRecordByVideoId(db, 'vr-video');
      expect(record?.position).toBe(150);
      expect(record?.time_watched).toBe(180);
      expect(record?.first_watched).toBe(firstWatched); // Preserved
      expect(record?.last_watched).toBe(lastWatched2); // Updated
    });

    it('should retrieve watch history ordered by last_watched', async () => {
      await db.run(`INSERT INTO videos (id, title, source_id) VALUES (?, ?, ?)`,
        ['vid-old', 'Old Video', 'vr-source']);
      await db.run(`INSERT INTO videos (id, title, source_id) VALUES (?, ?, ?)`,
        ['vid-new', 'New Video', 'vr-source']);

      await upsertViewRecord(db, 'vid-old', 'vr-source', 0, 10, 100, false,
        '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z');
      await upsertViewRecord(db, 'vid-new', 'vr-source', 0, 20, 200, false,
        '2025-01-02T00:00:00.000Z', '2025-01-02T00:00:00.000Z');

      const history = await findWatchHistory(db, 10);

      expect(history).toHaveLength(2);
      expect(history[0].video_id).toBe('vid-new'); // Most recent first
      expect(history[1].video_id).toBe('vid-old');
    });
  });

  describe('Favorite Queries', () => {
    beforeEach(async () => {
      await db.run(`INSERT INTO sources (id, type, title, url) VALUES (?, ?, ?, ?)`,
        ['fav-source', 'youtube_channel', 'Fav Source', 'https://youtube.com/@fav']);
      await db.run(`INSERT INTO videos (id, title, source_id) VALUES (?, ?, ?)`,
        ['fav-video', 'Fav Video', 'fav-source']);
    });

    it('should toggle favorite status', async () => {
      // Initially not favorited
      expect(await isFavorite(db, 'fav-video')).toBe(false);

      // Toggle on
      const added = await toggleFavorite(db, 'fav-video', 'fav-source');
      expect(added).toBe(true);
      expect(await isFavorite(db, 'fav-video')).toBe(true);

      // Toggle off
      const removed = await toggleFavorite(db, 'fav-video', 'fav-source');
      expect(removed).toBe(false);
      expect(await isFavorite(db, 'fav-video')).toBe(false);
    });

    it('should retrieve all favorites with video metadata', async () => {
      await db.run(`INSERT INTO videos (id, title, source_id, thumbnail) VALUES (?, ?, ?, ?)`,
        ['fav-1', 'Favorite 1', 'fav-source', 'https://thumb1.jpg']);
      await db.run(`INSERT INTO videos (id, title, source_id, thumbnail) VALUES (?, ?, ?, ?)`,
        ['fav-2', 'Favorite 2', 'fav-source', 'https://thumb2.jpg']);

      await toggleFavorite(db, 'fav-1', 'fav-source');
      await toggleFavorite(db, 'fav-2', 'fav-source');

      const favorites = await findAllFavorites(db);

      expect(favorites).toHaveLength(2);
      expect(favorites[0].video_title).toBe('Favorite 2'); // Most recent first
      expect(favorites[1].video_title).toBe('Favorite 1');
      expect(favorites[0].video_thumbnail).toBe('https://thumb2.jpg');
    });
  });

  describe('YouTube Cache Queries', () => {
    beforeEach(async () => {
      await db.run(`INSERT INTO sources (id, type, title, url) VALUES (?, ?, ?, ?)`,
        ['cache-source', 'youtube_channel', 'Cache Source', 'https://youtube.com/@cache']);

      // Insert test videos
      for (let i = 1; i <= 100; i++) {
        await db.run(`INSERT INTO videos (id, title, source_id) VALUES (?, ?, ?)`,
          [`cache-vid-${i}`, `Video ${i}`, 'cache-source']);
      }
    });

    it('should save and retrieve cached page', async () => {
      const videoIds = Array.from({ length: 50 }, (_, i) => `cache-vid-${i + 1}`);

      await saveCachedPage(db, 'cache-source', 1, videoIds, 50);

      const cachedPage = await findCachedPage(db, 'cache-source', 1, 50);

      expect(cachedPage).not.toBeNull();
      expect(cachedPage.videos).toHaveLength(50);
      expect(cachedPage.pageNumber).toBe(1);
      expect(cachedPage.videos[0].id).toBe('cache-vid-1');
      expect(cachedPage.videos[49].id).toBe('cache-vid-50');
    });

    it('should handle multiple pages independently', async () => {
      const page1Ids = Array.from({ length: 50 }, (_, i) => `cache-vid-${i + 1}`);
      const page2Ids = Array.from({ length: 50 }, (_, i) => `cache-vid-${i + 51}`);

      await saveCachedPage(db, 'cache-source', 1, page1Ids, 50);
      await saveCachedPage(db, 'cache-source', 2, page2Ids, 50);

      const cachedPage1 = await findCachedPage(db, 'cache-source', 1, 50);
      const cachedPage2 = await findCachedPage(db, 'cache-source', 2, 50);

      expect(cachedPage1.videos[0].id).toBe('cache-vid-1');
      expect(cachedPage2.videos[0].id).toBe('cache-vid-51');
    });

    it('should clear all cache for a source', async () => {
      const videoIds = Array.from({ length: 50 }, (_, i) => `cache-vid-${i + 1}`);
      await saveCachedPage(db, 'cache-source', 1, videoIds, 50);

      const beforeClear = await findCachedPage(db, 'cache-source', 1, 50);
      expect(beforeClear).not.toBeNull();

      await clearSourceCache(db, 'cache-source');

      const afterClear = await findCachedPage(db, 'cache-source', 1, 50);
      expect(afterClear).toBeNull();
    });

    it('should update cache page and replace existing entries', async () => {
      const originalIds = Array.from({ length: 50 }, (_, i) => `cache-vid-${i + 1}`);
      const updatedIds = Array.from({ length: 50 }, (_, i) => `cache-vid-${i + 51}`);

      await saveCachedPage(db, 'cache-source', 1, originalIds, 50);
      await saveCachedPage(db, 'cache-source', 1, updatedIds, 50);

      const cachedPage = await findCachedPage(db, 'cache-source', 1, 50);

      expect(cachedPage.videos).toHaveLength(50);
      expect(cachedPage.videos[0].id).toBe('cache-vid-51'); // Updated
    });
  });

  describe('Foreign Key Cascade Behavior', () => {
    it('should cascade delete from source to all related tables', async () => {
      // Create source
      await db.run(`INSERT INTO sources (id, type, title, url) VALUES (?, ?, ?, ?)`,
        ['cascade-all', 'youtube_channel', 'Cascade All', 'https://yt.com/cascade']);

      // Create video
      await db.run(`INSERT INTO videos (id, title, source_id) VALUES (?, ?, ?)`,
        ['vid-cascade', 'Video Cascade', 'cascade-all']);

      // Create view record
      await upsertViewRecord(db, 'vid-cascade', 'cascade-all', 10, 20, 100, false,
        new Date().toISOString(), new Date().toISOString());

      // Create favorite
      await toggleFavorite(db, 'vid-cascade', 'cascade-all');

      // Create YouTube cache
      await saveCachedPage(db, 'cascade-all', 1, ['vid-cascade'], 50);

      // Verify all records exist
      expect(await findSourceById(db, 'cascade-all')).not.toBeNull();
      expect(await findVideoById(db, 'vid-cascade')).not.toBeNull();
      expect(await findViewRecordByVideoId(db, 'vid-cascade')).not.toBeNull();
      expect(await isFavorite(db, 'vid-cascade')).toBe(true);
      expect(await findCachedPage(db, 'cascade-all', 1, 50)).not.toBeNull();

      // Delete source
      await deleteSource(db, 'cascade-all');

      // Verify all related records are deleted
      expect(await findSourceById(db, 'cascade-all')).toBeNull();
      expect(await findVideoById(db, 'vid-cascade')).toBeNull();
      expect(await findViewRecordByVideoId(db, 'vid-cascade')).toBeNull();
      expect(await isFavorite(db, 'vid-cascade')).toBe(false);
      expect(await findCachedPage(db, 'cascade-all', 1, 50)).toBeNull();
    });
  });
});
