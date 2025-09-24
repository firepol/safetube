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
  private static readonly VALIDATION_TIMEOUT = 3000; // 3 seconds

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
    try {
      // Check cache first
      const cacheKey = `${sourceId}:${sourceType}`;
      if (this.sourceCache.has(cacheKey)) {
        return this.sourceCache.get(cacheKey)!;
      }

      // Load current approved sources with timeout
      const sources = await this.withTimeout(
        this.getSources(),
        this.VALIDATION_TIMEOUT,
        'Source validation timeout'
      );

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
    } catch (error) {
      // Log error with context
      console.error(`Source validation failed for video ${videoId}:`, {
        sourceId,
        sourceType,
        error: error instanceof Error ? error.message : String(error)
      });

      // Fail-open: default to available on error to avoid blocking valid content
      // This is a UX decision - better to occasionally allow invalid content than block valid content
      return true;
    }
  }

  /**
   * Validates if a YouTube video's channel is in approved channels
   * @param channelId - The YouTube channel ID
   * @returns true if channel is approved, false otherwise
   */
  static async isChannelApproved(channelId: string): Promise<boolean> {
    try {
      // Check channel cache
      if (this.channelCache.has(channelId)) {
        return this.channelCache.get(channelId)!.length > 0;
      }

      // Load current approved sources with timeout
      const sources = await this.withTimeout(
        this.getSources(),
        this.VALIDATION_TIMEOUT,
        'Channel approval check timeout'
      );

      // Find channel sources that match this channelId
      const approvedSources = sources
        .filter(s => s.type === 'youtube_channel' && (s as any).channelId === channelId)
        .map(s => s.id);

      // Cache result
      this.channelCache.set(channelId, approvedSources);

      return approvedSources.length > 0;
    } catch (error) {
      // Log error with context
      console.error(`Channel approval check failed for channel ${channelId}:`, {
        error: error instanceof Error ? error.message : String(error)
      });

      // Fail-closed: default to not approved on error for channel validation
      // This is more secure as we don't know if the channel should be allowed
      return false;
    }
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

    try {
      // Load sources once with timeout
      const sources = await this.withTimeout(
        this.getSources(),
        this.VALIDATION_TIMEOUT,
        'Batch validation timeout'
      );
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
    } catch (error) {
      // Log error with context
      console.error('Batch validation failed:', {
        videoCount: videos.length,
        error: error instanceof Error ? error.message : String(error)
      });

      // Fail-open for batch validation: mark all as valid on error
      // This prevents blocking the entire UI when validation fails
      for (const video of videos) {
        results.set(video.videoId, true);
      }

      return results;
    }
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

    try {
      // Fetch fresh sources
      const sources = await window.electron.videoSourcesGetAll();
      this.sourcesCache = sources;
      this.sourcesCacheTime = now;

      return sources;
    } catch (error) {
      // If we have stale cache, return it rather than failing completely
      if (this.sourcesCache) {
        console.warn('Failed to fetch sources, using stale cache:', {
          error: error instanceof Error ? error.message : String(error),
          cacheAge: now - this.sourcesCacheTime
        });
        return this.sourcesCache;
      }

      // No cache available, re-throw error
      throw error;
    }
  }

  /**
   * Wraps a promise with a timeout
   * @private
   */
  private static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(errorMessage));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }
}