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

      // Check if already downloading
      const existingStatus = await getDownloadStatus(videoId);

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

      const alreadyDownloaded = downloadedVideos.find(dv => dv.videoId === videoId);
      if (alreadyDownloaded) {
        throw new Error('Video has already been downloaded');
      }

      // Get download path from settings
      const settings = await readMainSettings();
      const downloadPath = settings.downloadPath || await getDefaultDownloadPath();

      // Create folder structure
      const folderName = this.getFolderName(sourceInfo);
      const fullDownloadPath = path.join(downloadPath, folderName);

      // Ensure directory exists
      try {
        if (!fs.existsSync(fullDownloadPath)) {
          fs.mkdirSync(fullDownloadPath, { recursive: true });
        } else {
        }
      } catch (dirError) {
        logVerbose('[DownloadManager] Error creating directory:', dirError);
        throw new Error(`Failed to create download directory: ${dirError}`);
      }

      // Update status to downloading
      await updateDownloadStatus(videoId, {
        status: 'downloading',
        progress: 0,
        startTime: Date.now(),
        sourceInfo
      });

      // Ensure yt-dlp is available
      await YtDlpManager.ensureYtDlpAvailable();
      const ytDlpCommand = YtDlpManager.getYtDlpCommand();

      // Build yt-dlp command
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const sanitizedTitle = this.sanitizeFileName(videoTitle);
      const outputTemplate = path.join(fullDownloadPath, `${sanitizedTitle}.%(ext)s`);


      const args = [
        '--output', outputTemplate,
        '--no-playlist',
        '--write-info-json',
        '--write-thumbnail',
        videoUrl
      ];


      // Start yt-dlp process
      const ytDlpProcess = spawn(ytDlpCommand, args);
      this.activeDownloads.set(videoId, ytDlpProcess);

      let downloadedFilePath = '';
      let progress = 0;

      // Handle stdout
      ytDlpProcess.stdout?.on('data', (data) => {
        const output = data.toString();
      });

      // Handle stderr for progress tracking
      ytDlpProcess.stderr?.on('data', (data) => {
        const output = data.toString();

        // Parse progress from yt-dlp output
        const progressMatch = output.match(/(\d+\.?\d*)%/);
        if (progressMatch) {
          progress = Math.min(parseFloat(progressMatch[1]), 95);
          updateDownloadStatus(videoId, { progress }).catch(console.error);
        }

        // Extract filename from output
        const filenameMatch = output.match(/Destination: (.+)/);
        if (filenameMatch) {
          downloadedFilePath = filenameMatch[1].trim();
        }
      });

      // Handle process completion
      ytDlpProcess.on('close', async (code) => {
        this.activeDownloads.delete(videoId);

        if (code === 0) {
          // Download completed successfully

          // If downloadedFilePath is empty, use the output template as fallback
          const finalFilePath = downloadedFilePath || outputTemplate;

          await this.handleDownloadComplete(videoId, videoTitle, finalFilePath, sourceInfo);
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

      // Find thumbnail file
      const thumbnailFile = this.findThumbnailFile(videoFile);

      // Get video info from JSON file if available
      let duration = 0;
      const infoFile = this.findInfoJsonFile(videoFile);

      if (infoFile && fs.existsSync(infoFile)) {
        try {
          const info = JSON.parse(fs.readFileSync(infoFile, 'utf-8'));
          duration = info.duration || 0;

          // Clean up info.json file after extracting needed metadata
          fs.unlinkSync(infoFile);
        } catch (error) {
          logVerbose(`[DownloadManager] Failed to read or cleanup info file: ${error}`);
        }
      } else {
      }

      // Clean up any remaining temporary files, keeping only essential video and thumbnail files
      this.cleanupTemporaryFiles(videoFile);

      // Create downloaded video entry
      const downloadedVideo: DownloadedVideo = {
        videoId,
        title: videoTitle,
        channelTitle: sourceInfo.type === 'youtube_channel' ? sourceInfo.channelTitle : undefined,
        playlistTitle: sourceInfo.type === 'youtube_playlist' ? sourceInfo.playlistTitle : undefined,
        filePath: videoFile,
        downloadedAt: new Date().toISOString(),
        duration,
        thumbnail: thumbnailFile,
        sourceType: sourceInfo.type,
        sourceId: sourceInfo.sourceId
      };

      logVerbose(`[DownloadManager] Created downloaded video entry:`, {
        videoId,
        title: videoTitle,
        filePath: videoFile,
        thumbnail: thumbnailFile,
        duration
      });

      // Add to downloaded videos list
      await addDownloadedVideo(downloadedVideo);

      // Update download status
      await updateDownloadStatus(videoId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now(),
        filePath: videoFile
      });


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
   * Find thumbnail file for a video
   */
  private static findThumbnailFile(videoFilePath: string): string {
    const dir = path.dirname(videoFilePath);
    const baseName = path.basename(videoFilePath, path.extname(videoFilePath));

    // Look for thumbnail files with common extensions (webp first as yt-dlp prefers it)
    const thumbnailExtensions = ['.webp', '.jpg', '.jpeg', '.png'];

    for (const ext of thumbnailExtensions) {
      const thumbnailFile = path.join(dir, baseName + ext);
      if (fs.existsSync(thumbnailFile)) {
        return thumbnailFile;
      }
    }

    logVerbose(`[DownloadManager] No thumbnail found for: ${baseName}`);
    return '';
  }

  /**
   * Find info.json file for a video
   */
  private static findInfoJsonFile(videoFilePath: string): string | null {
    const dir = path.dirname(videoFilePath);
    const baseName = path.basename(videoFilePath, path.extname(videoFilePath));

    // Try the exact base name first
    const infoFile = path.join(dir, baseName + '.info.json');
    if (fs.existsSync(infoFile)) {
      return infoFile;
    }

    // If not found, scan the directory for any .info.json files
    try {
      const files = fs.readdirSync(dir);

      const infoJsonFiles = files.filter(file => file.endsWith('.info.json'));

      if (infoJsonFiles.length > 0) {
        const fullPath = path.join(dir, infoJsonFiles[0]);
        return fullPath;
      }
    } catch (error) {
      logVerbose(`[DownloadManager] Error scanning directory for info.json: ${error}`);
    }

    return null;
  }

  /**
   * Clean up temporary files created by yt-dlp, keeping only essential video and thumbnail files
   */
  private static cleanupTemporaryFiles(videoFilePath: string): void {
    try {
      const dir = path.dirname(videoFilePath);
      const baseName = path.basename(videoFilePath, path.extname(videoFilePath));

      // List of temporary file extensions that yt-dlp might create
      const temporaryExtensions = [
        '.description',  // Video description file
        '.annotations.xml',  // Annotations file
        '.live_chat.json',  // Live chat replay
        '.f4v',  // Flash video format (if downloaded as intermediate)
        '.part',  // Partial download files
        '.ytdl',  // yt-dlp temporary files
        '.temp'   // Other temporary files
      ];

      // Clean up temporary files with the same base name
      for (const ext of temporaryExtensions) {
        const tempFile = path.join(dir, baseName + ext);
        if (fs.existsSync(tempFile)) {
          try {
            fs.unlinkSync(tempFile);
          } catch (error) {
            logVerbose(`[DownloadManager] Failed to cleanup temporary file ${tempFile}: ${error}`);
          }
        }
      }

      // Also check for any .info.json files that might have been missed
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith('.info.json')) {
            const infoFile = path.join(dir, file);
            try {
              fs.unlinkSync(infoFile);
            } catch (error) {
              logVerbose(`[DownloadManager] Failed to cleanup info.json file ${infoFile}: ${error}`);
            }
          }
        }
      } catch (error) {
        logVerbose(`[DownloadManager] Error scanning directory for remaining info.json files: ${error}`);
      }

    } catch (error) {
      logVerbose(`[DownloadManager] Error during temporary file cleanup: ${error}`);
    }
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