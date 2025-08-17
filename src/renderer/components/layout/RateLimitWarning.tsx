import React from 'react';

interface RateLimitWarningProps {
  isVisible: boolean;
  lastFetched?: string;
  className?: string;
}

export const RateLimitWarning: React.FC<RateLimitWarningProps> = ({ 
  isVisible, 
  lastFetched, 
  className = '' 
}) => {
  if (!isVisible) return null;

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return 'unknown time';
    }
  };

  return (
    <div className={`fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded shadow-lg z-50 ${className}`}>
      <div className="flex items-center space-x-2">
        <div className="text-yellow-600">⚠️</div>
        <div>
          <div className="font-medium">Rate limit reached</div>
          <div className="text-sm">
            Using cached results from {lastFetched ? formatDate(lastFetched) : 'previous session'}
          </div>
        </div>
      </div>
    </div>
  );
};
