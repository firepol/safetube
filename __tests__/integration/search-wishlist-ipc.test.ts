/**
 * Integration tests for Search and Wishlist IPC handlers
 * Tests end-to-end IPC communication between main and renderer processes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ipcMain } from 'electron';
import DatabaseService from '../../src/main/services/DatabaseService';
import { registerSearchHandlers } from '../../src/main/ipc/searchHandlers';
import { registerWishlistHandlers } from '../../src/main/ipc/wishlistHandlers';
import { IPC } from '../../src/shared/ipc-channels';
import { VideoData, WishlistStatus } from '../../src/shared/types';

describe('Search and Wishlist IPC Handlers Integration', () => {
  let db: DatabaseService;

  beforeAll(async () => {
    // Initialize in-memory database
    db = DatabaseService.getInstance(':memory:');
    await db.initialize();

    // Register IPC handlers
    registerSearchHandlers();
    registerWishlistHandlers(null); // No main window in tests
  });

  afterAll(async () => {
    // Clean up
    await db.close();
  });

  beforeEach(async () => {
    // Clear test data between tests
    await db.run('DELETE FROM searches');
    await db.run('DELETE FROM wishlist');
    await db.run('DELETE FROM search_results_cache');
    await db.run('DELETE FROM videos');
  });

  describe('Search IPC Handlers', () => {
    beforeEach(async () => {
      // Insert test videos for database search
      await db.run(`
        INSERT INTO videos (id, title, description, thumbnail, duration, source_id, url, published_at)
        VALUES
          ('video1', 'Test Video 1', 'Description for test video 1', 'thumb1.jpg', 120, 'source1', 'url1', '2024-01-01'),
          ('video2', 'Test Video 2', 'Description for test video 2', 'thumb2.jpg', 240, 'source1', 'url2', '2024-01-02'),
          ('video3', 'Another Video', 'Different description', 'thumb3.jpg', 180, 'source2', 'url3', '2024-01-03')
      `);
    });

    it('should search database and return results', async () => {
      // Simulate IPC call
      const handler = ipcMain._events[IPC.SEARCH.DATABASE];
      expect(handler).toBeDefined();

      const result = await handler({}, 'Test');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('title');
    });

    it('should record search in history', async () => {
      const handler = ipcMain._events[IPC.SEARCH.DATABASE];
      await handler({}, 'Test Query');

      // Check search was recorded
      const searches = await db.all('SELECT * FROM searches');
      expect(searches.length).toBe(1);
      expect(searches[0].query).toBe('Test Query');
      expect(searches[0].search_type).toBe('database');
    });

    it('should return empty array for no results', async () => {
      const handler = ipcMain._events[IPC.SEARCH.DATABASE];
      const result = await handler({}, 'NonexistentQuery12345');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should get search history', async () => {
      // Add some search history
      await db.run(`
        INSERT INTO searches (query, search_type, result_count, timestamp)
        VALUES
          ('query1', 'database', 5, datetime('now')),
          ('query2', 'youtube', 10, datetime('now'))
      `);

      const handler = ipcMain._events[IPC.SEARCH.HISTORY_GET];
      const result = await handler({}, 100);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.length).toBe(2);
      expect(result.data[0]).toHaveProperty('query');
      expect(result.data[0]).toHaveProperty('search_type');
    });
  });

  describe('Wishlist IPC Handlers', () => {
    const testVideo: VideoData = {
      id: 'test_video_1',
      title: 'Test Video',
      thumbnail: 'https://example.com/thumb.jpg',
      description: 'Test description',
      duration: 300,
      channelId: 'channel123',
      channelName: 'Test Channel',
      url: 'https://youtube.com/watch?v=test_video_1',
      publishedAt: '2024-01-01'
    };

    it('should add video to wishlist', async () => {
      const handler = ipcMain._events[IPC.WISHLIST.ADD];
      const result = await handler({}, testVideo);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.video_id).toBe(testVideo.id);
      expect(result.data.status).toBe('pending');
    });

    it('should prevent duplicate wishlist entries', async () => {
      const handler = ipcMain._events[IPC.WISHLIST.ADD];

      // Add first time
      const result1 = await handler({}, testVideo);
      expect(result1.success).toBe(true);

      // Try to add again
      const result2 = await handler({}, testVideo);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('already in wishlist');
    });

    it('should remove video from wishlist', async () => {
      const addHandler = ipcMain._events[IPC.WISHLIST.ADD];
      const removeHandler = ipcMain._events[IPC.WISHLIST.REMOVE];

      // Add video first
      await addHandler({}, testVideo);

      // Remove video
      const result = await removeHandler({}, testVideo.id);

      expect(result.success).toBe(true);

      // Verify removed
      const wishlist = await db.all('SELECT * FROM wishlist WHERE video_id = ?', [testVideo.id]);
      expect(wishlist.length).toBe(0);
    });

    it('should get wishlist by status', async () => {
      const addHandler = ipcMain._events[IPC.WISHLIST.ADD];
      const getHandler = ipcMain._events[IPC.WISHLIST.GET_BY_STATUS];

      // Add multiple videos
      await addHandler({}, testVideo);
      await addHandler({}, { ...testVideo, id: 'video2', title: 'Video 2' });

      const result = await getHandler({}, 'pending');

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(2);
      expect(result.data[0].status).toBe('pending');
    });

    it('should approve video', async () => {
      const addHandler = ipcMain._events[IPC.WISHLIST.ADD];
      const approveHandler = ipcMain._events[IPC.WISHLIST.APPROVE];

      // Add video
      await addHandler({}, testVideo);

      // Approve video
      const result = await approveHandler({}, testVideo.id);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('approved');
      expect(result.data.reviewed_at).toBeDefined();
    });

    it('should deny video with reason', async () => {
      const addHandler = ipcMain._events[IPC.WISHLIST.ADD];
      const denyHandler = ipcMain._events[IPC.WISHLIST.DENY];

      // Add video
      await addHandler({}, testVideo);

      // Deny video with reason
      const denialReason = 'Not appropriate for kids';
      const result = await denyHandler({}, testVideo.id, denialReason);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('denied');
      expect(result.data.denial_reason).toBe(denialReason);
      expect(result.data.reviewed_at).toBeDefined();
    });

    it('should return error when approving non-existent video', async () => {
      const approveHandler = ipcMain._events[IPC.WISHLIST.APPROVE];
      const result = await approveHandler({}, 'nonexistent_video');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle status transitions correctly', async () => {
      const addHandler = ipcMain._events[IPC.WISHLIST.ADD];
      const approveHandler = ipcMain._events[IPC.WISHLIST.APPROVE];
      const getHandler = ipcMain._events[IPC.WISHLIST.GET_BY_STATUS];

      // Add video (pending)
      await addHandler({}, testVideo);

      // Approve video
      await approveHandler({}, testVideo.id);

      // Check pending list is empty
      const pendingResult = await getHandler({}, 'pending');
      expect(pendingResult.data.length).toBe(0);

      // Check approved list has the video
      const approvedResult = await getHandler({}, 'approved');
      expect(approvedResult.data.length).toBe(1);
      expect(approvedResult.data[0].video_id).toBe(testVideo.id);
    });
  });

  describe('Integration: Search and Wishlist Workflow', () => {
    it('should allow searching and adding result to wishlist', async () => {
      // Insert test video
      await db.run(`
        INSERT INTO videos (id, title, description, thumbnail, duration, source_id, url, published_at)
        VALUES ('search_result', 'Searchable Video', 'Description', 'thumb.jpg', 120, 'source1', 'url1', '2024-01-01')
      `);

      // Search for video
      const searchHandler = ipcMain._events[IPC.SEARCH.DATABASE];
      const searchResult = await searchHandler({}, 'Searchable');

      expect(searchResult.success).toBe(true);
      expect(searchResult.data.length).toBeGreaterThan(0);

      // Add search result to wishlist
      const addHandler = ipcMain._events[IPC.WISHLIST.ADD];
      const videoToAdd: VideoData = {
        id: searchResult.data[0].id,
        title: searchResult.data[0].title,
        thumbnail: searchResult.data[0].thumbnail,
        description: searchResult.data[0].description,
        duration: searchResult.data[0].duration,
        channelId: searchResult.data[0].channelId || '',
        channelName: searchResult.data[0].channelName || '',
        url: searchResult.data[0].url,
        publishedAt: searchResult.data[0].publishedAt
      };

      const addResult = await addHandler({}, videoToAdd);

      expect(addResult.success).toBe(true);
      expect(addResult.data.video_id).toBe('search_result');
    });
  });
});
