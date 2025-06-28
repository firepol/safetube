import React, { useEffect, useState } from 'react';
import clsx from 'clsx';

interface CountdownOverlayProps {
  /** Whether the countdown should be visible */
  isVisible: boolean;
  /** Time remaining in seconds */
  timeRemainingSeconds: number;
  /** Whether the video is currently playing */
  isVideoPlaying: boolean;
  /** Whether the countdown should be shown (when time is <= countdownWarningSeconds) */
  shouldShowCountdown: boolean;
  /** The countdown warning threshold in seconds */
  countdownWarningSeconds: number;
  /** CSS classes for additional styling */
  className?: string;
}

/**
 * Countdown overlay component that displays a countdown timer over the video
 * when time is running low. The countdown pauses when the video is paused.
 */
export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  isVisible,
  timeRemainingSeconds,
  isVideoPlaying,
  shouldShowCountdown,
  countdownWarningSeconds,
  className = ''
}) => {
  const [displayTime, setDisplayTime] = useState<number>(timeRemainingSeconds);

  // Update display time when timeRemainingSeconds changes
  useEffect(() => {
    setDisplayTime(Math.floor(timeRemainingSeconds));
  }, [timeRemainingSeconds]);

  // Countdown timer effect
  useEffect(() => {
    if (!isVisible || !shouldShowCountdown || !isVideoPlaying || displayTime <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setDisplayTime(prev => {
        const newTime = prev - 1;
        return newTime >= 0 ? newTime : 0;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, shouldShowCountdown, isVideoPlaying, displayTime]);

  if (!isVisible || !shouldShowCountdown) {
    return null;
  }

  // Format time display
  let timeString: string;
  if (displayTime >= 60) {
    const minutes = Math.floor(displayTime / 60);
    const seconds = displayTime % 60;
    timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  } else {
    timeString = `${displayTime}`;
  }

  return (
    <div
      data-testid="countdown-overlay"
      className={clsx(
        'absolute top-4 right-4 z-50',
        className
      )}
    >
      {/* Countdown timer */}
      <div className="bg-black bg-opacity-50 rounded-lg p-3">
        <div className="text-white text-2xl font-bold text-center">
          {timeString}
        </div>
        <div className="text-white text-xs text-center mt-1">
          {displayTime > 60 ? 'remaining' : 'seconds left'}
        </div>
      </div>
    </div>
  );
}; 