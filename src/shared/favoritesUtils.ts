import { FavoriteVideo, FavoritesConfig, VideoMetadata, FavoritesOperationResult, NormalizedVideoSource, VideoMetadataValidationResult } from './types';

/**
 * Utility functions for favorites management
 * These functions handle data transformations and validations
 * File I/O operations are handled in main process
 */

/**
 * Generate a normalized video ID for cross-source compatibility
 */
export function generateVideoId(sourceType: 'youtube' | 'local' | 'dlna', originalId: string): string {
  // For YouTube videos, use the video ID as-is
  if (sourceType === 'youtube') {
    return originalId;
  }

  // Check if ID is already normalized with the correct prefix
  if (originalId.startsWith(`${sourceType}:`)) {
    return originalId; // Already normalized, return as-is
  }

  // For local and DLNA videos, prefix with source type to avoid conflicts
  return `${sourceType}:${originalId}`;
}

/**
 * Parse a normalized video ID
 */
export function parseVideoId(videoId: string): { sourceType: string; originalId: string } {
  const parts = videoId.split(':');
  if (parts.length === 1) {
    // YouTube video ID (no prefix)
    return { sourceType: 'youtube', originalId: videoId };
  }

  // For local and DLNA videos, return the full ID as originalId to maintain consistency
  return { sourceType: parts[0], originalId: videoId };
}

/**
 * Convert video object to VideoMetadata for favorites operations
 */
export function videoToMetadata(video: {
  id: string;
  type: 'youtube' | 'local' | 'dlna';
  title: string;
  thumbnail?: string;
  duration?: number;
  url?: string;
}): VideoMetadata {
  return {
    id: video.id,
    type: video.type,
    title: video.title,
    thumbnail: video.thumbnail,
    duration: video.duration,
    url: video.url,
  };
}

/**
 * Create a FavoriteVideo from VideoMetadata
 */
export function createFavoriteVideo(metadata: VideoMetadata): FavoriteVideo {
  // Store video ID in the same format as watched.json (original ID, not normalized)
  // This allows subfolders and proper video loading like History page
  return {
    videoId: metadata.id,
    dateAdded: new Date().toISOString(),
    sourceType: metadata.type,
    title: metadata.title,
    thumbnail: metadata.thumbnail,
    duration: metadata.duration,
  };
}

/**
 * Create a default empty favorites configuration
 */
export function createDefaultFavoritesConfig(): FavoritesConfig {
  return {
    favorites: [],
    lastModified: new Date().toISOString(),
  };
}

/**
 * Add a video to favorites list (in-memory operation)
 */
