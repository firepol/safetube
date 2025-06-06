import { describe, it, expect } from 'vitest';
import { YouTubeAPI } from './youtube';

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

    // Also show some alternative candidates
    // Show first 3 combined formats (video+audio)
    const combinedFormats = videoStreams
      .filter(s => s.mimeType.includes('mp4'))
      .sort((a, b) => {
        const heightDiff = (b.height || 0) - (a.height || 0);
        if (heightDiff !== 0) return heightDiff;
        return (b.fps || 0) - (a.fps || 0);
      });

    // Show highest quality video-only format
    const videoOnly = videoStreams
      .filter(s => !s.mimeType.includes('audio'))
      .sort((a, b) => {
        const heightDiff = (b.height || 0) - (a.height || 0);
        if (heightDiff !== 0) return heightDiff;
        return (b.fps || 0) - (a.fps || 0);
      })[0];

    // Show highest quality audio track
    const bestAudio = audioTracks
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

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

    // Test highest quality stream with language preference
    const highestQuality = YouTubeAPI.getHighestQualityStream(videoStreams, audioTracks, preferredLanguages);

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
}); 