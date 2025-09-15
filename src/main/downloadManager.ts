import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logVerbose } from '../shared/logging';
import { YtDlpManager } from './ytDlpManager';
import {
  readMainSettings,
  getDefaultDownloadPath,
  updateDownloadStatus,
  getDownloadStatus,
  addDownloadedVideo
} from './fileUtils';
import { DownloadStatus, DownloadedVideo } from '../shared/types';

export class DownloadManager {
  private static activeDownloads = new Map<string, ChildProcess>();

  /**
   * Sanitize a string to be safe for use as a file name across different operating systems
   */
  private static sanitizeFileName(fileName: string): string {
    // Replace problematic characters with safe alternatives
    return fileName
      // Replace forward and back slashes with dash (prevents unwanted subdirectories)
      .replace(/[\/\\]/g, ' - ')
      // Replace colons with dash (problematic on Windows)
      .replace(/:/g, ' -')
      // Replace other problematic characters with nothing
      .replace(/[<>"|?*]/g, '')
      // Replace pipe character
      .replace(/\|/g, ' - ')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      // Remove leading/trailing spaces and dots (problematic on Windows)
      .replace(/^[\s.]+|[\s.]+$/g, '')
      // Limit length to prevent filesystem issues (200 chars should be safe)
      .substring(0, 200)
      .trim();
  }

  /**
   * Start downloading a YouTube video
   */
  static async startDownload(
    videoId: string,
    videoTitle: string,
    sourceInfo: {
      type: 'youtube_channel' | 'youtube_playlist';
      sourceId: string;
      channelTitle?: string;
      playlistTitle?: string;
    }
  ): Promise<void> {
    try {
      logVerbose('[DownloadManager] Starting download for:', { videoId, videoTitle, sourceInfo });

      // Check if already downloading
      const existingStatus = await getDownloadStatus(videoId);
      logVerbose('[DownloadManager] Existing status:', existingStatus);

      if (existingStatus && (existingStatus.status === 'downloading' || existingStatus.status === 'pending')) {
        throw new Error('Video is already being downloaded');
      }

      // Check if already downloaded
      if (existingStatus && existingStatus.status === 'completed') {
        throw new Error('Video has already been downloaded');
      }

      // Also check the downloaded videos list to prevent duplicates
      const { readDownloadedVideos } = await import('./fileUtils');
      const downloadedVideos = await readDownloadedVideos();
      logVerbose('[DownloadManager] Downloaded videos count:', downloadedVideos.length);

      const alreadyDownloaded = downloadedVideos.find(dv => dv.videoId === videoId);
      if (alreadyDownloaded) {
        throw new Error('Video has already been downloaded');
      }

      // Get download path from settings
      const settings = await readMainSettings();
      const downloadPath = settings.downloadPath || await getDefaultDownloadPath();
      logVerbose('[DownloadManager] Download path:', downloadPath);

      // Create folder structure
      const folderName = this.getFolderName(sourceInfo);
      const fullDownloadPath = path.join(downloadPath, folderName);
      logVerbose('[DownloadManager] Full download path:', fullDownloadPath);

      // Ensure directory exists
      try {
        if (!fs.existsSync(fullDownloadPath)) {
          logVerbose('[DownloadManager] Creating directory:', fullDownloadPath);
          fs.mkdirSync(fullDownloadPath, { recursive: true });
          logVerbose('[DownloadManager] Directory created successfully');
        } else {
          logVerbose('[DownloadManager] Directory already exists');
        }
      } catch (dirError) {
        logVerbose('[DownloadManager] Error creating directory:', dirError);
        throw new Error(`Failed to create download directory: ${dirError}`);
      }

      // Update status to downloading
      logVerbose('[DownloadManager] Updating download status to downloading');
      await updateDownloadStatus(videoId, {
        status: 'downloading',
        progress: 0,
        startTime: Date.now(),
        sourceInfo
      });
      logVerbose('[DownloadManager] Download status updated successfully');

      // Ensure yt-dlp is available
      await YtDlpManager.ensureYtDlpAvailable();
      const ytDlpCommand = YtDlpManager.getYtDlpCommand();

      // Build yt-dlp command
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const sanitizedTitle = this.sanitizeFileName(videoTitle);
      const outputTemplate = path.join(fullDownloadPath, `${sanitizedTitle}.%(ext)s`);

      logVerbose('[DownloadManager] Original title:', videoTitle);
      logVerbose('[DownloadManager] Sanitized title:', sanitizedTitle);

      const args = [
        '--output', outputTemplate,
        '--no-playlist',
        '--write-info-json',
        '--write-thumbnail',
        videoUrl
      ];

      logVerbose(`[DownloadManager] Starting download: ${videoUrl}`);
      logVerbose(`[DownloadManager] Command: ${ytDlpCommand} ${args.join(' ')}`);

      // Start yt-dlp process
      const ytDlpProcess = spawn(ytDlpCommand, args);
      this.activeDownloads.set(videoId, ytDlpProcess);

      let downloadedFilePath = '';
      let progress = 0;

      // Handle stdout
      ytDlpProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        logVerbose(`[DownloadManager] yt-dlp stdout: ${output}`);
      });

      // Handle stderr for progress tracking
      ytDlpProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        logVerbose(`[DownloadManager] yt-dlp stderr: ${output}`);

        // Parse progress from yt-dlp output
        const progressMatch = output.match(/(\d+\.?\d*)%/);
        if (progressMatch) {
          progress = Math.min(parseFloat(progressMatch[1]), 95);
          updateDownloadStatus(videoId, { progress }).catch(console.error);
        }

        // Extract filename from output
        const filenameMatch = output.match(/Destination: (.+)/);
        if (filenameMatch) {
          downloadedFilePath = filenameMatch[1];
        }
      });

