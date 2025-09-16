import React from 'react';
import { Video } from '../../types';

// Download status interface
interface DownloadStatus {
  status: 'idle' | 'pending' | 'downloading' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

// Props interface for the DownloadUI component
interface DownloadUIProps {
  video: Video | null;
  downloadStatus: DownloadStatus;
  isDownloading: boolean;
  onStartDownload: () => void;
  onCancelDownload: () => void;
  onResetDownload?: () => void;
  showResetButton?: boolean;
}

/**
 * Shared download UI component for both PlayerPage and YouTubePlayerPage
 * Handles all download states: idle, downloading, completed, failed
 */
export const DownloadUI: React.FC<DownloadUIProps> = ({
  video,
  downloadStatus,
  isDownloading,
  onStartDownload,
  onCancelDownload,
  onResetDownload,
  showResetButton = false,
}) => {
  // Only show download UI for YouTube videos
  if (!video || video.type !== 'youtube') {
    return null;
  }

  return (
    <div className="mt-4">
      {/* Downloading State */}
      {downloadStatus.status === 'downloading' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-blue-800 font-medium mb-2">Downloading Video...</div>
          <div className="text-sm text-blue-600 mb-2">
            Downloading video for offline viewing. This may take several minutes.
          </div>
          {downloadStatus.progress !== undefined && (
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${downloadStatus.progress}%` }}
                data-testid="download-progress-bar"
              ></div>
            </div>
          )}
          <div className="text-xs text-blue-500 mt-2">
            You can close this and come back later. The download will continue in the background.
          </div>
          <button
            onClick={onCancelDownload}
            className="mt-3 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
          >
            Cancel Download
          </button>
        </div>
      )}
      
      {/* Failed State */}
      {downloadStatus.status === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-medium mb-2">Download Failed</div>
          <div className="text-sm text-red-600 mb-3">
            {downloadStatus.error || 'An error occurred during download'}
          </div>
          <button
            onClick={onStartDownload}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Try Download Again
          </button>
        </div>
      )}
      
      {/* Completed State */}
      {downloadStatus.status === 'completed' && (
        <div className="text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-center">
              <div className="text-green-600 mr-2">✓</div>
              <div className="text-green-800 font-medium">Video Downloaded</div>
            </div>
            <div className="text-sm text-green-600 mt-1">
              This video is available offline in your Downloaded folder
            </div>
            {showResetButton && onResetDownload && (
              <button
                onClick={onResetDownload}
                className="mt-3 bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 transition-colors"
              >
                Reset Download
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Idle State */}
      {downloadStatus.status === 'idle' && (
        <div className="text-center">
          <button
            onClick={onStartDownload}
            disabled={isDownloading}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isDownloading ? 'Downloading...' : 'Download for Offline'}
          </button>
          <div className="text-xs text-gray-500 mt-2">
            Download this video to watch without internet connection
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadUI;

// Export types for use in other components
export type { DownloadStatus, DownloadUIProps };