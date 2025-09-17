export interface ElectronEnv {
  ELECTRON_LOG_VERBOSE: string;
}

export interface ElectronAPI {
  env: ElectronEnv;
  // Add other exposed methods as needed for shared code
  getVerboseLogging: () => Promise<{ verbose: boolean }>;
  log: (level: string, ...args: any[]) => Promise<void>;
  favoritesGetAll: () => Promise<FavoriteVideo[]>;
  favoritesIsFavorite: (videoId: string) => Promise<boolean>;
  favoritesToggle: (videoId: string, source: string, type: string, title: string, thumbnail: string, duration: number, lastWatched?: string) => Promise<{ favorite: FavoriteVideo | null; isFavorite: boolean }>;
  // Include more if needed for shared types
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export interface TimeLimits {
  Monday: number;
  Tuesday: number;
  Wednesday: number;
  Thursday: number;
  Friday: number;
  Saturday: number;
  Sunday: number;
  warningThresholdMinutes?: number;
  countdownWarningSeconds?: number;
  audioWarningSeconds?: number;
  timeUpMessage?: string;
  useSystemBeep?: boolean;
  customBeepSound?: string;
}

// Type for day-of-week keys only (for functions that need to access time limits)
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface UsageLog {
  [date: string]: number; // ISO date string -> seconds used (for precision)
}

// New interface for extra time added by parents
export interface TimeExtra {
  [date: string]: number; // ISO date string -> minutes added
}

export interface WatchedVideo {
  videoId: string;
  position: number; // seconds
  lastWatched: string; // ISO date string
  timeWatched: number; // seconds
  duration: number; // video duration in seconds
  watched: boolean; // whether video was fully watched
  // Enhanced metadata for faster history loading
  title: string; // video title
  thumbnail: string; // thumbnail URL or local path
  source: string; // source ID this video belongs to
  firstWatched: string; // ISO date string when first watched
}

// Video source types for configuration-driven system

export type VideoSourceType = 'youtube_channel' | 'youtube_playlist' | 'local';

// Form-specific type that includes the generic "youtube" option for auto-detection
export type VideoSourceFormType = VideoSourceType | 'youtube';

export interface YouTubeChannelSource {
  id: string;
  type: 'youtube_channel';
  url: string; // e.g. https://www.youtube.com/channel/UCxxxxx
  title: string;
  sortOrder?: 'newestFirst' | 'oldestFirst';
}

export interface YouTubePlaylistSource {
  id: string;
  type: 'youtube_playlist';
  url: string; // e.g. https://www.youtube.com/playlist?list=PLxxxxxx
  title: string;
  sortOrder?: 'playlistOrder' | 'newestFirst' | 'oldestFirst';
}

export interface LocalFolderSource {
  id: string;
  type: 'local';
  path: string;
  title: string;
  sortOrder?: 'alphabetical' | 'dateAdded' | 'manual';
  maxDepth?: number; // default 2
}

export type VideoSource = YouTubeChannelSource | YouTubePlaylistSource | LocalFolderSource;

// Video source management interfaces
export interface VideoSourceFormData {
  id?: string; // undefined for new sources
  type: VideoSourceFormType; // Allows 'youtube' for auto-detection
  url?: string;
  path?: string;
  title: string;
  sortOrder?: string;
  maxDepth?: number;
}

export interface VideoSourceValidation {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  cleanedUrl?: string; // for YouTube URLs that were cleaned
}

export interface VideoSourceManagementState {
  sources: VideoSource[];
  isLoading: boolean;
  error: string | null;
  editingSource: VideoSourceFormData | null;
  isAdding: boolean;
}

// YouTube cache metadata for efficient updates
export interface YouTubeSourceCache {
  sourceId: string;
  type: 'youtube_channel' | 'youtube_playlist';
  lastFetched: string; // ISO date
  lastVideoDate?: string; // ISO date of newest video in cache
  videos: Array<{
    id: string;
    title: string;
    publishedAt: string;
    thumbnail: string;
    duration: number;
    url: string;
    [key: string]: any;
  }>;
}

export interface TimeTrackingState {
  currentDate: string;
  timeUsedToday: number; // seconds
  timeLimitToday: number; // seconds (converted from minutes)
  timeRemaining: number; // seconds
  isLimitReached: boolean;
  extraTimeToday?: number; // minutes added today
}

export interface TimeTrackingConfig {
  timeLimits: TimeLimits;
  usageLog: UsageLog;
  watchedVideos: WatchedVideo[];
  videoSources: VideoSource[];
}

// New interface for admin authentication
export interface AdminAuth {
  isAuthenticated: boolean;
  sessionExpiry?: number; // timestamp when session expires
}

// New interface for admin time extension
export interface TimeExtension {
  minutes: number;
  reason?: string;
  timestamp: string;
}

// Main settings interface for global application configuration
export interface MainSettings {
  downloadPath?: string; // Path where downloaded videos are stored
  youtubeApiKey?: string; // YouTube API key for enhanced functionality
  adminPassword?: string; // Admin access password
  enableVerboseLogging?: boolean; // Enable detailed logging
}

// Download status tracking
export interface DownloadStatus {
  videoId: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number; // 0-100
  startTime?: number; // timestamp when download started
  endTime?: number; // timestamp when download completed
  error?: string; // error message if failed
  filePath?: string; // path to downloaded file when completed
  sourceInfo?: {
    type: 'youtube_channel' | 'youtube_playlist';
    sourceId: string;
    channelTitle?: string;
    playlistTitle?: string;
  };
}

// Downloaded video metadata
export interface DownloadedVideo {
  videoId: string;
  title: string;
  channelTitle?: string;
  playlistTitle?: string;
  filePath: string;
  downloadedAt: string; // ISO date string
  duration: number; // seconds
  thumbnail: string;
  sourceType: 'youtube_channel' | 'youtube_playlist';
  sourceId: string;
}

// Video ID parsing and generation utilities
export interface ParsedVideoId {
  type: 'youtube' | 'local' | 'dlna';
  originalId: string;
  path?: string; // for local and dlna videos
  host?: string; // for dlna videos (e.g., "192.168.1.100:8200")
}

export interface VideoIdUtilityResult {
  success: boolean;
  parsed?: ParsedVideoId;
  error?: string;
}

// Favorites System Types

export interface FavoriteVideo {
  videoId: string;                                   // Unique video identifier (cross-source compatible)
  dateAdded: string;                                // ISO date string when favorited
  sourceType: 'youtube' | 'local' | 'dlna';        // Video type for proper handling
  title: string;                                    // Video title for display
  thumbnail?: string;                               // Optional thumbnail URL/path
  duration?: number;                                // Optional duration in seconds
}

export interface FavoritesConfig {
  favorites: FavoriteVideo[];
  lastModified: string;                            // ISO date string for sync/cache purposes
}

// Video metadata interface for adding favorites
export interface VideoMetadata {
  id: string;
  type: 'youtube' | 'local' | 'dlna';
  title: string;
  thumbnail?: string;
  duration?: number;
  url?: string;
}

// Favorites validation and utility types
export interface FavoriteValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: FavoriteVideo;
}

export interface FavoritesOperationResult {
  success: boolean;
  error?: string;
  data?: FavoriteVideo | FavoriteVideo[] | FavoritesConfig | boolean;
} 