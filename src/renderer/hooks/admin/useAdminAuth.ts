/**
 * useAdminAuth Hook
 *
 * Manages authentication state and login/logout flows for the admin interface.
 * Works with both IPC and HTTP authentication mechanisms.
 */

import { useState, useCallback } from 'react';
import { useAdminDataAccess } from './useAdminDataAccess';

/**
 * Authentication hook return type
 */
export interface UseAdminAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
}

/**
 * Hook for managing admin authentication
 * @returns Authentication state and methods
 */
export function useAdminAuth(): UseAdminAuthReturn {
  const dataAccess = useAdminDataAccess();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (password: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await dataAccess.authenticate(password);
        if (result.success) {
          setIsAuthenticated(true);
          return true;
        } else {
          setError(result.error || 'Authentication failed');
          return false;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Connection error';
        setError(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [dataAccess]
  );

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setError(null);
  }, []);

  return {
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
  };
}
