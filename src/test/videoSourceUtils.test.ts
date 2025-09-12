import { describe, it, expect } from 'vitest';
import { cleanYouTubePlaylistUrl, validateVideoSource, getDefaultSortOrder } from '../shared/videoSourceUtils';

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
});
