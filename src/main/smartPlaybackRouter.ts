import { promises as fs } from 'fs';
import { logVerbose } from '../shared/logging';
import { DownloadedVideo } from '../shared/types';
import { DownloadResetService } from './downloadResetService';

/**
 * Result interface for shouldUseDownloadedVersion method
 */
export interface DownloadedVersionCheckResult {
  useDownloaded: boolean;
  downloadedVideo?: DownloadedVideo;
}

/**
 * Service for intelligent playback routing between YouTube and downloaded versions
 * Handles checking for downloaded videos and converting metadata to local video format
 */
export class SmartPlaybackRouter {
  /**
   * Check if a downloaded version of a YouTube video should be used for playback
   * @param videoId - The YouTube video ID to check
   * @returns Promise<DownloadedVersionCheckResult> - Result indicating whether to use downloaded version
   */
  static async shouldUseDownloadedVersion(videoId: string): Promise<DownloadedVersionCheckResult> {
    try {
      logVerbose(`[SmartPlaybackRouter] Checking for downloaded version of video: ${videoId}`);

      // First check if video is marked as downloaded
      const isDownloaded = await DownloadResetService.isVideoDownloaded(videoId);
      if (!isDownloaded) {
        logVerbose(`[SmartPlaybackRouter] Video ${videoId} is not marked as downloaded`);
        return { useDownloaded: false };
      }

      // Get the downloaded video metadata
      const downloadedVideo = await DownloadResetService.getDownloadedVideo(videoId);
      if (!downloadedVideo) {
        logVerbose(`[SmartPlaybackRouter] No downloaded video metadata found for ${videoId}`);
        return { useDownloaded: false };
      }

      // Check if the downloaded file actually exists and is accessible
      const filePath = await DownloadResetService.getDownloadedVideoPath(videoId);
      if (!filePath) {
        logVerbose(`[SmartPlaybackRouter] Downloaded video file not accessible for ${videoId}`);
        return { useDownloaded: false };
      }

      // Validate file existence one more time to be sure
      try {
        await fs.access(filePath);
        logVerbose(`[SmartPlaybackRouter] Downloaded version available for ${videoId} at: ${filePath}`);
        return { 
          useDownloaded: true, 
          downloadedVideo 
        };
      } catch (fileError) {
        logVerbose(`[SmartPlaybackRouter] File access failed for ${videoId}: ${fileError}`);
        return { useDownloaded: false };
      }
    } catch (error) {
      logVerbose(`[SmartPlaybackRouter] Error checking downloaded version for ${videoId}: ${error}`);
      return { useDownloaded: false };
    }
  }

  /**
   * Convert downloaded video metadata to local video format for playback
   * @param downloadedVideo - The downloaded video metadata
   * @param navigationContext - Optional navigation context to preserve (returnTo, etc.)
   * @returns Promise<Video> - Local video object ready for playback
   */
  static async createLocalVideoFromDownload(
    downloadedVideo: DownloadedVideo, 
    navigationContext?: { returnTo?: string; [key: string]: any }
  ): Promise<any> {
    try {
      logVerbose(`[SmartPlaybackRouter] Converting downloaded video to local format: ${downloadedVideo.videoId}`);

      // Validate that the file exists before creating the video object
      if (!downloadedVideo.filePath) {
        throw new Error(`No file path available for downloaded video ${downloadedVideo.videoId}`);
      }

      try {
        await fs.access(downloadedVideo.filePath);
      } catch (fileError) {
        throw new Error(`Downloaded video file not accessible: ${downloadedVideo.filePath}`);
      }

      // Create local video object from downloaded video metadata
      const localVideo = {
        id: downloadedVideo.videoId, // Keep original YouTube ID for navigation
        type: 'local' as const,
        title: downloadedVideo.title,
        thumbnail: downloadedVideo.thumbnail || '', // Use downloaded thumbnail
        duration: downloadedVideo.duration || 0,
        url: downloadedVideo.filePath, // Use local file path
        filePath: downloadedVideo.filePath,
        
        // Preserve source information for navigation
        sourceId: downloadedVideo.sourceId,
        sourceType: downloadedVideo.sourceType,
        sourceTitle: downloadedVideo.channelTitle || downloadedVideo.playlistTitle,
        
        // Mark as downloaded for UI components
        downloadedAt: downloadedVideo.downloadedAt,
        
        // Preserve navigation context for back button functionality
        navigationContext: navigationContext,
        
        // Additional metadata
        isAvailable: true,
        isFallback: false
      };

      logVerbose(`[SmartPlaybackRouter] Successfully created local video object for ${downloadedVideo.videoId}`, {
        hasNavigationContext: !!navigationContext,
        returnTo: navigationContext?.returnTo
      });
      return localVideo;
    } catch (error) {
      logVerbose(`[SmartPlaybackRouter] Error creating local video from download: ${error}`);
      throw new Error(`Failed to create local video from download: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get downloaded video information if available, with file validation
   * @param videoId - The YouTube video ID to check
   * @returns Promise<DownloadedVideo | null> - Downloaded video metadata if available and accessible
   */
  static async getValidatedDownloadedVideo(videoId: string): Promise<DownloadedVideo | null> {
    try {
      const result = await this.shouldUseDownloadedVersion(videoId);
      return result.useDownloaded ? result.downloadedVideo || null : null;
    } catch (error) {
      logVerbose(`[SmartPlaybackRouter] Error getting validated downloaded video for ${videoId}: ${error}`);
      return null;
    }
  }

  /**
   * Check if a video ID represents a downloaded YouTube video
   * @param videoId - The video ID to check
   * @returns Promise<boolean> - True if this is a downloaded YouTube video
   */
  static async isDownloadedYouTubeVideo(videoId: string): Promise<boolean> {
    try {
      // Check if this video ID exists in our downloaded videos
      const result = await this.shouldUseDownloadedVersion(videoId);
      return result.useDownloaded;
    } catch (error) {
      logVerbose(`[SmartPlaybackRouter] Error checking if video is downloaded YouTube video: ${error}`);
      return false;
    }
  }
}