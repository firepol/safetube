/**
 * useTimeTracking Hook
 *
 * Manages current time tracking state and extra time operations.
 * Handles fetching current time state and adding/removing extra time.
 */

import { useState, useCallback } from 'react';
import { useAdminDataAccess } from './useAdminDataAccess';
import { TimeTrackingState } from './types';

/**
 * Time tracking hook return type
 */
export interface UseTimeTrackingReturn {
  currentState: TimeTrackingState | null;
  isLoading: boolean;
  load: () => Promise<void>;
  addExtraTime: (minutes: number) => Promise<boolean>;
}

/**
 * Hook for managing time tracking state
 * @returns Time tracking state and methods
 */
export function useTimeTracking(): UseTimeTrackingReturn {
  const dataAccess = useAdminDataAccess();
  const [currentState, setCurrentState] = useState<TimeTrackingState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const state = await dataAccess.getTimeState();
      setCurrentState(state);
    } catch (err) {
      console.error('[useTimeTracking] Failed to load time state:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dataAccess]);

  const addExtraTime = useCallback(
    async (minutes: number): Promise<boolean> => {
      setIsLoading(true);
      try {
        await dataAccess.addExtraTime(minutes);
        // Reload state after adding extra time
        await load();
        return true;
      } catch (err) {
        console.error('[useTimeTracking] Failed to add extra time:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [dataAccess, load]
  );

  return {
    currentState,
    isLoading,
    load,
    addExtraTime,
  };
}
