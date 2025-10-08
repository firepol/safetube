import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup'; // Import mocks for Electron app
import { WishlistService } from '../wishlistService';
import DatabaseService from '../DatabaseService';
import { VideoData, WishlistStatus } from '../../../shared/types';
import { BrowserWindow } from 'electron';
import { resetDatabaseSingleton, createTestDatabase } from '../../database/__tests__/testHelpers';

describe('WishlistService', () => {
  let wishlistService: WishlistService;
  let db: DatabaseService;
  let mockWindow: BrowserWindow;

  const mockVideo: VideoData = {
    id: 'test-video-1',
    title: 'Test Video',
    thumbnail: 'https://example.com/thumb.jpg',
    description: 'Test description',
    duration: 300,
    channelId: 'test-channel',
    channelName: 'Test Channel',
    url: 'https://youtube.com/watch?v=test-video-1',
    publishedAt: '2025-01-01T00:00:00Z'
  };

  beforeEach(async () => {
    // Reset singleton and create test database
    resetDatabaseSingleton();
    db = await createTestDatabase();

    // Initialize schema
    const { SimpleSchemaManager } = await import('../../database/SimpleSchemaManager');
    const schemaManager = new SimpleSchemaManager(db);
    await schemaManager.initializeSchema();

    // Create wishlist service
    wishlistService = new WishlistService(db);

    // Mock window
    mockWindow = {
      isDestroyed: () => false,
      webContents: {
        send: vi.fn()
      }
    } as any;

    wishlistService.setMainWindow(mockWindow);
  });

  describe('addToWishlist', () => {
    it('should add video to wishlist with pending status', async () => {
      const result = await wishlistService.addToWishlist(mockVideo);

      expect(result.success).toBe(true);
      expect(result.item).toBeDefined();
      expect(result.item?.video_id).toBe(mockVideo.id);
      expect(result.item?.title).toBe(mockVideo.title);
      expect(result.item?.status).toBe('pending');
      expect(result.item?.requested_at).toBeDefined();
    });

    it('should return error for duplicate video', async () => {
      // Add video first time
      await wishlistService.addToWishlist(mockVideo);

      // Try to add again
      const result = await wishlistService.addToWishlist(mockVideo);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Video already in wishlist');
    });

    it('should return error for missing required fields', async () => {
      const invalidVideo = { ...mockVideo, id: '' };
      const result = await wishlistService.addToWishlist(invalidVideo);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    it('should emit IPC event on successful add', async () => {
      await wishlistService.addToWishlist(mockVideo);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('wishlist:updated');
    });

    it('should handle null optional fields', async () => {
      const minimalVideo: VideoData = {
        id: 'minimal-video',
        title: 'Minimal Video',
        url: 'https://youtube.com/watch?v=minimal-video',
        thumbnail: '',
        description: '',
        duration: 0,
        channelId: '',
        channelName: '',
        publishedAt: ''
      };

      const result = await wishlistService.addToWishlist(minimalVideo);

      expect(result.success).toBe(true);
      expect(result.item?.video_id).toBe('minimal-video');
    });
  });

  describe('removeFromWishlist', () => {
    beforeEach(async () => {
      // Add a video to remove
      await wishlistService.addToWishlist(mockVideo);
    });

    it('should remove video from wishlist', async () => {
      const result = await wishlistService.removeFromWishlist(mockVideo.id);

      expect(result.success).toBe(true);

      // Verify it's removed
      const items = await wishlistService.getAllWishlist();
      expect(items).toHaveLength(0);
    });

    it('should return error for non-existent video', async () => {
      const result = await wishlistService.removeFromWishlist('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Video not found in wishlist');
    });

    it('should emit IPC event on successful removal', async () => {
      await wishlistService.removeFromWishlist(mockVideo.id);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('wishlist:updated');
    });
  });

  describe('getWishlistByStatus', () => {
    beforeEach(async () => {
      // Add videos with different statuses
      await wishlistService.addToWishlist(mockVideo);
      await wishlistService.addToWishlist({
        ...mockVideo,
        id: 'test-video-2',
        title: 'Test Video 2'
      });

      // Approve one
      await wishlistService.approveVideo('test-video-2');
    });

    it('should return pending videos', async () => {
      const items = await wishlistService.getWishlistByStatus('pending');

      expect(items).toHaveLength(1);
      expect(items[0].video_id).toBe(mockVideo.id);
      expect(items[0].status).toBe('pending');
    });

    it('should return approved videos', async () => {
      const items = await wishlistService.getWishlistByStatus('approved');

      expect(items).toHaveLength(1);
      expect(items[0].video_id).toBe('test-video-2');
      expect(items[0].status).toBe('approved');
    });

    it('should return empty array for denied videos', async () => {
      const items = await wishlistService.getWishlistByStatus('denied');

      expect(items).toHaveLength(0);
    });

    it('should order by requested_at DESC', async () => {
      // Add another pending video
      await wishlistService.addToWishlist({
        ...mockVideo,
        id: 'test-video-3',
        title: 'Test Video 3'
      });

      // Add a small delay to ensure timestamps are different
      await new Promise(resolve => setTimeout(resolve, 10));

      const items = await wishlistService.getWishlistByStatus('pending');

      expect(items).toHaveLength(2);
      // Most recent first
      expect(items[0].video_id).toBe('test-video-3');
      expect(items[1].video_id).toBe(mockVideo.id);
    });
  });

  describe('approveVideo', () => {
    beforeEach(async () => {
      await wishlistService.addToWishlist(mockVideo);
    });

    it('should approve video and set reviewed_at', async () => {
      const result = await wishlistService.approveVideo(mockVideo.id);

      expect(result.success).toBe(true);
      expect(result.item?.status).toBe('approved');
      expect(result.item?.reviewed_at).toBeDefined();
      expect(result.item?.reviewed_at).not.toBeNull();
    });

    it('should return error for non-existent video', async () => {
      const result = await wishlistService.approveVideo('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Video not found in wishlist');
    });

    it('should emit IPC event on approval', async () => {
      await wishlistService.approveVideo(mockVideo.id);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('wishlist:updated');
    });

    it('should allow re-approving already approved video', async () => {
      // Approve first time
      await wishlistService.approveVideo(mockVideo.id);

      // Approve again
      const result = await wishlistService.approveVideo(mockVideo.id);

      expect(result.success).toBe(true);
      expect(result.item?.status).toBe('approved');
    });
  });

  describe('denyVideo', () => {
    beforeEach(async () => {
      await wishlistService.addToWishlist(mockVideo);
    });

    it('should deny video without reason', async () => {
      const result = await wishlistService.denyVideo(mockVideo.id);

      expect(result.success).toBe(true);
      expect(result.item?.status).toBe('denied');
      expect(result.item?.reviewed_at).toBeDefined();
      expect(result.item?.denial_reason).toBeNull();
    });

    it('should deny video with reason', async () => {
      const reason = 'Inappropriate content';
      const result = await wishlistService.denyVideo(mockVideo.id, reason);

      expect(result.success).toBe(true);
      expect(result.item?.status).toBe('denied');
      expect(result.item?.denial_reason).toBe(reason);
    });

    it('should return error for non-existent video', async () => {
      const result = await wishlistService.denyVideo('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Video not found in wishlist');
    });

    it('should emit IPC event on denial', async () => {
      await wishlistService.denyVideo(mockVideo.id, 'Test reason');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('wishlist:updated');
    });
  });

  describe('updateWishlistStatus', () => {
    beforeEach(async () => {
      await wishlistService.addToWishlist(mockVideo);
    });

    it('should update status to approved', async () => {
      const result = await wishlistService.updateWishlistStatus(mockVideo.id, 'approved');

      expect(result.success).toBe(true);
      expect(result.item?.status).toBe('approved');
      expect(result.item?.reviewed_at).toBeDefined();
    });

    it('should update status to denied with reason', async () => {
      const reason = 'Not appropriate';
      const result = await wishlistService.updateWishlistStatus(mockVideo.id, 'denied', reason);

      expect(result.success).toBe(true);
      expect(result.item?.status).toBe('denied');
      expect(result.item?.denial_reason).toBe(reason);
    });

    it('should update status back to pending', async () => {
      // Approve first
      await wishlistService.approveVideo(mockVideo.id);

      // Update back to pending
      const result = await wishlistService.updateWishlistStatus(mockVideo.id, 'pending');

      expect(result.success).toBe(true);
      expect(result.item?.status).toBe('pending');
    });

    it('should return error for invalid status', async () => {
      const result = await wishlistService.updateWishlistStatus(mockVideo.id, 'invalid' as WishlistStatus);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status');
    });

    it('should return error for non-existent video', async () => {
      const result = await wishlistService.updateWishlistStatus('non-existent-id', 'approved');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Video not found in wishlist');
    });

    it('should emit IPC event on status update', async () => {
      await wishlistService.updateWishlistStatus(mockVideo.id, 'approved');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('wishlist:updated');
    });
  });

  describe('isInWishlist', () => {
    beforeEach(async () => {
      await wishlistService.addToWishlist(mockVideo);
    });

    it('should return true for video in wishlist', async () => {
      const result = await wishlistService.isInWishlist(mockVideo.id);

      expect(result.inWishlist).toBe(true);
      expect(result.status).toBe('pending');
    });

    it('should return false for video not in wishlist', async () => {
      const result = await wishlistService.isInWishlist('non-existent-id');

      expect(result.inWishlist).toBe(false);
      expect(result.status).toBeUndefined();
    });

    it('should return correct status for approved video', async () => {
      await wishlistService.approveVideo(mockVideo.id);
      const result = await wishlistService.isInWishlist(mockVideo.id);

      expect(result.inWishlist).toBe(true);
      expect(result.status).toBe('approved');
    });
  });

  describe('getWishlistCounts', () => {
    it('should return zero counts for empty wishlist', async () => {
      const counts = await wishlistService.getWishlistCounts();

      expect(counts.pending).toBe(0);
      expect(counts.approved).toBe(0);
      expect(counts.denied).toBe(0);
      expect(counts.total).toBe(0);
    });

    it('should return correct counts for mixed statuses', async () => {
      // Add 3 videos
      await wishlistService.addToWishlist(mockVideo);
      await wishlistService.addToWishlist({
        ...mockVideo,
        id: 'test-video-2',
        title: 'Test Video 2'
      });
      await wishlistService.addToWishlist({
        ...mockVideo,
        id: 'test-video-3',
        title: 'Test Video 3'
      });

      // Approve one, deny one, leave one pending
      await wishlistService.approveVideo('test-video-2');
      await wishlistService.denyVideo('test-video-3', 'Test reason');

      const counts = await wishlistService.getWishlistCounts();

      expect(counts.pending).toBe(1);
      expect(counts.approved).toBe(1);
      expect(counts.denied).toBe(1);
      expect(counts.total).toBe(3);
    });
  });

  describe('getAllWishlist', () => {
    it('should return empty array for empty wishlist', async () => {
      const items = await wishlistService.getAllWishlist();

      expect(items).toHaveLength(0);
    });

    it('should return all wishlist items', async () => {
      await wishlistService.addToWishlist(mockVideo);
      await wishlistService.addToWishlist({
        ...mockVideo,
        id: 'test-video-2',
        title: 'Test Video 2'
      });

      const items = await wishlistService.getAllWishlist();

      expect(items).toHaveLength(2);
    });

    it('should order by requested_at DESC', async () => {
      await wishlistService.addToWishlist(mockVideo);
      await wishlistService.addToWishlist({
        ...mockVideo,
        id: 'test-video-2',
        title: 'Test Video 2'
      });

      const items = await wishlistService.getAllWishlist();

      expect(items[0].video_id).toBe('test-video-2');
      expect(items[1].video_id).toBe(mockVideo.id);
    });
  });

  describe('IPC events', () => {
    it('should not emit events when window is null', async () => {
      wishlistService.setMainWindow(null);

      await wishlistService.addToWishlist(mockVideo);

      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should not emit events when window is destroyed', async () => {
      const destroyedWindow = {
        isDestroyed: () => true,
        webContents: {
          send: vi.fn()
        }
      } as any;

      wishlistService.setMainWindow(destroyedWindow);
      await wishlistService.addToWishlist(mockVideo);

      expect(destroyedWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('database transactions and consistency', () => {
    it('should use database transactions for consistency', async () => {
      // Add video
      await wishlistService.addToWishlist(mockVideo);

      // Verify item exists
      const items = await wishlistService.getAllWishlist();
      expect(items).toHaveLength(1);

      // Remove and verify
      await wishlistService.removeFromWishlist(mockVideo.id);
      const itemsAfter = await wishlistService.getAllWishlist();
      expect(itemsAfter).toHaveLength(0);
    });

    it('should maintain referential integrity', async () => {
      await wishlistService.addToWishlist(mockVideo);

      // Direct database check
      const item = await db.get(`SELECT * FROM wishlist WHERE video_id = ?`, [mockVideo.id]);
      expect(item).toBeDefined();
      expect(item.video_id).toBe(mockVideo.id);
    });
  });
});
