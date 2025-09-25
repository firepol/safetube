import { VideoLoadError } from '../shared/videoErrorHandling';

export interface Video {
  id: string;
  type: 'local' | 'dlna' | 'youtube' | 'downloaded';
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
  // Source information
  sourceId?: string;
  sourceTitle?: string;
  sourceType?: 'youtube_channel' | 'youtube_playlist';
  sourceThumbnail?: string;
  // For downloaded videos
  downloadedAt?: string;
  filePath?: string;
  // Enhanced error handling fields
  isAvailable?: boolean;
  isFallback?: boolean;
  errorInfo?: VideoLoadError;
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
  getVideoData: (videoId: string, navigationContext?: any) => Promise<any>;
  testHandler: () => Promise<any>;
  env: {
    ELECTRON_LOG_VERBOSE?: string;
  };
  loadAllVideosFromSources: () => Promise<{ videos: any[]; debug: string[] }>;
  loadVideosFromSources: () => Promise<{ videosBySource: any[]; debug: string[] }>;
  getYouTubeApiKey: () => Promise<string | null>;
  getYouTubeVideoInfo: (videoId: string) => Promise<{
    videoId: string;
    title: string;
    channelId: string;
    channelTitle: string;
    thumbnail: string;
  } | null>;
  getPaginatedVideos: (sourceId: string, pageNumber: number) => Promise<{ videos: any[]; paginationState: any }>;
  getLocalFolderContents: (folderPath: string, maxDepth: number, currentDepth?: number) => Promise<{ folders: any[]; videos: any[]; depth: number }>;
  getLocalSourceVideoCount: (sourcePath: string, maxDepth: number) => Promise<number>;
  getFolderVideoCount: (folderPath: string, maxDepth: number) => Promise<number>;
  getLocalVideoDuration: (videoPath: string) => Promise<number>;
  // Admin functions
  adminAuthenticate: (password: string) => Promise<{ success: boolean }>;
  adminChangePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  adminHashPassword: (password: string) => Promise<{ success: boolean; hashedPassword?: string; error?: string }>;
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
    title?: string;
    channelId?: string;
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
  clearSourceCache: (sourceId: string) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
    keepCache?: boolean;
  }>;
  // Video codec detection and conversion
  getVideoCodecInfo: (filePath: string) => Promise<{
    videoCodec: string;
    audioCodec: string;
    isSupported: boolean;
    needsConversion: boolean;
    duration: number;
    width: number;
    height: number;
    bitrate: number;
  }>;
  getCompatibleVideoPath: (originalPath: string, cacheDir?: string) => Promise<string>;
  needsVideoConversion: (filePath: string) => Promise<boolean>;
  hasConvertedVideo: (filePath: string, cacheDir?: string) => Promise<boolean>;
  getExistingConvertedVideoPath: (filePath: string, cacheDir?: string) => Promise<string | null>;
  getConversionStatus: (filePath: string) => Promise<{
    status: 'idle' | 'converting' | 'completed' | 'failed';
    progress?: number;
    error?: string;
    startTime?: number;
  }>;
  startVideoConversion: (filePath: string, options?: {
    quality?: 'low' | 'medium' | 'high';
    preserveAudio?: boolean;
    cacheDir?: string;
  }) => Promise<{ success: boolean }>;
  // Download management
  startDownload: (videoId: string, videoTitle: string, sourceInfo: any) => Promise<{ success: boolean; error?: string }>;
  getDownloadStatus: (videoId: string) => Promise<{
    videoId: string;
    status: 'pending' | 'downloading' | 'completed' | 'failed';
    progress: number;
    startTime?: number;
    endTime?: number;
    error?: string;
    filePath?: string;
    sourceInfo?: any;
  } | null>;
  cancelDownload: (videoId: string) => Promise<{ success: boolean; error?: string }>;
  isDownloading: (videoId: string) => Promise<boolean>;
  // Main settings
  readMainSettings: () => Promise<{
    downloadPath?: string;
    youtubeApiKey?: string;
    adminPassword?: string;
    enableVerboseLogging?: boolean;
  }>;
  writeMainSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
  getDefaultDownloadPath: () => Promise<string>;
  // Downloaded videos
  getDownloadedVideos: () => Promise<Array<{
    videoId: string;
    title: string;
    channelTitle?: string;
    playlistTitle?: string;
    filePath: string;
    downloadedAt: string;
    duration: number;
    thumbnail: string;
    sourceType: 'youtube_channel' | 'youtube_playlist';
    sourceId: string;
  }>>;
  getDownloadedVideosBySource: (sourceId: string) => Promise<Array<{
    videoId: string;
    title: string;
    channelTitle?: string;
    playlistTitle?: string;
    filePath: string;
    downloadedAt: string;
    duration: number;
    thumbnail: string;
    sourceType: 'youtube_channel' | 'youtube_playlist';
    sourceId: string;
  }>>;
  // Download reset functionality
  resetDownloadStatus: (videoId: string) => Promise<{ success: boolean; error?: string }>;
  checkDownloadedVideo: (videoId: string) => Promise<{
    isDownloaded: boolean;
    filePath: string | null;
    downloadedVideo: {
      videoId: string;
      title: string;
      channelTitle?: string;
      playlistTitle?: string;
      filePath: string;
      downloadedAt: string;
      duration: number;
      thumbnail: string;
      sourceType: 'youtube_channel' | 'youtube_playlist';
      sourceId: string;
    } | null;
    isAccessible: boolean;
    error?: string;
  }>;
  // YouTube Cache
  getYouTubeCache: (cacheKey: string) => Promise<any | null>;
  setYouTubeCache: (cacheKey: string, data: any) => Promise<boolean>;
  clearExpiredYouTubeCache: () => Promise<boolean>;
  loadYouTubeCacheConfig: () => Promise<boolean>;
  // Thumbnail update events
  onThumbnailReady: (callback: (data: { videoId: string; thumbnailUrl: string }) => void) => any;
  offThumbnailReady: (wrappedCallback: any) => void;
  getBestThumbnail: (videoId: string) => Promise<string | null>;
  // Navigation events for YouTube iframe links
  onNavigateToVideo: (callback: (videoId: string) => void) => any;
  offNavigateToVideo: (wrappedCallback: any) => void;
  // Validation error events
  onShowChannelNotApprovedError: (callback: (data: { videoId: string; channelId: string; title: string }) => void) => any;
  offShowChannelNotApprovedError: (wrappedCallback: any) => void;
  onShowValidationError: (callback: (data: { message: string }) => void) => any;
  offShowValidationError: (wrappedCallback: any) => void;
  // Favorites management
  favoritesGetAll: () => Promise<any[]>;
  favoritesAdd: (videoId: string, sourceId: string, type: 'youtube' | 'local' | 'dlna' | 'downloaded', title: string, thumbnail: string, duration: number, lastWatched?: string) => Promise<any>;
  favoritesRemove: (videoId: string) => Promise<any>;
  favoritesIsFavorite: (videoId: string) => Promise<boolean>;
  favoritesToggle: (videoId: string, sourceId: string, type: 'youtube' | 'local' | 'dlna' | 'downloaded', title: string, thumbnail: string, duration: number, lastWatched?: string) => Promise<any>;
  favoritesUpdateMetadata: (videoId: string, metadata: any) => Promise<any>;
  favoritesGetBySource: (sourceId: string) => Promise<any[]>;
  favoritesGetConfig: () => Promise<any>;
  favoritesUpdateConfig: (config: any) => Promise<any>;
  favoritesCleanupOrphaned: () => Promise<any[]>;
  favoritesSyncWatchHistory: () => Promise<any[]>;
  favoritesGetUnavailable: () => Promise<any[]>;
  favoritesClearUnavailable: () => Promise<{ success: boolean; count: number; error?: string }>;

  // Path utilities for cross-platform compatibility
  pathJoin: (...paths: string[]) => Promise<string>;
}
declare global {
  interface Window {
    electron: ElectronAPI;
  }
} 