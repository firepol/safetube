import { VideoSource, VideoSourceType } from '../../shared/types';

/**
 * Service for validating video source availability and channel approvals.
 * Implements caching to optimize performance when validating multiple videos.
 */
export class SourceValidationService {
  private static sourceCache: Map<string, boolean> = new Map();
  private static channelCache: Map<string, string[]> = new Map(); // channelId -> [sourceIds]
  private static sourcesCache: VideoSource[] | null = null;
  private static sourcesCacheTime: number = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Validates if a video's source is still approved
   * @param videoId - The video identifier
   * @param sourceId - The source identifier from favorites/history
   * @param sourceType - Type of source (youtube, local, etc.)
   * @returns true if video is accessible, false otherwise
   */
  static async isVideoSourceValid(
    videoId: string,
    sourceId: string,
    sourceType: 'youtube' | 'local' | 'dlna' | 'downloaded' | 'youtube_playlist'
  ): Promise<boolean> {
    // Check cache first
    const cacheKey = `${sourceId}:${sourceType}`;
    if (this.sourceCache.has(cacheKey)) {
      return this.sourceCache.get(cacheKey)!;
    }

    // Load current approved sources
    const sources = await this.getSources();

    // Validate based on source type
    let isValid = false;

    if (sourceType === 'youtube_playlist') {
      // Playlists: just check if source exists
      isValid = sources.some(s => s.id === sourceId && s.type === 'youtube_playlist');
    } else if (sourceType === 'youtube') {
      // YouTube videos: check if source exists
      isValid = sources.some(s => s.id === sourceId && s.type === 'youtube_channel');
    } else if (sourceType === 'local') {
      // Local videos: check if source exists
      isValid = sources.some(s => s.id === sourceId && s.type === 'local');
    } else if (sourceType === 'downloaded') {
      // Downloaded videos are always valid (they're local files)
      isValid = true;
    }

    // Cache result
    this.sourceCache.set(cacheKey, isValid);

    return isValid;
  }

  /**
   * Validates if a YouTube video's channel is in approved channels
   * @param channelId - The YouTube channel ID
   * @returns true if channel is approved, false otherwise
   */
  static async isChannelApproved(channelId: string): Promise<boolean> {
    // Check channel cache
    if (this.channelCache.has(channelId)) {
      return this.channelCache.get(channelId)!.length > 0;
    }

    // Load current approved sources
    const sources = await this.getSources();

    // Find channel sources that match this channelId
    const approvedSources = sources
      .filter(s => s.type === 'youtube_channel' && (s as any).channelId === channelId)
      .map(s => s.id);

    // Cache result
    this.channelCache.set(channelId, approvedSources);

    return approvedSources.length > 0;
  }

  /**
   * Fetches video metadata to get channel ID
   * @param videoId - YouTube video ID
   * @returns Channel ID or null if not found
   */
  static async getVideoChannelId(videoId: string): Promise<string | null> {
    try {
      // Check if IPC method exists (will be added in Phase 8)
      if (typeof (window.electron as any).getYouTubeVideoInfo === 'function') {
        const videoInfo = await (window.electron as any).getYouTubeVideoInfo(videoId);
        return videoInfo.channelId || null;
      }

      console.warn('getYouTubeVideoInfo IPC method not yet implemented');
      return null;
    } catch (error) {
      console.error(`Failed to fetch channel ID for video ${videoId}:`, error);
      return null;
    }
  }

  /**
   * Clears validation cache (call when sources change)
   */
  static clearCache(): void {
    this.sourceCache.clear();
    this.channelCache.clear();
    this.sourcesCache = null;
    this.sourcesCacheTime = 0;
  }

  /**
   * Batch validate multiple videos for performance
   * @param videos - Array of videos to validate
   * @returns Map of videoId -> isValid
   */
  static async batchValidateVideos(
    videos: Array<{ videoId: string; sourceId: string; sourceType: string }>
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    // Load sources once
    const sources = await this.getSources();
    const sourceIds = new Set(sources.map(s => s.id));

    // Validate each video
    for (const video of videos) {
      let isValid = false;

      if (video.sourceType === 'downloaded') {
        // Downloaded videos are always valid
        isValid = true;
      } else {
        isValid = sourceIds.has(video.sourceId);
      }

      results.set(video.videoId, isValid);

      // Also cache individual results
      const cacheKey = `${video.sourceId}:${video.sourceType}`;
      this.sourceCache.set(cacheKey, isValid);
    }

    return results;
  }

  /**
   * Gets video sources with caching
   * @private
   */
  private static async getSources(): Promise<VideoSource[]> {
    const now = Date.now();

    // Return cached sources if still valid
    if (this.sourcesCache && (now - this.sourcesCacheTime) < this.CACHE_DURATION) {
      return this.sourcesCache;
    }

    // Fetch fresh sources
    const sources = await window.electron.videoSourcesGetAll();
    this.sourcesCache = sources;
    this.sourcesCacheTime = now;

    return sources;
  }
}