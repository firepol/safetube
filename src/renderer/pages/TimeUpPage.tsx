import React, { useEffect, useState } from 'react';
import { TimeLimits } from '@/shared/types';

// Utility functions moved here to avoid fs dependency
const getCurrentDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

const getDayOfWeek = (dateString: string): keyof TimeLimits => {
  const date = new Date(dateString);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()] as keyof TimeLimits;
};

export const TimeUpPage: React.FC = () => {
  const [timeLimits, setTimeLimits] = useState<TimeLimits | null>(null);
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSchedule = async () => {
      try {
        const limits = await window.electron.getTimeLimits();
        const today = getCurrentDate();
        setTimeLimits(limits);
        setCurrentDate(today);
      } catch (error) {
        console.error('Error loading schedule:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSchedule();
  }, []);

  const formatDayName = (day: string): string => {
    return day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
  };

  const isCurrentDay = (day: string): boolean => {
    if (!currentDate) return false;
    const dayOfWeek = getDayOfWeek(currentDate);
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg mb-2">Loading schedule...</div>
        </div>
      </div>
    );
  }

  if (!timeLimits) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg mb-2 text-red-600">Error loading schedule</div>
        </div>
      </div>
    );
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
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
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-center">Weekly Schedule</h2>
          <div className="space-y-3">
            {days.map((day) => {
              const limit = timeLimits[day as keyof TimeLimits] || 0;
              const isToday = isCurrentDay(day);
              
              return (
                <div
                  key={day}
                  className={`flex justify-between items-center p-3 rounded-lg border ${
                    isToday
                      ? 'bg-red-50 border-red-300'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <span
                    className={`font-medium ${
                      isToday ? 'text-red-700 font-bold' : 'text-gray-700'
                    }`}
                  >
                    {formatDayName(day)}
                    {isToday && (
                      <span className="ml-2 text-sm bg-red-100 text-red-800 px-2 py-1 rounded">
                        Today
                      </span>
                    )}
                  </span>
                  <span
                    className={`font-semibold ${
                      isToday ? 'text-red-700' : 'text-gray-600'
                    }`}
                  >
                    {formatTimeLimit(limit)}
                  </span>
                </div>
              );
            })}
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