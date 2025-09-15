import { promises as fs } from 'fs';
import { logVerbose } from '../shared/logging';
import { DownloadedVideo, DownloadStatus } from '../shared/types';
import { 
  readDownloadedVideos, 
  writeDownloadedVideos, 
  readDownloadStatus, 
  writeDownloadStatus 
} from './fileUtils';

/**
 * Service for managing download reset operations
 * Handles removing entries from both downloadStatus.json and downloadedVideos.json
 */
export class DownloadResetService {
  /**
   * Reset download status for a video by removing entries from both tracking files
   * @param videoId - The YouTube video ID to reset
   */
  static async resetDownloadStatus(videoId: string): Promise<void> {
    try {
      logVerbose(`[DownloadResetService] Resetting download status for video: ${videoId}`);

      // Remove from downloadStatus.json
      const downloadStatuses = await readDownloadStatus();
      const filteredStatuses = downloadStatuses.filter(status => status.videoId !== videoId);
      
      if (filteredStatuses.length !== downloadStatuses.length) {
        await writeDownloadStatus(filteredStatuses);
        logVerbose(`[DownloadResetService] Removed video ${videoId} from downloadStatus.json`);
      } else {
        logVerbose(`[DownloadResetService] Video ${videoId} not found in downloadStatus.json`);
      }

      // Remove from downloadedVideos.json
      const downloadedVideos = await readDownloadedVideos();
      const filteredVideos = downloadedVideos.filter(video => video.videoId !== videoId);
      
      if (filteredVideos.length !== downloadedVideos.length) {
        await writeDownloadedVideos(filteredVideos);
        logVerbose(`[DownloadResetService] Removed video ${videoId} from downloadedVideos.json`);
      } else {
        logVerbose(`[DownloadResetService] Video ${videoId} not found in downloadedVideos.json`);
      }

      logVerbose(`[DownloadResetService] Successfully reset download status for video: ${videoId}`);
    } catch (error) {
      logVerbose(`[DownloadResetService] Error resetting download status for ${videoId}: ${error}`);
      throw new Error(`Failed to reset download status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a video exists in downloadedVideos.json
   * @param videoId - The YouTube video ID to check
   * @returns Promise<boolean> - True if video is downloaded, false otherwise
   */
  static async isVideoDownloaded(videoId: string): Promise<boolean> {
    try {
      const downloadedVideos = await readDownloadedVideos();
      const isDownloaded = downloadedVideos.some(video => video.videoId === videoId);
      
      logVerbose(`[DownloadResetService] Video ${videoId} download status: ${isDownloaded}`);
      return isDownloaded;
    } catch (error) {
      logVerbose(`[DownloadResetService] Error checking download status for ${videoId}: ${error}`);
      return false;
    }
  }

  /**
   * Get the file path for a downloaded video
   * @param videoId - The YouTube video ID to get path for
   * @returns Promise<string | null> - File path if video is downloaded and file exists, null otherwise
   */
  static async getDownloadedVideoPath(videoId: string): Promise<string | null> {
    try {
      const downloadedVideos = await readDownloadedVideos();
      const downloadedVideo = downloadedVideos.find(video => video.videoId === videoId);
      
      if (!downloadedVideo) {
        logVerbose(`[DownloadResetService] Video ${videoId} not found in downloadedVideos.json`);
        return null;
      }

      if (!downloadedVideo.filePath) {
        logVerbose(`[DownloadResetService] Video ${videoId} has no file path recorded`);
        return null;
      }

      // Check if the file actually exists on disk
      try {
        await fs.access(downloadedVideo.filePath);
        logVerbose(`[DownloadResetService] Video ${videoId} file exists at: ${downloadedVideo.filePath}`);
        return downloadedVideo.filePath;
      } catch (fileError) {
        logVerbose(`[DownloadResetService] Video ${videoId} file not accessible at: ${downloadedVideo.filePath}`);
        return null;
      }
    } catch (error) {
      logVerbose(`[DownloadResetService] Error getting downloaded video path for ${videoId}: ${error}`);
      return null;
    }
  }

  /**
   * Get the downloaded video metadata for a video ID
   * @param videoId - The YouTube video ID to get metadata for
   * @returns Promise<DownloadedVideo | null> - Downloaded video metadata if found, null otherwise
   */
  static async getDownloadedVideo(videoId: string): Promise<DownloadedVideo | null> {
    try {
      const downloadedVideos = await readDownloadedVideos();
      const downloadedVideo = downloadedVideos.find(video => video.videoId === videoId);
      
      if (downloadedVideo) {
        logVerbose(`[DownloadResetService] Found downloaded video metadata for ${videoId}`);
      } else {
        logVerbose(`[DownloadResetService] No downloaded video metadata found for ${videoId}`);
      }
      
      return downloadedVideo || null;
    } catch (error) {
      logVerbose(`[DownloadResetService] Error getting downloaded video metadata for ${videoId}: ${error}`);
      return null;
    }
  }
}