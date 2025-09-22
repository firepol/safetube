import { describe, it, expect } from 'vitest';
import { cleanYouTubePlaylistUrl, validateVideoSource, getDefaultSortOrder, isValidYouTubePlaylistUrl, detectYouTubeUrlType } from '../shared/videoSourceUtils';

describe('videoSourceUtils', () => {
  describe('cleanYouTubePlaylistUrl', () => {
    it('should clean watch URLs with playlist parameter', () => {
      const input = 'https://www.youtube.com/watch?v=U5P5rEzuKy0&list=PLIbdwDXxccgQpVd37Auo634lvDV_lskA7';
      const expected = 'https://www.youtube.com/playlist?list=PLIbdwDXxccgQpVd37Auo634lvDV_lskA7';
      expect(cleanYouTubePlaylistUrl(input)).toBe(expected);
    });

    it('should return original URL if not a watch URL with playlist', () => {
      const input = 'https://www.youtube.com/playlist?list=PLIbdwDXxccgQpVd37Auo634lvDV_lskA7';
      expect(cleanYouTubePlaylistUrl(input)).toBe(input);
    });

    it('should handle URLs without playlist parameter', () => {
      const input = 'https://www.youtube.com/watch?v=U5P5rEzuKy0';
      expect(cleanYouTubePlaylistUrl(input)).toBe(input);
    });

    it('should clean the user-reported URL with numeric playlist ID', () => {
      const input = 'https://www.youtube.com/watch?v=xWghJEgmovU&list=PL4O65MiW7LRlXm035tmfqrR4MU4u2Xp1N';
      const expected = 'https://www.youtube.com/playlist?list=PL4O65MiW7LRlXm035tmfqrR4MU4u2Xp1N';
      expect(cleanYouTubePlaylistUrl(input)).toBe(expected);
    });
  });

  describe('validateVideoSource', () => {
    it('should validate YouTube channel source', () => {
      const result = validateVideoSource(
        'youtube_channel',
        'https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx',
        undefined,
        'Test Channel'
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate YouTube playlist source', () => {
      const result = validateVideoSource(
        'youtube_playlist',
        'https://www.youtube.com/playlist?list=PLxxxxxx',
        undefined,
        'Test Playlist'
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate local source', () => {
      const result = validateVideoSource(
        'local',
        undefined,
        '/path/to/videos',
        'Test Local'
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty title', () => {
      const result = validateVideoSource(
        'youtube_channel',
        'https://www.youtube.com/channel/UCxxxxx',
        undefined,
        ''
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Title is required');
    });

    it('should reject invalid YouTube channel URL', () => {
      const result = validateVideoSource(
        'youtube_channel',
        'https://invalid-url.com',
        undefined,
        'Test Channel'
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid YouTube channel URL format');
    });
  });

  describe('getDefaultSortOrder', () => {
    it('should return correct default sort order for each type', () => {
      expect(getDefaultSortOrder('youtube_channel')).toBe('newestFirst');
      expect(getDefaultSortOrder('youtube_playlist')).toBe('playlistOrder');
      expect(getDefaultSortOrder('local')).toBe('alphabetical');
    });
  });

  describe('isValidYouTubePlaylistUrl', () => {
    it('should validate standard playlist URLs', () => {
      expect(isValidYouTubePlaylistUrl('https://www.youtube.com/playlist?list=PLIbdwDXxccgQpVd37Auo634lvDV_lskA7')).toBe(true);
    });

    it('should validate watch URLs with playlist parameter', () => {
      expect(isValidYouTubePlaylistUrl('https://www.youtube.com/watch?v=U5P5rEzuKy0&list=PLIbdwDXxccgQpVd37Auo634lvDV_lskA7')).toBe(true);
    });

    it('should validate the user-reported URL', () => {
      const url = 'https://www.youtube.com/watch?v=xWghJEgmovU&list=PL4O65MiW7LRlXm035tmfqrR4MU4u2Xp1N';
      expect(isValidYouTubePlaylistUrl(url)).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidYouTubePlaylistUrl('https://example.com')).toBe(false);
      expect(isValidYouTubePlaylistUrl('https://www.youtube.com/watch?v=U5P5rEzuKy0')).toBe(false);
    });
  });

  describe('detectYouTubeUrlType', () => {
    it('should detect playlist URLs correctly', () => {
      expect(detectYouTubeUrlType('https://www.youtube.com/playlist?list=PLIbdwDXxccgQpVd37Auo634lvDV_lskA7')).toBe('youtube_playlist');
      expect(detectYouTubeUrlType('https://www.youtube.com/watch?v=U5P5rEzuKy0&list=PLIbdwDXxccgQpVd37Auo634lvDV_lskA7')).toBe('youtube_playlist');
    });

    it('should detect the user-reported URL as playlist', () => {
      const url = 'https://www.youtube.com/watch?v=xWghJEgmovU&list=PL4O65MiW7LRlXm035tmfqrR4MU4u2Xp1N';
      expect(detectYouTubeUrlType(url)).toBe('youtube_playlist');
    });

    it('should detect channel URLs correctly', () => {
      expect(detectYouTubeUrlType('https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx')).toBe('youtube_channel');
      expect(detectYouTubeUrlType('https://www.youtube.com/@username')).toBe('youtube_channel');
    });

    it('should return null for invalid URLs', () => {
      expect(detectYouTubeUrlType('https://example.com')).toBe(null);
      expect(detectYouTubeUrlType('')).toBe(null);
    });
  });
});
