// Simple test script to verify username resolution works
import 'dotenv/config';
import { YouTubeAPI } from '../main/youtube-api';

async function testUsernameResolution() {
  try {
    const { getYouTubeApiKey } = await import('../main/helpers/settingsHelper');
    const apiKey = await getYouTubeApiKey();

    if (!apiKey) {
      console.error('No API key found for testing. Please configure it via Main Settings tab or set YOUTUBE_API_KEY environment variable for testing.');
      return;
    }

    console.log('API key loaded:', !!apiKey);
    
    const youtubeAPI = new YouTubeAPI(apiKey);
    
    // Test username resolution
    console.log('Testing username resolution for @TEDEd...');
    const channelDetails = await youtubeAPI.searchChannelByUsername('TEDEd');
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
