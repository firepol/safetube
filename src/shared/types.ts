export interface TimeLimits {
  Monday: number;
  Tuesday: number;
  Wednesday: number;
  Thursday: number;
  Friday: number;
  Saturday: number;
  Sunday: number;
}

export interface UsageLog {
  [date: string]: number; // ISO date string -> minutes used
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
  timeUsedToday: number;
  timeLimitToday: number;
  timeRemaining: number;
  isLimitReached: boolean;
}

export interface TimeTrackingConfig {
  timeLimits: TimeLimits;
  usageLog: UsageLog;
  watchedVideos: WatchedVideo[];
  videoSources: VideoSource[];
} 