export interface ElectronEnv {
  ELECTRON_LOG_VERBOSE: string;
}

// ElectronAPI interface is defined in src/renderer/types.ts to avoid conflicts

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
  channelId?: string; // YouTube channel ID for validation (fetched from YouTube API)
  sortPreference?: 'newestFirst' | 'oldestFirst';
}

export interface YouTubePlaylistSource {
  id: string;
  type: 'youtube_playlist';
  url: string; // e.g. https://www.youtube.com/playlist?list=PLxxxxxx
  title: string;
  sortPreference?: 'playlistOrder' | 'newestFirst' | 'oldestFirst';
}

export interface LocalFolderSource {
  id: string;
  type: 'local';
  path: string;
  title: string;
  sortPreference?: 'alphabetical' | 'dateAdded' | 'manual';
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
  sortPreference?: string;
  maxDepth?: number;
  channelId?: string; // For YouTube channel sources
}

export interface VideoSourceValidation {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  cleanedUrl?: string; // for YouTube URLs that were cleaned
  title?: string; // Fetched title for YouTube sources
  channelId?: string; // Fetched channelId for YouTube channel sources
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
  allowYouTubeClicksToOtherVideos?: boolean; // Allow clicks to non-approved channels (default: false - most restrictive)
  remoteAccessEnabled?: boolean; // Enable HTTP server on 0.0.0.0 for LAN access (default: false - localhost only)
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
  type: 'youtube' | 'local' | 'dlna' | 'downloaded';
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
  sourceType: 'youtube' | 'local' | 'dlna' | 'downloaded';        // Video type for proper handling
  sourceId: string;                                 // Source ID for validation (which approved source this video belongs to)
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
  type: 'youtube' | 'local' | 'dlna' | 'downloaded';
  source: string;                                   // Source ID this video belongs to
  title: string;
  thumbnail?: string;
  duration?: number;
  url?: string;
}

// Video data structure for batch database operations
export interface VideoBatchUpsertData {
  id: string;
  title?: string;
  thumbnail?: string;
  duration?: number;
  sourceId?: string;
  url?: string;
  publishedAt?: string | null;
  published_at?: string | null;  // Alternative property name (normalized internally)
  description?: string | null;
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

// YouTube metadata normalization types
export interface NormalizedVideoSource {
  id: string;                           // Normalized video ID
  originalId: string;                   // Original ID as provided
  type: 'youtube' | 'local' | 'dlna' | 'downloaded';  // Source type
  title: string;                        // Video title
  thumbnail?: string;                   // Thumbnail URL/path
  duration?: number;                    // Duration in seconds
  url?: string;                         // Original URL if available
  metadata: {                           // Additional metadata
    isValidId: boolean;                 // Whether ID passed validation
    thumbnailGenerated: boolean;        // Whether thumbnail was generated vs provided
    normalizedAt: string;               // ISO timestamp of normalization
  };
}

export interface VideoMetadataValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalized?: NormalizedVideoSource;
}

// Search & Moderation Feature Types

export type SearchType = 'database' | 'youtube';

export interface Search {
  id: number;
  query: string;
  search_type: SearchType;
  result_count: number;
  timestamp: string; // ISO date string
  created_at: string;
}

export type WishlistStatus = 'pending' | 'approved' | 'denied';

export interface WishlistItem {
  id: number;
  video_id: string;
  title: string;
  thumbnail: string | null;
  description: string | null;
  channel_id: string | null;
  channel_name: string | null;
  duration: number | null;
  url: string;
  status: WishlistStatus;
  requested_at: string; // ISO date string
  reviewed_at: string | null; // ISO date string
  reviewed_by: string | null;
  denial_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  id: string;
  title: string;
  thumbnail: string;
  description: string;
  duration: number;
  channelId: string;
  channelName: string;
  url: string;
  publishedAt: string;
  type?: 'youtube' | 'local' | 'dlna'; // Video type
  isApprovedSource?: boolean; // Whether video is from approved source
  isInWishlist?: boolean; // Whether video is already in wishlist
  wishlistStatus?: WishlistStatus; // Status if in wishlist
}

export interface VideoData {
  id: string;
  title: string;
  thumbnail: string;
  description: string;
  duration: number;
  channelId: string;
  channelName: string;
  url: string;
  publishedAt: string;
}

export interface SearchResultsCacheEntry {
  id: number;
  search_query: string;
  video_id: string;
  video_data: string; // JSON blob
  position: number;
  search_type: SearchType;
  fetch_timestamp: string;
  expires_at: string;
  created_at: string;
} 