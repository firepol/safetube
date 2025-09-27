import { z } from 'zod';
import { logVerbose } from './logging';
import { VideoSource } from './types';
import { classifyVideoError, VideoErrorLogger, VideoErrorType, createFallbackVideo } from '../shared/videoErrorHandling';

// YouTube API response schemas
const VideoSchema = z.object({
  id: z.string(),
  snippet: z.object({
    title: z.string(),
    description: z.string(),
    thumbnails: z.object({
      default: z.object({ url: z.string() }),
      medium: z.object({ url: z.string() }),
      high: z.object({ url: z.string() }),
      maxres: z.object({ url: z.string() }).optional(),
    }),
    channelId: z.string(),
    channelTitle: z.string(),
  }),
  contentDetails: z.object({
    duration: z.string(), // ISO 8601 duration
    dimension: z.string(), // "2d" or "3d"
    definition: z.string(), // "hd" or "sd"
  }),
  status: z.object({
    privacyStatus: z.string(),
    madeForKids: z.boolean(),
  }),
});

const PlayerSchema = z.object({
  streamingData: z.object({
    formats: z.array(z.object({
      itag: z.number(),
      url: z.string(),
      mimeType: z.string(),
      bitrate: z.number(),
      width: z.number().optional(),
      height: z.number().optional(),
      lastModified: z.string(),
      contentLength: z.string(),
      quality: z.string(),
      fps: z.number().optional(),
      qualityLabel: z.string().optional(),
      projectionType: z.string(),
      averageBitrate: z.number().optional(),
      audioQuality: z.string().optional(),
      approxDurationMs: z.string(),
      audioSampleRate: z.string().optional(),
      audioChannels: z.number().optional(),
    })),
    adaptiveFormats: z.array(z.object({
      itag: z.number(),
      url: z.string(),
      mimeType: z.string(),
      bitrate: z.number(),
      width: z.number().optional(),
      height: z.number().optional(),
      lastModified: z.string(),
      contentLength: z.string(),
      quality: z.string(),
      fps: z.number().optional(),
      qualityLabel: z.string().optional(),
      projectionType: z.string(),
      averageBitrate: z.number().optional(),
      audioQuality: z.string().optional(),
      approxDurationMs: z.string(),
      audioSampleRate: z.string().optional(),
      audioChannels: z.number().optional(),
      language: z.string().optional(),
    })),
  }),
  videoDetails: z.object({
    videoId: z.string(),
    title: z.string(),
    lengthSeconds: z.string(),
    channelId: z.string(),
    isOwnerViewing: z.boolean(),
    isCrawlable: z.boolean(),
    thumbnails: z.array(z.object({
      url: z.string(),
      width: z.number(),
      height: z.number(),
    })),
    averageRating: z.number(),
    allowRatings: z.boolean(),
    viewCount: z.string(),
    author: z.string(),
    isPrivate: z.boolean(),
    isUnpluggedCorpus: z.boolean(),
    isLiveContent: z.boolean(),
  }),
});

const PlaylistItemSchema = z.object({
  id: z.string(),
  snippet: z.object({
    resourceId: z.object({
      videoId: z.string(),
    }),
  }),
});

const PlaylistSchema = z.object({
  items: z.array(PlaylistItemSchema),
  nextPageToken: z.string().optional(),
  pageInfo: z.object({
    totalResults: z.number(),
  }),
});

const ChannelSchema = z.object({
  id: z.string(),
  snippet: z.object({
    title: z.string(),
    description: z.string(),
    thumbnails: z.object({
      default: z.object({ url: z.string() }),
      medium: z.object({ url: z.string() }),
      high: z.object({ url: z.string() }),
    }),
  }),
  contentDetails: z.object({
    relatedPlaylists: z.object({
      uploads: z.string(),
    }),
  }),
});

