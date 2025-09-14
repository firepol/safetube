import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the logging and error handling modules
vi.mock('../logging', () => ({
  logVerbose: vi.fn()
}));

vi.mock('../../shared/videoErrorHandling', () => ({
  classifyVideoError: vi.fn().mockReturnValue({
    type: 'unknown',
    message: 'Test error',
    retryable: true,
    videoId: 'test',
    timestamp: '2023-01-01T00:00:00.000Z'
  }),
  VideoErrorLogger: {
    logVideoError: vi.fn(),
    logVideoLoadMetrics: vi.fn()
  },
  createVideoLoadMetrics: vi.fn().mockReturnValue({
    totalVideos: 2,
    successfulLoads: 1,
    failedLoads: 1,
    errorBreakdown: { unknown: 1 },
    loadTimeMs: 100
  }),
  createFallbackVideo: vi.fn().mockImplementation((videoId: string, errorInfo?: any) => ({
    id: videoId,
    type: 'youtube',
    title: `Video ${videoId} (Unavailable)`,
    thumbnail: '/placeholder-thumbnail.svg',
    duration: 0,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    publishedAt: '',
    isAvailable: false,
    isFallback: true,
    errorInfo: errorInfo || {
      type: 'unknown',
      message: 'Test error',
      retryable: true
    }
  }))
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import { YouTubeAPI } from '../youtube';

describe('YouTube API Batch Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    YouTubeAPI.setApiKey('test-api-key');
  });

  it('should handle mixed success/failure in getPlaylistVideosPage with Promise.allSettled', async () => {
    // Mock playlist videos call
    const mockPlaylistResponse = {
      items: [
        { snippet: { resourceId: { videoId: 'valid_video' } } },
        { snippet: { resourceId: { videoId: 'invalid_video' } } }
      ],
      pageInfo: { totalResults: 2 }
    };

    // Mock successful video details for first video
    const mockValidVideoResponse = {
      items: [{
        id: 'valid_video',
        snippet: {
          title: 'Valid Video',
          description: 'Test video description',
          thumbnails: { 
            default: { url: 'http://test.com/thumb.jpg' },
            medium: { url: 'http://test.com/thumb.jpg' },
            high: { url: 'http://test.com/thumb.jpg' }
          },
          channelId: 'channel123',
          channelTitle: 'Test Channel'
        },
        contentDetails: { 
          duration: 'PT1M30S',
          dimension: '2d',
          definition: 'hd'
        },
        status: { 
          privacyStatus: 'public',
          madeForKids: false 
        }
      }]
    };

    // Mock failed video details for second video (empty response)
    const mockInvalidVideoResponse = {
      items: []
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlaylistResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockValidVideoResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockInvalidVideoResponse
      });

    const result = await YouTubeAPI.getPlaylistVideosPage('test_playlist', 1, 2);
    
    // Should return both videos - one successful, one fallback
    expect(result.videos).toHaveLength(2);
    expect(result.totalResults).toBe(2);
    expect(result.pageNumber).toBe(1);

    // First video should be successful
    const validVideo = result.videos[0];
    expect(validVideo.id).toBe('valid_video');
    expect(validVideo.title).toBe('Valid Video');
    expect(validVideo.isAvailable).toBe(true);
    expect(validVideo.isFallback).toBeUndefined();

    // Second video should be a fallback
    const fallbackVideo = result.videos[1];
    expect(fallbackVideo.id).toBe('invalid_video');
    expect(fallbackVideo.title).toBe('Video invalid_video (Unavailable)');
    expect(fallbackVideo.isAvailable).toBe(false);
    expect(fallbackVideo.isFallback).toBe(true);
    expect(fallbackVideo.url).toBe('https://www.youtube.com/watch?v=invalid_video');
    expect(fallbackVideo.thumbnail).toBe('/placeholder-thumbnail.svg');
  });

  it('should maintain consistent page size with fallback entries', async () => {
    // Mock playlist with 3 videos, all failing
    const mockPlaylistResponse = {
      items: [
        { snippet: { resourceId: { videoId: 'fail1' } } },
        { snippet: { resourceId: { videoId: 'fail2' } } },
        { snippet: { resourceId: { videoId: 'fail3' } } }
      ],
      pageInfo: { totalResults: 3 }
    };

    // Mock all video details calls to return empty (failed)
    const mockEmptyResponse = { items: [] };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlaylistResponse
      })
      .mockResolvedValue({
        ok: true,
        json: async () => mockEmptyResponse
      });

    const result = await YouTubeAPI.getPlaylistVideosPage('test_playlist', 1, 3);
    
    // Should return 3 fallback videos to maintain page size
    expect(result.videos).toHaveLength(3);
    expect(result.totalResults).toBe(3);
    
    // All should be fallback videos
    result.videos.forEach((video, index) => {
      expect(video.id).toBe(`fail${index + 1}`);
      expect(video.isAvailable).toBe(false);
      expect(video.isFallback).toBe(true);
      expect(video.title).toBe(`Video fail${index + 1} (Unavailable)`);
    });
  });

  it('should create proper fallback video objects', async () => {
    // Test the private createFallbackVideo method indirectly
    const mockPlaylistResponse = {
      items: [{ snippet: { resourceId: { videoId: 'test_video' } } }],
      pageInfo: { totalResults: 1 }
    };

    const mockEmptyResponse = { items: [] };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlaylistResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockEmptyResponse
      });

    const result = await YouTubeAPI.getPlaylistVideosPage('test_playlist', 1, 1);
    
    const fallbackVideo = result.videos[0];
    
    // Verify fallback video structure
    expect(fallbackVideo).toMatchObject({
      id: 'test_video',
      type: 'youtube',
      title: 'Video test_video (Unavailable)',
      thumbnail: '/placeholder-thumbnail.svg',
      duration: 0,
      url: 'https://www.youtube.com/watch?v=test_video',
      publishedAt: '',
      isAvailable: false,
      isFallback: true,
      errorInfo: {
        type: 'unknown',
        retryable: true
      }
    });
  });
});