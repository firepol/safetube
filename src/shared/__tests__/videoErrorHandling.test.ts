/**
 * Unit tests for video error handling infrastructure
 */

import { vi } from 'vitest';
import {
  VideoErrorType,
  classifyVideoError,
  VideoErrorLogger,
  createFallbackVideo,
  createVideoLoadMetrics,
  DEFAULT_RETRY_CONFIG
} from '../videoErrorHandling';

describe('Video Error Handling Infrastructure', () => {
  beforeEach(() => {
    // Clear error tracking before each test
    VideoErrorLogger.clearErrorTracking();
  });

  describe('classifyVideoError', () => {
    test('should classify deleted video error', () => {
      const error = new Error('Video not found: test123');
      const classified = classifyVideoError(error, 'test123');

      expect(classified.type).toBe(VideoErrorType.DELETED);
      expect(classified.message).toBe('Video has been deleted');
      expect(classified.retryable).toBe(false);
      expect(classified.videoId).toBe('test123');
      expect(classified.timestamp).toBeDefined();
    });

    test('should classify private video error', () => {
      const error = new Error('Video is private');
      const classified = classifyVideoError(error, 'private123');

      expect(classified.type).toBe(VideoErrorType.PRIVATE);
      expect(classified.message).toBe('Video is private');
      expect(classified.retryable).toBe(false);
      expect(classified.videoId).toBe('private123');
    });

    test('should classify restricted video error', () => {
      const error = new Error('Video is age restricted');
      const classified = classifyVideoError(error, 'restricted123');

      expect(classified.type).toBe(VideoErrorType.RESTRICTED);
      expect(classified.message).toBe('Video is restricted (age/geo)');
      expect(classified.retryable).toBe(false);
    });

    test('should classify API quota error', () => {
      const error = new Error('API quota exceeded');
      const classified = classifyVideoError(error, 'quota123');

      expect(classified.type).toBe(VideoErrorType.API_ERROR);
      expect(classified.message).toBe('API quota or rate limit exceeded');
      expect(classified.retryable).toBe(true);
    });

    test('should classify network error', () => {
      const error = new Error('Request timeout');
      const classified = classifyVideoError(error, 'network123');

      expect(classified.type).toBe(VideoErrorType.NETWORK_ERROR);
      expect(classified.message).toBe('Network connectivity issue');
      expect(classified.retryable).toBe(true);
    });

    test('should classify unknown error', () => {
      const error = new Error('Some unexpected error');
      const classified = classifyVideoError(error, 'unknown123');

      expect(classified.type).toBe(VideoErrorType.UNKNOWN);
      expect(classified.message).toBe('Some unexpected error');
      expect(classified.retryable).toBe(true);
    });

    test('should handle non-Error objects', () => {
      const classified = classifyVideoError('string error', 'string123');

      expect(classified.type).toBe(VideoErrorType.UNKNOWN);
      expect(classified.message).toBe('string error');
      expect(classified.retryable).toBe(true);
    });

    test('should handle null/undefined errors', () => {
      const classified = classifyVideoError(null, 'null123');

      expect(classified.type).toBe(VideoErrorType.UNKNOWN);
      expect(classified.message).toBe('Unknown error occurred');
      expect(classified.retryable).toBe(true);
    });
  });

  describe('VideoErrorLogger', () => {
    test('should log and track video errors', () => {
      const error1 = classifyVideoError(new Error('Video not found'), 'video1');
      const error2 = classifyVideoError(new Error('API quota exceeded'), 'video2');

      VideoErrorLogger.logVideoError('video1', error1);
      VideoErrorLogger.logVideoError('video2', error2);

      const stats = VideoErrorLogger.getErrorStatistics();
      expect(stats.totalErrors).toBe(2);
      expect(stats.errorBreakdown[VideoErrorType.DELETED]).toBe(1);
      expect(stats.errorBreakdown[VideoErrorType.API_ERROR]).toBe(1);
    });

    test('should track multiple errors for same video', () => {
      const error1 = classifyVideoError(new Error('Network timeout'), 'video1');
      const error2 = classifyVideoError(new Error('API quota exceeded'), 'video1');

      VideoErrorLogger.logVideoError('video1', error1);
      VideoErrorLogger.logVideoError('video1', error2);

      const history = VideoErrorLogger.getVideoErrorHistory('video1');
      expect(history).toHaveLength(2);
      expect(history[0].type).toBe(VideoErrorType.NETWORK_ERROR);
      expect(history[1].type).toBe(VideoErrorType.API_ERROR);
    });

    test('should return empty history for unknown video', () => {
      const history = VideoErrorLogger.getVideoErrorHistory('unknown');
      expect(history).toHaveLength(0);
    });

    test('should clear error tracking', () => {
      const error = classifyVideoError(new Error('Test error'), 'video1');
      VideoErrorLogger.logVideoError('video1', error);

      let stats = VideoErrorLogger.getErrorStatistics();
      expect(stats.totalErrors).toBe(1);

      VideoErrorLogger.clearErrorTracking();

      stats = VideoErrorLogger.getErrorStatistics();
      expect(stats.totalErrors).toBe(0);
    });

    test('should log video load metrics', () => {
      // Set verbose logging for this test
      const originalVerbose = process.env.ELECTRON_LOG_VERBOSE;
      process.env.ELECTRON_LOG_VERBOSE = 'true';

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

      const metrics = createVideoLoadMetrics(
        10, // total
        8,  // successful
        2,  // failed
        { [VideoErrorType.DELETED]: 1, [VideoErrorType.PRIVATE]: 1 } as any,
        1500, // load time
        'test-source',
        1 // page number
      );

      VideoErrorLogger.logVideoLoadMetrics(metrics);

      // Should have logged multiple lines
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();

      // Restore original verbose setting
      if (originalVerbose !== undefined) {
        process.env.ELECTRON_LOG_VERBOSE = originalVerbose;
      } else {
        delete process.env.ELECTRON_LOG_VERBOSE;
      }
    });
  });

  describe('createFallbackVideo', () => {
    test('should create fallback video without error info', () => {
      const fallback = createFallbackVideo('test123');

      expect(fallback.id).toBe('test123');
      expect(fallback.type).toBe('youtube');
      expect(fallback.title).toBe('Video test123 (Unavailable)');
      expect(fallback.thumbnail).toBe('/placeholder-thumbnail.svg');
      expect(fallback.duration).toBe(0);
      expect(fallback.url).toBe('https://www.youtube.com/watch?v=test123');
      expect(fallback.isAvailable).toBe(false);
      expect(fallback.isFallback).toBe(true);
      expect(fallback.errorInfo).toBeUndefined();
    });

    test('should create fallback video with error info', () => {
      const error = classifyVideoError(new Error('Video not found'), 'test123');
      const fallback = createFallbackVideo('test123', error);

      expect(fallback.errorInfo).toBe(error);
      expect(fallback.errorInfo?.type).toBe(VideoErrorType.DELETED);
    });
  });

  describe('createVideoLoadMetrics', () => {
    test('should create metrics object with all fields', () => {
      const errorBreakdown = {
        [VideoErrorType.DELETED]: 1,
        [VideoErrorType.PRIVATE]: 1,
        [VideoErrorType.RESTRICTED]: 0,
        [VideoErrorType.API_ERROR]: 0,
        [VideoErrorType.NETWORK_ERROR]: 0,
        [VideoErrorType.UNKNOWN]: 0
      };

      const metrics = createVideoLoadMetrics(
        10, 8, 2, errorBreakdown, 1500, 'test-source', 1
      );

      expect(metrics.totalVideos).toBe(10);
      expect(metrics.successfulLoads).toBe(8);
      expect(metrics.failedLoads).toBe(2);
      expect(metrics.errorBreakdown).toBe(errorBreakdown);
      expect(metrics.loadTimeMs).toBe(1500);
      expect(metrics.sourceId).toBe('test-source');
      expect(metrics.pageNumber).toBe(1);
    });

    test('should create metrics object without optional fields', () => {
      const errorBreakdown = {
        [VideoErrorType.DELETED]: 0,
        [VideoErrorType.PRIVATE]: 0,
        [VideoErrorType.RESTRICTED]: 0,
        [VideoErrorType.API_ERROR]: 0,
        [VideoErrorType.NETWORK_ERROR]: 0,
        [VideoErrorType.UNKNOWN]: 1
      };

      const metrics = createVideoLoadMetrics(5, 4, 1, errorBreakdown, 800);

      expect(metrics.totalVideos).toBe(5);
      expect(metrics.successfulLoads).toBe(4);
      expect(metrics.failedLoads).toBe(1);
      expect(metrics.sourceId).toBeUndefined();
      expect(metrics.pageNumber).toBeUndefined();
    });
  });

  describe('DEFAULT_RETRY_CONFIG', () => {
    test('should have correct default values', () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBe(1000);
      expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(10000);
      expect(DEFAULT_RETRY_CONFIG.retryableErrorTypes).toContain(VideoErrorType.API_ERROR);
      expect(DEFAULT_RETRY_CONFIG.retryableErrorTypes).toContain(VideoErrorType.NETWORK_ERROR);
      expect(DEFAULT_RETRY_CONFIG.retryableErrorTypes).toContain(VideoErrorType.UNKNOWN);
      expect(DEFAULT_RETRY_CONFIG.retryableErrorTypes).not.toContain(VideoErrorType.DELETED);
      expect(DEFAULT_RETRY_CONFIG.retryableErrorTypes).not.toContain(VideoErrorType.PRIVATE);
    });
  });
});