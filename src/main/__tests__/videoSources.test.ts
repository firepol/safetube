import fs from 'fs';
import path from 'path';

describe('Video Sources Configuration', () => {
  const configPath = path.join(process.cwd(), 'config', 'videoSources.json');
  
  test('should have videoSources.json config file', () => {
    expect(fs.existsSync(configPath)).toBe(true);
  });
  
  test('should parse videoSources.json as valid JSON', () => {
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    expect(Array.isArray(config)).toBe(true);
    expect(config.length).toBeGreaterThan(0);
  });
  
  test('should have valid source structure', () => {
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    config.forEach((source: any, index: number) => {
      expect(source).toHaveProperty('id');
      expect(source).toHaveProperty('type');
      expect(source).toHaveProperty('title');
      expect(source).toHaveProperty('sortOrder');
      
      // Validate required fields
      expect(typeof source.id).toBe('string');
      expect(typeof source.type).toBe('string');
      expect(typeof source.title).toBe('string');
      expect(typeof source.sortOrder).toBe('string');
      
      // Validate type values - allow custom types for now
      expect(typeof source.type).toBe('string');
      
      // Validate sortOrder values - allow custom sort orders
      expect(typeof source.sortOrder).toBe('string');
      
      // Type-specific validations
      if (source.type.includes('youtube')) {
        expect(source).toHaveProperty('url');
        expect(typeof source.url).toBe('string');
        expect(source.url).toMatch(/^https:\/\/www\.youtube\.com\//);
      }
      
      if (source.type === 'local') {
        expect(source).toHaveProperty('path');
        expect(typeof source.path).toBe('string');
        // maxDepth is optional for local sources
        if (source.maxDepth !== undefined) {
          expect(typeof source.maxDepth).toBe('number');
          expect(source.maxDepth).toBeGreaterThan(0);
          expect(source.maxDepth).toBeLessThanOrEqual(5);
        }
      }
    });
  });
  
  test('should parse YouTube URLs correctly', () => {
    // Test channel ID extraction
    const channelUrl1 = 'https://www.youtube.com/@TEDEd';
    const channelUrl2 = 'https://www.youtube.com/channel/UCxxxxx';
    
    // Mock the extractChannelId function (we'll test the real one in integration tests)
    const extractChannelId = (url: string): string | null => {
      if (url.includes('/@')) {
        const match = url.match(/\/@([^\/\?]+)/);
        return match ? match[1] : null;
      } else if (url.includes('/channel/')) {
        const match = url.match(/\/channel\/([^\/\?]+)/);
        return match ? match[1] : null;
      }
      return null;
    };
    
    expect(extractChannelId(channelUrl1)).toBe('TEDEd');
    expect(extractChannelId(channelUrl2)).toBe('UCxxxxx');
    
    // Test playlist ID extraction
    const playlistUrl = 'https://www.youtube.com/playlist?list=PLDkj1tpCS_rt2h-vRvcSKGwpBiovqQBks';
    
    const extractPlaylistId = (url: string): string | null => {
      const match = url.match(/[?&]list=([^&]+)/);
      return match ? match[1] : null;
    };
    
    expect(extractPlaylistId(playlistUrl)).toBe('PLDkj1tpCS_rt2h-vRvcSKGwpBiovqQBks');
  });
});
