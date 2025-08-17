// This file is no longer needed as the types have been moved to types.ts 

interface ElectronAPI {
  send: (channel: string, data: any) => void;
  receive: (channel: string, func: (...args: any[]) => void) => void;
  removeListener: (channel: string, func: (...args: any[]) => void) => void;
  getLocalFile: (filePath: string) => Promise<{ url: string; type: string }>;
  getDlnaFile: (server: string, port: number, path: string) => Promise<{ url: string; type: string }>;
  getVideoStreams: (videoId: string) => Promise<{ videoStreams: VideoStream[]; audioTracks: AudioTrack[] }>;
  getVideoInfo: (videoId: string) => Promise<{ streamUrl?: string; audioStreamUrl?: string; preferredLanguages?: string[] }>;
  recordVideoWatching: (videoId: string, position: number, timeWatched: number) => Promise<{ success: boolean }>;
  getTimeTrackingState: () => Promise<{ currentDate: string; timeUsedToday: number; timeLimitToday: number; timeRemaining: number; isLimitReached: boolean }>;
  getPlayerConfig: () => Promise<any>;
  getVideoData: (id: string) => Promise<any>;
  getTimeLimits: () => Promise<any>;
  getDlnaFile: (server: string, port: number, path: string) => Promise<string>;
  setVerboseLogging: (enabled: boolean) => Promise<{ success: boolean; verbose: boolean }>;
  getVerboseLogging: () => Promise<{ verbose: boolean }>;
} 