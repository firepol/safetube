// Simple test script to verify username resolution works
import 'dotenv/config';
import { YouTubeAPI } from '../main/youtube-api';

async function testUsernameResolution() {
  try {
    // Try to read API key from mainSettings.json first
    let apiKey = '';
    try {
      const { readMainSettings } = await import('../shared/fileUtils');
      const mainSettings = await readMainSettings();
      apiKey = mainSettings.youtubeApiKey || '';
      console.log('API key loaded from mainSettings.json:', !!apiKey);
    } catch (error) {
      console.warn('Could not read mainSettings.json, trying environment variables:', error);
      // Fallback to environment variables
      apiKey = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY || '';
      console.log('API key loaded from environment:', !!apiKey);
    }

    if (!apiKey) {
      console.error('No API key found for testing. Please configure it in mainSettings.json (via Main Settings tab) or set VITE_YOUTUBE_API_KEY environment variable for testing.');
      return;
    }
    
    const youtubeAPI = new YouTubeAPI(apiKey);
    
    // Test username resolution
    console.log('Testing username resolution for @skypaul77...');
    const channelDetails = await youtubeAPI.searchChannelByUsername('skypaul77');
    console.log('Resolved channel:', channelDetails);
    
    // Test fetching videos
    console.log('Testing video fetching...');
    const videos = await youtubeAPI.getChannelVideos(channelDetails.channelId, 3);
    console.log('Found videos:', videos.length);
    console.log('First video:', videos[0]);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testUsernameResolution();
