import { exec } from 'child_process';
import { promisify } from 'util';
import { ipcMain } from 'electron';

const execAsync = promisify(exec);

interface VideoStream {
  url: string;
  quality: string;
  mimeType: string;
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
}

interface AudioTrack {
  url: string;
  language: string;
  mimeType: string;
  bitrate?: number;
}

export function setupYouTubeHandlers() {
  // Check if handler is already registered
  if (ipcMain.listenerCount('get-video-streams') > 0) {
    console.log('YouTube handlers already registered, skipping...');
    return;
  }

  ipcMain.handle('get-video-streams', async (_, videoId: string) => {
    try {
      // Use yt-dlp to get video info in JSON format
      const { stdout } = await execAsync(`yt-dlp -j https://www.youtube.com/watch?v=${videoId}`);
      const info = JSON.parse(stdout);

      const videoStreams: VideoStream[] = [];
      const audioTracks: AudioTrack[] = [];

      // Process formats
      for (const format of info.formats) {
        // Video-only formats
        if (format.vcodec && format.vcodec !== 'none' && (!format.acodec || format.acodec === 'none')) {
          videoStreams.push({
            url: format.url,
            quality: format.format_note || format.quality || 'unknown',
            mimeType: format.ext,
            width: format.width,
            height: format.height,
            fps: format.fps,
            bitrate: format.tbr,
          });
        }
        // Audio-only formats
        else if (format.acodec && format.acodec !== 'none' && (!format.vcodec || format.vcodec === 'none')) {
          audioTracks.push({
            url: format.url,
            language: format.language || 'en',
            mimeType: format.ext,
            bitrate: format.tbr,
          });
        }
      }

      return { videoStreams, audioTracks };
    } catch (error) {
      console.error('Error getting video streams:', error);
      throw new Error('Failed to get video streams');
    }
  });
} 