export function addToFavorites(config: FavoritesConfig, metadata: VideoMetadata): FavoritesOperationResult {
  try {
    // Use original video ID like watched.json does (no normalization)
    const videoId = metadata.id;

    // Check if already favorited
    const existing = config.favorites.find(fav => fav.videoId === videoId);
    if (existing) {
      return {
        success: false,
        error: 'Video is already in favorites',
        data: false,
      };
    }

    // Create new favorite
    const newFavorite = createFavoriteVideo(metadata);

    // Add to beginning of list (newest first)
    const updatedConfig: FavoritesConfig = {
      favorites: [newFavorite, ...config.favorites],
      lastModified: new Date().toISOString(),
    };

    return {
      success: true,
      data: updatedConfig,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to add favorite: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Remove a video from favorites list (in-memory operation)
 */
export function removeFromFavorites(config: FavoritesConfig, videoId: string): FavoritesOperationResult {
  try {
    const initialCount = config.favorites.length;
    const updatedFavorites = config.favorites.filter(fav => fav.videoId !== videoId);

    if (updatedFavorites.length === initialCount) {
      return {
        success: false,
        error: 'Video not found in favorites',
        data: false,
      };
    }

    const updatedConfig: FavoritesConfig = {
      favorites: updatedFavorites,
      lastModified: new Date().toISOString(),
    };

    return {
      success: true,
      data: updatedConfig,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to remove favorite: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Check if a video is favorited (in-memory operation)
 */
export function isFavorited(config: FavoritesConfig, videoId: string): boolean {
  // Check for exact match first (new format)
  if (config.favorites.some(fav => fav.videoId === videoId)) {
    return true;
  }

  // For backward compatibility, also check normalized versions
  // This handles cases where favorites may have been stored with different encoding
  return config.favorites.some(fav => {
    // Check if the favorite's videoId matches any reasonable variation of the input videoId
    if (fav.videoId === videoId) return true;

    // Handle local video paths - check if they represent the same file
    if (videoId.includes('/') || videoId.startsWith('local:')) {
      const cleanVideoId = videoId.replace(/^local:/, '');
      const cleanFavId = fav.videoId.replace(/^local:/, '');
      return cleanVideoId === cleanFavId;
    }

    return false;
  });
}

/**
 * Get all favorited videos, optionally sorted
 */
export function getFavorites(
  config: FavoritesConfig,
  sortBy: 'dateAdded' | 'title' = 'dateAdded',
  sortDirection: 'asc' | 'desc' = 'desc'
): FavoriteVideo[] {
  const sorted = [...config.favorites].sort((a, b) => {
    let comparison = 0;

    if (sortBy === 'dateAdded') {
      comparison = new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime();
    } else if (sortBy === 'title') {
      comparison = a.title.localeCompare(b.title);
    }

    return sortDirection === 'desc' ? -comparison : comparison;
  });

  return sorted;
}

/**
 * Validate favorites configuration
 */
export function validateFavoritesConfig(data: any): FavoritesOperationResult {
  try {
    if (!data || typeof data !== 'object') {
      return {
        success: false,
        error: 'Invalid favorites data: not an object',
      };
    }

    if (!Array.isArray(data.favorites)) {
      return {
        success: false,
        error: 'Invalid favorites data: favorites must be an array',
      };
    }

    if (typeof data.lastModified !== 'string') {
      return {
        success: false,
        error: 'Invalid favorites data: lastModified must be a string',
      };
    }

    // Validate each favorite
    for (const [index, favorite] of data.favorites.entries()) {
      if (!favorite.videoId || typeof favorite.videoId !== 'string') {
        return {
          success: false,
          error: `Invalid favorite at index ${index}: videoId is required`,
        };
      }

      if (!favorite.dateAdded || typeof favorite.dateAdded !== 'string') {
        return {
          success: false,
          error: `Invalid favorite at index ${index}: dateAdded is required`,
        };
      }

      if (!favorite.sourceType || !['youtube', 'local', 'dlna'].includes(favorite.sourceType)) {
        return {
          success: false,
          error: `Invalid favorite at index ${index}: invalid sourceType`,
        };
      }

      if (!favorite.title || typeof favorite.title !== 'string') {
        return {
          success: false,
          error: `Invalid favorite at index ${index}: title is required`,
        };
      }
    }

    return {
      success: true,
      data: data as FavoritesConfig,
    };
  } catch (error) {
    return {
      success: false,
      error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Clean and sanitize favorites configuration
 */
export function sanitizeFavoritesConfig(data: any): FavoritesConfig {
  const defaultConfig = createDefaultFavoritesConfig();

  if (!data || typeof data !== 'object') {
    return defaultConfig;
  }

  const favorites = Array.isArray(data.favorites)
    ? data.favorites.filter((fav: any) =>
        fav &&
        typeof fav.videoId === 'string' &&
        typeof fav.dateAdded === 'string' &&
        typeof fav.sourceType === 'string' &&
        ['youtube', 'local', 'dlna'].includes(fav.sourceType) &&
        typeof fav.title === 'string'
      )
    : [];

  return {
    favorites,
    lastModified: typeof data.lastModified === 'string' ? data.lastModified : new Date().toISOString(),
  };
}

/**
 * YouTube Video ID Extraction and Validation
 */

/**
 * Extract YouTube video ID from various YouTube URL formats
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Common YouTube URL patterns:
  // - https://www.youtube.com/watch?v=VIDEO_ID
  // - https://youtu.be/VIDEO_ID
  // - https://m.youtube.com/watch?v=VIDEO_ID
  // - https://youtube.com/watch?v=VIDEO_ID
  // - Just the video ID itself

  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,        // ?v=VIDEO_ID or &v=VIDEO_ID
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,   // youtu.be/VIDEO_ID
    /^([a-zA-Z0-9_-]{11})$/,            // Just the video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Validate YouTube video ID format
 */
export function isValidYouTubeVideoId(videoId: string): boolean {
  if (!videoId || typeof videoId !== 'string') {
    return false;
  }

  // YouTube video IDs are exactly 11 characters long and contain only letters, numbers, hyphens, and underscores
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

/**
 * YouTube Thumbnail URL Generation
 */

/**
 * Generate YouTube thumbnail URLs with fallback options
 */
export function generateYouTubeThumbnailUrls(videoId: string): {
  maxres: string;
  high: string;
  medium: string;
  default: string;
  fallback: string;
} {
  if (!isValidYouTubeVideoId(videoId)) {
    throw new Error(`Invalid YouTube video ID: ${videoId}`);
  }

  const baseUrl = `https://img.youtube.com/vi/${videoId}`;

  return {
    maxres: `${baseUrl}/maxresdefault.jpg`,    // 1280x720
    high: `${baseUrl}/hqdefault.jpg`,          // 480x360
    medium: `${baseUrl}/mqdefault.jpg`,        // 320x180
    default: `${baseUrl}/default.jpg`,         // 120x90
    fallback: `${baseUrl}/hqdefault.jpg`,      // Default fallback to high quality
  };
}

/**
 * Get best available YouTube thumbnail URL with fallback
 */
export function getBestYouTubeThumbnail(videoId: string, preferredQuality?: 'maxres' | 'high' | 'medium' | 'default'): string {
  const thumbnails = generateYouTubeThumbnailUrls(videoId);

  // Return preferred quality if specified and valid
  if (preferredQuality && thumbnails[preferredQuality]) {
    return thumbnails[preferredQuality];
  }

  // Default fallback order: high -> medium -> default
  return thumbnails.high;
}

/**
 * Video Source Normalization
 */


/**
 * Normalize video source metadata for consistent favorites handling
 */
export function normalizeVideoSource(source: {
  id: string;
  type?: 'youtube' | 'local' | 'dlna';
  title: string;
  thumbnail?: string;
  duration?: number;
  url?: string;
}): NormalizedVideoSource {
  const now = new Date().toISOString();

  // Handle YouTube videos
  if (source.type === 'youtube' || (!source.type && isValidYouTubeVideoId(source.id))) {
    const videoId = source.id;
    const isValid = isValidYouTubeVideoId(videoId);

    let thumbnail = source.thumbnail;
    let thumbnailGenerated = false;

    // Generate fallback thumbnail if none provided or if provided thumbnail is invalid
    if (!thumbnail || thumbnail === '' || thumbnail.includes('placeholder')) {
      if (isValid) {
        thumbnail = getBestYouTubeThumbnail(videoId, 'high');
        thumbnailGenerated = true;
      }
    }

    return {
      id: videoId,                      // YouTube IDs don't get prefixed
      originalId: source.id,
      type: 'youtube',
      title: source.title || 'Unknown Video',
      thumbnail,
      duration: source.duration,
      url: source.url,
      metadata: {
        isValidId: isValid,
        thumbnailGenerated,
        normalizedAt: now,
      },
    };
  }

  // Handle DLNA videos
  if (source.type === 'dlna' || source.id.startsWith('dlna:') ||
      (!source.type && source.id.includes(':') && !isValidYouTubeVideoId(source.id))) {
    // For auto-detection, validate it looks like host:port pattern
    if (!source.type && source.id.includes(':')) {
      const parts = source.id.split(':');
      if (parts.length < 2 || !/^\d+/.test(parts[1])) {
        // Not a valid host:port pattern, continue to other checks
      } else {
        // Valid DLNA pattern detected
        const normalizedId = generateVideoId('dlna', source.id);
        return {
          id: normalizedId,
          originalId: source.id,
          type: 'dlna',
          title: source.title || 'DLNA Video',
          thumbnail: source.thumbnail,
          duration: source.duration,
          url: source.url,
          metadata: {
            isValidId: true,                // DLNA IDs are always considered valid
            thumbnailGenerated: false,      // Thumbnails are handled separately for DLNA videos
            normalizedAt: now,
          },
        };
      }
    } else {
      // Explicit DLNA type or dlna: prefix
      const normalizedId = generateVideoId('dlna', source.id);
      return {
        id: normalizedId,
        originalId: source.id,
        type: 'dlna',
        title: source.title || 'DLNA Video',
        thumbnail: source.thumbnail,
        duration: source.duration,
        url: source.url,
        metadata: {
          isValidId: true,                // DLNA IDs are always considered valid
          thumbnailGenerated: false,      // Thumbnails are handled separately for DLNA videos
          normalizedAt: now,
        },
      };
    }
  }

  // Handle local videos
  if (source.type === 'local' || (!source.type && (source.id.includes('/') || source.id.startsWith('local:')))) {
    const normalizedId = generateVideoId('local', source.id);

    return {
      id: normalizedId,
      originalId: source.id,
      type: 'local',
      title: source.title || 'Local Video',
      thumbnail: source.thumbnail,
      duration: source.duration,
      url: source.url,
      metadata: {
        isValidId: true,                // Local IDs are always considered valid
        thumbnailGenerated: false,      // Thumbnails are handled separately for local videos
        normalizedAt: now,
      },
    };
  }

  // Fallback: try to determine type from ID or treat as YouTube
  let detectedType: 'youtube' | 'local' | 'dlna' = 'youtube';

  // Check for DLNA first (pattern: host:port/path or server:port/path)
  if (source.id.includes(':') && !isValidYouTubeVideoId(source.id)) {
    const parts = source.id.split(':');
    if (parts.length >= 2 && /^\d+/.test(parts[1])) {
      // Looks like host:port pattern
      detectedType = 'dlna';
    } else if (source.id.startsWith('/')) {
      // Absolute path
      detectedType = 'local';
    }
  } else if (source.id.includes('/')) {
    detectedType = 'local';
  }

  // Recursively call with detected type
  return normalizeVideoSource({
    ...source,
    type: detectedType,
  });
}

/**
 * Metadata Validation and Error Handling
 */


/**
 * Validate and normalize video metadata for favorites
 */
export function validateAndNormalizeVideoMetadata(metadata: VideoMetadata): VideoMetadataValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (!metadata || typeof metadata !== 'object') {
    errors.push('Video metadata must be an object');
    return { isValid: false, errors, warnings };
  }

  if (!metadata.id || typeof metadata.id !== 'string') {
    errors.push('Video ID is required and must be a string');
  }

  if (!metadata.title || typeof metadata.title !== 'string') {
    errors.push('Video title is required and must be a string');
  }

  if (metadata.type && !['youtube', 'local', 'dlna'].includes(metadata.type)) {
    errors.push('Video type must be one of: youtube, local, dlna');
  }

  if (metadata.duration !== undefined && (typeof metadata.duration !== 'number' || metadata.duration < 0)) {
    warnings.push('Video duration should be a positive number in seconds');
  }

  // Return early if basic validation failed
  if (errors.length > 0) {
    return { isValid: false, errors, warnings };
  }

  // Try to normalize the metadata
  try {
    const normalized = normalizeVideoSource({
      id: metadata.id,
      type: metadata.type,
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      duration: metadata.duration,
      url: metadata.url,
    });

    // Additional validation warnings
    if (normalized.type === 'youtube' && !normalized.metadata.isValidId) {
      warnings.push('YouTube video ID format appears invalid');
    }

    if (!normalized.thumbnail) {
      warnings.push('No thumbnail available for video');
    }

    if (!normalized.duration) {
      warnings.push('No duration information available for video');
    }

    return {
      isValid: true,
      errors,
      warnings,
      normalized,
    };

  } catch (error) {
    errors.push(`Failed to normalize video metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { isValid: false, errors, warnings };
  }
}

/**
 * Convert normalized video source to VideoMetadata format
 */
export function normalizedSourceToVideoMetadata(normalized: NormalizedVideoSource): VideoMetadata {
  return {
    id: normalized.id,
    type: normalized.type,
    title: normalized.title,
    thumbnail: normalized.thumbnail,
    duration: normalized.duration,
    url: normalized.url,
  };
}