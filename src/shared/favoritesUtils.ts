import { FavoriteVideo, FavoritesConfig, VideoMetadata, FavoritesOperationResult } from './types';

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