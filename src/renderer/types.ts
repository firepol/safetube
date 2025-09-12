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

export interface ElectronAPI {
  send: (channel: string, data: any) => void;
  receive: (channel: string, func: (...args: any[]) => void) => void;
  removeListener: (channel: string, func: (...args: any[]) => void) => void;
  getLocalFile: (filePath: string) => Promise<string>;
  getDlnaFile: (server: string, port: number, path: string) => Promise<string>;
  getVideoStreams: (videoId: string) => Promise<any>;
  recordVideoWatching: (videoId: string, position: number, timeWatched: number, duration?: number) => Promise<void>;
  getTimeTrackingState: () => Promise<any>;
  getTimeLimits: () => Promise<any>;
  getWatchedVideos: () => Promise<any[]>;
  getPlayerConfig: () => Promise<any>;
  getVideoData: (videoId: string) => Promise<any>;
  testHandler: () => Promise<any>;
  env: {
    ELECTRON_LOG_VERBOSE?: string;
  };
  loadAllVideosFromSources: () => Promise<{ videos: any[]; debug: string[] }>;
  loadVideosFromSources: () => Promise<{ videosBySource: any[]; debug: string[] }>;
  getYouTubeApiKey: () => Promise<string | null>;
  getPaginatedVideos: (sourceId: string, pageNumber: number) => Promise<{ videos: any[]; paginationState: any }>;
  getLocalFolderContents: (folderPath: string, maxDepth: number, currentDepth?: number) => Promise<{ folders: any[]; videos: any[]; depth: number }>;
  // Admin functions
  adminAuthenticate: (password: string) => Promise<{ isAuthenticated: boolean }>;
  adminAddExtraTime: (minutes: number) => Promise<{ success: boolean }>;
  adminGetTimeExtra: () => Promise<any>;
  adminWriteTimeLimits: (timeLimits: any) => Promise<{ success: boolean }>;
  adminGetLastWatchedVideoWithSource: () => Promise<{
    video: any;
    sourceId: string;
    sourceTitle: string;
  } | null>;
  // Video source management
  videoSourcesGetAll: () => Promise<any[]>;
  videoSourcesSaveAll: (sources: any[]) => Promise<{ success: boolean }>;
  videoSourcesValidateYouTubeUrl: (url: string, type: 'youtube_channel' | 'youtube_playlist') => Promise<{
    isValid: boolean;
    errors?: string[];
    cleanedUrl?: string;
    message?: string;
  }>;
  videoSourcesValidateLocalPath: (path: string) => Promise<{
    isValid: boolean;
    errors?: string[];
    message?: string;
  }>;
  // Logging configuration methods
  setVerboseLogging: (enabled: boolean) => Promise<{ success: boolean; verbose: boolean }>;
  getVerboseLogging: () => Promise<{ verbose: boolean }>;
  // Logging methods
  log: (level: string, ...args: any[]) => Promise<void>;
  // Clear source cache
  clearSourceCache: (sourceId: string) => Promise<{ success: boolean }>;
}
declare global {
  interface Window {
    electron: ElectronAPI;
  }
} 