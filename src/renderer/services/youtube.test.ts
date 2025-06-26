import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { YouTubeAPI } from './youtube';
import { CachedYouTubeAPI } from './__tests__/cached-youtube';
import { testCache } from './__tests__/test-cache';
import { logVerbose } from '@/shared/logging';

// Mock environment variables
vi.stubEnv('VITE_YOUTUBE_API_KEY', 'test-api-key');

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('YouTubeAPI', () => {
  beforeAll(() => {
    logVerbose('Starting YouTube API tests with caching enabled');
  });

  afterAll(() => {
    const stats = testCache.getCacheStats();
    logVerbose(`Test cache stats: ${stats.streams} streams, ${stats.details} details cached`);
  });

  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('fetches video details', async () => {
    const mockResponse = {
      items: [{
        id: 'test123',
        snippet: {
          title: 'Test Video',
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

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await YouTubeAPI.getVideoDetails('test123');
    expect(result.id).toBe('test123');
    expect(result.snippet.title).toBe('Test Video');
  });

  it('fetches playlist videos', async () => {
    const mockResponse = {
      items: [
        { 
          snippet: {
            resourceId: { videoId: 'video1' }
          }
        },
        { 
          snippet: {
            resourceId: { videoId: 'video2' }
          }
        }
      ]
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await YouTubeAPI.getPlaylistVideos('playlist123');
    expect(result).toEqual(['video1', 'video2']);
  });

  it('fetches channel details', async () => {
    const mockResponse = {
      items: [{
        id: 'channel123',
        snippet: {
          title: 'Test Channel',
          description: 'Test channel description',
          thumbnails: { 
            default: { url: 'http://test.com/channel.jpg' },
            medium: { url: 'http://test.com/channel.jpg' },
            high: { url: 'http://test.com/channel.jpg' }
          }
        },
        contentDetails: {
          relatedPlaylists: {
            uploads: 'test_uploads_playlist'
          }
        }
      }]
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await YouTubeAPI.getChannelDetails('channel123');
    expect(result.id).toBe('channel123');
    expect(result.snippet.title).toBe('Test Channel');
  });

  it('fetches channel videos', async () => {
    // First mock the channel details call
    const mockChannelResponse = {
      items: [{
        id: 'channel123',
        snippet: {
          title: 'Test Channel',
          description: 'Test channel description',
          thumbnails: { 
            default: { url: 'http://test.com/channel.jpg' },
            medium: { url: 'http://test.com/channel.jpg' },
            high: { url: 'http://test.com/channel.jpg' }
          }
        },
        contentDetails: {
          relatedPlaylists: {
            uploads: 'test_uploads_playlist'
          }
        }
      }]
    };

    // Then mock the playlist videos call
    const mockPlaylistResponse = {
      items: [
        { 
          snippet: {
            resourceId: { videoId: 'video1' }
          }
        },
        { 
          snippet: {
            resourceId: { videoId: 'video2' }
          }
        }
      ]
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannelResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlaylistResponse
      });

    const result = await YouTubeAPI.getChannelVideos('channel123');
    expect(result).toEqual(['video1', 'video2']);
  });

  it('parses ISO 8601 duration correctly', () => {
    expect(YouTubeAPI.parseDuration('PT1M30S')).toBe(90);
    expect(YouTubeAPI.parseDuration('PT2H15M30S')).toBe(8130);
    expect(YouTubeAPI.parseDuration('PT30S')).toBe(30);
  });

  it('handles API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    await expect(YouTubeAPI.getVideoDetails('invalid')).rejects.toThrow('YouTube API error: Not Found');
  });
});

// Skip debug tests in CI environment - these require real YouTube API access
const debugTestRunner = process.env.CI ? describe.skip : describe;

debugTestRunner('YouTubeAPI Debug Tests', () => {
  it('should verify video streams for OGDuutRhN9M', async () => {
    const videoId = 'OGDuutRhN9M';
    const { videoStreams, audioTracks } = await CachedYouTubeAPI.getVideoStreams(videoId);
    
    // Verify we got streams
    expect(videoStreams.length).toBeGreaterThan(0);
    expect(audioTracks.length).toBeGreaterThan(0);

    // Verify stream properties
    const firstVideoStream = videoStreams[0];
    expect(firstVideoStream).toHaveProperty('url');
    expect(firstVideoStream).toHaveProperty('quality');

    const firstAudioTrack = audioTracks[0];
    expect(firstAudioTrack).toHaveProperty('url');
    expect(firstAudioTrack).toHaveProperty('language');
  }, 30000);

  it('should verify video streams for f2_3sQu7lA4', async () => {
    const videoId = 'f2_3sQu7lA4';
    const { videoStreams, audioTracks } = await CachedYouTubeAPI.getVideoStreams(videoId);
    
    // Verify we got streams
    expect(videoStreams.length).toBeGreaterThan(0);
    expect(audioTracks.length).toBeGreaterThan(0);

    // Verify stream properties
    const firstVideoStream = videoStreams[0];
    expect(firstVideoStream).toHaveProperty('url');
    expect(firstVideoStream).toHaveProperty('quality');

    const firstAudioTrack = audioTracks[0];
    expect(firstAudioTrack).toHaveProperty('url');
    expect(firstAudioTrack).toHaveProperty('language');
  }, 30000);
}); 