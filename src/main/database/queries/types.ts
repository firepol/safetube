/**
 * Shared database types for query helpers
 */

// Source types
export type SourceType = 'local' | 'youtube_channel' | 'youtube_playlist' | 'dlna' | 'favorites';

export interface Source {
  id: string;
  type: SourceType;
  title: string;
  url: string | null;
  thumbnail: string | null;
  channel_id: string | null;
  path: string | null;
  sort_preference: string | null;
  position: number | null;
  total_videos: number | null;
  max_depth: number | null;
  created_at: string;
  updated_at: string;
}

// Video types
export interface Video {
  id: string;
  title: string;
  published_at: string | null;
  thumbnail: string | null;
  duration: number | null;
  url: string | null;
  is_available: boolean;
  description: string | null;
  source_id: string;
  created_at: string;
  updated_at: string;
}

// View Record types
export interface ViewRecord {
  id: number;
  video_id: string;
  source_id: string;
  position: number;
  time_watched: number;
  duration: number | null;
  watched: boolean;
  first_watched: string;
  last_watched: string;
  created_at: string;
  updated_at: string;
}

// Favorite types
export interface Favorite {
  id: number;
  video_id: string;
  source_id: string;
  date_added: string;
  created_at: string;
}

// YouTube API Cache types
export interface YouTubeApiResult {
  id: number;
  source_id: string;
  video_id: string;
  position: number;
  page_range: string;
  fetch_timestamp: string;
  created_at: string;
}

// Query result types with joins
export interface ViewRecordWithVideo extends ViewRecord {
  video_title?: string;
  video_thumbnail?: string;
  video_duration?: number;
}

export interface FavoriteWithVideo extends Favorite {
  video_title?: string;
  video_thumbnail?: string;
  video_duration?: number;
  video_url?: string;
  video_published_at?: string;
  video_description?: string;
  source_title?: string;
  source_type?: string;
}
