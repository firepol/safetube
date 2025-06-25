import { YouTubeAPI } from '../youtube';
import { testCache } from './test-cache';

export class CachedYouTubeAPI {
  static async getVideoDetails(videoId: string): Promise<any> {
    // Check cache first
    const cached = testCache.getVideoDetails(videoId);
    if (cached) {
      console.log(`[CACHE] Using cached video details for ${videoId}`);
      return cached;
    }

    // Fetch from API and cache
    console.log(`[CACHE] Fetching video details for ${videoId}`);
    const details = await YouTubeAPI.getVideoDetails(videoId);
    testCache.setVideoDetails(videoId, details);
    return details;
  }

  static async getVideoStreams(videoId: string): Promise<{ videoStreams: any[]; audioTracks: any[] }> {
    // Check cache first
    const cached = testCache.getVideoStreams(videoId);
    if (cached) {
      console.log(`[CACHE] Using cached video streams for ${videoId}`);
      return cached;
    }

    // Fetch from API and cache
    console.log(`[CACHE] Fetching video streams for ${videoId}`);
    const result = await YouTubeAPI.getVideoStreams(videoId);
    testCache.setVideoStreams(videoId, result.videoStreams, result.audioTracks);
    return result;
  }

  // Delegate other methods to the original YouTubeAPI
  static getBestStreamUrl = YouTubeAPI.getBestStreamUrl;
  static getHighestQualityStream = YouTubeAPI.getHighestQualityStream;
  static getBestAudioTrackByLanguage = YouTubeAPI.getBestAudioTrackByLanguage;
  static getPlaylistVideos = YouTubeAPI.getPlaylistVideos;
  static getChannelVideos = YouTubeAPI.getChannelVideos;
  static getChannelDetails = YouTubeAPI.getChannelDetails;
  static parseDuration = YouTubeAPI.parseDuration;
} 