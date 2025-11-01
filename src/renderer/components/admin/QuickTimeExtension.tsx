/**
 * QuickTimeExtension Component
 *
 * Quick time extension widget for adding/removing extra time.
 * Shows current and projected time states.
 */

import React, { useState, useEffect } from 'react';
import { useTimeTracking } from '@/renderer/hooks/admin/useTimeTracking';
import { useTimeLimits } from '@/renderer/hooks/admin/useTimeLimits';
import { useAdminContext } from '@/renderer/contexts/AdminContext';

export const QuickTimeExtension: React.FC = () => {
  const { currentState, isLoading: timeLoading, load: loadTimeState, addExtraTime } = useTimeTracking();
  const { timeLimits, load: loadTimeLimits } = useTimeLimits();
  const { addMessage } = useAdminContext();
  const [extraMinutes, setExtraMinutes] = useState(10);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    loadTimeState();
    loadTimeLimits();
  }, [loadTimeState, loadTimeLimits]);

  const calculateProjected = () => {
    if (!currentState || !timeLimits) return null;

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }) as keyof typeof timeLimits;
    const baseLimitMinutes = Number(timeLimits[today]) || 0;
    const projectedExtraTime = (currentState.extraTimeToday || 0) + extraMinutes;
    const projectedLimitSeconds = (baseLimitMinutes + projectedExtraTime) * 60;
    const projectedRemaining = Math.max(0, projectedLimitSeconds - currentState.timeUsedToday);

    return {
      extraTimeToday: projectedExtraTime,
      timeLimitToday: projectedLimitSeconds,
      timeRemaining: projectedRemaining,
      isLimitReached: projectedRemaining <= 0,
    };
  };

  const handleApplyTime = async () => {
    if (extraMinutes === 0) {
      addMessage('No change to apply', 'warning', 3000);
      return;
    }

    setIsApplying(true);
    const success = await addExtraTime(extraMinutes);
    setIsApplying(false);

    if (success) {
      addMessage(`Successfully processed ${extraMinutes} minutes!`, 'success', 3000);
      setExtraMinutes(10);
    } else {
      addMessage('Failed to apply extra time', 'error');
    }
  };

  const projected = calculateProjected();
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  if (timeLoading) {
    return <div className="p-6 text-center">Loading time state...</div>;
  }

  if (!currentState) {
    return <div className="p-6 text-center text-red-600">Failed to load time state</div>;
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <h3 className="text-xl font-bold mb-6">Quick Time Extension</h3>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border-l-4 border-blue-500 pl-4">
          <p className="text-sm text-gray-600">Time Used Today</p>
          <p className="text-2xl font-bold text-gray-900">{formatTime(currentState.timeUsedToday)}</p>
        </div>
        <div className="border-l-4 border-green-500 pl-4">
          <p className="text-sm text-gray-600">Time Remaining</p>
          <p className="text-2xl font-bold text-gray-900">{formatTime(currentState.timeRemaining)}</p>
        </div>
      </div>

      {projected && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-semibold text-blue-900 mb-3">Projected State (if applied)</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-blue-700">Remaining</p>
              <p className="text-lg font-bold text-blue-900">{formatTime(projected.timeRemaining)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-700">Extra Time</p>
              <p className="text-lg font-bold text-blue-900">{projected.extraTimeToday}m</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setExtraMinutes(Math.max(-1440, extraMinutes - 5))}
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg"
          disabled={isApplying}
        >
          -5
        </button>
        <input
          type="number"
          value={extraMinutes}
          onChange={(e) => setExtraMinutes(Math.max(-1440, Math.min(1440, Number(e.target.value))))}
          className="flex-1 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg p-2"
          disabled={isApplying}
        />
        <button
          onClick={() => setExtraMinutes(Math.min(1440, extraMinutes + 5))}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg"
          disabled={isApplying}
        >
          +5
        </button>
      </div>

      <button
        onClick={handleApplyTime}
        disabled={isApplying || extraMinutes === 0}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-700 text-white font-bold py-3 rounded-lg hover:from-blue-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isApplying ? 'Applying...' : 'Apply Time Change'}
      </button>
    </div>
  );
};
