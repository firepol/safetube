import { VideoLoadError } from '../../shared/videoErrorHandling';

export type VideoType = 'youtube' | 'local' | 'dlna';

export interface BaseVideo {
  id: string;
  type: VideoType;
  title: string;
  thumbnail: string;
  duration: number;
  url: string;
  streamUrl?: string;
  resumeAt?: number;
  // Enhanced error handling fields
  isAvailable?: boolean;
  isFallback?: boolean;
  errorInfo?: VideoLoadError;
}

export interface YoutubeVideo extends BaseVideo {
  type: 'youtube';
}

export interface LocalVideo extends BaseVideo {
  type: 'local';
}

export interface DlnaVideo extends BaseVideo {
  type: 'dlna';
  server: string;
  port: number;
  path: string;
}

export type Video = YoutubeVideo | LocalVideo | DlnaVideo; 