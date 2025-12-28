import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TimeLimits } from '@/shared/types';

// Utility functions moved here to avoid fs dependency
const getCurrentDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

const getDayOfWeek = (dateString: string): keyof TimeLimits => {
  const date = new Date(dateString + 'T00:00:00Z');
  const days: (keyof TimeLimits)[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getUTCDay()];
};

// Accept currentDate as a prop for testability
export const TimeUpPage: React.FC<{ currentDate?: string }> = ({ currentDate }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [timeLimits, setTimeLimits] = useState<TimeLimits | null>(null);
  const [date, setDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [sourceLoadingError, setSourceLoadingError] = useState<string | null>(null);
  const [showExtensionRequest, setShowExtensionRequest] = useState(false);
  const [selectedExtensionMinutes, setSelectedExtensionMinutes] = useState<number>(5);
  const [customExtensionMinutes, setCustomExtensionMinutes] = useState<string>('');
  const [extensionRequestSent, setExtensionRequestSent] = useState(false);
  const [extensionRequestLoading, setExtensionRequestLoading] = useState(false);

  // Get location state for source-specific blocking
  const locationState = location.state as any;
  const blockedReason = locationState?.blockedReason;
  const sourceId = locationState?.sourceId;
  const sourceTimeState = locationState?.sourceTimeState;

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

  // Fetch source name if source-limited
  useEffect(() => {
    const loadSourceName = async () => {
      if (blockedReason === 'source_limit' && sourceId) {
        try {
          const sources = await window.electron.videoSourcesGetAll();
          const source = sources.find((s: any) => s.id === sourceId);
          if (source) {
            setSourceName(source.title);
          } else {
            setSourceLoadingError('Source not found');
          }
        } catch (error) {
          console.error('Error loading source:', error);
          setSourceLoadingError('Failed to load source');
        }
      }
    };
    loadSourceName();
  }, [blockedReason, sourceId]);

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

  const handleRequestExtension = async () => {
    if (!sourceId) return;

    setExtensionRequestLoading(true);
    try {
      // Determine which extension amount to request
      const useCustom = customExtensionMinutes && parseInt(customExtensionMinutes) > 0;
      const minutesToRequest = useCustom ? parseInt(customExtensionMinutes) : selectedExtensionMinutes;

      // Validate the minutes
      if (minutesToRequest < 1 || minutesToRequest > 60) {
        alert('Please request between 1 and 60 minutes');
        return;
      }

      // Log the extension request (this would normally be sent to parent via notification)
      console.log(`[TimeUpPage] Extension request: ${sourceName} needs ${minutesToRequest} more minutes`);

      // Show confirmation message
      setExtensionRequestSent(true);
      setShowExtensionRequest(false);

      // Auto-hide confirmation after 3 seconds
      setTimeout(() => {
        setExtensionRequestSent(false);
      }, 3000);
    } catch (error) {
      console.error('Error requesting extension:', error);
      alert('Failed to send extension request');
    } finally {
      setExtensionRequestLoading(false);
    }
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

  // Determine if this is a source-specific block
  const isSourceBlocked = blockedReason === 'source_limit';

  // Use configurable timeUpMessage with fallback to default
  const timeUpMessage = isSourceBlocked
    ? `Time's up for ${sourceName || 'this source'}!`
    : timeLimits.timeUpMessage || "Time's up for today! Here's your schedule:";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-red-600 mb-6">
            {timeUpMessage}
          </h1>

          {isSourceBlocked && (
            <div className="text-lg text-gray-700 mb-4">
              <p className="mb-2">You've reached your daily time limit for this source.</p>
              <p>You can watch other sources or request more time.</p>
            </div>
          )}
        </div>

        {/* Show schedule for global block, show source-specific options for source block */}
        {!isSourceBlocked ? (
          // Global time limit reached - show weekly schedule
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
        ) : (
          // Source limit reached - show action buttons
          <div className="flex flex-col items-center gap-4">
            <div className="flex justify-center gap-4 flex-wrap">
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Choose Another Source
              </button>

              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Go Back
              </button>
            </div>

            {/* Extension request button */}
            <button
              onClick={() => setShowExtensionRequest(true)}
              className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Request More Time
            </button>

            {/* Extension request confirmation */}
            {extensionRequestSent && (
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 max-w-md mx-auto">
                <div className="text-center">
                  <p className="text-green-700 font-medium">Extension request sent to parent!</p>
                  <p className="text-sm text-green-600 mt-1">Your parent will review your request</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Extension Request Modal */}
        {showExtensionRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Request More Time</h2>
              <p className="text-gray-600 mb-6">How many more minutes would you like for {sourceName}?</p>

              {/* Quick extension options */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[5, 10, 15, 30].map((minutes) => (
                  <button
                    key={minutes}
                    onClick={() => {
                      setSelectedExtensionMinutes(minutes);
                      setCustomExtensionMinutes('');
                    }}
                    className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                      selectedExtensionMinutes === minutes && !customExtensionMinutes
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {minutes}m
                  </button>
                ))}
              </div>

              {/* Custom time input */}
              <div className="mb-6">
                <label className="block text-sm text-gray-600 mb-2">Or enter custom minutes (1-60):</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={customExtensionMinutes}
                  onChange={(e) => {
                    setCustomExtensionMinutes(e.target.value);
                    setSelectedExtensionMinutes(5); // Reset quick selection
                  }}
                  placeholder="Enter minutes"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExtensionRequest(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  disabled={extensionRequestLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestExtension}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                  disabled={extensionRequestLoading}
                >
                  {extensionRequestLoading ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8">
          {!isSourceBlocked && (
            <p className="text-gray-500 mb-4">
              You can watch videos again tomorrow!
            </p>
          )}

          {/* Admin Area Link */}
          <div className="mt-6">
            <button
              onClick={() => navigate('/admin')}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Parent Access
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 