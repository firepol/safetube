/**
 * DailyTimeLimitsForm Component
 *
 * Form for editing daily time limits for each day of the week.
 */

import React, { useEffect } from 'react';
import { useTimeLimits } from '@/renderer/hooks/admin/useTimeLimits';
import { useAdminContext } from '@/renderer/contexts/AdminContext';
import { TimeLimits } from '@/renderer/hooks/admin/types';

const DAYS: (keyof TimeLimits)[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const DailyTimeLimitsForm: React.FC = () => {
  const { timeLimits, isLoading, load, save, update } = useTimeLimits();
  const { addMessage } = useAdminContext();
  const [isSaving, setIsSaving] = React.useState(false);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!timeLimits) return;
    setIsSaving(true);
    const success = await save(timeLimits);
    setIsSaving(false);
    if (success) {
      addMessage('Time limits saved successfully!', 'success', 3000);
    } else {
      addMessage('Failed to save time limits', 'error');
    }
  };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }) as keyof TimeLimits;

  if (isLoading || !timeLimits) {
    return <div className="p-6 text-center">Loading time limits...</div>;
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <h3 className="text-xl font-bold mb-6">Daily Time Limits</h3>

      <div className="space-y-4 mb-6">
        {DAYS.map(day => (
          <div
            key={day}
            className={`flex items-center gap-4 p-4 rounded-lg ${
              day === today ? 'bg-blue-50 border-2 border-blue-500' : 'bg-gray-50 border border-gray-200'
            }`}
          >
            <label className="w-24 font-semibold text-gray-700 flex-shrink-0">
              {day}
              {day === today && <span className="text-xs text-blue-600 font-normal ml-1">(Today)</span>}
            </label>
            <div className="flex items-center flex-1">
              <input
                type="number"
                min="0"
                max="1440"
                value={timeLimits[day]}
                onChange={(e) => update(day, Number(e.target.value))}
                disabled={isSaving}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="ml-3 text-gray-600 font-medium">{Math.floor(timeLimits[day] / 60)}h {timeLimits[day] % 60}m</span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-700 text-white font-bold py-3 rounded-lg hover:from-blue-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isSaving ? 'Saving...' : 'Save Time Limits'}
      </button>
    </div>
  );
};
