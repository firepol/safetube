import { describe, it, expect } from 'vitest';
import {
  parseVideoId,
  createLocalVideoId,
  createDLNAVideoId,
  extractPathFromVideoId
} from './fileUtils';

describe('Video ID Utilities', () => {
  describe('parseVideoId', () => {
    it('should parse YouTube video IDs correctly', () => {
      const result = parseVideoId('dQw4w9WgXcQ');
      expect(result.success).toBe(true);
      expect(result.parsed?.type).toBe('youtube');
      expect(result.parsed?.originalId).toBe('dQw4w9WgXcQ');
    });

    it('should parse local video IDs correctly', () => {
      const result = parseVideoId('local:/home/user/videos/movie.mp4');
      expect(result.success).toBe(true);
      expect(result.parsed?.type).toBe('local');
      expect(result.parsed?.originalId).toBe('local:/home/user/videos/movie.mp4');
      expect(result.parsed?.path).toBe('/home/user/videos/movie.mp4');
    });

    it('should parse DLNA video IDs correctly', () => {
      const result = parseVideoId('dlna://192.168.1.100:8200/Movies/Action/movie.mp4');
      expect(result.success).toBe(true);
      expect(result.parsed?.type).toBe('dlna');
      expect(result.parsed?.originalId).toBe('dlna://192.168.1.100:8200/Movies/Action/movie.mp4');
      expect(result.parsed?.host).toBe('192.168.1.100:8200');
      expect(result.parsed?.path).toBe('/Movies/Action/movie.mp4');
    });

    it('should handle local paths with special characters', () => {
      const result = parseVideoId('local:/home/user/Videos/Kids/Fun Cartoon (2024) - Episode 1.mp4');
      expect(result.success).toBe(true);
      expect(result.parsed?.type).toBe('local');
      expect(result.parsed?.path).toBe('/home/user/Videos/Kids/Fun Cartoon (2024) - Episode 1.mp4');
    });

    it('should handle paths with emoji characters', () => {
      const result = parseVideoId('local:/home/user/Videos/🎬 Movies/Fun Video 🎉.mp4');
      expect(result.success).toBe(true);
      expect(result.parsed?.type).toBe('local');
      expect(result.parsed?.path).toBe('/home/user/Videos/🎬 Movies/Fun Video 🎉.mp4');
    });

    it('should handle legacy local video IDs', () => {
      const result = parseVideoId('local_abc123def456');
      expect(result.success).toBe(true);
      expect(result.parsed?.type).toBe('local');
      expect(result.parsed?.originalId).toBe('local_abc123def456');
    });

    it('should handle example video IDs', () => {
      const result = parseVideoId('example-video-1');
      expect(result.success).toBe(true);
      expect(result.parsed?.type).toBe('local');
      expect(result.parsed?.originalId).toBe('example-video-1');
    });

    it('should return error for invalid DLNA format', () => {
      const result = parseVideoId('dlna://192.168.1.100:8200');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid DLNA URL format: missing path');
    });

    it('should return error for unknown format', () => {
      const result = parseVideoId('unknown:format');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown video ID format');
    });
  });

  describe('createLocalVideoId', () => {
    it('should create local video ID correctly', () => {
      const videoId = createLocalVideoId('/home/user/videos/movie.mp4');
      expect(videoId).toBe('local:/home/user/videos/movie.mp4');
    });

    it('should handle special characters in paths', () => {
      const videoId = createLocalVideoId('/home/user/Videos/Fun Cartoon (2024) - Episode 1.mp4');
      expect(videoId).toBe('local:/home/user/Videos/Fun Cartoon (2024) - Episode 1.mp4');
    });

    it('should handle emoji characters in paths', () => {
      const videoId = createLocalVideoId('/home/user/Videos/🎬 Movies/Fun Video 🎉.mp4');
      expect(videoId).toBe('local:/home/user/Videos/🎬 Movies/Fun Video 🎉.mp4');
    });
  });

  describe('createDLNAVideoId', () => {
    it('should create DLNA video ID correctly', () => {
      const videoId = createDLNAVideoId('192.168.1.100:8200', '/Movies/Action/movie.mp4');
      expect(videoId).toBe('dlna://192.168.1.100:8200/Movies/Action/movie.mp4');
    });

    it('should handle special characters in DLNA paths', () => {
      const videoId = createDLNAVideoId('192.168.1.100:8200', '/Movies/Fun Movie (2024).mp4');
      expect(videoId).toBe('dlna://192.168.1.100:8200/Movies/Fun Movie (2024).mp4');
    });
  });

  describe('extractPathFromVideoId', () => {
    it('should extract path from local video ID', () => {
      const path = extractPathFromVideoId('local:/home/user/videos/movie.mp4');
      expect(path).toBe('/home/user/videos/movie.mp4');
    });

    it('should extract path from DLNA video ID', () => {
      const path = extractPathFromVideoId('dlna://192.168.1.100:8200/Movies/movie.mp4');
      expect(path).toBe('/Movies/movie.mp4');
    });

    it('should return null for YouTube video ID', () => {
      const path = extractPathFromVideoId('dQw4w9WgXcQ');
      expect(path).toBe(null);
    });

    it('should return null for invalid video ID', () => {
      const path = extractPathFromVideoId('invalid:format');
      expect(path).toBe(null);
    });

    it('should handle paths with special characters', () => {
      const path = extractPathFromVideoId('local:/home/user/Videos/Fun Cartoon (2024) - Episode 1.mp4');
      expect(path).toBe('/home/user/Videos/Fun Cartoon (2024) - Episode 1.mp4');
    });

    it('should handle paths with emoji characters', () => {
      const path = extractPathFromVideoId('local:/home/user/Videos/🎬 Movies/Fun Video 🎉.mp4');
      expect(path).toBe('/home/user/Videos/🎬 Movies/Fun Video 🎉.mp4');
    });
  });
});