/**
 * Tests for YouTube API getVideoDetails graceful error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YouTubeAPI } from '../../preload/youtube';
import { VideoErrorLogger } from '../videoErrorHandling';

// Mock the logging functions
vi.mock('../logging', () => ({
  logVerbose: vi.fn(),
  logError: vi.fn(),
  logWarning: vi.fn()
}));

describe('YouTube API Error Handling', () => {
  beforeEach(() => {
    // Clear error tracking before each test
    VideoErrorLogger.clearErrorTracking();
    
    // Set a mock API key
    YouTubeAPI.setApiKey('test-api-key');
  });

  it('should return null for video not found', async () => {
    // Mock fetch to return empty items array (video not found)
    const mockFetch = vi.fn().mockResolvedValue({
      items: []
    });
    
    // Replace the private fetch method
    (YouTubeAPI as any).fetch = mockFetch;

    const result = await YouTubeAPI.getVideoDetails('nonexistent_video');
    
    expect(result).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith('videos', {
      part: 'snippet,contentDetails,status',
      id: 'nonexistent_video'
    });
  });

  it('should return null and log error for API failures', async () => {
    // Mock fetch to throw an error
    const mockFetch = vi.fn().mockRejectedValue(new Error('API quota exceeded'));
    
    // Replace the private fetch method
    (YouTubeAPI as any).fetch = mockFetch;

    const result = await YouTubeAPI.getVideoDetails('test_video');
    
    expect(result).toBeNull();
    
    // Check that error was logged
    const errorStats = VideoErrorLogger.getErrorStatistics();
    expect(errorStats.totalErrors).toBe(1);
    expect(errorStats.errorBreakdown.api_error).toBe(1);
  });

  it('should return video data for successful requests', async () => {
    const mockVideoData = {
      id: 'test_video',
      snippet: {
        title: 'Test Video',
        description: 'Test Description',
        thumbnails: {
          default: { url: 'default.jpg' },
          medium: { url: 'medium.jpg' },
          high: { url: 'high.jpg' }
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
    };

    // Mock fetch to return successful response
    const mockFetch = vi.fn().mockResolvedValue({
      items: [mockVideoData]
    });
    
    // Replace the private fetch method
    (YouTubeAPI as any).fetch = mockFetch;

    const result = await YouTubeAPI.getVideoDetails('test_video');
    
    expect(result).not.toBeNull();
    expect(result?.id).toBe('test_video');
    expect(result?.snippet.title).toBe('Test Video');
  });

  it('should classify different error types correctly', async () => {
    const testCases = [
      { error: new Error('Video not found: deleted123'), expectedType: 'deleted' },
      { error: new Error('Video is private'), expectedType: 'private' },
      { error: new Error('quota exceeded'), expectedType: 'api_error' },
      { error: new Error('network timeout'), expectedType: 'network_error' },
      { error: new Error('unknown error'), expectedType: 'unknown' }
    ];

    for (const testCase of testCases) {
      // Clear error tracking
      VideoErrorLogger.clearErrorTracking();
      
      // Mock fetch to throw the specific error
      const mockFetch = vi.fn().mockRejectedValue(testCase.error);
      (YouTubeAPI as any).fetch = mockFetch;

      const result = await YouTubeAPI.getVideoDetails(`test_${testCase.expectedType}`);
      
      expect(result).toBeNull();
      
      // Check that the error was classified correctly
      const errorStats = VideoErrorLogger.getErrorStatistics();
      expect(errorStats.totalErrors).toBe(1);
      expect(errorStats.errorBreakdown[testCase.expectedType as keyof typeof errorStats.errorBreakdown]).toBe(1);
    }
  });
});