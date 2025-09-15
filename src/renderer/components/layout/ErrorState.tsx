import React from 'react';

interface ErrorStateProps {
  title?: string;
  message: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  backButtonText?: string;
  className?: string;
  variant?: 'fullscreen' | 'page' | 'inline';
  showDebug?: boolean;
  debugInfo?: string | string[];
  onRetry?: () => void;
  retryText?: string;
}

/**
 * Standardized error state component that can be used across the application.
 * Provides consistent error UI with optional back button, debug info, and retry functionality.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Error',
  message,
  showBackButton = false,
  onBackClick,
  backButtonText = '← Back',
  className = '',
  variant = 'page',
  showDebug = false,
  debugInfo,
  onRetry,
  retryText = 'Try Again'
}) => {
  const baseClasses = {
    fullscreen: 'min-h-screen bg-background flex flex-col items-center justify-center',
    page: 'p-4',
    inline: 'flex flex-col items-center justify-center py-8'
  };

  const containerClasses = {
    fullscreen: 'text-center max-w-2xl',
    page: 'max-w-2xl mx-auto',
    inline: 'text-center max-w-xl'
  };

  const formatDebugInfo = () => {
    if (!debugInfo) return '';
    if (Array.isArray(debugInfo)) {
      return debugInfo.join('\n');
    }
    return debugInfo;
  };

  return (
    <div className={`${baseClasses[variant]} ${className}`}>
      {/* Header with back button for page variant */}
      {variant === 'page' && (
        <div className="flex items-center justify-between mb-4">
          {showBackButton && onBackClick ? (
            <button
              onClick={onBackClick}
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors"
            >
              {backButtonText}
            </button>
          ) : (
            <div />
          )}
          <h1 className="text-2xl font-bold">{title}</h1>
          <div />
        </div>
      )}

      <div className={containerClasses[variant]}>
        {/* Title for non-page variants */}
        {variant !== 'page' && (
          <div className="text-xl font-bold mb-4 text-red-600">{title}</div>
        )}

        {/* Error message */}
        <div className="text-red-600 mb-4">{message}</div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-2 justify-center items-center mb-4">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              {retryText}
            </button>
          )}

          {/* Back button for fullscreen variant */}
          {variant === 'fullscreen' && showBackButton && onBackClick && (
            <button
              onClick={onBackClick}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors"
            >
              {backButtonText}
            </button>
          )}
        </div>

        {/* Debug information */}
        {showDebug && debugInfo && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800 mb-2">
              Show debug information
            </summary>
            <pre className="bg-gray-100 p-3 rounded text-xs max-w-full overflow-x-auto text-left whitespace-pre-wrap">
              {formatDebugInfo()}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};