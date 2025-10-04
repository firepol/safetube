import { z } from 'zod';
import { logVerboseRenderer } from '@/shared/logging';
import { classifyVideoError, VideoErrorLogger } from '../../shared/videoErrorHandling';

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

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

class YouTubeAPI {
  private static async getApiKey(): Promise<string> {
    try {
      // Get API key from main process (reads from Main Settings with YOUTUBE_API_KEY env fallback)
      const apiKey = await (window as any).electron.getYouTubeApiKey();
      if (apiKey) {
        return apiKey;
      }
    } catch (error) {
      console.warn('[YouTubeAPI] Could not get API key from main process:', error);
    }

    throw new Error('YouTube API key not configured. Please configure it in the Main Settings tab (Admin → Main Settings).');
  }

  private static async fetch<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    const apiKey = await this.getApiKey();
    const queryParams = new URLSearchParams({
      key: apiKey,
      ...params,
    });
    const response = await fetch(`${BASE_URL}/${endpoint}?${queryParams}`);
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.statusText}`);
    }
    return response.json();
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
    try {
      // In test environment, use yt-dlp directly
      if (typeof window === 'undefined' || !window.electron?.getVideoStreams) {
        // Node.js imports removed - not available in renderer context

        // yt-dlp functionality not available in renderer context
        throw new Error('yt-dlp functionality not available in renderer context');
        // Code removed - not available in renderer context
      }

      // In renderer process, use electron IPC
      return await window.electron.getVideoStreams(videoId);
    } catch (error) {
      logVerboseRenderer('Error getting video streams:', error);
      
      // Check if it's a yt-dlp availability error
      if (error instanceof Error && error.message.includes('yt-dlp is required')) {
        throw new Error(`YouTube functionality requires yt-dlp. ${error.message}`);
      }
      
      throw new Error('Failed to get video streams. Please check your internet connection and try again.');
    }
  }

  static async getPlaylistVideos(playlistId: string, maxResults = 50): Promise<string[]> {
    const data = await YouTubeAPI.fetch<YouTubePlaylist>('playlistItems', {
      part: 'snippet',
      playlistId,
      maxResults: maxResults.toString(),
    });
    return data.items.map(item => item.snippet.resourceId.videoId);
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

  // Helper to check if URL is m3u8
  static isM3U8(url: string): boolean {
    return url.toLowerCase().endsWith('.m3u8');
  }

  // Helper to get best quality stream URL
  static getBestStreamUrl(videoStreams: VideoStream[], audioTracks: AudioTrack[]): string {
    // First try to find a combined format with high quality
    const combinedFormats = videoStreams
      .filter(s => s.mimeType.includes('mp4') && !YouTubeAPI.isM3U8(s.url)) // Prefer mp4 and non-m3u8
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
      .filter(s => !YouTubeAPI.isM3U8(s.url)) // Only filter out m3u8
      .sort((a, b) => {
        // Sort by resolution first
        const heightDiff = (b.height || 0) - (a.height || 0);
        if (heightDiff !== 0) return heightDiff;
        // Then by FPS
        return (b.fps || 0) - (a.fps || 0);
      });
    
    if (videoFormats.length > 0) {
      const bestVideo = videoFormats[0];
      const bestAudio = this.getBestAudioTrackByLanguage(audioTracks, ['en']);
      
      return `${bestVideo.url}|${bestAudio.url}`;
    }

    // Fallback to any non-m3u8 format
    const fallbackVideoFormats = videoStreams
      .filter(s => !YouTubeAPI.isM3U8(s.url)) // Prefer non-m3u8
      .sort((a, b) => {
        const heightDiff = (b.height || 0) - (a.height || 0);
        if (heightDiff !== 0) return heightDiff;
        return (b.fps || 0) - (a.fps || 0);
      });
    
    const fallbackAudioFormats = audioTracks
      .filter(a => !YouTubeAPI.isM3U8(a.url)) // Prefer non-m3u8
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    if (fallbackVideoFormats.length > 0 && fallbackAudioFormats.length > 0) {
      return `${fallbackVideoFormats[0].url}|${fallbackAudioFormats[0].url}`;
    }

    // Last resort: use any format
    const lastResortVideoFormats = videoStreams
      .sort((a, b) => {
        const heightDiff = (b.height || 0) - (a.height || 0);
        if (heightDiff !== 0) return heightDiff;
        return (b.fps || 0) - (a.fps || 0);
      });
    
    const lastResortAudioFormats = audioTracks
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    if (lastResortVideoFormats.length > 0 && lastResortAudioFormats.length > 0) {
      return `${lastResortVideoFormats[0].url}|${lastResortAudioFormats[0].url}`;
    }

    throw new Error('No suitable stream found');
  }

  // Helper to get best audio track by language preference
  static getBestAudioTrackByLanguage(audioTracks: AudioTrack[], preferredLanguages: string[]): AudioTrack {
    if (!audioTracks.length) {
      logVerboseRenderer('No audio tracks available in getBestAudioTrackByLanguage');
      throw new Error('No audio tracks available');
    }

    logVerboseRenderer('Getting best audio track for languages:', preferredLanguages);
    logVerboseRenderer('Available audio tracks:', audioTracks.map(t => ({
      language: t.language,
      mimeType: t.mimeType,
      bitrate: t.bitrate
    })));

    // If no preferredLanguages, default to English
    const langs = (preferredLanguages && preferredLanguages.length > 0) ? preferredLanguages : ['en'];
    logVerboseRenderer('Using languages:', langs);

    // For each language, pick the highest-bitrate track, non-m3u8
    for (const lang of langs) {
      logVerboseRenderer(`Looking for language: ${lang}`);
      const candidates = audioTracks
        .filter(t => {
          const matches = t.language.toLowerCase() === lang.toLowerCase() && !YouTubeAPI.isM3U8(t.url);
          logVerboseRenderer(`Track ${t.language} matches ${lang}? ${matches}`);
          return matches;
        })
        .sort((a, b) => {
          // First sort by mimeType (prefer m4a over webm)
          if (a.mimeType === 'm4a' && b.mimeType !== 'm4a') return -1;
          if (a.mimeType !== 'm4a' && b.mimeType === 'm4a') return 1;
          // Then by bitrate
          return (b.bitrate || 0) - (a.bitrate || 0);
        });
      
      logVerboseRenderer(`Candidates for language ${lang}:`, candidates.map(t => ({
        language: t.language,
        mimeType: t.mimeType,
        bitrate: t.bitrate
      })));
      
      if (candidates.length > 0) {
        const selected = candidates[0];
        logVerboseRenderer('Selected audio track:', {
          language: selected.language,
          mimeType: selected.mimeType,
          bitrate: selected.bitrate
        });
        return selected;
      }
    }

    // If we get here, none of the preferred languages were found
    logVerboseRenderer('No tracks found for preferred languages, falling back to any non-m3u8 track');

    // Fallback: any non-m3u8
    const anyNonM3U8Track = audioTracks
      .filter(t => !YouTubeAPI.isM3U8(t.url))
      .sort((a, b) => {
        // First sort by mimeType (prefer m4a over webm)
        if (a.mimeType === 'm4a' && b.mimeType !== 'm4a') return -1;
        if (a.mimeType !== 'm4a' && b.mimeType === 'm4a') return 1;
        // Then by bitrate
        return (b.bitrate || 0) - (a.bitrate || 0);
      })[0];
    
    if (anyNonM3U8Track) {
      logVerboseRenderer('Selected fallback audio track:', {
        language: anyNonM3U8Track.language,
        mimeType: anyNonM3U8Track.mimeType,
        bitrate: anyNonM3U8Track.bitrate
      });
      return anyNonM3U8Track;
    }

    // Last resort: any
    const lastResortTrack = audioTracks
      .sort((a, b) => {
        // First sort by mimeType (prefer m4a over webm)
        if (a.mimeType === 'm4a' && b.mimeType !== 'm4a') return -1;
        if (a.mimeType !== 'm4a' && b.mimeType === 'm4a') return 1;
        // Then by bitrate
        return (b.bitrate || 0) - (a.bitrate || 0);
      })[0];
    
    logVerboseRenderer('Selected last resort audio track:', {
      language: lastResortTrack.language,
      mimeType: lastResortTrack.mimeType,
      bitrate: lastResortTrack.bitrate
    });
    return lastResortTrack;
  }

  // Helper to get highest quality stream details
  static getHighestQualityStream(
    videoStreams: VideoStream[], 
    audioTracks: AudioTrack[], 
    preferredLanguages: string[] = ['en'],
    maxQuality?: string
  ): {
    videoUrl: string;
    audioUrl?: string;
    quality: string;
    resolution: string;
    fps?: number;
    audioLanguage?: string;
  } {
    logVerboseRenderer('getHighestQualityStream called with:', {
      videoStreamsCount: videoStreams.length,
      audioTracksCount: audioTracks.length,
      preferredLanguages,
      maxQuality
    });

    // Parse max quality to height limit
    const maxHeight = maxQuality ? this.parseMaxQuality(maxQuality) : undefined;
    logVerboseRenderer('Max height limit:', maxHeight);

    // Filter streams by max quality if specified
    const filteredVideoStreams = maxHeight 
      ? videoStreams.filter(s => (s.height || 0) <= maxHeight)
      : videoStreams;

    logVerboseRenderer('Filtered video streams count:', filteredVideoStreams.length);

    // First try to find a combined format with high quality
    const combinedFormats = filteredVideoStreams
      .filter(s => s.mimeType.includes('mp4') && !YouTubeAPI.isM3U8(s.url) && s.mimeType.includes('audio')) // Must be mp4 and have audio
      .sort((a, b) => {
        // Sort by resolution first
        const heightDiff = (b.height || 0) - (a.height || 0);
        if (heightDiff !== 0) return heightDiff;
        // Then by FPS
        return (b.fps || 0) - (a.fps || 0);
      });

    logVerboseRenderer('Combined formats found:', combinedFormats.length);

    if (combinedFormats.length > 0) {
      const best = combinedFormats[0];
      logVerboseRenderer('Selected combined format:', {
        quality: best.quality,
        resolution: `${best.width || 0}x${best.height || 0}`,
        fps: best.fps
      });
      return {
        videoUrl: best.url,
        quality: best.quality,
        resolution: `${best.width || 0}x${best.height || 0}`,
        fps: best.fps,
      };
    }

    // If no combined format, get highest quality video and audio separately
    const videoFormats = filteredVideoStreams
      .filter(s => !YouTubeAPI.isM3U8(s.url)) // Only filter out m3u8
      .sort((a, b) => {
        // Sort by resolution first
        const heightDiff = (b.height || 0) - (a.height || 0);
        if (heightDiff !== 0) return heightDiff;
        // Then by FPS
        return (b.fps || 0) - (a.fps || 0);
      });
    
    if (videoFormats.length > 0) {
      const bestVideo = videoFormats[0];
      const bestAudio = this.getBestAudioTrackByLanguage(audioTracks, preferredLanguages);
      
      logVerboseRenderer('Selected separate video/audio format:', {
        videoQuality: bestVideo.quality,
        videoResolution: `${bestVideo.width || 0}x${bestVideo.height || 0}`,
        videoFps: bestVideo.fps,
        audioLanguage: bestAudio.language
      });

      return {
        videoUrl: bestVideo.url,
        audioUrl: bestAudio.url,
        quality: bestVideo.quality,
        resolution: `${bestVideo.width || 0}x${bestVideo.height || 0}`,
        fps: bestVideo.fps,
        audioLanguage: bestAudio.language,
      };
    }

    // Last resort: use any format including M3U8
    const lastResortVideoFormats = filteredVideoStreams
      .sort((a, b) => {
        // Sort by resolution first
        const heightDiff = (b.height || 0) - (a.height || 0);
        if (heightDiff !== 0) return heightDiff;
        // Then by FPS
        return (b.fps || 0) - (a.fps || 0);
      });
    
    if (lastResortVideoFormats.length > 0) {
      const bestVideo = lastResortVideoFormats[0];
      let bestAudio: AudioTrack;
      
      try {
        bestAudio = this.getBestAudioTrackByLanguage(audioTracks, preferredLanguages);
      } catch (error) {
        // If no audio tracks available, use the first one
        if (audioTracks.length > 0) {
          bestAudio = audioTracks[0];
        } else {
          // No audio tracks at all
          logVerboseRenderer('No audio tracks available, using video-only format');
          return {
            videoUrl: bestVideo.url,
            quality: bestVideo.quality,
            resolution: `${bestVideo.width || 0}x${bestVideo.height || 0}`,
            fps: bestVideo.fps,
          };
        }
      }
      
      logVerboseRenderer('Selected last resort format:', {
        videoQuality: bestVideo.quality,
        videoResolution: `${bestVideo.width || 0}x${bestVideo.height || 0}`,
        videoFps: bestVideo.fps,
        audioLanguage: bestAudio.language
      });

      return {
        videoUrl: bestVideo.url,
        audioUrl: bestAudio.url,
        quality: bestVideo.quality,
        resolution: `${bestVideo.width || 0}x${bestVideo.height || 0}`,
        fps: bestVideo.fps,
        audioLanguage: bestAudio.language,
      };
    }

    throw new Error('No suitable stream found');
  }

  // Helper function to parse quality string to max height
  private static parseMaxQuality(maxQuality: string): number {
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

export { YouTubeAPI }; 