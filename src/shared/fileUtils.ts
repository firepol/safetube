import { TimeLimits, UsageLog, WatchedVideo, VideoSource, TimeExtra, MainSettings, DownloadStatus, DownloadedVideo } from './types';

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

// File path encoding/decoding utilities (pure functions, no Node.js dependencies)
export function encodeFilePath(filePath: string): string {
  // Use base64 encoding to safely encode file paths for use as video IDs
  if (typeof btoa !== 'undefined') {
    // Browser environment - handle Unicode properly
    // Convert to UTF-8 bytes first, then base64 encode
    const utf8Bytes = new TextEncoder().encode(filePath);
    const binaryString = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
    return btoa(binaryString);
  } else {
    // Node.js environment
    return Buffer.from(filePath, 'utf8').toString('base64');
  }
}

export function decodeFilePath(encodedPath: string): string {
  // Decode base64 encoded file paths
  if (typeof atob !== 'undefined') {
    // Browser environment - handle Unicode properly
    // Base64 decode first, then convert from UTF-8 bytes
    const binaryString = atob(encodedPath);
    const utf8Bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      utf8Bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder().decode(utf8Bytes);
  } else {
    // Node.js environment
    return Buffer.from(encodedPath, 'base64').toString('utf8');
  }
}

export function isEncodedFilePath(videoId: string): boolean {
  // Check if a video ID is an encoded file path
  try {
    // Try to decode it - if it succeeds, it's likely an encoded path
    decodeFilePath(videoId);
    return true;
  } catch {
    return false;
  }
}