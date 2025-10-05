import DatabaseService from './DatabaseService';
import log from '../logger';
import { WishlistItem, WishlistStatus, VideoData } from '../../shared/types';
import { BrowserWindow } from 'electron';

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
      await this.db.run(`
        INSERT INTO wishlist (
          video_id, title, thumbnail, description,
          channel_id, channel_name, duration, url,
          status, requested_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `, [
        video.id,
        video.title,
        video.thumbnail || null,
        video.description || null,
        video.channelId || null,
        video.channelName || null,
        video.duration || null,
        video.url,
        now,
        now
      ]);

      log.info(`[WishlistService] Successfully added video to wishlist: ${video.id}`);

      // Fetch the created item
      const item = await this.db.get<WishlistItem>(`
        SELECT * FROM wishlist WHERE video_id = ?
      `, [video.id]);

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

      const result = await this.db.run(`
        DELETE FROM wishlist WHERE video_id = ?
      `, [videoId]);

      if (result.changes === 0) {
        const error = 'Video not found in wishlist';
        log.warn(`[WishlistService] ${error}: ${videoId}`);
        return { success: false, error };
      }

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

      const items = await this.db.all<WishlistItem>(`
        SELECT * FROM wishlist
        WHERE status = ?
        ORDER BY requested_at DESC
      `, [status]);

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
      const current = await this.db.get<WishlistItem>(`
        SELECT * FROM wishlist WHERE video_id = ?
      `, [videoId]);

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
      const item = await this.db.get<WishlistItem>(`
        SELECT * FROM wishlist WHERE video_id = ?
      `, [videoId]);

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
      const current = await this.db.get<WishlistItem>(`
        SELECT * FROM wishlist WHERE video_id = ?
      `, [videoId]);

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
      const item = await this.db.get<WishlistItem>(`
        SELECT * FROM wishlist WHERE video_id = ?
      `, [videoId]);

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
      const current = await this.db.get<WishlistItem>(`
        SELECT * FROM wishlist WHERE video_id = ?
      `, [videoId]);

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
      const item = await this.db.get<WishlistItem>(`
        SELECT * FROM wishlist WHERE video_id = ?
      `, [videoId]);

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
      const item = await this.db.get<WishlistItem>(`
        SELECT * FROM wishlist WHERE video_id = ?
      `, [videoId]);

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
      const counts = await this.db.get<any>(`
        SELECT
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied,
          COUNT(*) as total
        FROM wishlist
      `);

      return {
        pending: counts?.pending || 0,
        approved: counts?.approved || 0,
        denied: counts?.denied || 0,
        total: counts?.total || 0
      };
    } catch (error) {
      log.error('[WishlistService] Error getting wishlist counts:', error);
      return { pending: 0, approved: 0, denied: 0, total: 0 };
    }
  }
}

export default WishlistService;
