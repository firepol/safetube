import React, { useEffect, useState } from 'react';
import { TimeLimits } from '@/shared/types';

// Utility functions moved here to avoid fs dependency
const getCurrentDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

const getDayOfWeek = (dateString: string): keyof TimeLimits => {
  const date = new Date(dateString + 'T00:00:00Z');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getUTCDay()] as keyof TimeLimits;
};

// Accept currentDate as a prop for testability
export const TimeUpPage: React.FC<{ currentDate?: string }> = ({ currentDate }) => {
  const [timeLimits, setTimeLimits] = useState<TimeLimits | null>(null);
  const [date, setDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSchedule = async () => {
      try {
        const limits = await window.electron.getTimeLimits();
        setTimeLimits(limits);
        setDate(currentDate || getCurrentDate());
      } catch (error) {
        console.error('Error loading schedule:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSchedule();
  }, [currentDate]);

  const formatDayName = (day: string): string => {
    return day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
  };

  const isCurrentDay = (day: string): boolean => {
    if (!date) return false;
    const dayOfWeek = getDayOfWeek(date);
    return day.toLowerCase() === dayOfWeek.toLowerCase();
  };

  const formatTimeLimit = (minutes: number): string => {
    if (minutes === 0) return 'No time';
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minutes`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-lg mb-2">Loading schedule...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!timeLimits) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-lg mb-2 text-red-600">Error loading schedule</div>
          </div>
        </div>
      </div>
    );
  }

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-red-600 mb-4">
            Time's Up for Today!
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Here's your weekly viewing schedule:
          </p>
        </div>

        {/* Weekly Schedule */}
        <div className="flex justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 w-80">
            <h2 className="text-lg font-semibold mb-4 text-center">Weekly Schedule</h2>
            <table className="w-full border border-gray-400 border-collapse">
              <tbody>
                {days.map((day) => {
                  const limit = timeLimits[day as keyof TimeLimits] || 0;
                  const isToday = isCurrentDay(day);
                  return (
                    <tr
                      key={day}
                      className={
                        isToday
                          ? 'bg-red-50 border-l-4 border-red-500'
                          : ''
                      }
                    >
                      <td
                        className={
                          'border border-gray-300 px-6 py-3' +
                          (isToday ? ' text-red-700 font-bold' : ' text-gray-700')
                        }
                      >
                        {formatDayName(day)}
                      </td>
                      <td
                        className={
                          'border border-gray-300 px-6 py-3 text-right' +
                          (isToday ? ' text-red-700 font-bold' : ' text-gray-600 font-semibold')
                        }
                      >
                        {formatTimeLimit(Number(limit))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-500 mb-4">
            You can watch videos again tomorrow!
          </p>
        </div>
      </div>
    </div>
  );
}; 