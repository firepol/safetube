import { VideoSourceValidation, VideoSourceType } from './types';

/**
 * Cleans a YouTube URL by extracting the playlist ID from watch URLs
 * Converts: https://www.youtube.com/watch?v=U5P5rEzuKy0&list=PLIbdwDXxccgQpVd37Auo634lvDV_lskA7
 * To: https://www.youtube.com/playlist?list=PLIbdwDXxccgQpVd37Auo634lvDV_lskA7
 */
export function cleanYouTubePlaylistUrl(url: string): string {
  // Check if it's a watch URL with playlist parameter
  const watchWithPlaylistRegex = /^https?:\/\/(www\.)?youtube\.com\/watch\?.*list=([^&]+)/;
  const match = url.match(watchWithPlaylistRegex);

  if (match) {
    const playlistId = match[2];
    return `https://www.youtube.com/playlist?list=${playlistId}`;
  }

  return url;
}

/**
 * Cleans a YouTube channel URL by removing suffixes like /videos, /playlists, etc.
 * Converts: https://www.youtube.com/@username/videos
 * To: https://www.youtube.com/@username
 */
export function cleanYouTubeChannelUrl(url: string): string {
  // Remove common channel suffixes
  const suffixes = ['/videos', '/playlists', '/community', '/channels', '/about', '/featured'];

  for (const suffix of suffixes) {
    if (url.endsWith(suffix)) {
      return url.slice(0, -suffix.length);
    }
  }

  return url;
}

/**
 * Extracts channel ID from various YouTube channel URL formats
 */
export function extractChannelId(url: string): string | null {
  // Channel ID format: UCxxxxxxxxxxxxxxxxxxxxxx
  const channelIdRegex = /UC[a-zA-Z0-9_-]{22}/;
  const match = url.match(channelIdRegex);
  return match ? match[0] : null;
}

/**
 * Extracts playlist ID from YouTube playlist URL
 */
export function extractPlaylistId(url: string): string | null {
  // Playlist ID format: PLxxxxxxxxxxxxxxxxxxxxxx
  const playlistIdRegex = /list=([a-zA-Z0-9_-]+)/;
  const match = url.match(playlistIdRegex);
  return match ? match[1] : null;
}

/**
 * Validates YouTube channel URL format
 */
export function isValidYouTubeChannelUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/channel\/UC[a-zA-Z0-9_-]{22}/,
    /^https?:\/\/(www\.)?youtube\.com\/@[a-zA-Z0-9_-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/c\/[a-zA-Z0-9_-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/user\/[a-zA-Z0-9_-]+/
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

/**
 * Validates YouTube playlist URL format
 */
export function isValidYouTubePlaylistUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=[a-zA-Z0-9_-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/watch\?.*list=[a-zA-Z0-9_-]+/ // Watch URL with playlist
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

/**
 * Validates local folder path
 */
export function isValidLocalPath(path: string): boolean {
  // Basic validation - check if it looks like a valid path
  // More thorough validation will be done via file system checks
  return path.length > 0 && !path.includes('..'); // Prevent directory traversal
}

/**
 * Validates a video source based on its type and content
 */
export function validateVideoSource(
  type: VideoSourceType,
  url?: string,
  path?: string,
  title?: string
): VideoSourceValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let cleanedUrl: string | undefined;

  // Validate title
  if (!title || title.trim().length === 0) {
    errors.push('Title is required');
  }

  // Type-specific validation
  if (type === 'youtube_channel') {
    if (!url || url.trim().length === 0) {
      errors.push('YouTube channel URL is required');
    } else if (!isValidYouTubeChannelUrl(url)) {
      errors.push('Invalid YouTube channel URL format');
    }
  } else if (type === 'youtube_playlist') {
    if (!url || url.trim().length === 0) {
      errors.push('YouTube playlist URL is required');
    } else {
      // Check if it's a watch URL with playlist that needs cleaning
      if (url.includes('watch?v=') && url.includes('list=')) {
        cleanedUrl = cleanYouTubePlaylistUrl(url);
        warnings.push('URL was cleaned to proper playlist format');
      } else if (!isValidYouTubePlaylistUrl(url)) {
        errors.push('Invalid YouTube playlist URL format');
      }
    }
  } else if (type === 'local') {
    if (!path || path.trim().length === 0) {
      errors.push('Local folder path is required');
    } else if (!isValidLocalPath(path)) {
      errors.push('Invalid local folder path');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
    cleanedUrl
  };
}

/**
 * Generates a unique ID for a new video source
 */
export function generateVideoSourceId(): string {
  return 'src_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Gets the default sort order for a video source type
 */
export function getDefaultSortOrder(type: VideoSourceType): string {
  switch (type) {
    case 'youtube_channel':
      return 'newestFirst';
    case 'youtube_playlist':
      return 'playlistOrder';
    case 'local':
      return 'alphabetical';
    default:
      return 'alphabetical';
  }
}
