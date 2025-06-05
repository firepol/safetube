import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

export class YouTubeAPI {
  private static async fetch<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    const queryParams = new URLSearchParams({
      key: API_KEY,
      ...params,
    });
    const response = await fetch(`${BASE_URL}/${endpoint}?${queryParams}`);
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.statusText}`);
    }
    return response.json();
  }

  static async getVideoDetails(videoId: string): Promise<YouTubeVideo> {
    const data = await this.fetch<{ items: YouTubeVideo[] }>('videos', {
      part: 'snippet,contentDetails,status',
      id: videoId,
    });
    if (!data.items?.[0]) {
      throw new Error(`Video not found: ${videoId}`);
    }
    return VideoSchema.parse(data.items[0]);
  }

  static async getVideoPlayer(videoId: string): Promise<YouTubePlayer> {
    const data = await this.fetch<YouTubePlayer>('player', {
      part: 'streamingData,videoDetails',
      id: videoId,
    });
    return PlayerSchema.parse(data);
  }

  static async getVideoStreams(videoId: string): Promise<{ videoStreams: VideoStream[]; audioTracks: AudioTrack[] }> {
    try {
      // Use yt-dlp to get video info in JSON format
      const { stdout } = await execAsync(`yt-dlp -j https://www.youtube.com/watch?v=${videoId}`);
      const info = JSON.parse(stdout);

      const videoStreams: VideoStream[] = [];
      const audioTracks: AudioTrack[] = [];

      // Process formats
      for (const format of info.formats) {
        if (format.vcodec !== 'none' && format.acodec !== 'none') {
          // Combined video+audio format
          videoStreams.push({
            url: format.url,
            quality: format.format_note || format.quality || 'unknown',
            mimeType: format.ext,
            width: format.width,
            height: format.height,
            fps: format.fps,
            bitrate: format.tbr,
          });
        } else if (format.vcodec !== 'none') {
          // Video-only format
          videoStreams.push({
            url: format.url,
            quality: format.format_note || format.quality || 'unknown',
            mimeType: format.ext,
            width: format.width,
            height: format.height,
            fps: format.fps,
            bitrate: format.tbr,
          });
        } else if (format.acodec !== 'none') {
          // Audio-only format
          audioTracks.push({
            url: format.url,
            language: format.language || 'unknown',
            mimeType: format.ext,
            bitrate: format.tbr,
          });
        }
      }

      return { videoStreams, audioTracks };
    } catch (error) {
      console.error('Error getting video streams:', error);
      throw new Error('Failed to get video streams');
    }
  }

  static async getPlaylistVideos(playlistId: string, maxResults = 50): Promise<string[]> {
    const data = await this.fetch<YouTubePlaylist>('playlistItems', {
      part: 'snippet',
      playlistId,
      maxResults: maxResults.toString(),
    });
    return data.items.map(item => item.snippet.resourceId.videoId);
  }

  static async getChannelDetails(channelId: string): Promise<YouTubeChannel> {
    const data = await this.fetch<{ items: YouTubeChannel[] }>('channels', {
      part: 'snippet,contentDetails',
      id: channelId,
    });
    if (!data.items?.[0]) {
      throw new Error(`Channel not found: ${channelId}`);
    }
    return ChannelSchema.parse(data.items[0]);
  }

  static async getChannelVideos(channelId: string, maxResults = 50): Promise<string[]> {
    const channel = await this.getChannelDetails(channelId);
    return this.getPlaylistVideos(channel.contentDetails.relatedPlaylists.uploads, maxResults);
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

  // Helper to get best quality stream URL
  static getBestStreamUrl(videoStreams: VideoStream[], audioTracks: AudioTrack[]): string {
    // First try to find a combined format with high quality
    const combinedFormats = videoStreams
      .filter(s => s.mimeType.includes('mp4'))
      .sort((a, b) => {
        // Sort by resolution first
        const heightDiff = (b.height || 0) - (a.height || 0);
        if (heightDiff !== 0) return heightDiff;
        // Then by FPS
        return (b.fps || 0) - (a.fps || 0);
      });

    if (combinedFormats.length > 0) {
      return combinedFormats[0].url;
    }

    // If no combined format, get highest quality video and audio separately
    const videoFormats = videoStreams
      .sort((a, b) => {
        // Sort by resolution first
        const heightDiff = (b.height || 0) - (a.height || 0);
        if (heightDiff !== 0) return heightDiff;
        // Then by FPS
        return (b.fps || 0) - (a.fps || 0);
      });
    
    const audioFormats = audioTracks
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    if (videoFormats.length > 0 && audioFormats.length > 0) {
      // Return both URLs, player will need to handle them
      return `${videoFormats[0].url}|${audioFormats[0].url}`;
    }

    throw new Error('No suitable stream found');
  }

  // Helper to get highest quality stream details
  static getHighestQualityStream(videoStreams: VideoStream[], audioTracks: AudioTrack[]): {
    videoUrl: string;
    audioUrl?: string;
    quality: string;
    resolution: string;
    fps?: number;
  } {
    // First try to find a combined format with high quality
    const combinedFormats = videoStreams
      .filter(s => s.mimeType.includes('mp4'))
      .sort((a, b) => {
        // Sort by resolution first
        const heightDiff = (b.height || 0) - (a.height || 0);
        if (heightDiff !== 0) return heightDiff;
        // Then by FPS
        return (b.fps || 0) - (a.fps || 0);
      });

    if (combinedFormats.length > 0) {
      const best = combinedFormats[0];
      return {
        videoUrl: best.url,
        quality: best.quality,
        resolution: `${best.width}x${best.height}`,
        fps: best.fps
      };
    }

    // If no combined format, get highest quality video and audio separately
    const videoFormats = videoStreams
      .sort((a, b) => {
        // Sort by resolution first
        const heightDiff = (b.height || 0) - (a.height || 0);
        if (heightDiff !== 0) return heightDiff;
        // Then by FPS
        return (b.fps || 0) - (a.fps || 0);
      });
    
    const audioFormats = audioTracks
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    if (videoFormats.length > 0) {
      const bestVideo = videoFormats[0];
      return {
        videoUrl: bestVideo.url,
        audioUrl: audioFormats[0]?.url,
        quality: bestVideo.quality,
        resolution: `${bestVideo.width}x${bestVideo.height}`,
        fps: bestVideo.fps
      };
    }

    throw new Error('No suitable stream found');
  }

  // Helper to get available audio tracks
  static getAudioTracks(player: YouTubePlayer): Array<{ language: string; url: string }> {
    return player.streamingData.adaptiveFormats
      .filter(f => f.mimeType.startsWith('audio/') && f.language)
      .map(f => ({
        language: f.language!,
        url: f.url,
      }));
  }
} 