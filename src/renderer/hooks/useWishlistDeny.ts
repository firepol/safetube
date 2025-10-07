import { useState, useCallback } from 'react';

/**
 * Hook for handling wishlist video denial with reason
 */
export const useWishlistDeny = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const denyVideo = useCallback(async (videoId: string, reason?: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.wishlistDeny(videoId, reason);
      
      if (!result.success) {
        setError(result.error || 'Failed to deny video');
        return false;
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to deny video';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    denyVideo,
    isLoading,
    error,
    clearError
  };
};