export type YouTubeVideo = z.infer<typeof VideoSchema>;
export type YouTubePlayer = z.infer<typeof PlayerSchema>;
export type YouTubePlaylist = z.infer<typeof PlaylistSchema>;
export type YouTubeChannel = z.infer<typeof ChannelSchema>;

export interface VideoStream {
  url: string;
  quality: string;
  mimeType: string;
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
}

export interface AudioTrack {
  url: string;
  language: string;
  mimeType: string;
  bitrate?: number;
}

let API_KEY: string | null = null;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Cache configuration - will be loaded from config
let CACHE_DURATION_MS = 30 * 60 * 1000; // Default 30 minutes

// Cache management functions
function getCacheKey(endpoint: string, params: Record<string, string>): string {
  const sortedParams = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
  return `${endpoint}_${sortedParams}`;
}

// Cache file operations disabled in preload context

function isCacheValid(cacheData: any): boolean {
  if (!cacheData || !cacheData.timestamp) return false;
  const now = Date.now();
  return (now - cacheData.timestamp) < CACHE_DURATION_MS;
}

async function getCachedResult(cacheKey: string): Promise<any | null> {
  try {
    // Use IPC to get cache from main process
    if (typeof window !== 'undefined' && (window as any).electron?.getYouTubeCache) {
      return await (window as any).electron.getYouTubeCache(cacheKey);
    }
  } catch (e) {
    console.warn(`[YouTubeAPI] Error getting cache for ${cacheKey}:`, e);
  }
  return null;
}

async function setCachedResult(cacheKey: string, data: any): Promise<void> {
  try {
    // Use IPC to set cache in main process
    if (typeof window !== 'undefined' && (window as any).electron?.setYouTubeCache) {
      await (window as any).electron.setYouTubeCache(cacheKey, data);
    }
  } catch (e) {
    console.warn(`[YouTubeAPI] Error setting cache for ${cacheKey}:`, e);
  }
}

export class YouTubeAPI {
  static setApiKey(apiKey: string) {
    API_KEY = apiKey;
  }
  
