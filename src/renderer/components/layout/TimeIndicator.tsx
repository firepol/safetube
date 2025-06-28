import React, { useEffect, useState } from 'react';
import clsx from 'clsx';

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

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

/**
 * Formats time in a human-readable format
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${pad2(mins)}:${pad2(secs)}`;
}

/**
 * Formats remaining time with appropriate unit
 */
function formatRemainingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${pad2(mins)}:${pad2(secs)} min`;
  }
  return `${pad2(secs)} sec`;
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
  const [warningThresholdMinutes, setWarningThresholdMinutes] = useState<number>(3);
  const [countdownWarningSeconds, setCountdownWarningSeconds] = useState<number>(60);

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

  // Fetch warning threshold configuration
  const fetchWarningThreshold = async (): Promise<void> => {
    try {
      const timeLimits = await window.electron.getTimeLimits();
      const threshold = timeLimits.warningThresholdMinutes ?? 3;
      setWarningThresholdMinutes(threshold);
      setCountdownWarningSeconds(timeLimits.countdownWarningSeconds ?? 60);
    } catch (error) {
      console.error('Error fetching warning threshold:', error);
    }
  };

  // Initial load
  useEffect(() => {
    if (!initialState) {
      fetchTimeState().then(setTimeTrackingState);
    }
    fetchWarningThreshold();
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
  const minutesRemaining = Math.floor(timeRemaining / 60);
  
  // Determine color based on time remaining
  let colorClass = 'text-green-600';
  let barColor = 'bg-green-500';
  if (isLimitReached) {
    colorClass = 'text-red-600';
    barColor = 'bg-red-500';
  } else if (timeRemaining <= countdownWarningSeconds) {
    colorClass = 'text-red-600';
    barColor = 'bg-red-500';
  } else if (minutesRemaining <= warningThresholdMinutes) {
    colorClass = 'text-orange-600';
    barColor = 'bg-orange-500';
  }

  const percent = timeLimit > 0 ? Math.min(100, Math.max(0, Math.round((timeUsed / timeLimit) * 100))) : 0;

  return (
    <div
      data-testid="time-indicator-root"
      className={clsx(
        'text-sm font-medium flex flex-col gap-1',
        className
      )}
      style={{ minWidth: '260px' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-gray-600">⏰</span>
        <span className={colorClass}>{formatTime(timeUsed)} / {formatTime(timeLimit)}</span>
        <span className="text-gray-500">[{formatRemainingTime(timeRemaining)}]</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <div className="relative w-32 h-3 rounded bg-gray-200 overflow-hidden">
          <div
            className={`absolute left-0 top-0 h-3 rounded ${barColor}`}
            style={{ width: `${percent}%`, transition: 'width 0.3s' }}
          />
        </div>
        <span className="text-xs text-gray-500 ml-2" style={{minWidth: 32}}>{percent}%</span>
      </div>
    </div>
  );
}; 