import { z } from 'zod';
import { logVerbose } from './logging';
import { VideoSource } from './types';

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

export class YouTubeAPI {
  static setApiKey(apiKey: string) {
    API_KEY = apiKey;
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
                  resolve(JSON.parse(data));
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
        throw new Error(`YouTube API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      return response.json();
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

  static async getVideoDetails(videoId: string): Promise<YouTubeVideo> {
    const data = await YouTubeAPI.fetch<{ items: YouTubeVideo[] }>('videos', {
      part: 'snippet,contentDetails,status',
      id: videoId,
    });
    if (!data.items?.[0]) {
      throw new Error(`Video not found: ${videoId}`);
    }
    return VideoSchema.parse(data.items[0]);
  }

  static async getVideoPlayer(videoId: string): Promise<YouTubePlayer> {
    const data = await YouTubeAPI.fetch<YouTubePlayer>('player', {
      part: 'streamingData,videoDetails',
      id: videoId,
    });
    return PlayerSchema.parse(data);
  }

  static async getVideoStreams(videoId: string): Promise<{ videoStreams: VideoStream[]; audioTracks: AudioTrack[] }> {
    try {
      // In test environment, use yt-dlp directly
      if (typeof window === 'undefined') {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        const { stdout } = await execAsync(`yt-dlp -j "${videoId}"`);
        const data = JSON.parse(stdout);

        const videoStreams: VideoStream[] = data.formats
          .filter((f: any) => f.vcodec !== 'none' && f.acodec === 'none')
          .map((f: any) => ({
            url: f.url,
            quality: f.format_note || f.quality,
            mimeType: f.ext,
            width: f.width,
            height: f.height,
            fps: f.fps,
            bitrate: f.tbr
          }));

        const audioTracks: AudioTrack[] = data.formats
          .filter((f: any) => f.vcodec === 'none' && f.acodec !== 'none')
          .map((f: any) => ({
            url: f.url,
            language: f.language || 'en',
            mimeType: f.ext,
            bitrate: f.tbr
          }));

        return { videoStreams, audioTracks };
      }

      throw new Error('getVideoStreams is not available in preload/browser context');
    } catch (error) {
      console.error('Error getting video streams:', error);
      throw new Error('Failed to get video streams');
    }
  }

  static async getPlaylistVideos(playlistId: string, maxResults = 50): Promise<{ videoIds: string[], totalResults: number }> {
    const data = await YouTubeAPI.fetch<YouTubePlaylist>('playlistItems', {
      part: 'snippet',
      playlistId,
      maxResults: maxResults.toString(),
    });
    return {
      videoIds: data.items.map(item => item.snippet.resourceId.videoId),
      totalResults: data.pageInfo.totalResults
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

  static async getChannelVideos(channelId: string, maxResults = 50): Promise<{ videoIds: string[], totalResults: number }> {
    const channel = await this.getChannelDetails(channelId);
    return this.getPlaylistVideos(channel.contentDetails.relatedPlaylists.uploads, maxResults);
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