import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Fallback page for unmatched routes and routing errors
 * Provides recovery options and clear navigation paths
 */
export const ErrorFallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Try to extract video ID from URL path for smart recovery
  const extractVideoIdFromPath = (pathname: string): string | null => {
    // Match patterns like /youtube/VIDEO_ID or /player/VIDEO_ID
    const youtubeMatch = pathname.match(/\/youtube\/([^\/]+)/);
    if (youtubeMatch) return youtubeMatch[1];

    const playerMatch = pathname.match(/\/player\/([^\/]+)/);
    if (playerMatch) return playerMatch[1];

    return null;
  };

  const videoId = extractVideoIdFromPath(location.pathname);
  const isVideoRelatedError = !!videoId;

  const goHome = () => {
    navigate('/', { replace: true });
  };

  const goBack = () => {
    // Use browser's back navigation, but fallback to home if no history
    if (window.history.length > 1) {
      window.history.back();
    } else {
      goHome();
    }
  };

  const tryVideoPlayer = () => {
    if (videoId) {
      navigate(`/player/${videoId}`, { replace: true });
    }
  };

  const copyErrorDetails = () => {
    const errorDetails = {
      url: window.location.href,
      pathname: location.pathname,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => {
        alert('Error details copied to clipboard');
      })
      .catch((err) => {
        console.error('Failed to copy error details:', err);
        // Fallback: show the details in an alert
        alert(`Error Details:\n${JSON.stringify(errorDetails, null, 2)}`);
      });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-red-600 mb-4">Oops! Page Not Found</h1>
          <p className="text-xl text-gray-600 mb-2">
            The page you're looking for doesn't exist or there was a navigation error.
          </p>
          <p className="text-gray-500">
            Current URL: <code className="bg-gray-100 px-2 py-1 rounded text-sm">{location.pathname}</code>
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">What would you like to do?</h2>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={goHome}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              🏠 Go to Homepage
            </button>

            <button
              onClick={goBack}
              className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              ← Go Back
            </button>

            {isVideoRelatedError && (
              <button
                onClick={tryVideoPlayer}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                🎥 Try Video Player
              </button>
            )}
          </div>
        </div>

        {isVideoRelatedError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 mb-2">
              <strong>Found Video ID:</strong> <code className="bg-yellow-100 px-2 py-1 rounded">{videoId}</code>
            </p>
            <p className="text-sm text-yellow-700">
              This looks like a video-related error. Try clicking "Try Video Player" to play this video.
            </p>
          </div>
        )}

        <div className="text-sm text-gray-500">
          <button
            onClick={copyErrorDetails}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Copy error details
          </button>
          {' | '}
          <span>Need help? Contact support with the error details above.</span>
        </div>

        <div className="mt-8 text-xs text-gray-400">
          SafeTube Error Recovery • {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
};