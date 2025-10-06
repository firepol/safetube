import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { WishlistItem, WishlistStatus, VideoData } from '../../shared/types';

// Cache TTL in milliseconds (30 seconds)
const CACHE_TTL = 30 * 1000;

interface WishlistData {
  pending: WishlistItem[];
  approved: WishlistItem[];
  denied: WishlistItem[];
}

interface WishlistCounts {
  pending: number;
  approved: number;
  denied: number;
  total: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface WishlistContextType {
  // Data
  wishlistData: WishlistData;
  wishlistCounts: WishlistCounts;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  addToWishlist: (video: VideoData) => Promise<{ success: boolean; error?: string }>;
  removeFromWishlist: (videoId: string) => Promise<{ success: boolean; error?: string }>;
  approveVideo: (videoId: string) => Promise<{ success: boolean; error?: string }>;
  denyVideo: (videoId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  
  // Utilities
  refreshWishlist: () => Promise<void>;
  isInWishlist: (videoId: string) => { inWishlist: boolean; status?: WishlistStatus };
  getUnreadCount: () => number;
  markAsRead: (videoId: string) => void;
  markAllAsRead: () => void;
  getWishlistItem: (videoId: string) => WishlistItem | null;
  clearError: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};

interface WishlistProviderProps {
  children: ReactNode;
}

export const WishlistProvider: React.FC<WishlistProviderProps> = ({ children }) => {
  // State
  const [wishlistData, setWishlistData] = useState<WishlistData>({
    pending: [],
    approved: [],
    denied: []
  });
  const [wishlistCounts, setWishlistCounts] = useState<WishlistCounts>({
    pending: 0,
    approved: 0,
    denied: 0,
    total: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache for wishlist data
  const [dataCache, setDataCache] = useState<CacheEntry<WishlistData> | null>(null);
  const [countsCache, setCountsCache] = useState<CacheEntry<WishlistCounts> | null>(null);
  
  // Track read status for notifications
  const [readItems, setReadItems] = useState<Set<string>>(new Set());

  // Check if cache is valid
  const isCacheValid = useCallback((cache: CacheEntry<any> | null): boolean => {
    if (!cache) return false;
    return Date.now() - cache.timestamp < CACHE_TTL;
  }, []);

  // Load wishlist data by status
  const loadWishlistByStatus = useCallback(async (status: WishlistStatus): Promise<WishlistItem[]> => {
    try {
      if (!window.electron?.wishlistGetByStatus) {
        throw new Error('Wishlist API not available');
      }
      
      const response = await window.electron.wishlistGetByStatus(status);
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || `Failed to load ${status} wishlist`);
      }
    } catch (err) {
      console.error(`[WishlistContext] Error loading ${status} wishlist:`, err);
      throw err;
    }
  }, []);

  // Load all wishlist data
  const loadWishlistData = useCallback(async (): Promise<WishlistData> => {
    try {
      const [pending, approved, denied] = await Promise.all([
        loadWishlistByStatus('pending'),
        loadWishlistByStatus('approved'),
        loadWishlistByStatus('denied')
      ]);

      return { pending, approved, denied };
    } catch (err) {
      console.error('[WishlistContext] Error loading wishlist data:', err);
      throw err;
    }
  }, [loadWishlistByStatus]);

  // Calculate counts from data
  const calculateCounts = useCallback((data: WishlistData): WishlistCounts => {
    const pending = Array.isArray(data.pending) ? data.pending.length : 0;
    const approved = Array.isArray(data.approved) ? data.approved.length : 0;
    const denied = Array.isArray(data.denied) ? data.denied.length : 0;
    
    return {
      pending,
      approved,
      denied,
      total: pending + approved + denied
    };
  }, []);

  // Refresh wishlist data
  const refreshWishlist = useCallback(async (): Promise<void> => {
    // Check cache first
    if (isCacheValid(dataCache)) {
      console.log('[WishlistContext] Using cached wishlist data');
      setWishlistData(dataCache!.data);
      setWishlistCounts(calculateCounts(dataCache!.data));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[WishlistContext] Loading fresh wishlist data');
      const data = await loadWishlistData();
      const counts = calculateCounts(data);

      // Update state
      setWishlistData(data);
      setWishlistCounts(counts);

      // Update cache
      const now = Date.now();
      setDataCache({ data, timestamp: now });
      setCountsCache({ data: counts, timestamp: now });

      console.log('[WishlistContext] Wishlist data loaded successfully:', counts);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load wishlist';
      console.error('[WishlistContext] Error refreshing wishlist:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [dataCache, isCacheValid, loadWishlistData, calculateCounts]);

  // Add video to wishlist
  const addToWishlist = useCallback(async (video: VideoData): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!window.electron?.wishlistAdd) {
        throw new Error('Wishlist API not available');
      }

      console.log('[WishlistContext] Adding video to wishlist:', video.id);
      const result = await window.electron.wishlistAdd(video);

      if (result.success) {
        // Invalidate cache to force refresh
        setDataCache(null);
        setCountsCache(null);
        // Refresh data
        await refreshWishlist();
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add to wishlist';
      console.error('[WishlistContext] Error adding to wishlist:', err);
      return { success: false, error: errorMessage };
    }
  }, [refreshWishlist]);

  // Remove video from wishlist
  const removeFromWishlist = useCallback(async (videoId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!window.electron?.wishlistRemove) {
        throw new Error('Wishlist API not available');
      }

      console.log('[WishlistContext] Removing video from wishlist:', videoId);
      const result = await window.electron.wishlistRemove(videoId);

      if (result.success) {
        // Invalidate cache to force refresh
        setDataCache(null);
        setCountsCache(null);
        // Refresh data
        await refreshWishlist();
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove from wishlist';
      console.error('[WishlistContext] Error removing from wishlist:', err);
      return { success: false, error: errorMessage };
    }
  }, [refreshWishlist]);

  // Approve video
  const approveVideo = useCallback(async (videoId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!window.electron?.wishlistApprove) {
        throw new Error('Wishlist API not available');
      }

      console.log('[WishlistContext] Approving video:', videoId);
      const result = await window.electron.wishlistApprove(videoId);

      if (result.success) {
        // Invalidate cache to force refresh
        setDataCache(null);
        setCountsCache(null);
        // Refresh data
        await refreshWishlist();
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve video';
      console.error('[WishlistContext] Error approving video:', err);
      return { success: false, error: errorMessage };
    }
  }, [refreshWishlist]);

  // Deny video
  const denyVideo = useCallback(async (videoId: string, reason?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!window.electron?.wishlistDeny) {
        throw new Error('Wishlist API not available');
      }

      console.log('[WishlistContext] Denying video:', videoId, reason ? `(reason: ${reason})` : '');
      const result = await window.electron.wishlistDeny(videoId, reason);

      if (result.success) {
        // Invalidate cache to force refresh
        setDataCache(null);
        setCountsCache(null);
        // Refresh data
        await refreshWishlist();
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to deny video';
      console.error('[WishlistContext] Error denying video:', err);
      return { success: false, error: errorMessage };
    }
  }, [refreshWishlist]);

  // Check if video is in wishlist
  const isInWishlist = useCallback((videoId: string): { inWishlist: boolean; status?: WishlistStatus } => {
    // Check all status arrays
    for (const item of wishlistData.pending) {
      if (item.video_id === videoId) {
        return { inWishlist: true, status: 'pending' };
      }
    }
    for (const item of wishlistData.approved) {
      if (item.video_id === videoId) {
        return { inWishlist: true, status: 'approved' };
      }
    }
    for (const item of wishlistData.denied) {
      if (item.video_id === videoId) {
        return { inWishlist: true, status: 'denied' };
      }
    }
    
    return { inWishlist: false };
  }, [wishlistData]);

  // Get unread count (approved + denied items not marked as read)
  const getUnreadCount = useCallback((): number => {
    const unreadApproved = wishlistData.approved.filter(item => !readItems.has(item.video_id)).length;
    const unreadDenied = wishlistData.denied.filter(item => !readItems.has(item.video_id)).length;
    return unreadApproved + unreadDenied;
  }, [wishlistData, readItems]);

  // Mark item as read
  const markAsRead = useCallback((videoId: string): void => {
    setReadItems(prev => new Set([...prev, videoId]));
  }, []);

  // Mark all items as read
  const markAllAsRead = useCallback((): void => {
    const allVideoIds = [
      ...wishlistData.approved.map(item => item.video_id),
      ...wishlistData.denied.map(item => item.video_id)
    ];
    setReadItems(new Set(allVideoIds));
  }, [wishlistData]);

  // Get specific wishlist item by video ID
  const getWishlistItem = useCallback((videoId: string): WishlistItem | null => {
    // Search in all status arrays
    const allItems = [
      ...wishlistData.pending,
      ...wishlistData.approved,
      ...wishlistData.denied
    ];
    
    return allItems.find(item => item.video_id === videoId) || null;
  }, [wishlistData]);

  // Clear error state
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  // Set up real-time updates via IPC events
  useEffect(() => {
    if (!window.electron?.onWishlistUpdated || !window.electron?.offWishlistUpdated) {
      console.warn('[WishlistContext] Wishlist update events not available');
      return;
    }

    const handleWishlistUpdate = () => {
      console.log('[WishlistContext] Received wishlist update event, invalidating cache');
      // Invalidate cache to force fresh data load
      setDataCache(null);
      setCountsCache(null);
      // Refresh data
      refreshWishlist();
    };

    // Subscribe to wishlist update events
    const wrappedCallback = window.electron.onWishlistUpdated(handleWishlistUpdate);

    // Cleanup on unmount
    return () => {
      if (window.electron?.offWishlistUpdated && wrappedCallback) {
        window.electron.offWishlistUpdated(wrappedCallback);
      }
    };
  }, [refreshWishlist]);

  // Set up polling for periodic updates (fallback mechanism)
  useEffect(() => {
    const POLLING_INTERVAL = 30000; // 30 seconds

    const pollForUpdates = () => {
      // Only poll if cache is expired and we're not currently loading
      if (!isLoading && !isCacheValid(dataCache)) {
        console.log('[WishlistContext] Polling for wishlist updates');
        refreshWishlist();
      }
    };

    const intervalId = setInterval(pollForUpdates, POLLING_INTERVAL);

    // Cleanup on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [isLoading, dataCache, isCacheValid, refreshWishlist]);

  // Initial load
  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  const contextValue: WishlistContextType = {
    // Data
    wishlistData,
    wishlistCounts,
    isLoading,
    error,
    
    // Actions
    addToWishlist,
    removeFromWishlist,
    approveVideo,
    denyVideo,
    
    // Utilities
    refreshWishlist,
    isInWishlist,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    getWishlistItem,
    clearError
  };

  return (
    <WishlistContext.Provider value={contextValue}>
      {children}
    </WishlistContext.Provider>
  );
};