import { describe, it, expect, beforeAll } from 'vitest';
import { YouTubeAPI } from '../youtube-api';
import { logVerbose } from '../../shared/logging';

// This test requires a real YouTube API key to work
// Make sure VITE_YOUTUBE_API_KEY is set in your .env file
describe('YouTube Username Resolution', () => {
  let youtubeAPI: YouTubeAPI;
  
  beforeAll(() => {
    const apiKey = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error('YouTube API key not found. Please set VITE_YOUTUBE_API_KEY in your .env file');
    }
    youtubeAPI = new YouTubeAPI(apiKey);
  });

  it('should resolve @skypaul77 username to a valid channel ID', async () => {
    const username = 'skypaul77';
    
    // This should call the actual YouTube API
    const channelDetails = await youtubeAPI.searchChannelByUsername(username);
    
    // Verify we got a valid response
    expect(channelDetails).toBeDefined();
    expect(channelDetails.channelId).toBeDefined();
    expect(typeof channelDetails.channelId).toBe('string');
    expect(channelDetails.channelId.length).toBeGreaterThan(0);
    
    // Verify other fields
    expect(channelDetails.title).toBeDefined();
    expect(channelDetails.description).toBeDefined();
    expect(channelDetails.thumbnail).toBeDefined();
    
    logVerbose('Resolved username to channel:', {
      username,
      channelId: channelDetails.channelId,
      title: channelDetails.title
    });
  });

  it('should be able to fetch videos from the resolved channel ID', async () => {
    const username = 'skypaul77';
    
    // First resolve username to channel ID
    const channelDetails = await youtubeAPI.searchChannelByUsername(username);
    const channelId = channelDetails.channelId;
    
    // Then fetch videos from that channel
    const videos = await youtubeAPI.getChannelVideos(channelId, 5);
    
    // Verify we got videos
    expect(videos).toBeDefined();
    expect(Array.isArray(videos)).toBe(true);
    expect(videos.length).toBeGreaterThan(0);
    
    // Verify video structure
    const firstVideo = videos[0];
    expect(firstVideo.id).toBeDefined();
    expect(firstVideo.title).toBeDefined();
    expect(firstVideo.thumbnail).toBeDefined();
    expect(firstVideo.type).toBe('youtube');
    
    logVerbose('Fetched videos from channel:', {
      channelId,
      channelTitle: channelDetails.title,
      videoCount: videos.length,
      firstVideo: firstVideo.title
    });
  });

  it('should handle non-existent usernames gracefully', async () => {
    const nonExistentUsername = 'this_username_definitely_does_not_exist_12345';
    
    await expect(
      youtubeAPI.searchChannelByUsername(nonExistentUsername)
    ).rejects.toThrow('No channel found for username:');
  });
});
