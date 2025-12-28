import React, { useState } from 'react';
import { TimeTrackingService } from '@/renderer/services/timeTrackingService';

interface QuickExtensionMenuProps {
  sourceId: string;
  onExtensionGranted?: () => void;
}

export const QuickExtensionMenu: React.FC<QuickExtensionMenuProps> = ({
  sourceId,
  onExtensionGranted
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const extensionOptions = TimeTrackingService.getExtensionOptions();

  const handleExtend = async (minutes: number) => {
    try {
      setIsLoading(true);
      await TimeTrackingService.grantSourceExtension(
        sourceId,
        minutes,
        'Quick extension from admin panel'
      );

      // Show success message (you could use a toast library here)
      alert(`Granted ${minutes} minutes`);

      // Call parent callback to refresh display
      if (onExtensionGranted) {
        onExtensionGranted();
      }

      setIsOpen(false);
    } catch (error) {
      console.error('Error granting extension:', error);
      alert('Failed to grant extension');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-1"
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 h-3 w-3 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        <span>+ Time</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10 border border-gray-200">
          <div className="py-1">
            {extensionOptions.map((minutes) => (
              <button
                key={minutes}
                onClick={() => handleExtend(minutes)}
                disabled={isLoading}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
              >
                {minutes} minutes
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Close menu when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
