import { useState, useCallback } from 'react';
import { WishlistItem, WishlistStatus } from '@/shared/types';
import { useAdminDataAccess } from './useAdminDataAccess';

export interface UseWishlistReturn {
  wishlistItems: {
    pending: WishlistItem[];
    approved: WishlistItem[];
    denied: WishlistItem[];
  };
  isLoading: boolean;
  isOperating: boolean;
  error: string | null;
  load: () => Promise<void>;
  approve: (videoId: string) => Promise<void>;
  deny: (videoId: string, reason?: string) => Promise<void>;
  bulkApprove: (videoIds: string[]) => Promise<void>;
  bulkDeny: (videoIds: string[], reason?: string) => Promise<void>;
  loadByStatus: (status: WishlistStatus) => Promise<void>;
}

/**
 * Custom hook for managing wishlist data and operations
 * Provides methods for loading wishlist items and performing approval/denial actions
 */
export function useWishlist(): UseWishlistReturn {
  const dataAccess = useAdminDataAccess();
  const [wishlistItems, setWishlistItems] = useState<{
    pending: WishlistItem[];
    approved: WishlistItem[];
    denied: WishlistItem[];
  }>({
    pending: [],
    approved: [],
    denied: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isOperating, setIsOperating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load all statuses in parallel
      const [pending, approved, denied] = await Promise.all([
        dataAccess.getWishlistByStatus('pending'),
        dataAccess.getWishlistByStatus('approved'),
        dataAccess.getWishlistByStatus('denied'),
      ]);

      setWishlistItems({
        pending: pending || [],
        approved: approved || [],
        denied: denied || [],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load wishlist';
      setError(errorMessage);
      console.error('[useWishlist] Error loading wishlist:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dataAccess]);

  const loadByStatus = useCallback(async (status: WishlistStatus) => {
    try {
      setIsLoading(true);
      setError(null);
      const items = await dataAccess.getWishlistByStatus(status);

      setWishlistItems(prev => ({
        ...prev,
        [status]: items || [],
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to load ${status} items`;
      setError(errorMessage);
      console.error(`[useWishlist] Error loading ${status} items:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [dataAccess]);

  const approve = useCallback(async (videoId: string) => {
    try {
      setIsOperating(true);
      setError(null);
      await dataAccess.approveWishlistItem(videoId);

      // Remove from pending and add to approved
      setWishlistItems(prev => ({
        ...prev,
        pending: prev.pending.filter(item => item.video_id !== videoId),
        approved: [
          ...prev.approved,
          prev.pending.find(item => item.video_id === videoId),
        ].filter((item): item is WishlistItem => !!item),
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve item';
      setError(errorMessage);
      console.error('[useWishlist] Error approving item:', err);
      throw err;
    } finally {
      setIsOperating(false);
    }
  }, [dataAccess]);

  const deny = useCallback(async (videoId: string, reason?: string) => {
    try {
      setIsOperating(true);
      setError(null);
      await dataAccess.denyWishlistItem(videoId, reason);

      // Remove from pending and add to denied
      setWishlistItems(prev => ({
        ...prev,
        pending: prev.pending.filter(item => item.video_id !== videoId),
        denied: [
          ...prev.denied,
          prev.pending.find(item => item.video_id === videoId),
        ].filter((item): item is WishlistItem => !!item),
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to deny item';
      setError(errorMessage);
      console.error('[useWishlist] Error denying item:', err);
      throw err;
    } finally {
      setIsOperating(false);
    }
  }, [dataAccess]);

  const bulkApprove = useCallback(async (videoIds: string[]) => {
    try {
      setIsOperating(true);
      setError(null);
      await dataAccess.bulkApproveWishlist(videoIds);

      // Update local state
      setWishlistItems(prev => {
        const itemsToMove = prev.pending.filter(item => videoIds.includes(item.video_id));
        return {
          ...prev,
          pending: prev.pending.filter(item => !videoIds.includes(item.video_id)),
          approved: [...prev.approved, ...itemsToMove],
        };
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to bulk approve items';
      setError(errorMessage);
      console.error('[useWishlist] Error bulk approving items:', err);
      throw err;
    } finally {
      setIsOperating(false);
    }
  }, [dataAccess]);

  const bulkDeny = useCallback(async (videoIds: string[], reason?: string) => {
    try {
      setIsOperating(true);
      setError(null);
      await dataAccess.bulkDenyWishlist(videoIds, reason);

      // Update local state
      setWishlistItems(prev => {
        const itemsToMove = prev.pending.filter(item => videoIds.includes(item.video_id));
        return {
          ...prev,
          pending: prev.pending.filter(item => !videoIds.includes(item.video_id)),
          denied: [...prev.denied, ...itemsToMove],
        };
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to bulk deny items';
      setError(errorMessage);
      console.error('[useWishlist] Error bulk denying items:', err);
      throw err;
    } finally {
      setIsOperating(false);
    }
  }, [dataAccess]);

  return {
    wishlistItems,
    isLoading,
    isOperating,
    error,
    load,
    approve,
    deny,
    bulkApprove,
    bulkDeny,
    loadByStatus,
  };
}
