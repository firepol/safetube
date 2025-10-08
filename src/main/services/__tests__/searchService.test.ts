import './setup'; // Import mocks first
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDatabase, resetDatabaseSingleton } from '../../database/__tests__/testHelpers';
import DatabaseService from '../DatabaseService';
import { SimpleSchemaManager } from '../../database/SimpleSchemaManager';
import SearchService from '../searchService';
import { YouTubeAPI } from '../../youtube-api';

// Mock YouTubeAPI
vi.mock('../../youtube-api', () => ({
  YouTubeAPI: vi.fn().mockImplementation(() => ({
    searchVideos: vi.fn()
  }))
}));

describe('SearchService', () => {
  let db: DatabaseService;
  let searchService: SearchService;

  beforeEach(async () => {
    resetDatabaseSingleton();
    db = await createTestDatabase();

    // Initialize schema with search tables
    const schemaManager = new SimpleSchemaManager(db);
    await schemaManager.initializeSchema();

    searchService = new SearchService(db);

    // Insert test data
    await db.run(`
      INSERT INTO sources (id, type, title, url, channel_id)
      VALUES ('test_source', 'youtube_channel', 'Test Channel', 'https://youtube.com', 'UC123')
    `);

    await db.run(`
      INSERT INTO videos (id, title, description, source_id, duration, thumbnail, url, published_at)
      VALUES
        ('video1', 'Introduction to TypeScript', 'Learn TypeScript basics', 'test_source', 600, 'thumb1.jpg', 'https://youtube.com/watch?v=1', '2024-01-01'),
        ('video2', 'Advanced TypeScript Patterns', 'Master advanced TypeScript', 'test_source', 1200, 'thumb2.jpg', 'https://youtube.com/watch?v=2', '2024-01-02'),
        ('video3', 'JavaScript Fundamentals', 'Learn JavaScript from scratch', 'test_source', 800, 'thumb3.jpg', 'https://youtube.com/watch?v=3', '2024-01-03'),
        ('video4', 'React Tutorial', 'Build React applications', 'test_source', 900, 'thumb4.jpg', 'https://youtube.com/watch?v=4', '2024-01-04')
    `);
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('searchDatabase', () => {
    it('should find videos by title', async () => {
      const results = await searchService.searchDatabase('TypeScript');

      expect(results).toHaveLength(2);
      expect(results[0].title).toContain('TypeScript');
      expect(results[1].title).toContain('TypeScript');
    });

    it('should find videos by description', async () => {
      const results = await searchService.searchDatabase('Learn');

      expect(results.length).toBeGreaterThan(0);
      const hasRelevantResults = results.some(r =>
        r.title.includes('Learn') || r.description.includes('Learn')
      );
      expect(hasRelevantResults).toBe(true);
    });

    it('should return results with correct structure', async () => {
      const results = await searchService.searchDatabase('TypeScript');

      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('thumbnail');
      expect(results[0]).toHaveProperty('description');
      expect(results[0]).toHaveProperty('duration');
      expect(results[0]).toHaveProperty('channelId');
      expect(results[0]).toHaveProperty('channelName');
      expect(results[0]).toHaveProperty('url');
      expect(results[0]).toHaveProperty('publishedAt');
      expect(results[0]).toHaveProperty('isApprovedSource');
      expect(results[0].isApprovedSource).toBe(true);
    });

    it('should return empty array for no matches', async () => {
      const results = await searchService.searchDatabase('NonexistentTopic');

      expect(results).toHaveLength(0);
    });

    it('should handle empty query', async () => {
      const results = await searchService.searchDatabase('');

      expect(results).toHaveLength(0);
    });

    it('should escape FTS5 special characters', async () => {
      // Should not throw error with special characters
      const results = await searchService.searchDatabase('Type*Script"');

      // Should still find TypeScript videos
      expect(Array.isArray(results)).toBe(true);
    });

    it('should limit results to 50', async () => {
      // Insert 60 videos
      for (let i = 5; i <= 64; i++) {
        await db.run(`
          INSERT INTO videos (id, title, description, source_id, duration, thumbnail, url)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [`video${i}`, `Test Video ${i}`, 'Common description for all', 'test_source', 600, 'thumb.jpg', `https://youtube.com/watch?v=${i}`]);
      }

      const results = await searchService.searchDatabase('Common');

      expect(results.length).toBeLessThanOrEqual(50);
    });

    it('should record search in history', async () => {
      await searchService.searchDatabase('TypeScript');

      const history = await db.all(`SELECT * FROM searches ORDER BY timestamp DESC LIMIT 1`);

      expect(history).toHaveLength(1);
      expect(history[0].query).toBe('TypeScript');
      expect(history[0].search_type).toBe('database');
      expect(history[0].result_count).toBe(2);
    });

    it('should handle database errors gracefully', async () => {
      // Close the database to force an error
      await db.close();

      await expect(searchService.searchDatabase('test')).rejects.toThrow('Database search failed');
    });
  });

  describe('getSearchHistory', () => {
    beforeEach(async () => {
      // Manually insert search history with explicit timestamps to control ordering
      await db.run(`
        INSERT INTO searches (query, search_type, result_count, timestamp)
        VALUES
          ('TypeScript', 'database', 2, datetime('now', '-2 seconds')),
          ('JavaScript', 'database', 1, datetime('now', '-1 second')),
          ('React', 'database', 1, datetime('now'))
      `);
    });

    it('should return search history in reverse chronological order', async () => {
      const history = await searchService.getSearchHistory();

      expect(history).toHaveLength(3);
      expect(history[0].query).toBe('React');
      expect(history[1].query).toBe('JavaScript');
      expect(history[2].query).toBe('TypeScript');
    });

    it('should limit results to specified count', async () => {
      const history = await searchService.getSearchHistory(2);

      expect(history).toHaveLength(2);
    });

    it('should return empty array when no history', async () => {
      // Clear all history
      await db.run('DELETE FROM searches');

      const history = await searchService.getSearchHistory();

      expect(history).toHaveLength(0);
    });
  });

  describe('clearOldSearchHistory', () => {
    beforeEach(async () => {
      // Insert old searches
      await db.run(`
        INSERT INTO searches (query, search_type, result_count, timestamp)
        VALUES
          ('Old Search 1', 'database', 5, datetime('now', '-100 days')),
          ('Old Search 2', 'database', 3, datetime('now', '-95 days')),
          ('Recent Search', 'database', 2, datetime('now', '-10 days'))
      `);
    });

    it('should delete searches older than specified days', async () => {
      const deletedCount = await searchService.clearOldSearchHistory(90);

      expect(deletedCount).toBe(2);

      const remaining = await db.all('SELECT * FROM searches');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].query).toBe('Recent Search');
    });

    it('should not delete recent searches', async () => {
      const deletedCount = await searchService.clearOldSearchHistory(30);

      expect(deletedCount).toBe(2);

      const remaining = await db.all('SELECT * FROM searches');
      expect(remaining).toHaveLength(1);
    });

    it('should return 0 when no old searches', async () => {
      await db.run('DELETE FROM searches WHERE timestamp < datetime("now", "-50 days")');

      const deletedCount = await searchService.clearOldSearchHistory(90);

      expect(deletedCount).toBe(0);
    });
  });

  describe('searchYouTube', () => {
    beforeEach(async () => {
      // Set up YouTube API key in settings
      await db.run(`
        INSERT INTO settings (key, value, type)
        VALUES ('main.youtubeApiKey', '"test-api-key"', 'string')
      `);
    });

    it('should return cached results if available and not expired', async () => {
      const query = 'test query';
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Insert cached results
      await db.run(`
        INSERT INTO search_results_cache (
          search_query, video_id, video_data, position,
          search_type, fetch_timestamp, expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        query,
        'cached-video-1',
        JSON.stringify({
          id: 'cached-video-1',
          title: 'Cached Video',
          thumbnail: 'thumb.jpg',
          description: 'Cached description',
          duration: 300,
          channelId: 'channel1',
          channelName: 'Test Channel',
          url: 'https://youtube.com/watch?v=cached-video-1',
          publishedAt: '2024-01-01'
        }),
        0,
        'youtube',
        new Date().toISOString(),
        futureDate
      ]);

      const results = await searchService.searchYouTube(query);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('cached-video-1');
      expect(results[0].title).toBe('Cached Video');
      expect(results[0].isApprovedSource).toBe(false);
    });

    it('should call YouTube API if cache is expired', async () => {
      const query = 'test query';
      const pastDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

      // Insert expired cached results
      await db.run(`
        INSERT INTO search_results_cache (
          search_query, video_id, video_data, position,
          search_type, fetch_timestamp, expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        query,
        'expired-video',
        JSON.stringify({
          id: 'expired-video',
          title: 'Expired Video',
          thumbnail: 'thumb.jpg',
          description: 'Expired description',
          duration: 300,
          channelId: 'channel1',
          channelName: 'Test Channel',
          url: 'https://youtube.com/watch?v=expired-video',
          publishedAt: '2024-01-01'
        }),
        0,
        'youtube',
        pastDate,
        pastDate
      ]);

      // Mock YouTube API response
      const mockVideos = [
        {
          id: 'new-video-1',
          title: 'New Video',
          thumbnail: 'thumb.jpg',
          description: 'New description',
          duration: 300,
          channelId: 'channel1',
          channelTitle: 'Test Channel',
          url: 'https://youtube.com/watch?v=new-video-1',
          publishedAt: '2024-01-01'
        }
      ];

      const mockYoutubeApi = new YouTubeAPI('test-key');
      vi.mocked(mockYoutubeApi.searchVideos).mockResolvedValue(mockVideos);
      (searchService as any).youtubeApi = mockYoutubeApi;

      const results = await searchService.searchYouTube(query);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('new-video-1');
      expect(results[0].title).toBe('New Video');
      expect(mockYoutubeApi.searchVideos).toHaveBeenCalledWith(query, 50);
    });

    it('should cache YouTube API results for 24 hours', async () => {
      const query = 'test query';

      // Mock YouTube API response
      const mockVideos = [
        {
          id: 'video-1',
          title: 'Test Video',
          thumbnail: 'thumb.jpg',
          description: 'Test description',
          duration: 300,
          channelId: 'channel1',
          channelTitle: 'Test Channel',
          url: 'https://youtube.com/watch?v=video-1',
          publishedAt: '2024-01-01'
        }
      ];

      const mockYoutubeApi = new YouTubeAPI('test-key');
      vi.mocked(mockYoutubeApi.searchVideos).mockResolvedValue(mockVideos);
      (searchService as any).youtubeApi = mockYoutubeApi;

      await searchService.searchYouTube(query);

      // Verify cache entry
      const cached = await db.all(`
        SELECT * FROM search_results_cache
        WHERE search_query = ? AND search_type = 'youtube'
      `, [query]);

      expect(cached).toHaveLength(1);
      expect(cached[0].video_id).toBe('video-1');

      const videoData = JSON.parse(cached[0].video_data);
      expect(videoData.title).toBe('Test Video');

      // Verify expires_at is ~24 hours from now
      const expiresAt = new Date(cached[0].expires_at).getTime();
      const expectedExpiry = Date.now() + 24 * 60 * 60 * 1000;
      expect(expiresAt).toBeGreaterThan(expectedExpiry - 60000); // Within 1 minute
      expect(expiresAt).toBeLessThan(expectedExpiry + 60000);
    });

    it('should record YouTube search in history', async () => {
      const query = 'test query';

      // Mock YouTube API response
      const mockVideos = [
        {
          id: 'video-1',
          title: 'Test Video',
          thumbnail: 'thumb.jpg',
          description: 'Test description',
          duration: 300,
          channelId: 'channel1',
          channelTitle: 'Test Channel',
          url: 'https://youtube.com/watch?v=video-1',
          publishedAt: '2024-01-01'
        }
      ];

      const mockYoutubeApi = new YouTubeAPI('test-key');
      vi.mocked(mockYoutubeApi.searchVideos).mockResolvedValue(mockVideos);
      (searchService as any).youtubeApi = mockYoutubeApi;

      await searchService.searchYouTube(query);

      const history = await db.all(`
        SELECT * FROM searches
        WHERE query = ? AND search_type = 'youtube'
      `, [query]);

      expect(history).toHaveLength(1);
      expect(history[0].result_count).toBe(1);
    });

    it('should return empty array for empty query', async () => {
      const results = await searchService.searchYouTube('');

      expect(results).toHaveLength(0);
    });

    it('should handle YouTube API errors gracefully', async () => {
      const query = 'test query';

      const mockYoutubeApi = new YouTubeAPI('test-key');
      vi.mocked(mockYoutubeApi.searchVideos).mockRejectedValue(new Error('API Error'));
      (searchService as any).youtubeApi = mockYoutubeApi;

      await expect(searchService.searchYouTube(query)).rejects.toThrow('YouTube search failed');
    });

    it('should handle quota exceeded error', async () => {
      const query = 'test query';

      const mockYoutubeApi = new YouTubeAPI('test-key');
      vi.mocked(mockYoutubeApi.searchVideos).mockRejectedValue(new Error('quotaExceeded'));
      (searchService as any).youtubeApi = mockYoutubeApi;

      await expect(searchService.searchYouTube(query)).rejects.toThrow('YouTube API quota exceeded');
    });

    it('should throw error if YouTube API key not configured', async () => {
      // Remove API key from settings
      await db.run('DELETE FROM settings WHERE key = ?', ['main.youtubeApiKey']);

      await expect(searchService.searchYouTube('test')).rejects.toThrow('YouTube search is not available');
    });

    it('should enforce max 50 results', async () => {
      const query = 'test query';

      // Mock YouTube API to return 50 videos
      const mockVideos = Array.from({ length: 50 }, (_, i) => ({
        id: `video-${i}`,
        title: `Test Video ${i}`,
        thumbnail: 'thumb.jpg',
        description: 'Test description',
        duration: 300,
        channelId: 'channel1',
        channelTitle: 'Test Channel',
        url: `https://youtube.com/watch?v=video-${i}`,
        publishedAt: '2024-01-01'
      }));

      const mockYoutubeApi = new YouTubeAPI('test-key');
      vi.mocked(mockYoutubeApi.searchVideos).mockResolvedValue(mockVideos);
      (searchService as any).youtubeApi = mockYoutubeApi;

      const results = await searchService.searchYouTube(query);

      expect(results).toHaveLength(50);
      expect(mockYoutubeApi.searchVideos).toHaveBeenCalledWith(query, 50);
    });

    it('should mark all YouTube results as not from approved sources', async () => {
      const query = 'test query';

      const mockVideos = [
        {
          id: 'video-1',
          title: 'Test Video',
          thumbnail: 'thumb.jpg',
          description: 'Test description',
          duration: 300,
          channelId: 'channel1',
          channelTitle: 'Test Channel',
          url: 'https://youtube.com/watch?v=video-1',
          publishedAt: '2024-01-01'
        }
      ];

      const mockYoutubeApi = new YouTubeAPI('test-key');
      vi.mocked(mockYoutubeApi.searchVideos).mockResolvedValue(mockVideos);
      (searchService as any).youtubeApi = mockYoutubeApi;

      const results = await searchService.searchYouTube(query);

      expect(results[0].isApprovedSource).toBe(false);
    });
  });

  describe('clearExpiredCache', () => {
    beforeEach(async () => {
      const pastDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Insert expired cache entries
      await db.run(`
        INSERT INTO search_results_cache (
          search_query, video_id, video_data, position,
          search_type, fetch_timestamp, expires_at
        )
        VALUES
          ('query1', 'expired1', '{}', 0, 'youtube', ?, ?),
          ('query2', 'expired2', '{}', 0, 'youtube', ?, ?),
          ('query3', 'valid1', '{}', 0, 'youtube', ?, ?)
      `, [pastDate, pastDate, pastDate, pastDate, futureDate, futureDate]);
    });

    it('should delete expired cache entries', async () => {
      const deletedCount = await searchService.clearExpiredCache();

      expect(deletedCount).toBe(2);

      const remaining = await db.all('SELECT * FROM search_results_cache');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].video_id).toBe('valid1');
    });

    it('should return 0 when no expired entries', async () => {
      // Clear all expired entries first
      await db.run(`DELETE FROM search_results_cache WHERE expires_at < datetime('now')`);

      const deletedCount = await searchService.clearExpiredCache();

      expect(deletedCount).toBe(0);
    });
  });
});
