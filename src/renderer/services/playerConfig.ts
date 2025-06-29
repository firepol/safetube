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

/**
 * Service for managing YouTube player configuration.
 * 
 * This service handles configuration for both MediaSource and iframe YouTube players,
 * including quality settings, language preferences, and per-video overrides.
 */
export class PlayerConfigService {
  private static config: PlayerConfig | null = null;

  /**
   * Gets the complete player configuration.
   * 
   * @returns Promise<PlayerConfig> The complete configuration object
   */
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

  /**
   * Gets the global YouTube player type.
   * 
   * @returns Promise<'iframe' | 'mediasource'> The configured player type
   */
  static async getYouTubePlayerType(): Promise<'iframe' | 'mediasource'> {
    const config = await this.getConfig();
    return config.youtubePlayerType;
  }

  /**
   * Gets the MediaSource player configuration.
   * 
   * @returns Promise<YouTubePlayerConfig['mediasource']> MediaSource configuration
   */
  static async getMediaSourceConfig() {
    const config = await this.getConfig();
    return config.youtubePlayerConfig.mediasource;
  }

  /**
   * Gets the iframe player configuration.
   * 
   * @returns Promise<YouTubePlayerConfig['iframe']> iframe configuration
   */
  static async getIframeConfig() {
    const config = await this.getConfig();
    return config.youtubePlayerConfig.iframe;
  }

  /**
   * Gets per-video override configuration for a specific video.
   * 
   * @param videoId - The YouTube video ID
   * @returns Promise<PerVideoOverride | null> Override configuration or null if none exists
   */
  static async getPerVideoOverride(videoId: string): Promise<PerVideoOverride | null> {
    const config = await this.getConfig();
    return config.perVideoOverrides[videoId] || null;
  }

  /**
   * Gets the effective player type for a specific video, considering overrides.
   * 
   * @param videoId - The YouTube video ID
   * @returns Promise<'iframe' | 'mediasource'> The effective player type
   */
  static async getEffectivePlayerType(videoId: string): Promise<'iframe' | 'mediasource'> {
    const override = await this.getPerVideoOverride(videoId);
    if (override) {
      return override.youtubePlayerType;
    }
    return await this.getYouTubePlayerType();
  }

  /**
   * Parses a quality string to its corresponding height in pixels.
   * 
   * Supported quality values:
   * - `144p` → 144px (256×144) - Very slow connections
   * - `240p` → 240px (426×240) - Slow connections  
   * - `360p` → 360px (640×360) - Basic streaming
   * - `480p` → 480px (854×480) - Standard definition
   * - `720p` → 720px (1280×720) - High definition (recommended)
   * - `1080p` → 1080px (1920×1080) - Full HD (default)
   * - `1440p` → 1440px (2560×1440) - 2K resolution
   * - `2160p` → 2160px (3840×2160) - 4K resolution
   * - `4k` → 2160px (3840×2160) - 4K resolution (alias)
   * 
   * @param maxQuality - The quality string (e.g., "1080p", "720p", "4k")
   * @returns number The height in pixels, defaults to 1080 if unknown
   */
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
} 