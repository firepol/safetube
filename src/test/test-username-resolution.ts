// Simple test script to verify username resolution works
import 'dotenv/config';
import { YouTubeAPI } from '../main/youtube-api';

async function testUsernameResolution() {
  try {
    const apiKey = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
    console.log('API Key configured:', !!apiKey);
    
    if (!apiKey) {
      console.error('No API key found');
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
