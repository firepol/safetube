/**
 * useTimeLimits Hook
 *
 * Manages time limits CRUD operations including loading, saving, and updating.
 * Handles all time limit data operations and state management.
 */

import { useState, useCallback } from 'react';
import { useAdminDataAccess } from './useAdminDataAccess';
import { TimeLimits } from './types';

/**
 * Time limits hook return type
 */
export interface UseTimeLimitsReturn {
  timeLimits: TimeLimits | null;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  save: (limits: TimeLimits) => Promise<boolean>;
  update: (day: keyof TimeLimits, value: number) => void;
}

/**
 * Hook for managing time limits
 * @returns Time limits state and methods
 */
export function useTimeLimits(): UseTimeLimitsReturn {
  const dataAccess = useAdminDataAccess();
  const [timeLimits, setTimeLimits] = useState<TimeLimits | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const limits = await dataAccess.getTimeLimits();
      setTimeLimits(limits);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load time limits';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [dataAccess]);

  const save = useCallback(
    async (limits: TimeLimits): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        await dataAccess.setTimeLimits(limits);
        setTimeLimits(limits);
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save time limits';
        setError(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [dataAccess]
  );

  const update = useCallback((day: keyof TimeLimits, value: number) => {
    if (!timeLimits) return;
    // Clamp value between 0 and 1440 (24 hours)
    const clampedValue = Math.max(0, Math.min(1440, value));
    setTimeLimits(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [day]: clampedValue,
      };
    });
  }, [timeLimits]);

  return {
    timeLimits,
    isLoading,
    error,
    load,
    save,
    update,
  };
}
