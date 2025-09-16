import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Video } from '../../types';
import { logVerbose } from '../../lib/logging';

interface LocalPlayerResetUIProps {
  video: Video | null;
  onResetDownload?: () => void;
}

interface DownloadedVideoInfo {
  videoId: string;
  title: string;
  filePath: string;
  sourceType: string;
  sourceId: string;
}

/**
 * Component that shows a reset button when playing downloaded YouTube videos in the local player
 * Allows users to reset the download status and return to YouTube playback
 */
export const LocalPlayerResetUI: React.FC<LocalPlayerResetUIProps> = ({
  video,
  onResetDownload
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [downloadedVideoInfo, setDownloadedVideoInfo] = useState<DownloadedVideoInfo | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Check if the current local video is a downloaded YouTube video
  useEffect(() => {
    const checkIfDownloadedVideo = async () => {
      if (!video || video.type !== 'local' || !video.url) {
        setDownloadedVideoInfo(null);
        return;
      }

      try {
        logVerbose('[LocalPlayerResetUI] Checking if local video is downloaded YouTube video:', video.url);
        
        // Get all downloaded videos
        const downloadedVideos = await window.electron.getDownloadedVideos();
        
        // Find a match based on file path
        const matchingVideo = downloadedVideos.find((downloadedVideo: any) => 
          downloadedVideo.filePath === video.url
        );

        if (matchingVideo) {
          logVerbose('[LocalPlayerResetUI] Found matching downloaded video:', matchingVideo);
          setDownloadedVideoInfo({
            videoId: matchingVideo.videoId,
            title: matchingVideo.title,
            filePath: matchingVideo.filePath,
            sourceType: matchingVideo.sourceType,
            sourceId: matchingVideo.sourceId
          });
        } else {
          logVerbose('[LocalPlayerResetUI] No matching downloaded video found');
          setDownloadedVideoInfo(null);
        }
      } catch (error) {
        console.error('[LocalPlayerResetUI] Error checking downloaded videos:', error);
        setDownloadedVideoInfo(null);
      }
    };

    checkIfDownloadedVideo();
  }, [video?.url, video?.type]);

  const handleResetDownload = async () => {
    if (!downloadedVideoInfo) return;

    try {
      setIsResetting(true);
      logVerbose('[LocalPlayerResetUI] Resetting download status for video:', downloadedVideoInfo.videoId);

      // Reset the download status
      await window.electron.resetDownloadStatus(downloadedVideoInfo.videoId);

      // Call the optional callback
      if (onResetDownload) {
        onResetDownload();
      }

      // Preserve navigation context when navigating to YouTube player
      // Use video's preserved context if available, otherwise use current location state
      const videoNavigationContext = (video as any)?.navigationContext;
      const currentLocationState = location.state;
      const navigationContext = videoNavigationContext || currentLocationState || {};
      
      const youtubeUrl = `/youtube/${encodeURIComponent(downloadedVideoInfo.videoId)}`;
      
      logVerbose('[LocalPlayerResetUI] Navigating to YouTube player with preserved context:', {
        url: youtubeUrl,
        hasVideoNavigationContext: !!videoNavigationContext,
        hasLocationState: !!currentLocationState,
        finalContext: navigationContext
      });
      
      navigate(youtubeUrl, {
        state: navigationContext
      });

    } catch (error) {
      console.error('[LocalPlayerResetUI] Error resetting download:', error);
      // TODO: Show error message to user
    } finally {
      setIsResetting(false);
    }
  };

  // Only show the reset UI if this is a downloaded YouTube video
  if (!downloadedVideoInfo) {
    return null;
  }

  return (
    <div className="mt-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-blue-800 font-medium mb-1">Downloaded YouTube Video</div>
            <div className="text-sm text-blue-600">
              This is a downloaded version of a YouTube video. You can reset to play from YouTube instead.
            </div>
          </div>
          <button
            onClick={handleResetDownload}
            disabled={isResetting}
            className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isResetting ? 'Resetting...' : 'Reset Download'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocalPlayerResetUI;