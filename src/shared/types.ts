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

export interface WatchedVideo {
  videoId: string;
  position: number; // seconds
  lastWatched: string; // ISO date string
  timeWatched: number; // seconds
}

// Video source types for configuration-driven system

export type VideoSourceType = 'youtube_channel' | 'youtube_playlist' | 'local';

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
}

export interface TimeTrackingConfig {
  timeLimits: TimeLimits;
  usageLog: UsageLog;
  watchedVideos: WatchedVideo[];
  videoSources: VideoSource[];
} 