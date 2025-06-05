import { VideoStream, AudioTrack } from '../services/youtube';

declare global {
  interface Window {
    electron: {
      getLocalFile: (filePath: string) => Promise<string>;
      getDlnaFile: (server: string, port: number, path: string) => Promise<string>;
      getVideoStreams: (videoId: string) => Promise<{ videoStreams: VideoStream[]; audioTracks: AudioTrack[] }>;
    };
  }
} 