  static async clearExpiredCache(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).electron?.clearExpiredYouTubeCache) {
        await (window as any).electron.clearExpiredYouTubeCache();
      }
    } catch (error) {
      console.warn('[YouTubeAPI] Error clearing expired cache:', error);
    }
  }

  static async loadCacheConfig(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).electron?.loadYouTubeCacheConfig) {
        await (window as any).electron.loadYouTubeCacheConfig();
        logVerbose(`[YouTubeAPI] Cache config loaded via IPC`);
      }
    } catch (error) {
      console.warn('[YouTubeAPI] Failed to load cache config via IPC:', error);
    }
  }
  
  private static async fetch<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    if (!API_KEY) {
      throw new Error('YouTube API key not set. Call YouTubeAPI.setApiKey() first.');
    }
    
    const queryParams = new URLSearchParams({
      key: API_KEY,
      ...params,
    });
    
    const url = `${BASE_URL}/${endpoint}?${queryParams}`;
    
    // Check cache first
    const cacheKey = getCacheKey(endpoint, params);
    const cachedResult = await getCachedResult(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    
    try {
      // Use Node.js fetch if available, fallback to global fetch
      let response: Response;
      if (typeof globalThis.fetch === 'function') {
        response = await globalThis.fetch(url);
      } else {
        // Fallback for older Node.js versions
        const https = require('https');
        const http = require('http');
        
        return new Promise((resolve, reject) => {
          const urlObj = new URL(url);
          const client = urlObj.protocol === 'https:' ? https : http;
          
          const req = client.request(url, (res: any) => {
            let data = '';
            res.on('data', (chunk: any) => data += chunk);
            res.on('end', () => {
              try {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                  const result = JSON.parse(data);
                  // Cache the successful result
                  setCachedResult(cacheKey, result);
                  resolve(result);
                } else {
                  reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                }
              } catch (e) {
                reject(new Error(`Failed to parse response: ${e}`));
              }
            });
          });
          
          req.on('error', reject);
          req.setTimeout(10000, () => req.destroy());
          req.end();
        });
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        
        // Try to parse the error response to get specific error details
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            if (errorData.error.code === 403 && errorData.error.reason === 'quotaExceeded') {
              throw new Error(`YouTube API quota exceeded. Please try again later.`);
            } else if (errorData.error.code === 403) {
              throw new Error(`YouTube API access denied. Please check your API key.`);
            } else if (errorData.error.code === 429) {
              throw new Error(`YouTube API rate limit exceeded. Please try again later.`);
            } else {
              throw new Error(`YouTube API error: ${errorData.error.message || errorData.error.code}`);
            }
          }
        } catch (parseError) {
          // If we can't parse the error response, use the generic error
        }
        
        throw new Error(`YouTube API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      
      // Cache the successful result
      await setCachedResult(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error(`[YouTubeAPI] Fetch failed for ${endpoint}:`, error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('fetch failed')) {
          throw new Error(`Network error: Unable to reach YouTube API. Please check your internet connection.`);
        } else if (error.message.includes('403')) {
          throw new Error(`YouTube API access denied. Please check your API key.`);
        } else if (error.message.includes('429')) {
          throw new Error(`YouTube API rate limit exceeded. Please try again later.`);
        } else if (error.message.includes('500')) {
          throw new Error(`YouTube API server error. Please try again later.`);
        }
      }
      
      throw new Error(`YouTube API request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static async getVideoDetails(videoId: string): Promise<YouTubeVideo | null> {
    try {
      const data = await YouTubeAPI.fetch<{ items: YouTubeVideo[] }>('videos', {
        part: 'snippet,contentDetails,status',
        id: videoId,
      });
      if (!data.items?.[0]) {
        // Classify and log the "not found" error
        const errorInfo = classifyVideoError(new Error(`Video not found: ${videoId}`), videoId);
        VideoErrorLogger.logVideoError(videoId, errorInfo);
        return null;
      }
      return VideoSchema.parse(data.items[0]);
    } catch (error) {
      // Enhanced error logging with classification
      const errorInfo = classifyVideoError(error, videoId);
      VideoErrorLogger.logVideoError(videoId, errorInfo);
      
      // Return null instead of throwing to allow graceful failure
      return null;
    }
  }

  static async getVideoPlayer(videoId: string): Promise<YouTubePlayer> {
    const data = await YouTubeAPI.fetch<YouTubePlayer>('player', {
      part: 'streamingData,videoDetails',
      id: videoId,
    });
    return PlayerSchema.parse(data);
  }

  static async getVideoStreams(videoId: string): Promise<{ videoStreams: VideoStream[]; audioTracks: AudioTrack[] }> {
    throw new Error('getVideoStreams is not available in preload/browser context');
  }

  static async getPlaylistVideos(playlistId: string, maxResults?: number, pageToken?: string): Promise<{ videoIds: string[], totalResults: number, nextPageToken?: string }> {
    const params: Record<string, string> = {
      part: 'snippet',
      playlistId,
      maxResults: (maxResults || 50).toString(),
    };
    
    if (pageToken) {
      params.pageToken = pageToken;
    }
    
    const data = await YouTubeAPI.fetch<YouTubePlaylist>('playlistItems', params);
    return {
      videoIds: data.items.map(item => item.snippet.resourceId.videoId),
      totalResults: data.pageInfo.totalResults,
      nextPageToken: data.nextPageToken
    };
  }

  static async getChannelDetails(channelId: string): Promise<YouTubeChannel> {
    const data = await YouTubeAPI.fetch<{ items: YouTubeChannel[] }>('channels', {
      part: 'snippet,contentDetails',
      id: channelId,
    });
    if (!data.items?.[0]) {
      throw new Error(`Channel not found: ${channelId}`);
    }
    return ChannelSchema.parse(data.items[0]);
  }

  static async getPlaylistDetails(playlistId: string): Promise<{ id: string; title: string; thumbnail: string; totalItems: number }> {
    const data = await YouTubeAPI.fetch<{ items: any[]; pageInfo: any }>('playlists', {
      part: 'snippet,contentDetails',
      id: playlistId,
    });
    if (!data.items?.[0]) {
      throw new Error(`Playlist not found: ${playlistId}`);
    }
    const playlist = data.items[0];
    return {
      id: playlist.id,
      title: playlist.snippet.title,
      thumbnail: playlist.snippet.thumbnails?.high?.url || playlist.snippet.thumbnails?.medium?.url || '',
      totalItems: playlist.contentDetails.itemCount || 0
    };
  }

  static async getChannelBasicInfo(channelId: string): Promise<{ id: string; title: string; thumbnail: string; totalVideos: number }> {
    const channel = await this.getChannelDetails(channelId);

    // Get just the count of videos without fetching them all
    const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;
    const firstPageResult = await this.getPlaylistVideos(uploadsPlaylistId, 1); // Get just 1 video to get total count

    return {
      id: channelId,
      title: channel.snippet.title,
      thumbnail: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.medium?.url || '',
      totalVideos: firstPageResult.totalResults
    };
  }

  static async getPlaylistBasicInfo(playlistId: string): Promise<{ id: string; title: string; thumbnail: string; totalVideos: number }> {
    const playlist = await this.getPlaylistDetails(playlistId);
    return {
      id: playlistId,
      title: playlist.title,
      thumbnail: playlist.thumbnail,
      totalVideos: playlist.totalItems
    };
  }

  static async getChannelVideos(channelId: string, maxResults?: number, pageToken?: string): Promise<{ videoIds: string[], totalResults: number, nextPageToken?: string }> {
    const channel = await this.getChannelDetails(channelId);
    return this.getPlaylistVideos(channel.contentDetails.relatedPlaylists.uploads, maxResults, pageToken);
  }

  static async getChannelVideosPage(channelId: string, pageNumber: number, pageSize: number = 50): Promise<{ videos: any[], totalResults: number, pageNumber: number }> {
    try {
      const channel = await this.getChannelDetails(channelId);
      return this.getPlaylistVideosPage(channel.contentDetails.relatedPlaylists.uploads, pageNumber, pageSize);
    } catch (error) {
      console.error(`[YouTubeAPI] Error in getChannelVideosPage for channelId ${channelId}:`, error);
      throw error;
    }
  }

  static async getPlaylistVideosPage(playlistId: string, pageNumber: number, pageSize: number = 50): Promise<{ videos: any[], totalResults: number, pageNumber: number }> {

    const startTime = Date.now();

    // Calculate how many items to skip for the requested page
    const itemsToSkip = (pageNumber - 1) * pageSize;

    let currentPageToken: string | undefined = undefined;
    let totalResults = 0;
    let allVideoIds: string[] = [];

    // Fetch batches until we have enough videos for the requested page
    while (allVideoIds.length <= itemsToSkip + pageSize) {

      const result = await this.getPlaylistVideos(playlistId, 50, currentPageToken);

      if (result.videoIds.length === 0) {
        break;
      }

      totalResults = result.totalResults;
      allVideoIds.push(...result.videoIds);
      currentPageToken = result.nextPageToken;

      // If no more pages available, break
      if (!currentPageToken) {
        break;
      }

      // If we have enough videos for the requested page, we can stop
      if (allVideoIds.length > itemsToSkip + pageSize - 1) {
        break;
      }
    }

    // Extract the videos for the requested page
    const startIndex = itemsToSkip;
    const endIndex = Math.min(startIndex + pageSize, allVideoIds.length);
    const pageVideoIds = allVideoIds.slice(startIndex, endIndex);

    if (pageVideoIds.length === 0) {
      return {
        videos: [],
        totalResults,
        pageNumber
      };
    }

    // Enhanced batch processing with Promise.allSettled for graceful failure handling
    const videoResults = await Promise.allSettled(
      pageVideoIds.map(async (videoId): Promise<{ success: boolean; video?: YouTubeVideo; videoId: string; error?: any }> => {
        const video = await this.getVideoDetails(videoId);
        if (video) {
          return { success: true, video, videoId };
        } else {
          return { success: false, videoId };
        }
      })
    );

    // Process results and create fallback entries for failed videos
    const videos = videoResults.map((result, index) => {
      const videoId = pageVideoIds[index];
      
      if (result.status === 'fulfilled' && result.value.success && result.value.video) {
        // Successful video load - transform to expected format
        const video = result.value.video;
        return {
          id: video.id,
          type: 'youtube',
          title: video.snippet.title,
          description: video.snippet.description || '',
          publishedAt: ((video.snippet as any).publishedAt || ''),
          thumbnail: video.snippet.thumbnails.high.url,
          duration: YouTubeAPI.parseDuration(video.contentDetails.duration),
          url: `https://www.youtube.com/watch?v=${video.id}`,
          isAvailable: true
        };
      } else {
        // Failed video load - create fallback entry using shared implementation
        let errorInfo;
        if (result.status === 'rejected') {
          errorInfo = classifyVideoError(result.reason, videoId);
        }
        return createFallbackVideo(videoId, errorInfo);
      }
    });

    // Calculate and log metrics
    const loadTimeMs = Date.now() - startTime;
    const successfulLoads = videos.filter(v => v.isAvailable !== false).length;
    const failedLoads = videos.length - successfulLoads;
    
    // Create error breakdown
    const errorBreakdown = {
      deleted: 0,
      private: 0,
      restricted: 0,
      api_error: 0,
      network_error: 0,
      unknown: failedLoads // For now, count all failures as unknown
    };

    // Log metrics using the enhanced logging
    const { VideoErrorLogger, createVideoLoadMetrics } = await import('../shared/videoErrorHandling');
    const metrics = createVideoLoadMetrics(
      videos.length,
      successfulLoads,
      failedLoads,
      errorBreakdown,
      loadTimeMs,
      playlistId,
      pageNumber
    );
    VideoErrorLogger.logVideoLoadMetrics(metrics);

    return { videos, totalResults, pageNumber };
  }



  static async getVideosForPage(sourceId: string, pageNumber: number, pageSize?: number): Promise<{ videos: any[], totalResults: number }> {
    try {
      // This method will be called from the main process with source details
      // For now, we'll need to get the source info to determine the type and ID
      throw new Error('getVideosForPage should be called from main process with source details');
    } catch (error) {
      console.error('[YouTubeAPI] Error in getVideosForPage:', error);
      throw error;
    }
  }

  static async searchChannelByUsername(username: string): Promise<{ channelId: string; title: string; thumbnail: string }> {
    // Remove @ prefix if present
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    
    const data = await YouTubeAPI.fetch<{ items: any[] }>('search', {
      part: 'snippet',
      q: cleanUsername,
      type: 'channel',
      maxResults: '1'
    });
    
    if (!data.items?.[0]) {
      throw new Error(`Channel not found for username: ${username}`);
    }
    
    const channel = data.items[0];
    return {
      channelId: channel.id.channelId,
      title: channel.snippet.title,
      thumbnail: channel.snippet.thumbnails?.high?.url || ''
    };
  }

  // Helper to convert ISO 8601 duration to seconds
  static parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const [, hours, minutes, seconds] = match;
    return (
      (parseInt(hours || '0') * 3600) +
      (parseInt(minutes || '0') * 60) +
      parseInt(seconds || '0')
    );
  }

  // Helper to check if URL is m3u8
  static isM3U8(url: string): boolean {
    return url.toLowerCase().endsWith('.m3u8');
  }

  // ... (rest of the code unchanged)
} 