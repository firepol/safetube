import { useState, useCallback } from 'react';
import { Video } from '../types';

export interface DownloadStatus {
  status: 'idle' | 'pending' | 'downloading' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

export interface UseDownloadReturn {
  downloadStatus: DownloadStatus;
  isDownloading: boolean;
  checkDownloadStatus: (videoId: string) => Promise<void>;
  handleStartDownload: (video: Video) => Promise<void>;
  handleCancelDownload: (videoId: string) => Promise<void>;
}

export function useDownload(): UseDownloadReturn {
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>({ 
    status: 'idle' 
  });
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const checkDownloadStatus = useCallback(async (videoId: string) => {
    try {
      const status = await window.electron.getDownloadStatus(videoId);
      if (status) {
        setDownloadStatus({
          status: status.status,
          progress: status.progress,
          error: status.error
        });
        setIsDownloading(status.status === 'downloading');
      } else {
        setDownloadStatus({ status: 'idle' });
        setIsDownloading(false);
      }
    } catch (error) {
      console.error('[useDownload] Error checking download status:', error);
      setDownloadStatus({ status: 'idle' });
      setIsDownloading(false);
    }
  }, []);

  const handleStartDownload = useCallback(async (video: Video) => {
    if (!video?.id || !video?.title) return;
    
    try {
      setDownloadStatus({ status: 'downloading', progress: 0 });
      setIsDownloading(true);

      // Get source info for folder organization
      const sourceInfo = {
        type: (video.sourceType || 'youtube_channel') as 'youtube_channel' | 'youtube_playlist',
        sourceId: video.sourceId || 'unknown',
        channelTitle: video.sourceTitle || 'Unknown Channel',
        playlistTitle: video.sourceType === 'youtube_playlist' ? video.sourceTitle : undefined
      };

      const result = await window.electron.startDownload(video.id, video.title, sourceInfo);
      
      if (!result.success) {
        setDownloadStatus({ 
          status: 'failed', 
          error: result.error || 'Download failed'
        });
        setIsDownloading(false);
        return;
      }
      
      // Start polling for status updates
      const pollInterval = setInterval(async () => {
        try {
          const status = await window.electron.getDownloadStatus(video.id);
          if (status) {
            setDownloadStatus({
              status: status.status,
              progress: status.progress,
              error: status.error
            });
            
            if (status.status === 'completed' || status.status === 'failed') {
              clearInterval(pollInterval);
              setIsDownloading(false);
            }
          }
        } catch (error) {
          console.error('[useDownload] Error polling download status:', error);
          clearInterval(pollInterval);
          setIsDownloading(false);
        }
      }, 1000);
      
    } catch (error) {
      console.error('[useDownload] Error starting download:', error);
      setDownloadStatus({ 
        status: 'failed', 
        error: error instanceof Error ? error.message : String(error) 
      });
      setIsDownloading(false);
    }
  }, []);

  const handleCancelDownload = useCallback(async (videoId: string) => {
    if (!videoId) return;
    
    try {
      await window.electron.cancelDownload(videoId);
      setDownloadStatus({ status: 'idle' });
      setIsDownloading(false);
    } catch (error) {
      console.error('[useDownload] Error cancelling download:', error);
    }
  }, []);

  return {
    downloadStatus,
    isDownloading,
    checkDownloadStatus,
    handleStartDownload,
    handleCancelDownload
  };
}