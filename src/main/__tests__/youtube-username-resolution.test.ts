import { describe, it, expect, beforeAll } from 'vitest';
import { YouTubeAPI } from '../youtube-api';
import { logVerbose } from '../../shared/logging';
import { getYouTubeApiKey } from '../helpers/settingsHelper';

// This test requires a real YouTube API key to work
// Make sure the API key is configured via Main Settings tab or YOUTUBE_API_KEY environment variable
describe('YouTube Username Resolution', () => {
  let youtubeAPI: YouTubeAPI;

  beforeAll(async () => {
    const apiKey = await getYouTubeApiKey();

    if (!apiKey) {
      throw new Error('YouTube API key not found for testing. Please configure it via Main Settings tab or set YOUTUBE_API_KEY environment variable for testing.');
    }

    youtubeAPI = new YouTubeAPI(apiKey);
  });

  it('should resolve @TEDEd username to a valid channel ID', async () => {
    const username = 'TEDEd';
    
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
    const username = 'TEDEd';
    
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
