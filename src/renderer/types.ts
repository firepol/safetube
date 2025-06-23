import { VideoStream, AudioTrack } from './services/youtube';

export interface Video {
  id: string;
  type: 'local' | 'dlna' | 'youtube';
  title: string;
  thumbnail: string;
  duration: number;
  url: string;
  // For local videos with separate streams
  video?: string;
  audio?: string;
  // For YouTube videos
  streamUrl?: string;
  audioStreamUrl?: string;
  resumeAt?: number;
  server?: string;
  port?: number;
  path?: string;
  preferredLanguages?: string[];
  useJsonStreamUrls?: boolean;
}

declare global {
  interface Window {
    electron: {
      send: (channel: string, data: any) => void;
      receive: (channel: string, func: (...args: any[]) => void) => void;
      removeListener: (channel: string, func: (...args: any[]) => void) => void;
      getLocalFile: (filePath: string) => Promise<string>;
      getDlnaFile: (server: string, port: number, path: string) => Promise<string>;
      getVideoStreams: (videoId: string) => Promise<{ videoStreams: VideoStream[]; audioTracks: AudioTrack[] }>;
      recordVideoWatching: (videoId: string, position: number, timeWatched: number) => Promise<{ success: boolean }>;
      getTimeTrackingState: () => Promise<{ currentDate: string; timeUsedToday: number; timeLimitToday: number; timeRemaining: number; isLimitReached: boolean }>;
    };
  }
} 