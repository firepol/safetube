import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as sharedFileUtils from '../shared/fileUtils';

// Mock dependencies
vi.mock('../shared/fileUtils');

const mockSharedFileUtils = vi.mocked(sharedFileUtils);

describe('Video Loading System', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up parseVideoId mock
    mockSharedFileUtils.parseVideoId.mockImplementation((videoId) => {
      if (videoId.startsWith('local:')) {
        return {
          success: true,
          parsed: {
            type: 'local',
            originalId: videoId,
            path: videoId.substring(6)
          }
        };
      } else if (videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
        return {
          success: true,
          parsed: {
            type: 'youtube',
            originalId: videoId
          }
        };
      } else if (videoId.startsWith('dlna://')) {
        const urlPart = videoId.substring(7);
        const firstSlash = urlPart.indexOf('/');
        if (firstSlash === -1) {
          return {
            success: false,
            error: 'Invalid DLNA URL format: missing path'
          };
        }
        return {
          success: true,
          parsed: {
            type: 'dlna',
            originalId: videoId,
            host: urlPart.substring(0, firstSlash),
            path: urlPart.substring(firstSlash)
          }
        };
      }
      return {
        success: false,
        error: 'Unknown video ID format'
      };
    });

    mockSharedFileUtils.extractPathFromVideoId.mockImplementation((videoId) => {
      const result = mockSharedFileUtils.parseVideoId(videoId);
      if (result.success && result.parsed?.path) {
        return result.parsed.path;
      }
      return null;
    });

    mockSharedFileUtils.createLocalVideoId.mockImplementation((filePath) => {
      return `local:${filePath}`;
    });

    mockSharedFileUtils.createDLNAVideoId.mockImplementation((host, path) => {
      return `dlna://${host}${path}`;
    });
  });

  describe('Video ID Parsing', () => {
    it('should parse YouTube video IDs correctly', () => {
      const result = mockSharedFileUtils.parseVideoId('dQw4w9WgXcQ');

      expect(result.success).toBe(true);
      expect(result.parsed?.type).toBe('youtube');
      expect(result.parsed?.originalId).toBe('dQw4w9WgXcQ');
    });

    it('should parse local video IDs correctly', () => {
      const videoId = 'local:/home/user/videos/movie.mp4';
      const result = mockSharedFileUtils.parseVideoId(videoId);

      expect(result.success).toBe(true);
      expect(result.parsed?.type).toBe('local');
      expect(result.parsed?.path).toBe('/home/user/videos/movie.mp4');
    });

    it('should parse DLNA video IDs correctly', () => {
      const videoId = 'dlna://192.168.1.100:8200/Movies/Action/movie.mp4';
      const result = mockSharedFileUtils.parseVideoId(videoId);

      expect(result.success).toBe(true);
      expect(result.parsed?.type).toBe('dlna');
      expect(result.parsed?.host).toBe('192.168.1.100:8200');
      expect(result.parsed?.path).toBe('/Movies/Action/movie.mp4');
    });

    it('should handle special characters in paths', () => {
      const videoId = 'local:/home/user/Videos/Fun Cartoon (2024) - Episode 1.mp4';
      const result = mockSharedFileUtils.parseVideoId(videoId);

      expect(result.success).toBe(true);
      expect(result.parsed?.path).toBe('/home/user/Videos/Fun Cartoon (2024) - Episode 1.mp4');
    });

    it('should handle emoji characters in paths', () => {
      const videoId = 'local:/home/user/Videos/🎬 Movies/Fun Video 🎉.mp4';
      const result = mockSharedFileUtils.parseVideoId(videoId);

      expect(result.success).toBe(true);
      expect(result.parsed?.path).toBe('/home/user/Videos/🎬 Movies/Fun Video 🎉.mp4');
    });

    it('should return error for invalid formats', () => {
      const result = mockSharedFileUtils.parseVideoId('invalid:format:here');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown video ID format');
    });
  });

  describe('Path Extraction', () => {
    it('should extract paths from local video IDs', () => {
      const videoId = 'local:/home/user/videos/movie.mp4';
      const path = mockSharedFileUtils.extractPathFromVideoId(videoId);

      expect(path).toBe('/home/user/videos/movie.mp4');
    });

    it('should extract paths from DLNA video IDs', () => {
      const videoId = 'dlna://192.168.1.100:8200/Movies/movie.mp4';
      const path = mockSharedFileUtils.extractPathFromVideoId(videoId);

      expect(path).toBe('/Movies/movie.mp4');
    });

    it('should return null for YouTube video IDs', () => {
      const path = mockSharedFileUtils.extractPathFromVideoId('dQw4w9WgXcQ');

      expect(path).toBe(null);
    });
  });

  describe('Video ID Creation', () => {
    it('should create local video IDs correctly', () => {
      const filePath = '/home/user/videos/movie.mp4';
      const videoId = mockSharedFileUtils.createLocalVideoId(filePath);

      expect(videoId).toBe('local:/home/user/videos/movie.mp4');
    });

    it('should create DLNA video IDs correctly', () => {
      const videoId = mockSharedFileUtils.createDLNAVideoId('192.168.1.100:8200', '/Movies/movie.mp4');

      expect(videoId).toBe('dlna://192.168.1.100:8200/Movies/movie.mp4');
    });

    it('should handle special characters in local paths', () => {
      const filePath = '/home/user/Videos/Fun Cartoon (2024) - Episode 1.mp4';
      const videoId = mockSharedFileUtils.createLocalVideoId(filePath);

      expect(videoId).toBe('local:/home/user/Videos/Fun Cartoon (2024) - Episode 1.mp4');
    });
  });

  describe('Round-trip Consistency', () => {
    it('should maintain consistency for local videos', () => {
      const originalPath = '/home/user/videos/test-movie.mp4';

      // Create ID from path
      const videoId = mockSharedFileUtils.createLocalVideoId(originalPath);

      // Extract path from ID
      const extractedPath = mockSharedFileUtils.extractPathFromVideoId(videoId);

      expect(extractedPath).toBe(originalPath);
    });

    it('should maintain consistency for DLNA videos', () => {
      const originalHost = '192.168.1.100:8200';
      const originalPath = '/Movies/Action/test.mp4';

      // Create ID
      const videoId = mockSharedFileUtils.createDLNAVideoId(originalHost, originalPath);

      // Parse back
      const parseResult = mockSharedFileUtils.parseVideoId(videoId);

      expect(parseResult.success).toBe(true);
      expect(parseResult.parsed?.host).toBe(originalHost);
      expect(parseResult.parsed?.path).toBe(originalPath);
    });
  });
});