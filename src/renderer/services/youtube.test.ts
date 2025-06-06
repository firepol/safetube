import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YouTubeAPI } from './youtube';

// Mock environment variables
vi.mock('vite', () => ({
  env: {
    VITE_YOUTUBE_API_KEY: 'test_api_key',
  },
}));

describe('YouTubeAPI', () => {
  const mockVideoResponse = {
    items: [{
      id: 'test_video_id',
      snippet: {
        title: 'Test Video',
        description: 'Test Description',
        thumbnails: {
          default: { url: 'https://example.com/default.jpg' },
          medium: { url: 'https://example.com/medium.jpg' },
          high: { url: 'https://example.com/high.jpg' },
          maxres: { url: 'https://example.com/maxres.jpg' },
        },
        channelId: 'test_channel_id',
        channelTitle: 'Test Channel',
      },
      contentDetails: {
        duration: 'PT1H2M3S',
        dimension: '2d',
        definition: 'hd',
      },
      status: {
        privacyStatus: 'public',
        madeForKids: true,
      },
    }],
  };

  const mockPlaylistResponse = {
    items: [
      { id: '1', snippet: { resourceId: { videoId: 'video1' } } },
      { id: '2', snippet: { resourceId: { videoId: 'video2' } } },
    ],
    nextPageToken: 'next_page',
  };

  const mockChannelResponse = {
    items: [{
      id: 'test_channel_id',
      snippet: {
        title: 'Test Channel',
        description: 'Test Channel Description',
        thumbnails: {
          default: { url: 'https://example.com/channel_default.jpg' },
          medium: { url: 'https://example.com/channel_medium.jpg' },
          high: { url: 'https://example.com/channel_high.jpg' },
        },
      },
      contentDetails: {
        relatedPlaylists: {
          uploads: 'test_uploads_playlist',
        },
      },
    }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('fetches video details', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockVideoResponse),
    });

    const video = await YouTubeAPI.getVideoDetails('test_video_id');
    expect(video.id).toBe('test_video_id');
    expect(video.snippet.title).toBe('Test Video');
    expect(video.contentDetails.duration).toBe('PT1H2M3S');
  });

  it('fetches playlist videos', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPlaylistResponse),
    });

    const videos = await YouTubeAPI.getPlaylistVideos('test_playlist_id');
    expect(videos).toEqual(['video1', 'video2']);
  });

  it('fetches channel details', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockChannelResponse),
    });

    const channel = await YouTubeAPI.getChannelDetails('test_channel_id');
    expect(channel.id).toBe('test_channel_id');
    expect(channel.snippet.title).toBe('Test Channel');
  });

  it('fetches channel videos', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChannelResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPlaylistResponse),
      });

    const videos = await YouTubeAPI.getChannelVideos('test_channel_id');
    expect(videos).toEqual(['video1', 'video2']);
  });

  it('parses ISO 8601 duration correctly', () => {
    expect(YouTubeAPI.parseDuration('PT1H2M3S')).toBe(3723); // 1 hour + 2 minutes + 3 seconds
    expect(YouTubeAPI.parseDuration('PT2M30S')).toBe(150); // 2 minutes + 30 seconds
    expect(YouTubeAPI.parseDuration('PT45S')).toBe(45); // 45 seconds
    expect(YouTubeAPI.parseDuration('PT1H')).toBe(3600); // 1 hour
  });

  it('handles API errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'API Error',
    });

    await expect(YouTubeAPI.getVideoDetails('test_video_id'))
      .rejects
      .toThrow('YouTube API error: API Error');
  });
});

describe('YouTubeAPI Debug Tests', () => {
  it('should verify video streams for OGDuutRhN9M', async () => {
    const videoId = 'OGDuutRhN9M';
    const { videoStreams, audioTracks } = await YouTubeAPI.getVideoStreams(videoId);
    
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
    const { videoStreams, audioTracks } = await YouTubeAPI.getVideoStreams(videoId);
    
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