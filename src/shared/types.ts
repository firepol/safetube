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

export type VideoSourceType = 'youtube_channel' | 'youtube_playlist' | 'dlna' | 'local';
export type SortOrder = 'newestFirst' | 'manual' | 'alphabetical';

export interface VideoSource {
  id: string;
  type: VideoSourceType;
  title: string;
  sortOrder: SortOrder;
  url?: string;
  path?: string;
  allowedFolder?: string;
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