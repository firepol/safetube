/**
 * Comprehensive unit tests for YouTube API error handling
 * Tests Requirements: 1.1, 1.3, 1.4, 2.1
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { YouTubeAPI } from '../youtube';
import { 
  VideoErrorType, 
  classifyVideoError, 
  VideoErrorLogger, 
  createFallbackVideo 
} from '../../shared/videoErrorHandling';

// Mock the logging module
vi.mock('../logging', () => ({
  logVerbose: vi.fn()
}));

// Mock the shared error handling module
vi.mock('../../shared/videoErrorHandling', async () => {
  const actual = await vi.importActual('../../shared/videoErrorHandling');
  return {
    ...actual,
    VideoErrorLogger: {
      logVideoError: vi.fn(),
      logVideoLoadMetrics: vi.fn(),
      getErrorStatistics: vi.fn(() => ({ totalErrors: 0, errorBreakdown: {} })),
      getVideoErrorHistory: vi.fn(() => []),
      clearErrorTracking: vi.fn()
    }
  };
});

describe('YouTube API Error Handling', () => {
  beforeEach(() => {
    // Set up API key for tests
    YouTubeAPI.setApiKey('test-api-key');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getVideoDetails error handling', () => {
    test('should return null for deleted video and log error', async () => {
      // Mock fetch to simulate deleted video (empty items array)
      const mockFetch = vi.spyOn(YouTubeAPI as any, 'fetch').mockResolvedValue({
        items: []
      });

      const result = await YouTubeAPI.getVideoDetails('deleted_video_id');

      expect(result).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith('videos', {
        part: 'snippet,contentDetails,status',
        id: 'deleted_video_id'
      });
      expect(VideoErrorLogger.logVideoError).toHaveBeenCalledWith(
        'deleted_video_id',
        expect.objectContaining({
          type: VideoErrorType.DELETED,
          videoId: 'deleted_video_id'
        })
      );

      mockFetch.mockRestore();
    });

    test('should return null for private video API error and log error', async () => {
      // Mock fetch to throw private video error
      const privateError = new Error('Video is private');
      const mockFetch = vi.spyOn(YouTubeAPI as any, 'fetch').mockRejectedValue(privateError);

      const result = await YouTubeAPI.getVideoDetails('private_video_id');

      expect(result).toBeNull();
      expect(VideoErrorLogger.logVideoError).toHaveBeenCalledWith(
        'private_video_id',
        expect.objectContaining({
          type: VideoErrorType.PRIVATE,
          videoId: 'private_video_id'
        })
      );

      mockFetch.mockRestore();
    });

    test('should return null for API quota exceeded error and log error', async () => {
      // Mock fetch to throw quota error
      const quotaError = new Error('YouTube API quota exceeded. Please try again later.');
      const mockFetch = vi.spyOn(YouTubeAPI as any, 'fetch').mockRejectedValue(quotaError);

      const result = await YouTubeAPI.getVideoDetails('quota_test_id');

      expect(result).toBeNull();
      expect(VideoErrorLogger.logVideoError).toHaveBeenCalledWith(
        'quota_test_id',
        expect.objectContaining({
          type: VideoErrorType.API_ERROR,
          videoId: 'quota_test_id'
        })
      );

      mockFetch.mockRestore();
    });

    test('should return null for network error and log error', async () => {
      // Mock fetch to throw network error
      const networkError = new Error('Request timeout');
      const mockFetch = vi.spyOn(YouTubeAPI as any, 'fetch').mockRejectedValue(networkError);

      const result = await YouTubeAPI.getVideoDetails('network_test_id');

      expect(result).toBeNull();
      expect(VideoErrorLogger.logVideoError).toHaveBeenCalledWith(
        'network_test_id',
        expect.objectContaining({
          type: VideoErrorType.NETWORK_ERROR,
          videoId: 'network_test_id'
        })
      );

      mockFetch.mockRestore();
    });

    test('should return valid video object for successful request', async () => {
      // Mock successful video response
      const mockVideoData = {
        items: [{
          id: 'valid_video_id',
          snippet: {
            title: 'Test Video',
            description: 'Test Description',
            thumbnails: {
              default: { url: 'https://example.com/default.jpg' },
              medium: { url: 'https://example.com/medium.jpg' },
              high: { url: 'https://example.com/high.jpg' }
            },
            channelId: 'test_channel',
            channelTitle: 'Test Channel'
          },
          contentDetails: {
            duration: 'PT5M30S',
            dimension: '2d',
            definition: 'hd'
          },
          status: {
            privacyStatus: 'public',
            madeForKids: false
          }
        }]
      };

      const mockFetch = vi.spyOn(YouTubeAPI as any, 'fetch').mockResolvedValue(mockVideoData);

      const result = await YouTubeAPI.getVideoDetails('valid_video_id');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('valid_video_id');
      expect(result?.snippet.title).toBe('Test Video');
      expect(VideoErrorLogger.logVideoError).not.toHaveBeenCalled();

      mockFetch.mockRestore();
    });
  });

  describe('getPlaylistVideosPage mixed success/failure scenarios', () => {
    test('should handle mixed success and failure results gracefully', async () => {
      // Mock playlist videos fetch to return video IDs
      const mockPlaylistFetch = vi.spyOn(YouTubeAPI, 'getPlaylistVideos').mockResolvedValue({
        videoIds: ['valid_video_1', 'deleted_video', 'valid_video_2', 'private_video'],
        totalResults: 4,
        nextPageToken: undefined
      });

      // Mock getVideoDetails to return mixed results
      const mockGetVideoDetails = vi.spyOn(YouTubeAPI, 'getVideoDetails')
        .mockImplementation(async (videoId: string) => {
          if (videoId === 'valid_video_1') {
            return {
              id: 'valid_video_1',
              snippet: {
                title: 'Valid Video 1',
                description: 'Description 1',
                thumbnails: {
                  default: { url: 'https://example.com/default1.jpg' },
                  medium: { url: 'https://example.com/medium1.jpg' },
                  high: { url: 'https://example.com/high1.jpg' }
                },
                channelId: 'test_channel',
                channelTitle: 'Test Channel'
              },
              contentDetails: {
                duration: 'PT3M45S',
                dimension: '2d',
                definition: 'hd'
              },
              status: {
                privacyStatus: 'public',
                madeForKids: false
              }
            };
          } else if (videoId === 'valid_video_2') {
            return {
              id: 'valid_video_2',
              snippet: {
                title: 'Valid Video 2',
                description: 'Description 2',
                thumbnails: {
                  default: { url: 'https://example.com/default2.jpg' },
                  medium: { url: 'https://example.com/medium2.jpg' },
                  high: { url: 'https://example.com/high2.jpg' }
                },
                channelId: 'test_channel',
                channelTitle: 'Test Channel'
              },
              contentDetails: {
                duration: 'PT7M20S',
                dimension: '2d',
                definition: 'hd'
              },
              status: {
                privacyStatus: 'public',
                madeForKids: false
              }
            };
          } else {
            // Return null for deleted_video and private_video
            return null;
          }
        });

      const result = await YouTubeAPI.getPlaylistVideosPage('test_playlist', 1, 4);

      expect(result.videos).toHaveLength(4);
      expect(result.totalResults).toBe(4);
      expect(result.pageNumber).toBe(1);

      // Check successful videos
      const validVideos = result.videos.filter(v => v.isAvailable !== false);
      expect(validVideos).toHaveLength(2);
      expect(validVideos[0].id).toBe('valid_video_1');
      expect(validVideos[0].title).toBe('Valid Video 1');
      expect(validVideos[1].id).toBe('valid_video_2');
      expect(validVideos[1].title).toBe('Valid Video 2');

      // Check fallback videos
      const fallbackVideos = result.videos.filter(v => v.isFallback === true);
      expect(fallbackVideos).toHaveLength(2);
      expect(fallbackVideos.map(v => v.id)).toContain('deleted_video');
      expect(fallbackVideos.map(v => v.id)).toContain('private_video');

      // Verify all fallback videos have correct properties
      fallbackVideos.forEach(video => {
        expect(video.isAvailable).toBe(false);
        expect(video.isFallback).toBe(true);
        expect(video.type).toBe('youtube');
        expect(video.url).toBe(`https://www.youtube.com/watch?v=${video.id}`);
        expect(video.thumbnail).toBe('/placeholder-thumbnail.svg');
        expect(video.duration).toBe(0);
      });

      mockPlaylistFetch.mockRestore();
      mockGetVideoDetails.mockRestore();
    });

    test('should handle all videos failing gracefully', async () => {
      // Mock playlist videos fetch
      const mockPlaylistFetch = vi.spyOn(YouTubeAPI, 'getPlaylistVideos').mockResolvedValue({
        videoIds: ['deleted_1', 'deleted_2', 'private_1'],
        totalResults: 3,
        nextPageToken: undefined
      });

      // Mock all getVideoDetails calls to return null
      const mockGetVideoDetails = vi.spyOn(YouTubeAPI, 'getVideoDetails').mockResolvedValue(null);

      const result = await YouTubeAPI.getPlaylistVideosPage('test_playlist', 1, 3);

      expect(result.videos).toHaveLength(3);
      expect(result.totalResults).toBe(3);

      // All videos should be fallbacks
      result.videos.forEach(video => {
        expect(video.isAvailable).toBe(false);
        expect(video.isFallback).toBe(true);
        expect(video.type).toBe('youtube');
        expect(video.title).toMatch(/^Video .+ \(Unavailable\)$/);
      });

      mockPlaylistFetch.mockRestore();
      mockGetVideoDetails.mockRestore();
    });

    test('should handle empty playlist gracefully', async () => {
      // Mock empty playlist
      const mockPlaylistFetch = vi.spyOn(YouTubeAPI, 'getPlaylistVideos').mockResolvedValue({
        videoIds: [],
        totalResults: 0,
        nextPageToken: undefined
      });

      const result = await YouTubeAPI.getPlaylistVideosPage('empty_playlist', 1, 50);

      expect(result.videos).toHaveLength(0);
      expect(result.totalResults).toBe(0);
      expect(result.pageNumber).toBe(1);

      mockPlaylistFetch.mockRestore();
    });

    test('should handle pagination correctly with mixed results', async () => {
      // Mock playlist videos fetch for page 2
      const mockPlaylistFetch = vi.spyOn(YouTubeAPI, 'getPlaylistVideos')
        .mockImplementation(async (playlistId, maxResults, pageToken) => {
          // Simulate fetching multiple batches to reach page 2
          if (!pageToken) {
            // First batch (page 1 equivalent)
            return {
              videoIds: Array.from({ length: 50 }, (_, i) => `video_${i + 1}`),
              totalResults: 150,
              nextPageToken: 'token_page_2'
            };
          } else if (pageToken === 'token_page_2') {
            // Second batch (page 2 equivalent)
            return {
              videoIds: Array.from({ length: 50 }, (_, i) => `video_${i + 51}`),
              totalResults: 150,
              nextPageToken: 'token_page_3'
            };
          }
          return { videoIds: [], totalResults: 150 };
        });

      // Mock getVideoDetails to simulate mixed success/failure
      const mockGetVideoDetails = vi.spyOn(YouTubeAPI, 'getVideoDetails')
        .mockImplementation(async (videoId: string) => {
          const videoNum = parseInt(videoId.split('_')[1]);
          // Make every 3rd video fail
          if (videoNum % 3 === 0) {
            return null;
          }
          return {
            id: videoId,
            snippet: {
              title: `Video ${videoNum}`,
              description: `Description ${videoNum}`,
              thumbnails: {
                default: { url: `https://example.com/default${videoNum}.jpg` },
                medium: { url: `https://example.com/medium${videoNum}.jpg` },
                high: { url: `https://example.com/high${videoNum}.jpg` }
              },
              channelId: 'test_channel',
              channelTitle: 'Test Channel'
            },
            contentDetails: {
              duration: 'PT5M00S',
              dimension: '2d',
              definition: 'hd'
            },
            status: {
              privacyStatus: 'public',
              madeForKids: false
            }
          };
        });

      const result = await YouTubeAPI.getPlaylistVideosPage('test_playlist', 2, 50);

      expect(result.videos).toHaveLength(50);
      expect(result.totalResults).toBe(150);
      expect(result.pageNumber).toBe(2);

      // Check that we have both successful and fallback videos
      const successfulVideos = result.videos.filter(v => v.isAvailable !== false);
      const fallbackVideos = result.videos.filter(v => v.isFallback === true);

      expect(successfulVideos.length).toBeGreaterThan(0);
      expect(fallbackVideos.length).toBeGreaterThan(0);
      expect(successfulVideos.length + fallbackVideos.length).toBe(50);

      mockPlaylistFetch.mockRestore();
      mockGetVideoDetails.mockRestore();
    });
  });

  describe('Error classification accuracy', () => {
    test('should correctly classify deleted video errors', () => {
      const errors = [
        new Error('Video not found: test123'),
        new Error('Video not found'),
        new Error('not found in database')
      ];

      errors.forEach(error => {
        const classified = classifyVideoError(error, 'test_video');
        expect(classified.type).toBe(VideoErrorType.DELETED);
        expect(classified.retryable).toBe(false);
        expect(classified.videoId).toBe('test_video');
      });
    });

    test('should correctly classify private video errors', () => {
      const errors = [
        new Error('Video is private'),
        new Error('This video is private'),
        new Error('Private video access denied')
      ];

      errors.forEach(error => {
        const classified = classifyVideoError(error, 'private_video');
        expect(classified.type).toBe(VideoErrorType.PRIVATE);
        expect(classified.retryable).toBe(false);
        expect(classified.videoId).toBe('private_video');
      });
    });

    test('should correctly classify restricted video errors', () => {
      const errors = [
        new Error('Video is age restricted'),
        new Error('This video is restricted'),
        new Error('Content restricted in your region')
      ];

      errors.forEach(error => {
        const classified = classifyVideoError(error, 'restricted_video');
        expect(classified.type).toBe(VideoErrorType.RESTRICTED);
        expect(classified.retryable).toBe(false);
        expect(classified.videoId).toBe('restricted_video');
      });
    });

    test('should correctly classify API quota errors', () => {
      const errors = [
        new Error('YouTube API quota exceeded'),
        new Error('API quota exceeded'),
        new Error('quotaExceeded'),
        new Error('Rate limit exceeded')
      ];

      errors.forEach(error => {
        const classified = classifyVideoError(error, 'quota_video');
        expect(classified.type).toBe(VideoErrorType.API_ERROR);
        expect(classified.retryable).toBe(true);
        expect(classified.videoId).toBe('quota_video');
      });
    });

    test('should correctly classify network errors', () => {
      const errors = [
        new Error('Request timeout'),
        new Error('network connection failed'),
        new Error('ENOTFOUND error'),
        new Error('ECONNRESET connection reset')
      ];

      errors.forEach(error => {
        const classified = classifyVideoError(error, 'network_video');
        expect(classified.type).toBe(VideoErrorType.NETWORK_ERROR);
        expect(classified.retryable).toBe(true);
        expect(classified.videoId).toBe('network_video');
      });
    });

    test('should classify unknown errors as retryable', () => {
      const errors = [
        new Error('Some unexpected error'),
        new Error('Unknown API response'),
        'String error',
        null,
        undefined
      ];

      errors.forEach(error => {
        const classified = classifyVideoError(error, 'unknown_video');
        expect(classified.type).toBe(VideoErrorType.UNKNOWN);
        expect(classified.retryable).toBe(true);
        expect(classified.videoId).toBe('unknown_video');
      });
    });

    test('should include timestamp in error classification', () => {
      const error = new Error('Test error');
      const beforeTime = Date.now();
      const classified = classifyVideoError(error, 'test_video');
      const afterTime = Date.now();

      expect(classified.timestamp).toBeDefined();
      const timestamp = new Date(classified.timestamp!).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Fallback video creation and properties', () => {
    test('should create fallback video with correct basic properties', () => {
      const fallback = createFallbackVideo('test_video_123');

      expect(fallback.id).toBe('test_video_123');
      expect(fallback.type).toBe('youtube');
      expect(fallback.title).toBe('Video test_video_123 (Unavailable)');
      expect(fallback.thumbnail).toBe('/placeholder-thumbnail.svg');
      expect(fallback.duration).toBe(0);
      expect(fallback.url).toBe('https://www.youtube.com/watch?v=test_video_123');
      expect(fallback.isAvailable).toBe(false);
      expect(fallback.isFallback).toBe(true);
      expect(fallback.publishedAt).toBeUndefined(); // publishedAt is optional and not set for fallback videos
    });

    test('should create fallback video with error information', () => {
      const errorInfo = classifyVideoError(new Error('Video not found'), 'deleted_video');
      const fallback = createFallbackVideo('deleted_video', errorInfo);

      expect(fallback.errorInfo).toBe(errorInfo);
      expect(fallback.errorInfo?.type).toBe(VideoErrorType.DELETED);
      expect(fallback.errorInfo?.videoId).toBe('deleted_video');
    });

    test('should create fallback video without error information', () => {
      const fallback = createFallbackVideo('unknown_video');

      expect(fallback.errorInfo).toBeUndefined();
      expect(fallback.isAvailable).toBe(false);
      expect(fallback.isFallback).toBe(true);
    });

    test('should handle various video ID formats correctly', () => {
      const videoIds = [
        'dQw4w9WgXcQ',
        'sp0RqVGKuJY',
        'test123',
        'a1b2c3d4e5f',
        'VIDEO_WITH_UNDERSCORES'
      ];

      videoIds.forEach(videoId => {
        const fallback = createFallbackVideo(videoId);
        expect(fallback.id).toBe(videoId);
        expect(fallback.url).toBe(`https://www.youtube.com/watch?v=${videoId}`);
        expect(fallback.title).toBe(`Video ${videoId} (Unavailable)`);
      });
    });

    test('should create consistent fallback properties across multiple calls', () => {
      const videoId = 'consistent_test';
      const fallback1 = createFallbackVideo(videoId);
      const fallback2 = createFallbackVideo(videoId);

      // Properties should be identical except for timestamps in error info
      expect(fallback1.id).toBe(fallback2.id);
      expect(fallback1.type).toBe(fallback2.type);
      expect(fallback1.title).toBe(fallback2.title);
      expect(fallback1.thumbnail).toBe(fallback2.thumbnail);
      expect(fallback1.duration).toBe(fallback2.duration);
      expect(fallback1.url).toBe(fallback2.url);
      expect(fallback1.isAvailable).toBe(fallback2.isAvailable);
      expect(fallback1.isFallback).toBe(fallback2.isFallback);
    });
  });

  describe('Integration scenarios', () => {
    test('should handle complete API failure gracefully in getPlaylistVideosPage', async () => {
      // Mock playlist fetch to fail
      const mockPlaylistFetch = vi.spyOn(YouTubeAPI, 'getPlaylistVideos')
        .mockRejectedValue(new Error('Complete API failure'));

      await expect(YouTubeAPI.getPlaylistVideosPage('failed_playlist', 1, 50))
        .rejects.toThrow('Complete API failure');

      mockPlaylistFetch.mockRestore();
    });

    test('should log metrics for video loading operations', async () => {
      // Mock playlist videos fetch
      const mockPlaylistFetch = vi.spyOn(YouTubeAPI, 'getPlaylistVideos').mockResolvedValue({
        videoIds: ['video1', 'video2'],
        totalResults: 2,
        nextPageToken: undefined
      });

      // Mock mixed results
      const mockGetVideoDetails = vi.spyOn(YouTubeAPI, 'getVideoDetails')
        .mockImplementation(async (videoId: string) => {
          if (videoId === 'video1') {
            return {
              id: 'video1',
              snippet: {
                title: 'Video 1',
                description: 'Description 1',
                thumbnails: {
                  default: { url: 'https://example.com/default.jpg' },
                  medium: { url: 'https://example.com/medium.jpg' },
                  high: { url: 'https://example.com/high.jpg' }
                },
                channelId: 'test_channel',
                channelTitle: 'Test Channel'
              },
              contentDetails: {
                duration: 'PT5M00S',
                dimension: '2d',
                definition: 'hd'
              },
              status: {
                privacyStatus: 'public',
                madeForKids: false
              }
            };
          }
          return null; // video2 fails
        });

      await YouTubeAPI.getPlaylistVideosPage('metrics_test', 1, 2);

      // Verify that metrics logging was called
      expect(VideoErrorLogger.logVideoLoadMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          totalVideos: 2,
          successfulLoads: 1,
          failedLoads: 1,
          sourceId: 'metrics_test',
          pageNumber: 1,
          loadTimeMs: expect.any(Number)
        })
      );

      mockPlaylistFetch.mockRestore();
      mockGetVideoDetails.mockRestore();
    });
  });
});