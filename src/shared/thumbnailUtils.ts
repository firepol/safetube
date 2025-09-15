/**
 * Thumbnail utility functions for handling video thumbnails across different sources
 */

export type VideoType = 'youtube' | 'local' | 'dlna';

/**
 * Get the appropriate fallback thumbnail for a video type
 */
export function getFallbackThumbnail(type: VideoType): string {
  switch (type) {
    case 'local':
      return '/local-video-thumbnail.svg';
    case 'dlna':
      return '/dlna-video-thumbnail.svg';
    case 'youtube':
    default:
      return '/placeholder-thumbnail.svg';
  }
}

/**
 * Determine if a thumbnail path is a fallback thumbnail
 */
export function isFallbackThumbnail(thumbnail: string): boolean {
  const fallbackThumbnails = [
    '/placeholder-thumbnail.svg',
    '/local-video-thumbnail.svg',
    '/dlna-video-thumbnail.svg'
  ];
  return fallbackThumbnails.includes(thumbnail);
}

/**
 * Get the best available thumbnail for a video
 * Returns the original thumbnail if valid, otherwise returns appropriate fallback
 */
export function getBestThumbnail(originalThumbnail: string | null | undefined, type: VideoType): string {
  // If we have a valid thumbnail, use it
  if (originalThumbnail && originalThumbnail.trim() && !isFallbackThumbnail(originalThumbnail)) {
    return originalThumbnail;
  }

  // Otherwise, return appropriate fallback
  return getFallbackThumbnail(type);
}

/**
 * Check if a thumbnail URL/path is valid
 */
export function isValidThumbnail(thumbnail: string | null | undefined): boolean {
  if (!thumbnail || !thumbnail.trim()) {
    return false;
  }

  // Check if it's a valid URL (for YouTube or web thumbnails)
  try {
    new URL(thumbnail);
    return true;
  } catch {
    // Not a URL, check if it's a valid local path
    return thumbnail.startsWith('/') || thumbnail.includes('://');
  }
}

/**
 * Normalize thumbnail path for consistent usage
 */
export function normalizeThumbnailPath(thumbnail: string | null | undefined, type: VideoType): string {
  const best = getBestThumbnail(thumbnail, type);

  // Ensure local paths start with forward slash for web usage
  if (best && !best.startsWith('http') && !best.startsWith('/')) {
    return `/${best}`;
  }

  return best;
}

/**
 * Generate a cache key for thumbnail caching
 */
export function getThumbnailCacheKey(videoId: string, type: VideoType): string {
  return `thumbnail_${type}_${videoId.replace(/[/\\:*?"<>|]/g, '_')}`;
}

/**
 * Video thumbnail generation options
 */
export interface ThumbnailGenerationOptions {
  videoPath: string;
  outputPath: string;
  timePosition?: number; // seconds into the video (default: 10% of duration)
  width?: number; // default: 320
  height?: number; // default: 180
  quality?: number; // 1-100, default: 80
}

/**
 * Check if FFmpeg is available for thumbnail generation
 */
export function isFFmpegAvailable(): Promise<boolean> {
  // This would be implemented in the main process
  // For now, return false as we're in shared code
  return Promise.resolve(false);
}