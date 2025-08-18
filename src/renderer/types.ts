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
  recordVideoWatching: (videoId: string, position: number, timeWatched: number) => Promise<void>;
  getTimeTrackingState: () => Promise<any>;
  getTimeLimits: () => Promise<any>;
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
}
declare global {
  interface Window {
    electron: ElectronAPI;
  }
} 