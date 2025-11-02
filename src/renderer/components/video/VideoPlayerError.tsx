import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface VideoPlayerErrorProps {
  errorMessage: string;
  videoUrl?: string;
  onRetry?: () => void;
  videoTitle?: string;
  disableBlocking?: boolean;
}

export const VideoPlayerError: React.FC<VideoPlayerErrorProps> = ({
  errorMessage,
  videoUrl,
  onRetry,
  videoTitle,
  disableBlocking = false,
}) => {
  const navigate = useNavigate();
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleOpenInWindow = useCallback(async () => {
    if (!videoUrl) return;

    try {
      await window.electron.openVideoInWindow(videoUrl, { disableBlocking });
      // If successful, close the password prompt
      setShowPasswordPrompt(false);
      setPassword('');
      setPasswordError(null);
    } catch (error) {
      console.error('Failed to open video in window:', error);
      // Fallback to default window.open if IPC fails
      window.open(videoUrl, '_blank');
    }
  }, [videoUrl, disableBlocking]);

  const handleWatchInBrowserClick = useCallback(() => {
    // Show password prompt instead of opening immediately
    setShowPasswordPrompt(true);
    setPasswordError(null);
  }, []);

  const handlePasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setPasswordError(null);

    try {
      const auth = await window.electron.adminAuthenticate(password);
      if (auth.success) {
        // Authentication successful, open video window
        await handleOpenInWindow();
      } else {
        setPasswordError('Invalid password');
      }
    } catch (error) {
      setPasswordError('Authentication failed. Please check your password.');
    } finally {
      setIsAuthenticating(false);
    }
  }, [password, handleOpenInWindow]);

  const handleCancelPassword = useCallback(() => {
    setShowPasswordPrompt(false);
    setPassword('');
    setPasswordError(null);
  }, []);

  // Show password prompt if requested
  if (showPasswordPrompt) {
    return (
      <div className="flex items-center justify-center py-12 px-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 border-2 border-blue-200">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Parent Access Required
            </h2>
            <p className="text-sm text-gray-600">
              Enter your password to watch this video in the browser
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter parent password"
                required
                autoFocus
                disabled={isAuthenticating}
              />
            </div>

            {passwordError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{passwordError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isAuthenticating ? 'Authenticating...' : 'Continue'}
            </button>

            <button
              type="button"
              onClick={handleCancelPassword}
              className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200"
            >
              Cancel
            </button>
          </form>

          <div className="mt-6 flex justify-center gap-4 text-sm">
            <button
              onClick={() => navigate(-1)}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back
            </button>
            <span className="text-gray-400">|</span>
            <button
              onClick={() => navigate('/')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default error display
  return (
    <div className="flex items-center justify-center py-12 px-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center border-2 border-blue-200">
        {/* Large Sad Smiley */}
        <div className="text-8xl mb-4 select-none" aria-label="sad face">
          😟
        </div>

        {/* Error Title */}
        <h2 className="text-xl font-semibold text-gray-800 mb-3">
          Oops! Video Couldn't Play
        </h2>

        {/* Video Title if available */}
        {videoTitle && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 truncate">
              <span className="font-medium">Video:</span> {videoTitle}
            </p>
          </div>
        )}

        {/* Error Message */}
        <div className="mb-6">
          <p className="text-sm text-gray-700 leading-relaxed">
            {errorMessage}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* Open in Browser Button - now requires password */}
          {videoUrl && (
            <button
              onClick={handleWatchInBrowserClick}
              className="w-full inline-flex items-center justify-center px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 font-medium text-sm"
            >
              <span>▶ Watch in Browser</span>
            </button>
          )}

          {/* Retry Button */}
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full inline-flex items-center justify-center px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-medium text-sm"
            >
              <span>🔄 Try Again</span>
            </button>
          )}
        </div>

        {/* Additional Info */}
        <p className="text-xs text-gray-500 mt-4 leading-relaxed">
          This video may not be available in your region or may have been restricted by the uploader.
        </p>
      </div>
    </div>
  );
};
