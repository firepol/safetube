export type YouTubePlayerType = 'iframe' | 'mediasource';

export interface IframePlayerConfig {
  showRelatedVideos: boolean;
  customEndScreen: boolean;
  qualityControls: boolean;
  autoplay: boolean;
  controls: boolean;
}

export interface MediaSourcePlayerConfig {
  maxQuality: string;
  preferredLanguages: string[];
  fallbackToLowerQuality: boolean;
}

export interface YouTubePlayerConfig {
  iframe: IframePlayerConfig;
  mediasource: MediaSourcePlayerConfig;
}

export interface PerVideoOverride {
  youtubePlayerType: YouTubePlayerType;
}

export interface PlayerConfigSchema {
  youtubePlayerType: YouTubePlayerType;
  youtubePlayerConfig: YouTubePlayerConfig;
  perVideoOverrides?: Record<string, PerVideoOverride>;
} 