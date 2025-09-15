import { describe, it, expect } from 'vitest';

/**
 * Utility functions for URL encoding/decoding video IDs in routes
 */

export function encodeVideoIdForRoute(videoId: string): string {
  return encodeURIComponent(videoId);
}

export function decodeVideoIdFromRoute(encodedVideoId: string): string {
  return decodeURIComponent(encodedVideoId);
}

describe('URL Encoding/Decoding Utilities', () => {
  describe('Round-trip Consistency', () => {
    it('should maintain consistency for local video IDs with colons', () => {
      const originalId = 'local:/home/user/videos/movie.mp4';

      const encoded = encodeVideoIdForRoute(originalId);
      const decoded = decodeVideoIdFromRoute(encoded);

      expect(decoded).toBe(originalId);
    });

    it('should maintain consistency for local video IDs with special characters', () => {
      const originalId = 'local:/home/user/Videos/Fun Cartoon (2024) - Episode 1.mp4';

      const encoded = encodeVideoIdForRoute(originalId);
      const decoded = decodeVideoIdFromRoute(encoded);

      expect(decoded).toBe(originalId);
    });

    it('should maintain consistency for local video IDs with emoji characters', () => {
      const originalId = 'local:/home/user/Videos/🎬 Movies/Fun Video 🎉.mp4';

      const encoded = encodeVideoIdForRoute(originalId);
      const decoded = decodeVideoIdFromRoute(encoded);

      expect(decoded).toBe(originalId);
    });

    it('should maintain consistency for DLNA video IDs', () => {
      const originalId = 'dlna://192.168.1.100:8200/Movies/Action Movie (2024).mp4';

      const encoded = encodeVideoIdForRoute(originalId);
      const decoded = decodeVideoIdFromRoute(encoded);

      expect(decoded).toBe(originalId);
    });

    it('should maintain consistency for YouTube video IDs', () => {
      const originalId = 'dQw4w9WgXcQ';

      const encoded = encodeVideoIdForRoute(originalId);
      const decoded = decodeVideoIdFromRoute(encoded);

      expect(decoded).toBe(originalId);
    });

    it('should handle video IDs with percent signs correctly', () => {
      const originalId = 'local:/home/user/Videos/Test%20Video.mp4';

      const encoded = encodeVideoIdForRoute(originalId);
      const decoded = decodeVideoIdFromRoute(encoded);

      expect(decoded).toBe(originalId);
    });

    it('should handle video IDs with question marks and hash symbols', () => {
      const originalId = 'local:/home/user/Videos/Movie? & Hash#.mp4';

      const encoded = encodeVideoIdForRoute(originalId);
      const decoded = decodeVideoIdFromRoute(encoded);

      expect(decoded).toBe(originalId);
    });

    it('should handle video IDs with plus signs', () => {
      const originalId = 'local:/home/user/Videos/Movie + Extra.mp4';

      const encoded = encodeVideoIdForRoute(originalId);
      const decoded = decodeVideoIdFromRoute(encoded);

      expect(decoded).toBe(originalId);
    });

    it('should handle video IDs with ampersands', () => {
      const originalId = 'local:/home/user/Videos/Rock & Roll.mp4';

      const encoded = encodeVideoIdForRoute(originalId);
      const decoded = decodeVideoIdFromRoute(encoded);

      expect(decoded).toBe(originalId);
    });

    it('should handle video IDs with equals signs', () => {
      const originalId = 'local:/home/user/Videos/Math=Fun.mp4';

      const encoded = encodeVideoIdForRoute(originalId);
      const decoded = decodeVideoIdFromRoute(encoded);

      expect(decoded).toBe(originalId);
    });

    it('should handle empty string', () => {
      const originalId = '';

      const encoded = encodeVideoIdForRoute(originalId);
      const decoded = decodeVideoIdFromRoute(encoded);

      expect(decoded).toBe(originalId);
    });

    it('should handle video IDs with newlines and tabs', () => {
      const originalId = 'local:/home/user/Videos/Movie\nWith\tSpecial\rChars.mp4';

      const encoded = encodeVideoIdForRoute(originalId);
      const decoded = decodeVideoIdFromRoute(encoded);

      expect(decoded).toBe(originalId);
    });
  });

  describe('Encoding Format', () => {
    it('should encode colons correctly', () => {
      const videoId = 'local:/path';
      const encoded = encodeVideoIdForRoute(videoId);

      expect(encoded).toBe('local%3A%2Fpath');
    });

    it('should encode spaces correctly', () => {
      const videoId = 'local:/path with spaces.mp4';
      const encoded = encodeVideoIdForRoute(videoId);

      expect(encoded).toBe('local%3A%2Fpath%20with%20spaces.mp4');
    });

    it('should encode parentheses correctly', () => {
      const videoId = 'local:/path/Movie (2024).mp4';
      const encoded = encodeVideoIdForRoute(videoId);

      expect(encoded).toBe('local%3A%2Fpath%2FMovie%20(2024).mp4');
    });

    it('should encode emojis correctly', () => {
      const videoId = 'local:/path/🎬.mp4';
      const encoded = encodeVideoIdForRoute(videoId);

      expect(encoded).toBe('local%3A%2Fpath%2F%F0%9F%8E%AC.mp4');
    });

    it('should not double-encode already encoded strings', () => {
      const videoId = 'local:/path/file.mp4';
      const firstEncoded = encodeVideoIdForRoute(videoId);
      const secondEncoded = encodeVideoIdForRoute(firstEncoded);

      // Second encoding should be different from first (double-encoded)
      expect(secondEncoded).not.toBe(firstEncoded);

      // But decoding twice should give us the original
      const firstDecoded = decodeVideoIdFromRoute(secondEncoded);
      const secondDecoded = decodeVideoIdFromRoute(firstDecoded);

      expect(secondDecoded).toBe(videoId);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long video IDs', () => {
      const originalId = 'local:/home/user/very/long/path/with/many/subdirectories/and/a/very/long/filename/that/might/cause/issues/Movie (2024) - Super Long Title with Emojis 🎬🎉.mp4';

      const encoded = encodeVideoIdForRoute(originalId);
      const decoded = decodeVideoIdFromRoute(encoded);

      expect(decoded).toBe(originalId);
    });

    it('should handle video IDs with all URL-unsafe characters', () => {
      const originalId = 'local:/home/user/Videos/!@#$%^&*()+=[]{}|\\:";\'<>?,./~`Movie.mp4';

      const encoded = encodeVideoIdForRoute(originalId);
      const decoded = decodeVideoIdFromRoute(encoded);

      expect(decoded).toBe(originalId);
    });

    it('should handle Unicode characters beyond emojis', () => {
      const originalId = 'local:/home/user/Videos/Café_Français_中文_العربية_Русский.mp4';

      const encoded = encodeVideoIdForRoute(originalId);
      const decoded = decodeVideoIdFromRoute(encoded);

      expect(decoded).toBe(originalId);
    });

    it('should handle video IDs that look like URLs', () => {
      const originalId = 'local:/home/user/Videos/https://example.com/video.mp4';

      const encoded = encodeVideoIdForRoute(originalId);
      const decoded = decodeVideoIdFromRoute(encoded);

      expect(decoded).toBe(originalId);
    });
  });
});