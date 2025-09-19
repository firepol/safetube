import { describe, it, expect } from 'vitest';
import {
  generateVideoId,
  parseVideoId,
  createFavoriteVideo,
  createDefaultFavoritesConfig,
  addToFavorites,
  removeFromFavorites,
  isFavorited,
  getFavorites,
  validateFavoritesConfig,
  sanitizeFavoritesConfig,
  videoToMetadata,
  extractYouTubeVideoId,
  isValidYouTubeVideoId,
  generateYouTubeThumbnailUrls,
  getBestYouTubeThumbnail,
  normalizeVideoSource,
  validateAndNormalizeVideoMetadata,
  normalizedSourceToVideoMetadata,
} from './favoritesUtils';
import { VideoMetadata, FavoritesConfig } from './types';

describe('Favorites Utilities', () => {
  describe('Video ID management', () => {
    it('should generate correct video IDs for different source types', () => {
      expect(generateVideoId('youtube', 'dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(generateVideoId('local', '/path/to/video.mp4')).toBe('local:/path/to/video.mp4');
      expect(generateVideoId('dlna', 'server:8200/video.mp4')).toBe('dlna:server:8200/video.mp4');
    });

    it('should not double-encode already normalized video IDs', () => {
      // Test that already normalized IDs don't get encoded again
      expect(generateVideoId('local', 'local:/path/to/video.mp4')).toBe('local:/path/to/video.mp4');
      expect(generateVideoId('dlna', 'dlna:server:8200/video.mp4')).toBe('dlna:server:8200/video.mp4');
      expect(generateVideoId('youtube', 'dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ'); // YouTube doesn't get prefixed anyway
    });

    it('should parse video IDs correctly', () => {
      expect(parseVideoId('dQw4w9WgXcQ')).toEqual({
        sourceType: 'youtube',
        originalId: 'dQw4w9WgXcQ',
      });
      expect(parseVideoId('local:/path/to/video.mp4')).toEqual({
        sourceType: 'local',
        originalId: 'local:/path/to/video.mp4',
      });
      expect(parseVideoId('dlna:server:8200/video.mp4')).toEqual({
        sourceType: 'dlna',
        originalId: 'dlna:server:8200/video.mp4',
      });
    });
  });

  describe('Favorite video creation', () => {
    it('should create a favorite video from metadata', () => {
      const metadata: VideoMetadata = {
        id: 'test-video',
        type: 'youtube',
        title: 'Test Video',
        thumbnail: 'https://example.com/thumb.jpg',
        duration: 120,
      };

      const favorite = createFavoriteVideo(metadata);

      expect(favorite.videoId).toBe('test-video');
      expect(favorite.sourceType).toBe('youtube');
      expect(favorite.title).toBe('Test Video');
      expect(favorite.thumbnail).toBe('https://example.com/thumb.jpg');
      expect(favorite.duration).toBe(120);
      expect(favorite.dateAdded).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle local video IDs correctly', () => {
      const metadata: VideoMetadata = {
        id: '/path/to/local/video.mp4',
        type: 'local',
        title: 'Local Video',
      };

      const favorite = createFavoriteVideo(metadata);
      expect(favorite.videoId).toBe('/path/to/local/video.mp4'); // Store original ID like watched.json
      expect(favorite.sourceType).toBe('local');
    });
  });

  describe('Video conversion', () => {
    it('should convert video object to VideoMetadata', () => {
      const video = {
        id: 'test-video',
        type: 'youtube' as const,
        title: 'Test Video',
        thumbnail: 'https://example.com/thumb.jpg',
        duration: 120,
        url: 'https://youtube.com/watch?v=test-video',
      };

      const metadata = videoToMetadata(video);

      expect(metadata).toEqual({
        id: 'test-video',
        type: 'youtube',
        title: 'Test Video',
        thumbnail: 'https://example.com/thumb.jpg',
        duration: 120,
        url: 'https://youtube.com/watch?v=test-video',
      });
    });
  });

  describe('Favorites configuration', () => {
    it('should create default configuration', () => {
      const config = createDefaultFavoritesConfig();

      expect(config.favorites).toEqual([]);
      expect(config.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should validate valid configuration', () => {
      const validConfig = {
        favorites: [
          {
            videoId: 'test-video',
            dateAdded: '2025-09-17T16:00:00.000Z',
            sourceType: 'youtube',
            title: 'Test Video',
          },
        ],
        lastModified: '2025-09-17T16:00:00.000Z',
      };

      const result = validateFavoritesConfig(validConfig);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validConfig);
    });

    it('should reject invalid configuration', () => {
      const invalidConfigs = [
        null,
        'not an object',
        { favorites: 'not an array' },
        { favorites: [], lastModified: 123 },
        {
          favorites: [{ videoId: '', title: 'Empty ID' }],
          lastModified: '2025-09-17T16:00:00.000Z',
        },
      ];

      invalidConfigs.forEach((config) => {
        const result = validateFavoritesConfig(config);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should sanitize configuration', () => {
      const dirtyConfig = {
        favorites: [
          {
            videoId: 'valid-video',
            dateAdded: '2025-09-17T16:00:00.000Z',
            sourceType: 'youtube',
            title: 'Valid Video',
          },
          {
            videoId: '',
            title: 'Invalid - empty ID',
          },
          'not an object',
          {
            videoId: 'another-valid',
            dateAdded: '2025-09-17T16:01:00.000Z',
            sourceType: 'local',
            title: 'Another Valid',
          },
        ],
        lastModified: '2025-09-17T16:00:00.000Z',
        extraField: 'should be ignored',
      };

      const sanitized = sanitizeFavoritesConfig(dirtyConfig);

      expect(sanitized.favorites).toHaveLength(2);
      expect(sanitized.favorites[0].videoId).toBe('valid-video');
      expect(sanitized.favorites[1].videoId).toBe('another-valid');
      expect(sanitized.lastModified).toBe('2025-09-17T16:00:00.000Z');
    });
  });

  describe('Favorites operations', () => {
    let config: FavoritesConfig;

    beforeEach(() => {
      config = createDefaultFavoritesConfig();
    });

    it('should add a favorite', () => {
      const metadata: VideoMetadata = {
        id: 'new-video',
        type: 'youtube',
        title: 'New Video',
      };

      const result = addToFavorites(config, metadata);

      expect(result.success).toBe(true);
      const updatedConfig = result.data as FavoritesConfig;
      expect(updatedConfig.favorites).toHaveLength(1);
      expect(updatedConfig.favorites[0].videoId).toBe('new-video'); // Store original ID like watched.json
      expect(updatedConfig.favorites[0].title).toBe('New Video');
    });

    it('should prevent duplicate favorites', () => {
      const metadata: VideoMetadata = {
        id: 'duplicate-video',
        type: 'youtube',
        title: 'Duplicate Video',
      };

      // Add first time
      const firstResult = addToFavorites(config, metadata);
      expect(firstResult.success).toBe(true);

      // Try to add again
      const updatedConfig = firstResult.data as FavoritesConfig;
      const secondResult = addToFavorites(updatedConfig, metadata);
      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toContain('already in favorites');
    });

    it('should remove a favorite', () => {
      // First add a favorite
      const metadata: VideoMetadata = {
        id: 'to-remove',
        type: 'youtube',
        title: 'To Remove',
      };

      const addResult = addToFavorites(config, metadata);
      const configWithFavorite = addResult.data as FavoritesConfig;

      // Then remove it
      const removeResult = removeFromFavorites(configWithFavorite, 'to-remove');

      expect(removeResult.success).toBe(true);
      const updatedConfig = removeResult.data as FavoritesConfig;
      expect(updatedConfig.favorites).toHaveLength(0);
    });

    it('should handle removing non-existent favorite', () => {
      const result = removeFromFavorites(config, 'non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should check if video is favorited', () => {
      // Empty config
      expect(isFavorited(config, 'any-video')).toBe(false);

      // Add a favorite
      const metadata: VideoMetadata = {
        id: 'favorite-video',
        type: 'youtube',
        title: 'Favorite Video',
      };

      const addResult = addToFavorites(config, metadata);
      const configWithFavorite = addResult.data as FavoritesConfig;

      expect(isFavorited(configWithFavorite, 'favorite-video')).toBe(true);
      expect(isFavorited(configWithFavorite, 'not-favorite')).toBe(false);
    });

    it('should get favorites with sorting', () => {
      // Manually create config with favorites that have different timestamps
      const configWithFavorites: FavoritesConfig = {
        favorites: [
          {
            videoId: 'video-1',
            dateAdded: '2025-09-17T16:00:00.000Z', // Older
            sourceType: 'youtube',
            title: 'B Video',
          },
          {
            videoId: 'video-2',
            dateAdded: '2025-09-17T16:01:00.000Z', // Newer
            sourceType: 'youtube',
            title: 'A Video',
          },
        ],
        lastModified: '2025-09-17T16:01:00.000Z',
      };

      // Get by date (desc) - newest first
      const byDateDesc = getFavorites(configWithFavorites, 'dateAdded', 'desc');
      expect(byDateDesc[0].title).toBe('A Video'); // Newer timestamp
      expect(byDateDesc[1].title).toBe('B Video');

      // Get by date (asc) - oldest first
      const byDateAsc = getFavorites(configWithFavorites, 'dateAdded', 'asc');
      expect(byDateAsc[0].title).toBe('B Video'); // Older timestamp
      expect(byDateAsc[1].title).toBe('A Video');

      // Get by title (asc) - alphabetical
      const byTitleAsc = getFavorites(configWithFavorites, 'title', 'asc');
      expect(byTitleAsc[0].title).toBe('A Video');
      expect(byTitleAsc[1].title).toBe('B Video');

      // Get by title (desc) - reverse alphabetical
      const byTitleDesc = getFavorites(configWithFavorites, 'title', 'desc');
      expect(byTitleDesc[0].title).toBe('B Video');
      expect(byTitleDesc[1].title).toBe('A Video');
    });
  });

  describe('YouTube Video ID Extraction and Validation', () => {
    describe('extractYouTubeVideoId', () => {
      it('should extract video ID from standard YouTube URLs', () => {
        const testCases = [
          ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
          ['https://youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
          ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
          ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s', 'dQw4w9WgXcQ'],
          ['https://www.youtube.com/watch?list=PLxxxxxx&v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ];

        testCases.forEach(([url, expectedId]) => {
          expect(extractYouTubeVideoId(url)).toBe(expectedId);
        });
      });

      it('should extract video ID from short YouTube URLs', () => {
        expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
        expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=30')).toBe('dQw4w9WgXcQ');
      });

      it('should extract video ID from plain video ID string', () => {
        expect(extractYouTubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      });

      it('should return null for invalid URLs', () => {
        const invalidUrls = [
          '',
          'not-a-url',
          'https://example.com',
          'https://www.youtube.com/channel/UCxxxxxx',
          'https://www.youtube.com/playlist?list=PLxxxxxx',
          null as any,
          undefined as any,
          123 as any,
        ];

        invalidUrls.forEach((url) => {
          expect(extractYouTubeVideoId(url)).toBeNull();
        });
      });
    });

    describe('isValidYouTubeVideoId', () => {
      it('should validate correct YouTube video IDs', () => {
        const validIds = [
          'dQw4w9WgXcQ',
          'aBcDeFgHiJk',
          '123456789-_',
          '_-123456789',
          'a1B2c3D4e5F',
        ];

        validIds.forEach((id) => {
          expect(isValidYouTubeVideoId(id)).toBe(true);
        });
      });

      it('should reject invalid YouTube video IDs', () => {
        const invalidIds = [
          '',
          'short',
          'toolongvideoid123',
          'invalid chars!',
          'dQw4w9WgXcQ@',
          'dQw4w9WgXc',  // too short
          'dQw4w9WgXcQQ', // too long
          null as any,
          undefined as any,
          123 as any,
        ];

        invalidIds.forEach((id) => {
          expect(isValidYouTubeVideoId(id)).toBe(false);
        });
      });
    });
  });

  describe('YouTube Thumbnail URL Generation', () => {
    describe('generateYouTubeThumbnailUrls', () => {
      it('should generate all thumbnail URLs for valid video ID', () => {
        const thumbnails = generateYouTubeThumbnailUrls('dQw4w9WgXcQ');

        expect(thumbnails.maxres).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
        expect(thumbnails.high).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
        expect(thumbnails.medium).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
        expect(thumbnails.default).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg');
        expect(thumbnails.fallback).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
      });

      it('should throw error for invalid video ID', () => {
        expect(() => generateYouTubeThumbnailUrls('invalid')).toThrow('Invalid YouTube video ID: invalid');
        expect(() => generateYouTubeThumbnailUrls('')).toThrow('Invalid YouTube video ID: ');
      });
    });

    describe('getBestYouTubeThumbnail', () => {
      it('should return high quality thumbnail by default', () => {
        const thumbnail = getBestYouTubeThumbnail('dQw4w9WgXcQ');
        expect(thumbnail).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
      });

      it('should return preferred quality when specified', () => {
        expect(getBestYouTubeThumbnail('dQw4w9WgXcQ', 'maxres')).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
        expect(getBestYouTubeThumbnail('dQw4w9WgXcQ', 'medium')).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
        expect(getBestYouTubeThumbnail('dQw4w9WgXcQ', 'default')).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg');
      });

      it('should fallback to high quality for invalid preferred quality', () => {
        const thumbnail = getBestYouTubeThumbnail('dQw4w9WgXcQ', 'invalid' as any);
        expect(thumbnail).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
      });
    });
  });

  describe('Video Source Normalization', () => {
    describe('normalizeVideoSource', () => {
      it('should normalize YouTube videos correctly', () => {
        const source = {
          id: 'dQw4w9WgXcQ',
          type: 'youtube' as const,
          title: 'Test YouTube Video',
          duration: 212,
        };

        const normalized = normalizeVideoSource(source);

        expect(normalized.id).toBe('dQw4w9WgXcQ');
        expect(normalized.originalId).toBe('dQw4w9WgXcQ');
        expect(normalized.type).toBe('youtube');
        expect(normalized.title).toBe('Test YouTube Video');
        expect(normalized.duration).toBe(212);
        expect(normalized.thumbnail).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
        expect(normalized.metadata.isValidId).toBe(true);
        expect(normalized.metadata.thumbnailGenerated).toBe(true);
        expect(normalized.metadata.normalizedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });

      it('should auto-detect YouTube videos by ID format', () => {
        const source = {
          id: 'dQw4w9WgXcQ',
          title: 'Auto-detected YouTube Video',
        };

        const normalized = normalizeVideoSource(source);

        expect(normalized.type).toBe('youtube');
        expect(normalized.metadata.isValidId).toBe(true);
      });

      it('should preserve provided thumbnail for YouTube videos', () => {
        const customThumbnail = 'https://custom.example.com/thumb.jpg';
        const source = {
          id: 'dQw4w9WgXcQ',
          type: 'youtube' as const,
          title: 'YouTube Video with Custom Thumbnail',
          thumbnail: customThumbnail,
        };

        const normalized = normalizeVideoSource(source);

        expect(normalized.thumbnail).toBe(customThumbnail);
        expect(normalized.metadata.thumbnailGenerated).toBe(false);
      });

      it('should generate fallback thumbnail for invalid YouTube thumbnails', () => {
        const source = {
          id: 'dQw4w9WgXcQ',
          type: 'youtube' as const,
          title: 'YouTube Video with Placeholder',
          thumbnail: '/placeholder-thumbnail.svg',
        };

        const normalized = normalizeVideoSource(source);

        expect(normalized.thumbnail).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
        expect(normalized.metadata.thumbnailGenerated).toBe(true);
      });

      it('should normalize local videos correctly', () => {
        const source = {
          id: '/path/to/video.mp4',
          type: 'local' as const,
          title: 'Local Video',
          thumbnail: '/path/to/thumb.jpg',
          duration: 300,
        };

        const normalized = normalizeVideoSource(source);

        expect(normalized.id).toBe('local:/path/to/video.mp4');
        expect(normalized.originalId).toBe('/path/to/video.mp4');
        expect(normalized.type).toBe('local');
        expect(normalized.title).toBe('Local Video');
        expect(normalized.thumbnail).toBe('/path/to/thumb.jpg');
        expect(normalized.metadata.isValidId).toBe(true);
        expect(normalized.metadata.thumbnailGenerated).toBe(false);
      });

      it('should auto-detect local videos by path format', () => {
        const source = {
          id: '/home/user/videos/movie.mkv',
          title: 'Auto-detected Local Video',
        };

        const normalized = normalizeVideoSource(source);

        expect(normalized.type).toBe('local');
        expect(normalized.id).toBe('local:/home/user/videos/movie.mkv');
      });

      it('should normalize DLNA videos correctly', () => {
        const source = {
          id: 'server:8200/video.mp4',
          type: 'dlna' as const,
          title: 'DLNA Video',
          url: 'http://192.168.1.100:8200/video.mp4',
        };

        const normalized = normalizeVideoSource(source);

        expect(normalized.id).toBe('dlna:server:8200/video.mp4');
        expect(normalized.originalId).toBe('server:8200/video.mp4');
        expect(normalized.type).toBe('dlna');
        expect(normalized.title).toBe('DLNA Video');
        expect(normalized.url).toBe('http://192.168.1.100:8200/video.mp4');
        expect(normalized.metadata.isValidId).toBe(true);
        expect(normalized.metadata.thumbnailGenerated).toBe(false);
      });

      it('should auto-detect DLNA videos by colon format', () => {
        const source = {
          id: '192.168.1.100:8200/stream.mkv',
          title: 'Auto-detected DLNA Video',
        };

        const normalized = normalizeVideoSource(source);

        expect(normalized.type).toBe('dlna');
        expect(normalized.id).toBe('dlna:192.168.1.100:8200/stream.mkv');
      });

      it('should handle missing titles with defaults', () => {
        const sources = [
          { id: 'dQw4w9WgXcQ', title: '', type: 'youtube' as const },
          { id: '/path/video.mp4', title: '', type: 'local' as const },
          { id: 'server:8200/video.mp4', title: '', type: 'dlna' as const },
        ];

        const results = sources.map(normalizeVideoSource);

        expect(results[0].title).toBe('Unknown Video');
        expect(results[1].title).toBe('Local Video');
        expect(results[2].title).toBe('DLNA Video');
      });
    });
  });

  describe('Metadata Validation and Error Handling', () => {
    describe('validateAndNormalizeVideoMetadata', () => {
      it('should validate and normalize valid YouTube metadata', () => {
        const metadata: VideoMetadata = {
          id: 'dQw4w9WgXcQ',
          type: 'youtube',
          title: 'Valid YouTube Video',
          duration: 212,
        };

        const result = validateAndNormalizeVideoMetadata(metadata);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
        expect(result.normalized).toBeDefined();
        expect(result.normalized!.type).toBe('youtube');
        expect(result.normalized!.metadata.isValidId).toBe(true);
      });

      it('should detect invalid metadata objects', () => {
        const invalidInputs = [
          null,
          undefined,
          'not an object',
          123,
        ];

        invalidInputs.forEach((input) => {
          const result = validateAndNormalizeVideoMetadata(input as any);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('Video metadata must be an object');
        });

        // Arrays need separate handling since they're objects but not valid metadata
        const result = validateAndNormalizeVideoMetadata([] as any);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should detect missing required fields', () => {
        const invalidMetadata = [
          { title: 'Missing ID' },
          { id: 'test-id' }, // Missing title
          { id: '', title: 'Empty ID' },
          { id: 'test-id', title: '' }, // Empty title
        ];

        invalidMetadata.forEach((metadata) => {
          const result = validateAndNormalizeVideoMetadata(metadata as any);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        });
      });

      it('should detect invalid video types', () => {
        const metadata = {
          id: 'test-id',
          type: 'invalid-type',
          title: 'Test Video',
        };

        const result = validateAndNormalizeVideoMetadata(metadata as any);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Video type must be one of: youtube, local, dlna');
      });

      it('should generate warnings for invalid duration', () => {
        const metadata: VideoMetadata = {
          id: 'dQw4w9WgXcQ',
          type: 'youtube',
          title: 'Video with Invalid Duration',
          duration: -10,
        };

        const result = validateAndNormalizeVideoMetadata(metadata);
        expect(result.isValid).toBe(true); // Still valid overall
        expect(result.warnings).toContain('Video duration should be a positive number in seconds');
      });

      it('should generate warnings for missing optional fields', () => {
        const metadata: VideoMetadata = {
          id: 'invalid-id',
          type: 'youtube',
          title: 'Video with Warnings',
        };

        const result = validateAndNormalizeVideoMetadata(metadata);
        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('YouTube video ID format appears invalid');
        expect(result.warnings).toContain('No duration information available for video');
      });

      it('should handle edge cases gracefully', () => {
        // Test with metadata that passes basic validation but has edge case values
        const metadata: VideoMetadata = {
          id: 'short',  // Invalid YouTube ID length
          type: 'youtube',
          title: 'Edge Case Video',
        };

        const result = validateAndNormalizeVideoMetadata(metadata);

        // Should still normalize successfully even with warnings
        expect(result.isValid).toBe(true);
        expect(result.warnings.some(warning => warning.includes('YouTube video ID format appears invalid'))).toBe(true);
        expect(result.normalized).toBeDefined();
        expect(result.normalized!.metadata.isValidId).toBe(false);
      });
    });

    describe('normalizedSourceToVideoMetadata', () => {
      it('should convert normalized source back to VideoMetadata', () => {
        const normalized = normalizeVideoSource({
          id: 'dQw4w9WgXcQ',
          type: 'youtube',
          title: 'Test Video',
          thumbnail: 'custom-thumb.jpg',
          duration: 212,
          url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        });

        const metadata = normalizedSourceToVideoMetadata(normalized);

        expect(metadata.id).toBe('dQw4w9WgXcQ');
        expect(metadata.type).toBe('youtube');
        expect(metadata.title).toBe('Test Video');
        expect(metadata.thumbnail).toBe('custom-thumb.jpg');
        expect(metadata.duration).toBe(212);
        expect(metadata.url).toBe('https://youtube.com/watch?v=dQw4w9WgXcQ');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete YouTube video favoriting workflow', () => {
      // Simulate getting video metadata from YouTube player
      const playerMetadata = {
        id: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        thumbnail: '', // Empty thumbnail to test fallback
        duration: 212,
      };

      // Normalize the metadata
      const normalized = normalizeVideoSource(playerMetadata);

      // Validate and convert to VideoMetadata
      const validation = validateAndNormalizeVideoMetadata(normalizedSourceToVideoMetadata(normalized));
      expect(validation.isValid).toBe(true);

      // Create favorite from normalized metadata
      const favoriteMetadata = normalizedSourceToVideoMetadata(normalized);
      const favorite = createFavoriteVideo(favoriteMetadata);

      expect(favorite.videoId).toBe('dQw4w9WgXcQ');
      expect(favorite.sourceType).toBe('youtube');
      expect(favorite.title).toBe('Never Gonna Give You Up');
      expect(favorite.thumbnail).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
      expect(favorite.duration).toBe(212);
    });

    it('should handle URL extraction and normalization workflow', () => {
      const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s';

      // Extract video ID from URL
      const videoId = extractYouTubeVideoId(youtubeUrl);
      expect(videoId).toBe('dQw4w9WgXcQ');

      // Validate the extracted ID
      expect(isValidYouTubeVideoId(videoId!)).toBe(true);

      // Normalize with extracted ID
      const normalized = normalizeVideoSource({
        id: videoId!,
        title: 'Video from URL',
      });

      expect(normalized.type).toBe('youtube');
      expect(normalized.metadata.isValidId).toBe(true);
      expect(normalized.thumbnail).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    });
  });
});