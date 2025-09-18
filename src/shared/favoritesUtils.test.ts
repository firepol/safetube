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
});