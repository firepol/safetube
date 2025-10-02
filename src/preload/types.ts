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
  totalVideos?: number; // Total videos in the channel/playlist
  thumbnail?: string; // Thumbnail for the source (from first video)
  title?: string; // Title for the source (from channel/playlist details)
  usingCachedData?: boolean; // Flag indicating if we're using cached data due to API failure
  fetchedNewData?: boolean; // Flag indicating if new data was fetched from API (not cache hit)
  apiErrorFallback?: boolean; // Flag indicating if we're using cached data due to API error/rate limit
}

// Pagination configuration
export interface PaginationConfig {
  pageSize: number;
  cacheDurationMinutes: number;
  maxCachedPages: number;
}

// Pagination state for a source
export interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalVideos: number;
  pageSize: number;
  maxPages?: number; // Maximum pages available (for expansion beyond default totalPages)
}

// Cached page data
export interface CachedPage {
  pageNumber: number;
  videos: any[];
  timestamp: number;
  sourceId: string;
}

// Processed source data returned by loadAllVideosFromSources
export interface ProcessedSource {
  id: string;
  type: string;
  title: string;
  thumbnail: string;
  videoCount: number;
  videos: any[];
  paginationState: PaginationState;
  usingCachedData?: boolean;
  lastFetched?: string;
} 