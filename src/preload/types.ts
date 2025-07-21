// Video source types for configuration-driven system

export type VideoSourceType = 'youtube_channel' | 'youtube_playlist' | 'local';

export interface YouTubeChannelSource {
  id: string;
  type: 'youtube_channel';
  url: string; // e.g. https://www.youtube.com/channel/UCxxxxx
  title: string;
  sortOrder?: 'newestFirst' | 'oldestFirst';
}

export interface YouTubePlaylistSource {
  id: string;
  type: 'youtube_playlist';
  url: string; // e.g. https://www.youtube.com/playlist?list=PLxxxxxx
  title: string;
  sortOrder?: 'playlistOrder' | 'newestFirst' | 'oldestFirst';
}

export interface LocalFolderSource {
  id: string;
  type: 'local';
  path: string;
  title: string;
  sortOrder?: 'alphabetical' | 'dateAdded' | 'manual';
  maxDepth?: number; // default 2
}

export type VideoSource = YouTubeChannelSource | YouTubePlaylistSource | LocalFolderSource;

// YouTube cache metadata for efficient updates
export interface YouTubeSourceCache {
  sourceId: string;
  type: 'youtube_channel' | 'youtube_playlist';
  lastFetched: string; // ISO date
  lastVideoDate?: string; // ISO date of newest video in cache
  videos: Array<{
    id: string;
    title: string;
    publishedAt: string;
    thumbnail: string;
    duration: number;
    url: string;
    [key: string]: any;
  }>;
} 