import React, { useState, useEffect } from 'react';
import { TimeTrackingService } from '@/renderer/services/timeTrackingService';
import { SourceTimeState } from '@/shared/types';

interface SourceTimeDisplayProps {
  sourceId: string;
}

export const SourceTimeDisplay: React.FC<SourceTimeDisplayProps> = ({ sourceId }) => {
  const [timeState, setTimeState] = useState<SourceTimeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimeState = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const state = await TimeTrackingService.getSourceTimeState(sourceId);
        setTimeState(state);
      } catch (err) {
        console.error('Error fetching source time state:', err);
        setError('Failed to load time state');
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch immediately
    fetchTimeState();

    // Refresh every 60 seconds
    const interval = setInterval(() => {
      fetchTimeState();
    }, 60000);

    return () => clearInterval(interval);
  }, [sourceId]);

  if (isLoading) {
    return <span className="text-gray-500">Loading...</span>;
  }

  if (error) {
    return <span className="text-red-500 text-sm">{error}</span>;
  }

  if (!timeState) {
    return <span className="text-gray-500">No data</span>;
  }

  // If no limit is set, show Unlimited
  if (timeState.dailyLimitMinutes === null || timeState.secondsRemainingToday === null) {
    return <span className="text-gray-600">Unlimited</span>;
  }

  // Calculate progress percentage
  const totalSeconds = timeState.dailyLimitMinutes * 60;
  const progressPercent = Math.min(100, (timeState.secondsUsedToday / totalSeconds) * 100);

  // Determine warning/exceeded state
  const isWarning = timeState.secondsRemainingToday < 300; // < 5 minutes
  const isExceeded = timeState.isLimitExceeded;

  // Format remaining time
  const minutesRemaining = Math.floor(timeState.secondsRemainingToday / 60);
  const secondsRemaining = timeState.secondsRemainingToday % 60;
  const timeDisplay = isExceeded
    ? 'Limit exceeded'
    : `${minutesRemaining}m ${secondsRemaining}s`;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-[100px]">
        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              isExceeded
                ? 'bg-red-500'
                : isWarning
                  ? 'bg-orange-500'
                  : 'bg-green-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      <span
        className={`text-sm whitespace-nowrap font-medium ${
          isExceeded
            ? 'text-red-600'
            : isWarning
              ? 'text-orange-600'
              : 'text-gray-600'
        }`}
        title={`Last reset: ${timeState.lastResetDate}`}
      >
        {timeDisplay}
      </span>
    </div>
  );
};
