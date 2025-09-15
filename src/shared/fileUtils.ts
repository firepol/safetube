import { TimeLimits, UsageLog, WatchedVideo, VideoSource, TimeExtra, MainSettings, DownloadStatus, DownloadedVideo, ParsedVideoId, VideoIdUtilityResult } from './types';

// This file contains only types and interfaces that can be shared between main and renderer processes
// All Node.js-specific functionality has been moved to src/main/fileUtils.ts

// These are just type exports - the actual implementations are in src/main/fileUtils.ts
export type {
  TimeLimits,
  UsageLog,
  WatchedVideo,
  VideoSource,
  TimeExtra,
  MainSettings,
  DownloadStatus,
  DownloadedVideo
};

// URI-style video ID utilities

export function parseVideoId(videoId: string): VideoIdUtilityResult {
  try {
    // YouTube video (11 characters, alphanumeric with - and _)
    if (videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
      return {
        success: true,
        parsed: {
          type: 'youtube',
          originalId: videoId
        }
      };
    }

    // Local video (starts with local:)
    if (videoId.startsWith('local:')) {
      const path = videoId.substring(6); // Remove 'local:' prefix
      return {
        success: true,
        parsed: {
          type: 'local',
          originalId: videoId,
          path: path
        }
      };
    }

    // DLNA video (starts with dlna://)
    if (videoId.startsWith('dlna://')) {
      const urlPart = videoId.substring(7); // Remove 'dlna://' prefix
      const firstSlash = urlPart.indexOf('/');
      if (firstSlash === -1) {
        return {
          success: false,
          error: 'Invalid DLNA URL format: missing path'
        };
      }
      const host = urlPart.substring(0, firstSlash);
      const path = urlPart.substring(firstSlash);

      return {
        success: true,
        parsed: {
          type: 'dlna',
          originalId: videoId,
          host: host,
          path: path
        }
      };
    }

    // Legacy encoded format or example videos - try to handle gracefully
    if (videoId.startsWith('local_') || videoId.startsWith('example-')) {
      return {
        success: true,
        parsed: {
          type: 'local', // Assume local for legacy
          originalId: videoId
        }
      };
    }

    return {
      success: false,
      error: `Unknown video ID format: ${videoId}`
    };
  } catch (error) {
    return {
      success: false,
      error: `Error parsing video ID: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export function createLocalVideoId(filePath: string): string {
  // Create a local video ID in the format local:/path/to/video.mp4
  // No encoding needed - JSON will handle escaping when serialized
  return `local:${filePath}`;
}

export function createDLNAVideoId(host: string, path: string): string {
  // Create a DLNA video ID in the format dlna://host:port/path/to/video.mp4
  return `dlna://${host}${path}`;
}

export function extractPathFromVideoId(videoId: string): string | null {
  const result = parseVideoId(videoId);
  if (result.success && result.parsed?.path) {
    return result.parsed.path;
  }
  return null;
}