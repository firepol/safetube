import { describe, test, expect } from 'vitest';
import {
  getFallbackThumbnail,
  isFallbackThumbnail,
  getBestThumbnail,
  isValidThumbnail,
  normalizeThumbnailPath,
  getThumbnailCacheKey
} from './thumbnailUtils';

describe('thumbnailUtils', () => {
  describe('getFallbackThumbnail', () => {
    test('should return local fallback for local videos', () => {
      expect(getFallbackThumbnail('local')).toBe('/local-video-thumbnail.svg');
    });

    test('should return dlna fallback for dlna videos', () => {
      expect(getFallbackThumbnail('dlna')).toBe('/dlna-video-thumbnail.svg');
    });

    test('should return generic fallback for youtube videos', () => {
      expect(getFallbackThumbnail('youtube')).toBe('/placeholder-thumbnail.svg');
    });
  });

  describe('isFallbackThumbnail', () => {
    test('should identify fallback thumbnails', () => {
      expect(isFallbackThumbnail('/placeholder-thumbnail.svg')).toBe(true);
      expect(isFallbackThumbnail('/local-video-thumbnail.svg')).toBe(true);
      expect(isFallbackThumbnail('/dlna-video-thumbnail.svg')).toBe(true);
    });

    test('should not identify regular thumbnails as fallbacks', () => {
      expect(isFallbackThumbnail('https://example.com/thumb.jpg')).toBe(false);
      expect(isFallbackThumbnail('/path/to/video.jpg')).toBe(false);
      expect(isFallbackThumbnail('custom-thumbnail.png')).toBe(false);
    });
  });

  describe('getBestThumbnail', () => {
    test('should return original thumbnail if valid', () => {
      const original = 'https://example.com/thumb.jpg';
      expect(getBestThumbnail(original, 'local')).toBe(original);
    });

    test('should return fallback if original is empty', () => {
      expect(getBestThumbnail('', 'local')).toBe('/local-video-thumbnail.svg');
      expect(getBestThumbnail(null, 'dlna')).toBe('/dlna-video-thumbnail.svg');
      expect(getBestThumbnail(undefined, 'youtube')).toBe('/placeholder-thumbnail.svg');
    });

    test('should return fallback if original is already a fallback', () => {
      expect(getBestThumbnail('/placeholder-thumbnail.svg', 'local')).toBe('/local-video-thumbnail.svg');
    });

    test('should handle whitespace-only thumbnails', () => {
      expect(getBestThumbnail('   ', 'local')).toBe('/local-video-thumbnail.svg');
    });
  });

  describe('isValidThumbnail', () => {
    test('should validate URLs', () => {
      expect(isValidThumbnail('https://example.com/thumb.jpg')).toBe(true);
      expect(isValidThumbnail('http://localhost/thumb.png')).toBe(true);
      expect(isValidThumbnail('file:///path/to/thumb.jpg')).toBe(true);
    });

    test('should validate local paths', () => {
      expect(isValidThumbnail('/path/to/thumb.jpg')).toBe(true);
    });

    test('should reject invalid thumbnails', () => {
      expect(isValidThumbnail('')).toBe(false);
      expect(isValidThumbnail(null)).toBe(false);
      expect(isValidThumbnail(undefined)).toBe(false);
      expect(isValidThumbnail('   ')).toBe(false);
    });

    test('should handle edge cases', () => {
      expect(isValidThumbnail('invalid-url')).toBe(false);
      expect(isValidThumbnail('just-a-filename.jpg')).toBe(false);
    });
  });

  describe('normalizeThumbnailPath', () => {
    test('should preserve valid URLs', () => {
      const url = 'https://example.com/thumb.jpg';
      expect(normalizeThumbnailPath(url, 'youtube')).toBe(url);
    });

    test('should add leading slash to relative paths', () => {
      expect(normalizeThumbnailPath('path/to/thumb.jpg', 'local')).toBe('/path/to/thumb.jpg');
    });

    test('should preserve paths that already start with slash', () => {
      const path = '/path/to/thumb.jpg';
      expect(normalizeThumbnailPath(path, 'local')).toBe(path);
    });

    test('should return appropriate fallback for invalid input', () => {
      expect(normalizeThumbnailPath('', 'local')).toBe('/local-video-thumbnail.svg');
      expect(normalizeThumbnailPath(null, 'dlna')).toBe('/dlna-video-thumbnail.svg');
    });
  });

  describe('getThumbnailCacheKey', () => {
    test('should generate consistent cache keys', () => {
      const key1 = getThumbnailCacheKey('video123', 'local');
      const key2 = getThumbnailCacheKey('video123', 'local');
      expect(key1).toBe(key2);
      expect(key1).toBe('thumbnail_local_video123');
    });

    test('should handle special characters in video IDs', () => {
      const key = getThumbnailCacheKey('video/with:special*chars', 'youtube');
      expect(key).toBe('thumbnail_youtube_video_with_special_chars');
    });

    test('should include video type in cache key', () => {
      const localKey = getThumbnailCacheKey('video123', 'local');
      const youtubeKey = getThumbnailCacheKey('video123', 'youtube');
      expect(localKey).not.toBe(youtubeKey);
    });
  });
});