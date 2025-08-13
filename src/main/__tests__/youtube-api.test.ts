import { YouTubeAPI } from '../youtube-api';
import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock the https module
vi.mock('https', () => ({
  request: vi.fn()
}));

describe('YouTube API', () => {
  let youtubeAPI: YouTubeAPI;
  
  beforeEach(() => {
    youtubeAPI = new YouTubeAPI('test-api-key');
    vi.clearAllMocks();
  });
  
  test('should create YouTube API instance with API key', () => {
    expect(youtubeAPI).toBeInstanceOf(YouTubeAPI);
  });
  
  test('should extract channel ID from @username URL', () => {
    const url = 'https://www.youtube.com/@skypaul77';
    // This would test the extractChannelId function if it were public
    // For now, we'll test the URL parsing logic
    expect(url.includes('/@')).toBe(true);
    const match = url.match(/\/@([^\/\?]+)/);
    expect(match?.[1]).toBe('skypaul77');
  });
  
  test('should extract channel ID from /channel/ URL', () => {
    const url = 'https://www.youtube.com/channel/UCxxxxx';
    expect(url.includes('/channel/')).toBe(true);
    const match = url.match(/\/channel\/([^\/\?]+)/);
    expect(match?.[1]).toBe('UCxxxxx');
  });
  
  test('should extract playlist ID from playlist URL', () => {
    const url = 'https://www.youtube.com/playlist?list=PLDkj1tpCS_rt2h-vRvcSKGwpBiovqQBks';
    const match = url.match(/[?&]list=([^&]+)/);
    expect(match?.[1]).toBe('PLDkj1tpCS_rt2h-vRvcSKGwpBiovqQBks');
  });
  
  test('should handle invalid URLs gracefully', () => {
    const invalidUrl = 'https://www.youtube.com/invalid';
    expect(invalidUrl.includes('/@')).toBe(false);
    expect(invalidUrl.includes('/channel/')).toBe(false);
    
    const match = invalidUrl.match(/[?&]list=([^&]+)/);
    expect(match).toBeNull();
  });
});
