import React from 'react';

interface LoadingStateProps {
  message?: string;
  submessage?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  backButtonText?: string;
  className?: string;
  variant?: 'fullscreen' | 'page' | 'inline';
}

/**
 * Standardized loading state component that can be used across the application.
 * Provides consistent loading UI with optional back button and customizable messages.
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  submessage,
  showBackButton = false,
  onBackClick,
  backButtonText = '← Back',
  className = '',
  variant = 'page'
}) => {
  const baseClasses = {
    fullscreen: 'min-h-screen bg-background flex items-center justify-center',
    page: 'p-4',
    inline: 'flex items-center justify-center py-8'
  };

  const containerClasses = {
    fullscreen: 'text-center',
    page: 'flex items-center justify-center h-64',
    inline: 'text-center'
  };

  return (
    <div className={`${baseClasses[variant]} ${className}`}>
      {showBackButton && onBackClick && variant === 'page' && (
        <div className="absolute top-4 left-4">
          <button
            onClick={onBackClick}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            {backButtonText}
          </button>
        </div>
      )}

      <div className={containerClasses[variant]}>
        <div className="text-lg mb-2">{message}</div>
        {submessage && (
          <div className="text-sm text-gray-500">{submessage}</div>
        )}
      </div>
    </div>
  );
};