      // Handle process completion
      ytDlpProcess.on('close', async (code) => {
        this.activeDownloads.delete(videoId);

        if (code === 0) {
          // Download completed successfully
          await this.handleDownloadComplete(videoId, videoTitle, downloadedFilePath, sourceInfo);
        } else {
          // Download failed
          await updateDownloadStatus(videoId, {
            status: 'failed',
            progress: 0,
            endTime: Date.now(),
            error: `yt-dlp exited with code ${code}`
          });
        }
      });

      // Handle process error
      ytDlpProcess.on('error', async (error) => {
        this.activeDownloads.delete(videoId);
        await updateDownloadStatus(videoId, {
          status: 'failed',
          progress: 0,
          endTime: Date.now(),
          error: error.message
        });
      });

    } catch (error) {
      await updateDownloadStatus(videoId, {
        status: 'failed',
        progress: 0,
        endTime: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get folder name based on source info
   */
  private static getFolderName(sourceInfo: {
    type: 'youtube_channel' | 'youtube_playlist';
    sourceId: string;
    channelTitle?: string;
    playlistTitle?: string;
  }): string {
    // For YouTube channels, use channel title
    if (sourceInfo.type === 'youtube_channel' && sourceInfo.channelTitle) {
      return this.sanitizeFolderName(sourceInfo.channelTitle);
    }

    // For YouTube playlists, use playlist title
    if (sourceInfo.type === 'youtube_playlist' && sourceInfo.playlistTitle) {
      return this.sanitizeFolderName(sourceInfo.playlistTitle);
    }

    // If we have a channel title but it's a playlist, still use channel title (channel takes priority)
    if (sourceInfo.channelTitle) {
      return this.sanitizeFolderName(sourceInfo.channelTitle);
    }

    // Fallback to source title or source ID
    const fallbackName = sourceInfo.playlistTitle || sourceInfo.channelTitle || sourceInfo.sourceId;
    return this.sanitizeFolderName(fallbackName);
  }

  /**
   * Sanitize folder name for filesystem compatibility
   */
  private static sanitizeFolderName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 100); // Limit length
  }

  /**
   * Handle successful download completion
   */
  private static async handleDownloadComplete(
    videoId: string,
    videoTitle: string,
    filePath: string,
    sourceInfo: any
  ): Promise<void> {
    try {
      // Find the actual video file (yt-dlp might have added extension)
      const videoFile = this.findVideoFile(filePath);

      // Get video info from JSON file if available
      const infoFile = filePath.replace(/\.[^/.]+$/, '.info.json');
      let duration = 0;
      let thumbnail = '';

      if (fs.existsSync(infoFile)) {
        try {
          const info = JSON.parse(fs.readFileSync(infoFile, 'utf-8'));
          duration = info.duration || 0;
          thumbnail = info.thumbnail || '';
        } catch (error) {
          logVerbose(`[DownloadManager] Failed to read info file: ${error}`);
        }
      }

      // Create downloaded video entry
      const downloadedVideo: DownloadedVideo = {
        videoId,
        title: videoTitle,
        channelTitle: sourceInfo.type === 'youtube_channel' ? sourceInfo.channelTitle : undefined,
        playlistTitle: sourceInfo.type === 'youtube_playlist' ? sourceInfo.playlistTitle : undefined,
        filePath: videoFile,
        downloadedAt: new Date().toISOString(),
        duration,
        thumbnail,
        sourceType: sourceInfo.type,
        sourceId: sourceInfo.sourceId
      };

      // Add to downloaded videos list
      await addDownloadedVideo(downloadedVideo);

      // Update download status
      await updateDownloadStatus(videoId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now(),
        filePath: videoFile
      });

      logVerbose(`[DownloadManager] Download completed: ${videoId} -> ${videoFile}`);

    } catch (error) {
      logVerbose(`[DownloadManager] Error handling download completion: ${error}`);
      await updateDownloadStatus(videoId, {
        status: 'failed',
        progress: 0,
        endTime: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Find the actual video file from yt-dlp output path
   */
  private static findVideoFile(outputPath: string): string {
    const dir = path.dirname(outputPath);
    const baseName = path.basename(outputPath, path.extname(outputPath));

    // Look for video files with common extensions
    const videoExtensions = ['.mp4', '.webm', '.mkv', '.avi', '.mov'];

    for (const ext of videoExtensions) {
      const videoFile = path.join(dir, baseName + ext);
      if (fs.existsSync(videoFile)) {
        return videoFile;
      }
    }

    // Fallback to original path
    return outputPath;
  }

  /**
   * Cancel an active download
   */
  static async cancelDownload(videoId: string): Promise<void> {
    const process = this.activeDownloads.get(videoId);
    if (process) {
      process.kill();
      this.activeDownloads.delete(videoId);

      await updateDownloadStatus(videoId, {
        status: 'failed',
        progress: 0,
        endTime: Date.now(),
        error: 'Download cancelled by user'
      });
    }
  }

  /**
   * Get download progress for a video
   */
  static async getDownloadProgress(videoId: string): Promise<DownloadStatus | null> {
    return getDownloadStatus(videoId);
  }

  /**
   * Check if a video is currently being downloaded
   */
  static isDownloading(videoId: string): boolean {
    return this.activeDownloads.has(videoId);
  }
}
