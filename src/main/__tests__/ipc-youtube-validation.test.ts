import { describe, it, expect } from 'vitest';

// Test the URL validation logic directly without full IPC setup
function validateYouTubeUrl(url: string, type: 'youtube_channel' | 'youtube_playlist') {
  try {
    if (type === 'youtube_channel') {
      // Validate YouTube channel URL
      const channelMatch = url.match(/(?:youtube\.com\/(?:c\/|channel\/|user\/|@))([\w-]+)/);
      if (!channelMatch) {
        return { isValid: false, errors: ['Invalid YouTube channel URL format'] };
      }

      // For channel validation, we could check if it exists via API
      // For now, just check format
      return { isValid: true };
    } else if (type === 'youtube_playlist') {
      // Validate YouTube playlist URL - check for both direct playlist URLs and watch URLs with list parameter
      const playlistMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
      if (!playlistMatch) {
        return { isValid: false, errors: ['Invalid YouTube playlist URL format'] };
      }

      // Check if it's a watch URL that should be cleaned to a proper playlist URL
      const isWatchUrl = url.includes('/watch?') && url.includes('list=');
      let cleanedUrl: string | undefined;

      if (isWatchUrl) {
        const listId = playlistMatch[1];
        cleanedUrl = `https://www.youtube.com/playlist?list=${listId}`;
      }

      return {
        isValid: true,
        cleanedUrl
      };
    }

    return { isValid: false, errors: ['Unknown URL type'] };
  } catch (error) {
    return { isValid: false, errors: ['Validation error'] };
  }
}

describe('YouTube URL Validation Logic', () => {

  describe('playlist URL validation', () => {
    it('should validate standard playlist URLs', () => {
      const url = 'https://www.youtube.com/playlist?list=PLIbdwDXxccgQpVd37Auo634lvDV_lskA7';
      const result = validateYouTubeUrl(url, 'youtube_playlist');

      expect(result.isValid).toBe(true);
      expect(result.cleanedUrl).toBeUndefined();
    });

    it('should validate and clean watch URLs with playlist parameter', () => {
      const url = 'https://www.youtube.com/watch?v=U5P5rEzuKy0&list=PLIbdwDXxccgQpVd37Auo634lvDV_lskA7';
      const result = validateYouTubeUrl(url, 'youtube_playlist');

      expect(result.isValid).toBe(true);
      expect(result.cleanedUrl).toBe('https://www.youtube.com/playlist?list=PLIbdwDXxccgQpVd37Auo634lvDV_lskA7');
    });

    it('should validate the user-reported URL', () => {
      const url = 'https://www.youtube.com/watch?v=xWghJEgmovU&list=PL4O65MiW7LRlXm035tmfqrR4MU4u2Xp1N';
      const result = validateYouTubeUrl(url, 'youtube_playlist');

      expect(result.isValid).toBe(true);
      expect(result.cleanedUrl).toBe('https://www.youtube.com/playlist?list=PL4O65MiW7LRlXm035tmfqrR4MU4u2Xp1N');
    });

    it('should handle various playlist ID formats', () => {
      const urls = [
        'https://www.youtube.com/playlist?list=PLrm5sF3xBUPF7_1-nCJU_VxlhXgwKTBm6',
        'https://www.youtube.com/watch?v=abc123&list=PLrm5sF3xBUPF7_1-nCJU_VxlhXgwKTBm6',
        'https://www.youtube.com/watch?list=PLrm5sF3xBUPF7_1-nCJU_VxlhXgwKTBm6&v=def456'
      ];

      urls.forEach(url => {
        const result = validateYouTubeUrl(url, 'youtube_playlist');
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject URLs without list parameter', () => {
      const url = 'https://www.youtube.com/watch?v=U5P5rEzuKy0';
      const result = validateYouTubeUrl(url, 'youtube_playlist');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid YouTube playlist URL format');
    });

    it('should reject invalid URLs', () => {
      const url = 'https://example.com';
      const result = validateYouTubeUrl(url, 'youtube_playlist');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid YouTube playlist URL format');
    });
  });

  describe('channel URL validation', () => {
    it('should validate channel URLs with @ format', () => {
      const url = 'https://www.youtube.com/@username';
      const result = validateYouTubeUrl(url, 'youtube_channel');

      expect(result.isValid).toBe(true);
    });

    it('should validate channel URLs with channel ID format', () => {
      const url = 'https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx';
      const result = validateYouTubeUrl(url, 'youtube_channel');

      expect(result.isValid).toBe(true);
    });

    it('should reject invalid channel URLs', () => {
      const url = 'https://example.com';
      const result = validateYouTubeUrl(url, 'youtube_channel');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid YouTube channel URL format');
    });
  });

  describe('response structure', () => {
    it('should return correct structure for valid playlist', () => {
      const url = 'https://www.youtube.com/playlist?list=PLtest123';
      const result = validateYouTubeUrl(url, 'youtube_playlist');

      expect(result).toHaveProperty('isValid');
      expect(typeof result.isValid).toBe('boolean');
      expect(result.isValid).toBe(true);
    });

    it('should return correct structure for invalid URL', () => {
      const url = 'invalid-url';
      const result = validateYouTubeUrl(url, 'youtube_playlist');

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result.isValid).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });
});