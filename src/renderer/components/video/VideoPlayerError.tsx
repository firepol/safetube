import React, { useCallback } from 'react';

interface VideoPlayerErrorProps {
  errorMessage: string;
  videoUrl?: string;
  onRetry?: () => void;
  videoTitle?: string;
}

export const VideoPlayerError: React.FC<VideoPlayerErrorProps> = ({
  errorMessage,
  videoUrl,
  onRetry,
  videoTitle,
}) => {
  const handleOpenInWindow = useCallback(async () => {
    if (!videoUrl) return;

    try {
      await window.electron.openVideoInWindow(videoUrl);
    } catch (error) {
      console.error('Failed to open video in window:', error);
      // Fallback to default window.open if IPC fails
      window.open(videoUrl, '_blank');
    }
  }, [videoUrl]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Large Sad Smiley */}
        <div className="text-9xl mb-6 select-none" aria-label="sad face">
          😟
        </div>

        {/* Error Title */}
        <h1 className="text-2xl font-semibold text-gray-800 mb-3">
          Oops! Video Couldn't Play
        </h1>

        {/* Video Title if available */}
        {videoTitle && (
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Video:</span> {videoTitle}
            </p>
          </div>
        )}

        {/* Error Message */}
        <div className="mb-8">
          <p className="text-base text-gray-700 leading-relaxed">
            {errorMessage}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Open in Browser Button */}
          {videoUrl && (
            <button
              onClick={handleOpenInWindow}
              className="w-full inline-flex items-center justify-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 font-medium"
            >
              <span>▶ Watch in Browser</span>
            </button>
          )}

          {/* Retry Button */}
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full inline-flex items-center justify-center px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-medium"
            >
              <span>🔄 Try Again</span>
            </button>
          )}
        </div>

        {/* Additional Info */}
        <p className="text-xs text-gray-500 mt-6 leading-relaxed">
          This video may not be available in your region or may have been restricted by the uploader.
        </p>
      </div>
    </div>
  );
};
