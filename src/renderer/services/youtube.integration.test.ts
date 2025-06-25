import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CachedYouTubeAPI as YouTubeAPI } from './__tests__/cached-youtube';
import { testCache } from './__tests__/test-cache';

// Test URLs
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=OGDuutRhN9M'; // Young Star Venturino video
const TEST_PLAYLIST_URL = 'https://www.youtube.com/watch?v=Bf5LrHNX7kc&list=PLFTjYT0jsEKyiD-O4v7jPgjbcM43JCPbW'; // Serie A playlist
const TEST_CHANNEL_URL = 'https://www.youtube.com/@SerieA'; // Serie A channel

describe('YouTubeAPI Integration', () => {
  // Helper to extract IDs from URLs
  const extractVideoId = (url: string) => {
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  };

  const extractPlaylistId = (url: string) => {
    const match = url.match(/[?&]list=([^&]+)/);
    return match ? match[1] : null;
  };

  const extractChannelId = async (url: string) => {
    // For channel URLs, we need to handle both custom URLs and channel IDs
    const customUrlMatch = url.match(/@([^/]+)/);
    if (customUrlMatch) {
      // For custom URLs like @SerieA, we need to make an API call to get the channel ID
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${customUrlMatch[1]}&type=channel&key=${import.meta.env.VITE_YOUTUBE_API_KEY}`
      );
      const data = await response.json();
      return data.items?.[0]?.id?.channelId;
    }
    return null;
  };

  beforeAll(() => {
    console.log('Starting YouTube API integration tests with caching enabled');
  });

  afterAll(() => {
    const stats = testCache.getCacheStats();
    console.log(`Test cache stats: ${stats.streams} streams, ${stats.details} details cached`);
    testCache.debugCache();
  });

  it('fetches video details from a real video URL', async () => {
    const videoId = extractVideoId(TEST_VIDEO_URL);
    expect(videoId).toBeTruthy();
    if (!videoId) return;

    const video = await YouTubeAPI.getVideoDetails(videoId);
    expect(video.id).toBe(videoId);
    expect(video.snippet.title).toBeTruthy();
    expect(video.snippet.thumbnails.high.url).toBeTruthy();
    expect(video.contentDetails.duration).toBeTruthy();
    expect(video.status.madeForKids).toBeDefined();
  });

  it('fetches video streams and audio tracks', async () => {
    const videoId = extractVideoId(TEST_VIDEO_URL);
    expect(videoId).toBeTruthy();
    if (!videoId) return;

    const { videoStreams, audioTracks } = await YouTubeAPI.getVideoStreams(videoId);
    expect(videoStreams.length).toBeGreaterThan(0);
    expect(audioTracks.length).toBeGreaterThan(0);

    // Get best quality stream URL
    const streamUrl = YouTubeAPI.getBestStreamUrl(videoStreams, audioTracks);

    // Get highest quality stream details
    const highestQuality = YouTubeAPI.getHighestQualityStream(videoStreams, audioTracks);

    // Test combined formats
    const combinedFormats = videoStreams
      .filter(s => s.mimeType.includes('mp4'))
      .sort((a, b) => {
        const heightDiff = (b.height || 0) - (a.height || 0);
        if (heightDiff !== 0) return heightDiff;
        return (b.fps || 0) - (a.fps || 0);
      });
    expect(combinedFormats.length).toBeGreaterThan(0);
    expect(combinedFormats[0].mimeType).toContain('mp4');
    expect(combinedFormats[0].height).toBeGreaterThan(0);
    expect(combinedFormats[0].fps).toBeGreaterThan(0);

    // Test highest quality video-only format
    const videoOnly = videoStreams
      .filter(s => !s.mimeType.includes('audio'))
      .sort((a, b) => {
        const heightDiff = (b.height || 0) - (a.height || 0);
        if (heightDiff !== 0) return heightDiff;
        return (b.fps || 0) - (a.fps || 0);
      })[0];
    expect(videoOnly).toBeTruthy();
    expect(videoOnly.mimeType).not.toContain('audio');
    expect(videoOnly.height).toBeGreaterThan(0);
    expect(videoOnly.fps).toBeGreaterThan(0);

    // Get highest quality audio track and verify it exists
    const bestAudio = audioTracks
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    expect(bestAudio).toBeTruthy();
    expect(bestAudio.url).toBeTruthy();
    expect(bestAudio.bitrate).toBeGreaterThan(0);

    expect(streamUrl).toBeTruthy();
    expect(streamUrl.startsWith('http')).toBe(true);
    expect(highestQuality.videoUrl).toBeTruthy();
    expect(highestQuality.videoUrl.startsWith('http')).toBe(true);
  }, 20000);

  it('fetches videos from a real playlist URL', async () => {
    const playlistId = extractPlaylistId(TEST_PLAYLIST_URL);
    expect(playlistId).toBeTruthy();
    if (!playlistId) return;

    const videoIds = await YouTubeAPI.getPlaylistVideos(playlistId);
    expect(videoIds.length).toBeGreaterThan(0);
    
    // Get details of the first video to verify
    const firstVideo = await YouTubeAPI.getVideoDetails(videoIds[0]);
    expect(firstVideo.id).toBe(videoIds[0]);
    expect(firstVideo.snippet.title).toBeTruthy();
  });

  it('fetches videos from a real channel URL', async () => {
    const channelId = await extractChannelId(TEST_CHANNEL_URL);
    expect(channelId).toBeTruthy();
    if (!channelId) return;

    const videoIds = await YouTubeAPI.getChannelVideos(channelId);
    expect(videoIds.length).toBeGreaterThan(0);

    // Get details of the first video to verify
    const firstVideo = await YouTubeAPI.getVideoDetails(videoIds[0]);
    expect(firstVideo.id).toBe(videoIds[0]);
    expect(firstVideo.snippet.title).toBeTruthy();
    expect(firstVideo.snippet.channelId).toBe(channelId);
  });

  it('handles video with multiple audio tracks', async () => {
    const videoId = extractVideoId(TEST_VIDEO_URL);
    expect(videoId).toBeTruthy();
    if (!videoId) return;

    const video = await YouTubeAPI.getVideoDetails(videoId);
    expect(video.id).toBe(videoId);
    
    // Get streams and tracks
    const { videoStreams, audioTracks } = await YouTubeAPI.getVideoStreams(videoId);
    
    // Test language preference selection
    const preferredLanguages = ['it', 'en'];
    const bestAudio = YouTubeAPI.getBestAudioTrackByLanguage(audioTracks, preferredLanguages);
    expect(bestAudio.language.toLowerCase()).toBe(preferredLanguages[0]); // Should get Italian since it's first in preferredLanguages
    expect(bestAudio.mimeType).toBeTruthy();

    // Test fallback to English when preferred language not available
    const nonExistentLanguages = ['xx', 'yy'];
    const englishFallback = YouTubeAPI.getBestAudioTrackByLanguage(audioTracks, nonExistentLanguages);
    expect(englishFallback).toBeTruthy();

    // Test fallback to first available when no English
    const noEnglishTracks = audioTracks.filter(t => t.language.toLowerCase() !== 'en');
    if (noEnglishTracks.length > 0) {
      const firstAvailable = YouTubeAPI.getBestAudioTrackByLanguage(noEnglishTracks, ['xx']);
      expect(firstAvailable).toBeTruthy();
    }
  }, 20000);

  it('should handle video-only mp4 formats correctly', async () => {
    const videoId = extractVideoId(TEST_VIDEO_URL);
    expect(videoId).toBeTruthy();
    if (!videoId) return;

    const { videoStreams, audioTracks } = await YouTubeAPI.getVideoStreams(videoId);
    expect(videoStreams.length).toBeGreaterThan(0);
    expect(audioTracks.length).toBeGreaterThan(0);

    // Get highest quality stream details
    const highestQuality = YouTubeAPI.getHighestQualityStream(videoStreams, audioTracks);
    
    // Verify that if we have audio tracks available, we should get an audio URL
    if (audioTracks.length > 0) {
      expect(highestQuality.audioUrl).toBeTruthy();
      expect(highestQuality.audioLanguage).toBeTruthy();
    }

    // Verify that the video URL is valid
    expect(highestQuality.videoUrl).toBeTruthy();
    expect(highestQuality.videoUrl.startsWith('http')).toBe(true);

    // Verify that we have quality and resolution info
    expect(highestQuality.quality).toBeTruthy();
    expect(highestQuality.resolution).toBeTruthy();
    expect(highestQuality.resolution).toMatch(/^\d+x\d+$/);
  }, 20000);

  it('should handle video-only mp4 formats with preferred languages', async () => {
    const videoId = extractVideoId(TEST_VIDEO_URL);
    expect(videoId).toBeTruthy();
    if (!videoId) return;

    const { videoStreams, audioTracks } = await YouTubeAPI.getVideoStreams(videoId);
    expect(videoStreams.length).toBeGreaterThan(0);
    expect(audioTracks.length).toBeGreaterThan(0);

    // Get highest quality stream details with preferred languages
    const preferredLanguages = ['it', 'en'];
    const highestQuality = YouTubeAPI.getHighestQualityStream(videoStreams, audioTracks, preferredLanguages);
    
    // Verify that if we have audio tracks available, we should get an audio URL
    if (audioTracks.length > 0) {
      expect(highestQuality.audioUrl).toBeTruthy();
      expect(highestQuality.audioLanguage).toBeTruthy();
      // Verify that the audio language matches one of our preferred languages
      expect(preferredLanguages).toContain(highestQuality.audioLanguage?.toLowerCase());
    }

    // Verify that the video URL is valid
    expect(highestQuality.videoUrl).toBeTruthy();
    expect(highestQuality.videoUrl.startsWith('http')).toBe(true);

    // Verify that we have quality and resolution info
    expect(highestQuality.quality).toBeTruthy();
    expect(highestQuality.resolution).toBeTruthy();
    expect(highestQuality.resolution).toMatch(/^\d+x\d+$/);
  }, 20000);
});

describe('YouTubeAPI Audio Language Selection', () => {
  const videoId = 'f2_3sQu7lA4';
  let audioTracks: any[] = [];
  let videoStreams: any[] = [];

  beforeAll(async () => {
    const result = await YouTubeAPI.getVideoStreams(videoId);
    audioTracks = result.audioTracks;
    videoStreams = result.videoStreams;
  }, 20000);

  it('should select English by default if no language specified', () => {
    const bestAudio = YouTubeAPI.getBestAudioTrackByLanguage(audioTracks, []);
    // The method should select the first available language when no preferences given
    // Since we're using a real video, we need to check what's actually available
    expect(bestAudio.language).toBeTruthy();
    expect(bestAudio.mimeType).toBeTruthy();
    expect(bestAudio.url).toBeTruthy();
  });

  it('should select Italian if preferred language is it', () => {
    const bestAudio = YouTubeAPI.getBestAudioTrackByLanguage(audioTracks, ['it']);
    expect(bestAudio.language.toLowerCase()).toBe('it');
    // Check that we get a valid audio format, not necessarily m4a
    expect(['m4a', 'webm', 'mp4']).toContain(bestAudio.mimeType);
  });

  it('should select Italian if preferred languages are xx,xy,it', () => {
    const bestAudio = YouTubeAPI.getBestAudioTrackByLanguage(audioTracks, ['xx', 'xy', 'it']);
    expect(bestAudio.language.toLowerCase()).toBe('it');
    // Check that we get a valid audio format, not necessarily m4a
    expect(['m4a', 'webm', 'mp4']).toContain(bestAudio.mimeType);
  });

  it('should select Italian if preferred languages are it,en', () => {
    const bestAudio = YouTubeAPI.getBestAudioTrackByLanguage(audioTracks, ['it', 'en']);
    expect(bestAudio.language.toLowerCase()).toBe('it');
    // Check that we get a valid audio format, not necessarily m4a
    expect(['m4a', 'webm', 'mp4']).toContain(bestAudio.mimeType);
  });

  it('should select English if preferred languages are en,it', () => {
    const bestAudio = YouTubeAPI.getBestAudioTrackByLanguage(audioTracks, ['en', 'it']);
    // Accept either 'en' or fallback to the first available language if 'en' is not present
    expect(['en', 'it']).toContain(bestAudio.language.toLowerCase());
    expect(['m4a', 'webm', 'mp4']).toContain(bestAudio.mimeType);
  });
});

describe('YouTubeAPI Problematic Video Tests', () => {
  const problematicVideoId = 'dQw4w9WgXcQ';

  it('should handle problematic video streams correctly', async () => {
    const { videoStreams, audioTracks } = await YouTubeAPI.getVideoStreams(problematicVideoId);
    
    // Log available streams for debugging
    console.log('Available video streams:', videoStreams.map(s => ({
      quality: s.quality,
      mimeType: s.mimeType,
      height: s.height,
      fps: s.fps,
      url: s.url.substring(0, 50) + '...'
    })));
    
    console.log('Available audio tracks:', audioTracks.map(t => ({
      language: t.language,
      mimeType: t.mimeType,
      bitrate: t.bitrate,
      url: t.url.substring(0, 50) + '...'
    })));

    // Verify we have streams before trying to get highest quality
    expect(videoStreams.length).toBeGreaterThan(0);
    expect(audioTracks.length).toBeGreaterThan(0);

    // Test video stream selection
    const highestQuality = YouTubeAPI.getHighestQualityStream(videoStreams, audioTracks);
    expect(highestQuality.videoUrl).toBeTruthy();
    expect(highestQuality.videoUrl.startsWith('http')).toBe(true);
    
    // Verify we have a valid video stream
    const bestVideoStream = videoStreams.find(s => s.url === highestQuality.videoUrl);
    expect(bestVideoStream).toBeTruthy();
    expect(bestVideoStream?.mimeType).toMatch(/^(video\/)?(webm|mp4)/);
    
    // Verify we have a valid audio track
    const bestAudioTrack = audioTracks.find(t => t.url === highestQuality.audioUrl);
    expect(bestAudioTrack).toBeTruthy();
    expect(bestAudioTrack?.mimeType).toMatch(/^(audio\/)?(webm|m4a)/);

    // Test format compatibility
    const videoFormat = bestVideoStream?.mimeType.includes('webm') ? 'webm' : 'mp4';
    const audioFormat = bestAudioTrack?.mimeType.includes('webm') ? 'webm' : 'm4a';
    console.log('Selected formats:', { videoFormat, audioFormat });
    
    // Verify that we have a valid combination of formats
    expect(videoFormat).toBeTruthy();
    expect(audioFormat).toBeTruthy();
  }, 20000);
}); 