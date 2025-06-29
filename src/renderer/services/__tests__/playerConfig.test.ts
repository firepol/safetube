import { PlayerConfigService } from '../playerConfig';

describe('PlayerConfigService', () => {
  beforeEach(() => {
    // Reset the config cache before each test
    (PlayerConfigService as any).config = null;
  });

  describe('getConfig', () => {
    it('should return default configuration', async () => {
      const config = await PlayerConfigService.getConfig();
      
      expect(config.youtubePlayerType).toBe('mediasource');
      expect(config.youtubePlayerConfig.mediasource.maxQuality).toBe('1080p');
      expect(config.youtubePlayerConfig.mediasource.preferredLanguages).toEqual(['en']);
      expect(config.youtubePlayerConfig.iframe.showRelatedVideos).toBe(false);
    });

    it('should cache configuration after first load', async () => {
      const config1 = await PlayerConfigService.getConfig();
      const config2 = await PlayerConfigService.getConfig();
      
      expect(config1).toBe(config2); // Same object reference
    });
  });

  describe('getMediaSourceConfig', () => {
    it('should return MediaSource configuration', async () => {
      const config = await PlayerConfigService.getMediaSourceConfig();
      
      expect(config.maxQuality).toBe('1080p');
      expect(config.preferredLanguages).toEqual(['en']);
      expect(config.fallbackToLowerQuality).toBe(true);
      expect(config.bufferSize).toBe(30);
    });
  });

  describe('getIframeConfig', () => {
    it('should return iframe configuration', async () => {
      const config = await PlayerConfigService.getIframeConfig();
      
      expect(config.showRelatedVideos).toBe(false);
      expect(config.customEndScreen).toBe(false);
      expect(config.qualityControls).toBe(true);
      expect(config.rel).toBe(0);
    });
  });

  describe('getEffectivePlayerType', () => {
    it('should return global player type when no override exists', async () => {
      const playerType = await PlayerConfigService.getEffectivePlayerType('test-video-id');
      expect(playerType).toBe('mediasource');
    });

    it('should return override player type when override exists', async () => {
      // Mock a per-video override
      const mockConfig = await PlayerConfigService.getConfig();
      mockConfig.perVideoOverrides['test-video-id'] = {
        youtubePlayerType: 'iframe',
        reason: 'Test override'
      };

      const playerType = await PlayerConfigService.getEffectivePlayerType('test-video-id');
      expect(playerType).toBe('iframe');
    });
  });

  describe('parseMaxQuality', () => {
    it('should parse quality strings to height values', () => {
      expect(PlayerConfigService.parseMaxQuality('720p')).toBe(720);
      expect(PlayerConfigService.parseMaxQuality('1080p')).toBe(1080);
      expect(PlayerConfigService.parseMaxQuality('4k')).toBe(2160);
      expect(PlayerConfigService.parseMaxQuality('2160p')).toBe(2160);
    });

    it('should return default value for unknown quality', () => {
      expect(PlayerConfigService.parseMaxQuality('unknown')).toBe(1080);
    });

    it('should handle case insensitive input', () => {
      expect(PlayerConfigService.parseMaxQuality('720P')).toBe(720);
      expect(PlayerConfigService.parseMaxQuality('4K')).toBe(2160);
    });
  });
}); 