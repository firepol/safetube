import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logVerbose } from '../shared/logging';
import { ThumbnailGenerationOptions, getThumbnailCacheKey } from '../shared/thumbnailUtils';

/**
 * Service for generating video thumbnails using FFmpeg
 */
export class ThumbnailGenerator {
  private static thumbnailsDir = path.join(process.cwd(), 'public', 'thumbnails');

  /**
   * Ensure thumbnails directory exists
   */
  private static ensureThumbnailsDir(): void {
    if (!fs.existsSync(this.thumbnailsDir)) {
      fs.mkdirSync(this.thumbnailsDir, { recursive: true });
    }
  }

  /**
   * Check if FFmpeg is available on the system
   */
  static async isFFmpegAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', ['-version'], { stdio: 'pipe' });

      ffmpeg.on('close', (code) => {
        resolve(code === 0);
      });

      ffmpeg.on('error', () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        ffmpeg.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Get video duration using FFprobe
   */
  static async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        videoPath
      ], { stdio: 'pipe' });

      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          const duration = parseFloat(output.trim());
          resolve(isNaN(duration) ? 0 : duration);
        } else {
          reject(new Error(`FFprobe failed with code ${code}`));
        }
      });

      ffprobe.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Generate thumbnail from video file
   */
  static async generateThumbnail(options: ThumbnailGenerationOptions): Promise<string> {
    const {
      videoPath,
      outputPath,
      timePosition,
      width = 320,
      height = 180,
      quality = 80
    } = options;

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let seekTime = timePosition;

    // If no time position specified, try to get 10% into the video
    if (seekTime === undefined) {
      try {
        const duration = await this.getVideoDuration(videoPath);
        seekTime = Math.max(1, Math.min(duration * 0.1, 30)); // Between 1-30 seconds
      } catch (error) {
        logVerbose('[ThumbnailGenerator] Failed to get video duration, using default seek time:', error);
        seekTime = 5; // Default to 5 seconds
      }
    }

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-ss', seekTime.toString(),
        '-vframes', '1',
        '-vf', `scale=${width}:${height}`,
        '-q:v', Math.round((100 - quality) / 4).toString(), // Convert quality to FFmpeg scale (2-31)
        '-y', // Overwrite output file
        outputPath
      ], { stdio: 'pipe' });

      let errorOutput = '';
      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          logVerbose(`[ThumbnailGenerator] Generated thumbnail: ${outputPath}`);
          resolve(outputPath);
        } else {
          const error = new Error(`FFmpeg failed with code ${code}: ${errorOutput}`);
          logVerbose('[ThumbnailGenerator] FFmpeg error:', error);
          reject(error);
        }
      });

      ffmpeg.on('error', (error) => {
        logVerbose('[ThumbnailGenerator] FFmpeg spawn error:', error);
        reject(error);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('Thumbnail generation timed out'));
      }, 30000);
    });
  }

  /**
   * Generate cached thumbnail for a video
   */
  static async generateCachedThumbnail(videoId: string, videoPath: string): Promise<string | null> {
    try {
      this.ensureThumbnailsDir();

      // Check if thumbnail already exists
      const cacheKey = getThumbnailCacheKey(videoId, 'local');
      const thumbnailPath = path.join(this.thumbnailsDir, `${cacheKey}.jpg`);

      if (fs.existsSync(thumbnailPath)) {
        logVerbose(`[ThumbnailGenerator] Using cached thumbnail: ${thumbnailPath}`);
        return thumbnailPath;
      }

      // Check if FFmpeg is available
      const ffmpegAvailable = await this.isFFmpegAvailable();
      if (!ffmpegAvailable) {
        logVerbose('[ThumbnailGenerator] FFmpeg not available, cannot generate thumbnail');
        return null;
      }

      // Generate new thumbnail
      await this.generateThumbnail({
        videoPath,
        outputPath: thumbnailPath,
        width: 320,
        height: 180,
        quality: 80
      });

      return thumbnailPath;
    } catch (error) {
      logVerbose(`[ThumbnailGenerator] Failed to generate thumbnail for ${videoId}:`, error);
      return null;
    }
  }

  /**
   * Clean up old cached thumbnails (older than specified days)
   */
  static async cleanupOldThumbnails(maxAgeDays: number = 30): Promise<void> {
    try {
      if (!fs.existsSync(this.thumbnailsDir)) {
        return;
      }

      const files = fs.readdirSync(this.thumbnailsDir);
      const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

      for (const file of files) {
        const filePath = path.join(this.thumbnailsDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          logVerbose(`[ThumbnailGenerator] Removed old thumbnail: ${file}`);
        }
      }
    } catch (error) {
      console.warn('[ThumbnailGenerator] Error cleaning up thumbnails:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { count: number; totalSize: number } {
    try {
      if (!fs.existsSync(this.thumbnailsDir)) {
        return { count: 0, totalSize: 0 };
      }

      const files = fs.readdirSync(this.thumbnailsDir);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(this.thumbnailsDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      }

      return { count: files.length, totalSize };
    } catch (error) {
      console.warn('[ThumbnailGenerator] Error getting cache stats:', error);
      return { count: 0, totalSize: 0 };
    }
  }
}