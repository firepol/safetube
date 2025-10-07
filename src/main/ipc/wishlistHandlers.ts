import { ipcMain, BrowserWindow } from 'electron';
import log from '../logger';
import DatabaseService from '../services/DatabaseService';
import { WishlistService } from '../services/wishlistService';
import { IPC } from '../../shared/ipc-channels';
import { WishlistItem, WishlistStatus, VideoData } from '../../shared/types';

// Types for IPC database operations
interface DatabaseResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Wishlist IPC Handlers
 * Wire up wishlist functionality for video approval workflow
 */
export function registerWishlistHandlers(mainWindow: BrowserWindow | null = null) {
  const db = DatabaseService.getInstance();
  const wishlistService = new WishlistService(db);

  // Set main window for event emission
  if (mainWindow) {
    wishlistService.setMainWindow(mainWindow);
  }

  // Add video to wishlist
  ipcMain.handle(
    IPC.WISHLIST.ADD,
    async (_, video: VideoData): Promise<DatabaseResponse<WishlistItem>> => {
      try {
        log.info(`[Wishlist IPC] Add to wishlist request: ${video.id}`);
        const result = await wishlistService.addToWishlist(video);

        if (!result.success) {
          return {
            success: false,
            error: result.error,
            code: result.error?.includes('already in wishlist') ? 'ALREADY_IN_WISHLIST' : 'ADD_TO_WISHLIST_FAILED'
          };
        }

        return {
          success: true,
          data: result.item
        };
      } catch (error) {
        log.error('[Wishlist IPC] Add to wishlist failed:', error);
        return {
          success: false,
          error: `Failed to add to wishlist: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'ADD_TO_WISHLIST_FAILED'
        };
      }
    }
  );

  // Remove video from wishlist
  ipcMain.handle(
    IPC.WISHLIST.REMOVE,
    async (_, videoId: string): Promise<DatabaseResponse<boolean>> => {
      try {
        log.info(`[Wishlist IPC] Remove from wishlist request: ${videoId}`);
        const result = await wishlistService.removeFromWishlist(videoId);

        if (!result.success) {
          return {
            success: false,
            error: result.error,
            code: result.error?.includes('not found') ? 'VIDEO_NOT_FOUND' : 'REMOVE_FROM_WISHLIST_FAILED'
          };
        }

        return {
          success: true,
          data: true
        };
      } catch (error) {
        log.error('[Wishlist IPC] Remove from wishlist failed:', error);
        return {
          success: false,
          error: `Failed to remove from wishlist: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'REMOVE_FROM_WISHLIST_FAILED'
        };
      }
    }
  );

  // Get wishlist items by status
  ipcMain.handle(
    IPC.WISHLIST.GET_BY_STATUS,
    async (_, status: WishlistStatus): Promise<DatabaseResponse<WishlistItem[]>> => {
      try {
        log.debug(`[Wishlist IPC] Get wishlist by status request: ${status}`);
        const items = await wishlistService.getWishlistByStatus(status);
        return {
          success: true,
          data: items
        };
      } catch (error) {
        log.error('[Wishlist IPC] Get wishlist by status failed:', error);
        return {
          success: false,
          error: `Failed to get wishlist: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'GET_WISHLIST_FAILED'
        };
      }
    }
  );

  // Approve video in wishlist
  ipcMain.handle(
    IPC.WISHLIST.APPROVE,
    async (_, videoId: string): Promise<DatabaseResponse<WishlistItem>> => {
      try {
        log.info(`[Wishlist IPC] Approve video request: ${videoId}`);
        const result = await wishlistService.approveVideo(videoId);

        if (!result.success) {
          return {
            success: false,
            error: result.error,
            code: result.error?.includes('not found') ? 'VIDEO_NOT_FOUND' : 'APPROVE_VIDEO_FAILED'
          };
        }

        return {
          success: true,
          data: result.item
        };
      } catch (error) {
        log.error('[Wishlist IPC] Approve video failed:', error);
        return {
          success: false,
          error: `Failed to approve video: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'APPROVE_VIDEO_FAILED'
        };
      }
    }
  );

  // Deny video in wishlist
  ipcMain.handle(
    IPC.WISHLIST.DENY,
    async (_, videoId: string, reason?: string): Promise<DatabaseResponse<WishlistItem>> => {
      try {
        log.info(`[Wishlist IPC] Deny video request: ${videoId}${reason ? ` (reason: ${reason})` : ''}`);
        const result = await wishlistService.denyVideo(videoId, reason);

        if (!result.success) {
          return {
            success: false,
            error: result.error,
            code: result.error?.includes('not found') ? 'VIDEO_NOT_FOUND' : 'DENY_VIDEO_FAILED'
          };
        }

        return {
          success: true,
          data: result.item
        };
      } catch (error) {
        log.error('[Wishlist IPC] Deny video failed:', error);
        return {
          success: false,
          error: `Failed to deny video: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'DENY_VIDEO_FAILED'
        };
      }
    }
  );

  // Bulk approve videos in wishlist
  ipcMain.handle(
    IPC.WISHLIST.BULK_APPROVE,
    async (_, videoIds: string[]): Promise<DatabaseResponse<{ success: string[], failed: string[] }>> => {
      try {
        log.info(`[Wishlist IPC] Bulk approve request: ${videoIds.length} videos`);
        const result = await wishlistService.bulkApproveVideos(videoIds);

        return {
          success: true,
          data: result
        };
      } catch (error) {
        log.error('[Wishlist IPC] Bulk approve failed:', error);
        return {
          success: false,
          error: `Failed to bulk approve videos: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'BULK_APPROVE_FAILED'
        };
      }
    }
  );

  // Bulk deny videos in wishlist
  ipcMain.handle(
    IPC.WISHLIST.BULK_DENY,
    async (_, videoIds: string[], reason?: string): Promise<DatabaseResponse<{ success: string[], failed: string[] }>> => {
      try {
        log.info(`[Wishlist IPC] Bulk deny request: ${videoIds.length} videos${reason ? ` (reason: ${reason})` : ''}`);
        const result = await wishlistService.bulkDenyVideos(videoIds, reason);

        return {
          success: true,
          data: result
        };
      } catch (error) {
        log.error('[Wishlist IPC] Bulk deny failed:', error);
        return {
          success: false,
          error: `Failed to bulk deny videos: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'BULK_DENY_FAILED'
        };
      }
    }
  );

  log.info('[Wishlist IPC] Wishlist handlers registered');
}

/**
 * Update the main window reference for event emission
 * Call this when the main window is created or recreated
 */
export function updateWishlistMainWindow(mainWindow: BrowserWindow | null) {
  const db = DatabaseService.getInstance();
  const wishlistService = new WishlistService(db);
  wishlistService.setMainWindow(mainWindow);
  log.debug('[Wishlist IPC] Main window reference updated');
}

export default registerWishlistHandlers;
