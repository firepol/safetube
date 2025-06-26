import React, { useEffect, useState } from 'react';

export interface TimeTrackingState {
  timeRemaining: number;
  timeLimit: number;
  timeUsed: number;
  isLimitReached: boolean;
}

interface TimeIndicatorProps {
  /** Whether to update the time display in real-time (for player page) */
  realTime?: boolean;
  /** Update interval in milliseconds (default: 5000ms = 5 seconds) */
  updateInterval?: number;
  /** Initial time tracking state (for static mode) */
  initialState?: TimeTrackingState;
  /** CSS classes for styling */
  className?: string;
}

/**
 * Reusable time indicator component that can display time tracking information
 * in both static and real-time updating modes.
 */
export const TimeIndicator: React.FC<TimeIndicatorProps> = ({
  realTime = false,
  updateInterval = 5000,
  initialState,
  className = ''
}) => {
  const [timeTrackingState, setTimeTrackingState] = useState<TimeTrackingState | null>(initialState || null);

  // Fetch time tracking state from main process
  const fetchTimeState = async (): Promise<TimeTrackingState | null> => {
    try {
      const state = await window.electron.getTimeTrackingState();
      return {
        timeRemaining: state.timeRemaining,
        timeLimit: state.timeLimitToday,
        timeUsed: state.timeUsedToday,
        isLimitReached: state.isLimitReached
      };
    } catch (error) {
      console.error('Error fetching time tracking state:', error);
      return null;
    }
  };

  // Initial load
  useEffect(() => {
    if (!initialState) {
      fetchTimeState().then(setTimeTrackingState);
    }
  }, [initialState]);

  // Real-time updates
  useEffect(() => {
    if (!realTime) return;

    const interval = setInterval(async () => {
      const newState = await fetchTimeState();
      if (newState) {
        setTimeTrackingState(newState);
      }
    }, updateInterval);

    return () => clearInterval(interval);
  }, [realTime, updateInterval]);

  if (!timeTrackingState) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Loading time...
      </div>
    );
  }

  const { timeRemaining, timeLimit, timeUsed, isLimitReached } = timeTrackingState;
  const minutesUsed = Math.floor(timeUsed / 60);
  const minutesLimit = Math.floor(timeLimit / 60);
  const minutesRemaining = Math.floor(timeRemaining / 60);
  
  // Show red when time is low (less than 3 minutes or 10% of daily limit)
  const isTimeLow = minutesRemaining <= 3 || minutesRemaining <= (minutesLimit * 0.1);
  
  const textColor = isLimitReached || isTimeLow ? 'text-red-600' : 'text-green-600';

  return (
    <div className="text-sm font-medium">
      {isLimitReached ? (
        <span className={`${textColor} ${className}`}>Daily time limit reached</span>
      ) : (
        <span className={`${textColor} ${className}`}>
          {minutesUsed} / {minutesLimit} [{minutesRemaining} minutes left]
        </span>
      )}
    </div>
  );
}; 