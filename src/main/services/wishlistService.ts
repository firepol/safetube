import DatabaseService from './DatabaseService';
import log from '../logger';
import { WishlistItem, WishlistStatus, VideoData } from '../../shared/types';
import { BrowserWindow } from 'electron';
import {
  addToWishlist,
  removeFromWishlist,
  getWishlistByStatus,
  updateWishlistStatus,
  isVideoInWishlist,
  getWishlistCounts,
  findWishlistVideo
} from '../database/queries/wishlistQueries';

/**
 * Wishlist service for managing video approval workflow
 */
export class WishlistService {
  private db: DatabaseService;
  private mainWindow: BrowserWindow | null = null;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Set main window for IPC event emission
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * Emit IPC event to notify renderer of wishlist updates
   */
  private emitWishlistUpdate(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('wishlist:updated');
      log.debug('[WishlistService] Emitted wishlist:updated event');
    }
  }

  /**
   * Add video to wishlist with pending status
   * Returns error if video already exists in wishlist
   */
  async addToWishlist(video: VideoData): Promise<{ success: boolean; error?: string; item?: WishlistItem }> {
    try {
      log.info(`[WishlistService] Adding video to wishlist: ${video.id}`);

      // Validate required fields
      if (!video.id || !video.title || !video.url) {
        const error = 'Missing required fields: id, title, and url are required';
        log.warn(`[WishlistService] ${error}`);
        return { success: false, error };
      }

      const now = new Date().toISOString();

      // Insert into wishlist with pending status
      await addToWishlist(this.db, {
        video_id: video.id,
        title: video.title,
        thumbnail: video.thumbnail,
        description: video.description,
        channel_id: video.channelId,
        channel_name: video.channelName,
        duration: video.duration,
        url: video.url
      });

      log.info(`[WishlistService] Successfully added video to wishlist: ${video.id}`);

      // Fetch the created item
      const item = await findWishlistVideo(this.db, video.id) as WishlistItem;

      // Emit update event
      this.emitWishlistUpdate();

      return { success: true, item: item || undefined };
    } catch (error: any) {
      // Handle duplicate video_id constraint violation
      if (error.code === 'SQLITE_CONSTRAINT' || error.message?.includes('UNIQUE constraint failed')) {
        const errorMsg = 'Video already in wishlist';
        log.info(`[WishlistService] ${errorMsg}: ${video.id}`);
        return { success: false, error: errorMsg };
      }

      log.error('[WishlistService] Error adding to wishlist:', error);
      return {
        success: false,
        error: `Failed to add to wishlist: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Remove video from wishlist
   */
  async removeFromWishlist(videoId: string): Promise<{ success: boolean; error?: string }> {
    try {
      log.info(`[WishlistService] Removing video from wishlist: ${videoId}`);

      // Check if video exists first
      const exists = await isVideoInWishlist(this.db, videoId);
      if (!exists) {
        const error = 'Video not found in wishlist';
        log.warn(`[WishlistService] ${error}: ${videoId}`);
        return { success: false, error };
      }

      await removeFromWishlist(this.db, videoId);

      log.info(`[WishlistService] Successfully removed video from wishlist: ${videoId}`);

      // Emit update event
      this.emitWishlistUpdate();

      return { success: true };
    } catch (error) {
      log.error('[WishlistService] Error removing from wishlist:', error);
      return {
        success: false,
        error: `Failed to remove from wishlist: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get wishlist items by status
   */
  async getWishlistByStatus(status: WishlistStatus): Promise<WishlistItem[]> {
    try {
      log.debug(`[WishlistService] Fetching wishlist with status: ${status}`);

      const items = await getWishlistByStatus(this.db, status) as WishlistItem[];

      log.debug(`[WishlistService] Found ${items.length} items with status: ${status}`);

      return items;
    } catch (error) {
      log.error('[WishlistService] Error getting wishlist by status:', error);
      throw new Error(`Failed to get wishlist: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all wishlist items
   */
  async getAllWishlist(): Promise<WishlistItem[]> {
    try {
      log.debug('[WishlistService] Fetching all wishlist items');

      const items = await this.db.all<WishlistItem>(`
        SELECT * FROM wishlist
        ORDER BY requested_at DESC
      `);

      log.debug(`[WishlistService] Found ${items.length} total wishlist items`);

      return items;
    } catch (error) {
      log.error('[WishlistService] Error getting all wishlist items:', error);
      throw new Error(`Failed to get wishlist: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Approve a video in the wishlist
   */
  async approveVideo(videoId: string): Promise<{ success: boolean; error?: string; item?: WishlistItem }> {
    try {
      log.info(`[WishlistService] Approving video: ${videoId}`);

      // Validate status transition
      const current = await findWishlistVideo(this.db, videoId) as WishlistItem;

      if (!current) {
        const error = 'Video not found in wishlist';
        log.warn(`[WishlistService] ${error}: ${videoId}`);
        return { success: false, error };
      }

      const now = new Date().toISOString();

      // Update status to approved
      const result = await this.db.run(`
        UPDATE wishlist
        SET status = 'approved',
            reviewed_at = ?,
            updated_at = ?
        WHERE video_id = ?
      `, [now, now, videoId]);

      if (result.changes === 0) {
        const error = 'Failed to update video status';
        log.error(`[WishlistService] ${error}: ${videoId}`);
        return { success: false, error };
      }

      log.info(`[WishlistService] Successfully approved video: ${videoId}`);

      // Fetch updated item
      const item = await findWishlistVideo(this.db, videoId) as WishlistItem;

      // Emit update event
      this.emitWishlistUpdate();

      return { success: true, item: item || undefined };
    } catch (error) {
      log.error('[WishlistService] Error approving video:', error);
      return {
        success: false,
        error: `Failed to approve video: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Deny a video in the wishlist with optional reason
   */
  async denyVideo(videoId: string, reason?: string): Promise<{ success: boolean; error?: string; item?: WishlistItem }> {
    try {
      log.info(`[WishlistService] Denying video: ${videoId}${reason ? ` (reason: ${reason})` : ''}`);

      // Validate status transition
      const current = await findWishlistVideo(this.db, videoId) as WishlistItem;

      if (!current) {
        const error = 'Video not found in wishlist';
        log.warn(`[WishlistService] ${error}: ${videoId}`);
        return { success: false, error };
      }

      const now = new Date().toISOString();

      // Update status to denied with optional reason
      const result = await this.db.run(`
        UPDATE wishlist
        SET status = 'denied',
            reviewed_at = ?,
            denial_reason = ?,
            updated_at = ?
        WHERE video_id = ?
      `, [now, reason || null, now, videoId]);

      if (result.changes === 0) {
        const error = 'Failed to update video status';
        log.error(`[WishlistService] ${error}: ${videoId}`);
        return { success: false, error };
      }

      log.info(`[WishlistService] Successfully denied video: ${videoId}`);

      // Fetch updated item
      const item = await findWishlistVideo(this.db, videoId) as WishlistItem;

      // Emit update event
      this.emitWishlistUpdate();

      return { success: true, item: item || undefined };
    } catch (error) {
      log.error('[WishlistService] Error denying video:', error);
      return {
        success: false,
        error: `Failed to deny video: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Update wishlist status (generic status update)
   */
  async updateWishlistStatus(
    videoId: string,
    status: WishlistStatus,
    reason?: string
  ): Promise<{ success: boolean; error?: string; item?: WishlistItem }> {
    try {
      log.info(`[WishlistService] Updating video status to ${status}: ${videoId}`);

      // Validate status value
      const validStatuses: WishlistStatus[] = ['pending', 'approved', 'denied'];
      if (!validStatuses.includes(status)) {
        const error = `Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`;
        log.warn(`[WishlistService] ${error}`);
        return { success: false, error };
      }

      // Check if video exists
      const current = await findWishlistVideo(this.db, videoId) as WishlistItem;

      if (!current) {
        const error = 'Video not found in wishlist';
        log.warn(`[WishlistService] ${error}: ${videoId}`);
        return { success: false, error };
      }

      const now = new Date().toISOString();

      // Update status
      const result = await this.db.run(`
        UPDATE wishlist
        SET status = ?,
            reviewed_at = CASE WHEN ? IN ('approved', 'denied') THEN ? ELSE reviewed_at END,
            denial_reason = ?,
            updated_at = ?
        WHERE video_id = ?
      `, [status, status, now, reason || null, now, videoId]);

      if (result.changes === 0) {
        const error = 'Failed to update video status';
        log.error(`[WishlistService] ${error}: ${videoId}`);
        return { success: false, error };
      }

      log.info(`[WishlistService] Successfully updated video status to ${status}: ${videoId}`);

      // Fetch updated item
      const item = await findWishlistVideo(this.db, videoId) as WishlistItem;

      // Emit update event
      this.emitWishlistUpdate();

      return { success: true, item: item || undefined };
    } catch (error) {
      log.error('[WishlistService] Error updating wishlist status:', error);
      return {
        success: false,
        error: `Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check if video is in wishlist
   */
  async isInWishlist(videoId: string): Promise<{ inWishlist: boolean; status?: WishlistStatus }> {
    try {
      const item = await findWishlistVideo(this.db, videoId) as WishlistItem;

      if (item) {
        return { inWishlist: true, status: item.status };
      }

      return { inWishlist: false };
    } catch (error) {
      log.error('[WishlistService] Error checking wishlist status:', error);
      return { inWishlist: false };
    }
  }

  /**
   * Get wishlist counts by status
   */
  async getWishlistCounts(): Promise<{ pending: number; approved: number; denied: number; total: number }> {
    try {
      const counts = await getWishlistCounts(this.db);

      return counts;
    } catch (error) {
      log.error('[WishlistService] Error getting wishlist counts:', error);
      return { pending: 0, approved: 0, denied: 0, total: 0 };
    }
  }

  /**
   * Bulk approve multiple videos in the wishlist
   * Uses database transaction for consistency
   */
  async bulkApproveVideos(videoIds: string[]): Promise<{ success: string[]; failed: string[] }> {
    const results: { success: string[]; failed: string[] } = { success: [], failed: [] };

    if (videoIds.length === 0) {
      log.warn('[WishlistService] Bulk approve called with empty video list');
      return results;
    }

    log.info(`[WishlistService] Starting bulk approve for ${videoIds.length} videos`);

    try {
      // Begin transaction
      await this.db.run('BEGIN TRANSACTION');

      const now = new Date().toISOString();

      for (const videoId of videoIds) {
        try {
          // Update status to approved for pending videos only
          const result = await this.db.run(`
            UPDATE wishlist
            SET status = 'approved',
                reviewed_at = ?,
                updated_at = ?
            WHERE video_id = ? AND status = 'pending'
          `, [now, now, videoId]);

          if (result.changes > 0) {
            results.success.push(videoId);
            log.debug(`[WishlistService] Successfully approved video: ${videoId}`);
          } else {
            results.failed.push(videoId);
            log.warn(`[WishlistService] Failed to approve video (not found or not pending): ${videoId}`);
          }
        } catch (error) {
          results.failed.push(videoId);
          log.error(`[WishlistService] Error approving video ${videoId}:`, error);
        }
      }

      // Commit transaction
      await this.db.run('COMMIT');

      log.info(`[WishlistService] Bulk approve completed: ${results.success.length} success, ${results.failed.length} failed`);

      // Emit update event if any videos were updated
      if (results.success.length > 0) {
        this.emitWishlistUpdate();
      }

      return results;
    } catch (error) {
      // Rollback transaction on error
      try {
        await this.db.run('ROLLBACK');
      } catch (rollbackError) {
        log.error('[WishlistService] Error rolling back transaction:', rollbackError);
      }

      log.error('[WishlistService] Bulk approve transaction failed:', error);
      
      // Mark all videos as failed
      results.failed = [...videoIds];
      results.success = [];
      
      return results;
    }
  }

  /**
   * Bulk deny multiple videos in the wishlist with optional shared reason
   * Uses database transaction for consistency
   */
  async bulkDenyVideos(videoIds: string[], reason?: string): Promise<{ success: string[]; failed: string[] }> {
    const results: { success: string[]; failed: string[] } = { success: [], failed: [] };

    if (videoIds.length === 0) {
      log.warn('[WishlistService] Bulk deny called with empty video list');
      return results;
    }

    log.info(`[WishlistService] Starting bulk deny for ${videoIds.length} videos${reason ? ` (reason: ${reason})` : ''}`);

    try {
      // Begin transaction
      await this.db.run('BEGIN TRANSACTION');

      const now = new Date().toISOString();

      for (const videoId of videoIds) {
        try {
          // Update status to denied for pending videos only
          const result = await this.db.run(`
            UPDATE wishlist
            SET status = 'denied',
                reviewed_at = ?,
                denial_reason = ?,
                updated_at = ?
            WHERE video_id = ? AND status = 'pending'
          `, [now, reason || null, now, videoId]);

          if (result.changes > 0) {
            results.success.push(videoId);
            log.debug(`[WishlistService] Successfully denied video: ${videoId}`);
          } else {
            results.failed.push(videoId);
            log.warn(`[WishlistService] Failed to deny video (not found or not pending): ${videoId}`);
          }
        } catch (error) {
          results.failed.push(videoId);
          log.error(`[WishlistService] Error denying video ${videoId}:`, error);
        }
      }

      // Commit transaction
      await this.db.run('COMMIT');

      log.info(`[WishlistService] Bulk deny completed: ${results.success.length} success, ${results.failed.length} failed`);

      // Emit update event if any videos were updated
      if (results.success.length > 0) {
        this.emitWishlistUpdate();
      }

      return results;
    } catch (error) {
      // Rollback transaction on error
      try {
        await this.db.run('ROLLBACK');
      } catch (rollbackError) {
        log.error('[WishlistService] Error rolling back transaction:', rollbackError);
      }

      log.error('[WishlistService] Bulk deny transaction failed:', error);
      
      // Mark all videos as failed
      results.failed = [...videoIds];
      results.success = [];
      
      return results;
    }
  }
}

export default WishlistService;
