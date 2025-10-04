import { promises as fs } from 'fs';
import { logVerbose } from '../shared/logging';
import { DownloadedVideo } from '../shared/types';
import { DatabaseService } from './services/DatabaseService';
import {
  isVideoDownloaded,
  getDownloadedVideoById,
  deleteDownloadedVideo
} from './database/queries/downloadedVideosQueries';
import { deleteDownload } from './database/queries/downloadsQueries';

/**
 * Service for managing download reset operations
 * Handles removing entries from both downloads and downloaded_videos tables
 */
export class DownloadResetService {
  /**
   * Reset download status for a video by removing entries from both database tables
   * @param videoId - The YouTube video ID to reset
   */
  static async resetDownloadStatus(videoId: string): Promise<void> {
    try {
      logVerbose(`[DownloadResetService] Resetting download status for video: ${videoId}`);

      const db = DatabaseService.getInstance();

      // Remove from downloads table
      await deleteDownload(db, videoId);
      logVerbose(`[DownloadResetService] Removed video ${videoId} from downloads table`);

      // Remove from downloaded_videos table
      await deleteDownloadedVideo(db, videoId);
      logVerbose(`[DownloadResetService] Removed video ${videoId} from downloaded_videos table`);

      logVerbose(`[DownloadResetService] Successfully reset download status for video: ${videoId}`);
    } catch (error) {
      logVerbose(`[DownloadResetService] Error resetting download status for ${videoId}: ${error}`);
      throw new Error(`Failed to reset download status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a video exists in downloaded_videos table
   * @param videoId - The YouTube video ID to check
   * @returns Promise<boolean> - True if video is downloaded, false otherwise
   */
  static async isVideoDownloaded(videoId: string): Promise<boolean> {
    try {
      const db = DatabaseService.getInstance();
      const downloaded = await isVideoDownloaded(db, videoId);

      logVerbose(`[DownloadResetService] Video ${videoId} download status: ${downloaded}`);
      return downloaded;
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
      const db = DatabaseService.getInstance();
      const downloadedVideo = await getDownloadedVideoById(db, videoId);

      if (!downloadedVideo) {
        logVerbose(`[DownloadResetService] Video ${videoId} not found in downloaded_videos table`);
        return null;
      }

      if (!downloadedVideo.file_path) {
        logVerbose(`[DownloadResetService] Video ${videoId} has no file path recorded`);
        return null;
      }

      // Check if the file actually exists on disk
      try {
        await fs.access(downloadedVideo.file_path);
        logVerbose(`[DownloadResetService] Video ${videoId} file exists at: ${downloadedVideo.file_path}`);
        return downloadedVideo.file_path;
      } catch (fileError) {
        logVerbose(`[DownloadResetService] Video ${videoId} file not accessible at: ${downloadedVideo.file_path}`);
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
      const db = DatabaseService.getInstance();
      const downloadedVideo = await getDownloadedVideoById(db, videoId);

      if (downloadedVideo) {
        logVerbose(`[DownloadResetService] Found downloaded video metadata for ${videoId}`);

        // Convert database format to DownloadedVideo type
        return {
          videoId: downloadedVideo.video_id || videoId,
          sourceId: downloadedVideo.source_id,
          title: downloadedVideo.title,
          filePath: downloadedVideo.file_path,
          thumbnail: downloadedVideo.thumbnail_path || '',
          duration: downloadedVideo.duration || 0,
          downloadedAt: downloadedVideo.downloaded_at,
          sourceType: 'youtube_channel' // Default to youtube_channel
        };
      } else {
        logVerbose(`[DownloadResetService] No downloaded video metadata found for ${videoId}`);
      }

      return null;
    } catch (error) {
      logVerbose(`[DownloadResetService] Error getting downloaded video metadata for ${videoId}: ${error}`);
      return null;
    }
  }
}
