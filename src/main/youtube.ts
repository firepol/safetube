import { exec } from 'child_process';
import { promisify } from 'util';
import { ipcMain } from 'electron';
import { logVerbose } from '../shared/logging';
import { YtDlpManager } from './ytDlpManager';
import { IPC } from '../shared/ipc-channels';

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
    logVerbose('YouTube handlers already registered, skipping...');
    return;
  }

  ipcMain.handle(IPC.PLAYBACK.GET_VIDEO_STREAMS, async (_, videoId: string) => {
    try {
      // Ensure yt-dlp is available (auto-download on Windows if needed)
      await YtDlpManager.ensureYtDlpAvailable();
      
      // Use yt-dlp to get video info in JSON format
      const ytDlpCommand = YtDlpManager.getYtDlpCommand();
      const { stdout } = await execAsync(`${ytDlpCommand} -j https://www.youtube.com/watch?v=${videoId}`);
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
      
      // Check if it's a yt-dlp availability error
      if (error instanceof Error && error.message.includes('yt-dlp is required')) {
        throw new Error(`YouTube functionality requires yt-dlp. ${error.message}`);
      }
      
      throw new Error('Failed to get video streams. Please check your internet connection and try again.');
    }
  });
} 