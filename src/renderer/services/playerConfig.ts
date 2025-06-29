import { logVerbose } from '../../shared/logging';

export interface YouTubePlayerConfig {
  iframe: {
    showRelatedVideos: boolean;
    customEndScreen: boolean;
    qualityControls: boolean;
    autoplay: boolean;
    controls: boolean;
    modestbranding: boolean;
    rel: number;
    fs: number;
  };
  mediasource: {
    maxQuality: string;
    preferredLanguages: string[];
    fallbackToLowerQuality: boolean;
    bufferSize: number;
  };
}

export interface PerVideoOverride {
  youtubePlayerType: 'iframe' | 'mediasource';
  reason?: string;
}

export interface PlayerConfig {
  youtubePlayerType: 'iframe' | 'mediasource';
  youtubePlayerConfig: YouTubePlayerConfig;
  perVideoOverrides: Record<string, PerVideoOverride>;
}

export class PlayerConfigService {
  private static config: PlayerConfig | null = null;

  static async getConfig(): Promise<PlayerConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      // For now, use default configuration
      // Later this will load from youtubePlayer.json
      this.config = {
        youtubePlayerType: 'mediasource',
        youtubePlayerConfig: {
          iframe: {
            showRelatedVideos: false,
            customEndScreen: false,
            qualityControls: true,
            autoplay: true,
            controls: true,
            modestbranding: true,
            rel: 0,
            fs: 1
          },
          mediasource: {
            maxQuality: '1080p',
            preferredLanguages: ['en'],
            fallbackToLowerQuality: true,
            bufferSize: 30
          }
        },
        perVideoOverrides: {}
      };

      logVerbose('Loaded default YouTube player configuration:', this.config);
      return this.config;
    } catch (error) {
      console.error('Error loading YouTube player configuration:', error);
      // Return default config on error
      return this.getDefaultConfig();
    }
  }

  static async getYouTubePlayerType(): Promise<'iframe' | 'mediasource'> {
    const config = await this.getConfig();
    return config.youtubePlayerType;
  }

  static async getMediaSourceConfig() {
    const config = await this.getConfig();
    return config.youtubePlayerConfig.mediasource;
  }

  static async getIframeConfig() {
    const config = await this.getConfig();
    return config.youtubePlayerConfig.iframe;
  }

  static async getPerVideoOverride(videoId: string): Promise<PerVideoOverride | null> {
    const config = await this.getConfig();
    return config.perVideoOverrides[videoId] || null;
  }

  static async getEffectivePlayerType(videoId: string): Promise<'iframe' | 'mediasource'> {
    const override = await this.getPerVideoOverride(videoId);
    if (override) {
      return override.youtubePlayerType;
    }
    return await this.getYouTubePlayerType();
  }

  private static getDefaultConfig(): PlayerConfig {
    return {
      youtubePlayerType: 'mediasource',
      youtubePlayerConfig: {
        iframe: {
          showRelatedVideos: false,
          customEndScreen: false,
          qualityControls: true,
          autoplay: true,
          controls: true,
          modestbranding: true,
          rel: 0,
          fs: 1
        },
        mediasource: {
          maxQuality: '1080p',
          preferredLanguages: ['en'],
          fallbackToLowerQuality: true,
          bufferSize: 30
        }
      },
      perVideoOverrides: {}
    };
  }

  // Helper function to parse quality string to max height
  static parseMaxQuality(maxQuality: string): number {
    const qualityMap: Record<string, number> = {
      '144p': 144,
      '240p': 240,
      '360p': 360,
      '480p': 480,
      '720p': 720,
      '1080p': 1080,
      '1440p': 1440,
      '2160p': 2160,
      '4k': 2160
    };

    return qualityMap[maxQuality.toLowerCase()] || 1080;
  }
} 