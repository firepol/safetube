import { z } from 'zod';
import { FavoriteVideo, FavoritesConfig, FavoriteValidationResult } from './types';

// Zod schema for FavoriteVideo validation
export const FavoriteVideoSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required'),
  dateAdded: z.string().datetime({ message: 'Invalid ISO date string for dateAdded' }),
  sourceType: z.enum(['youtube', 'local', 'dlna'], {
    errorMap: () => ({ message: 'Source type must be youtube, local, or dlna' })
  }),
  sourceId: z.string().min(1, 'Source ID is required'),
  title: z.string().min(1, 'Title is required'),
  thumbnail: z.string().optional(),
  duration: z.number().min(0, 'Duration must be non-negative').optional()
});

// Zod schema for FavoritesConfig validation
export const FavoritesConfigSchema = z.object({
  favorites: z.array(FavoriteVideoSchema),
  lastModified: z.string().datetime({ message: 'Invalid ISO date string for lastModified' })
});

// Default favorites configuration
export const DEFAULT_FAVORITES_CONFIG: FavoritesConfig = {
  favorites: [],
  lastModified: new Date().toISOString()
};

/**
 * Validates and sanitizes a FavoriteVideo object
 */
export function validateFavoriteVideo(data: unknown): FavoriteValidationResult {
  try {
    const result = FavoriteVideoSchema.safeParse(data);

    if (!result.success) {
      return {
        isValid: false,
        errors: result.error.issues.map(issue =>
          `${issue.path.join('.')}: ${issue.message}`
        )
      };
    }

    return {
      isValid: true,
      errors: [],
      sanitized: result.data
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Validates and sanitizes a FavoritesConfig object
 */
export function validateFavoritesConfig(data: unknown): {
  isValid: boolean;
  errors: string[];
  sanitized?: FavoritesConfig;
} {
  try {
    const result = FavoritesConfigSchema.safeParse(data);

    if (!result.success) {
      return {
        isValid: false,
        errors: result.error.issues.map(issue =>
          `${issue.path.join('.')}: ${issue.message}`
        )
      };
    }

    return {
      isValid: true,
      errors: [],
      sanitized: result.data
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Sanitizes video data for adding to favorites
 */
export function sanitizeVideoData(data: Partial<FavoriteVideo>): Partial<FavoriteVideo> {
  return {
    videoId: typeof data.videoId === 'string' ? data.videoId.trim() : undefined,
    dateAdded: data.dateAdded, // ISO string validation handled by schema
    sourceType: data.sourceType, // Enum validation handled by schema
    sourceId: typeof data.sourceId === 'string' ? data.sourceId.trim() : undefined,
    title: typeof data.title === 'string' ? data.title.trim() : undefined,
    thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail.trim() : undefined,
    duration: typeof data.duration === 'number' && data.duration >= 0 ? data.duration : undefined,
  };
}

/**
 * Creates a new FavoriteVideo from video metadata
 */
export function createFavoriteFromVideo(
  videoId: string,
  sourceType: 'youtube' | 'local' | 'dlna',
  sourceId: string,
  title: string,
  thumbnail?: string,
  duration?: number
): FavoriteVideo {
  const favorite: FavoriteVideo = {
    videoId,
    dateAdded: new Date().toISOString(),
    sourceType,
    sourceId,
    title: title.trim(),
    thumbnail: thumbnail?.trim(),
    duration: duration !== undefined ? Math.max(0, duration) : undefined
  };

  const validation = validateFavoriteVideo(favorite);
  if (!validation.isValid) {
    throw new Error(`Invalid favorite video data: ${validation.errors.join(', ')}`);
  }

  return validation.sanitized!;
}