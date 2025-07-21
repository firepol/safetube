import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import videos from '../data/videos.json';
import { CachedYouTubeAPI as YouTubeAPI } from './__tests__/cached-youtube';
import { testCache } from './__tests__/test-cache';
import fs from 'fs';
import path from 'path';
import { logVerboseRenderer } from '@/shared/logging';

// Set to true to save debug info
const DEBUG_MODE = true;

// Skip YouTube integration tests in CI environment
// These tests require real YouTube API access and yt-dlp, which are unreliable in CI
const youtubeTestRunner = process.env.CI ? describe.skip : describe;

interface DebugStreamInfo {
  videoId: string;
  title: string;
  originalUrls?: {
    videoUrl?: string;
    audioUrl?: string;
  };
  availableStreams: {
    videoStreams: Array<{
      url: string;
      quality: string;
      mimeType: string;
      width?: number;
      height?: number;
      fps?: number;
      bitrate?: number;
    }>;
    audioTracks: Array<{
      url: string;
      language: string;
      mimeType: string;
      bitrate?: number;
    }>;
  };
  selectedStreams?: {
    videoUrl: string;
    audioUrl?: string;
    quality: string;
    resolution?: string;
    fps?: number;
    audioLanguage?: string;
  };
}

describe('Video Stream URLs Integration Tests', () => {
  beforeAll(() => {
    logVerboseRenderer('Starting video URLs integration tests with caching enabled');
  });

  afterAll(() => {
    const stats = testCache.getCacheStats();
    logVerboseRenderer(`Test cache stats: ${stats.streams} streams, ${stats.details} details cached`);
    testCache.debugCache();
  });

  // Helper function to check if a URL is accessible
  async function checkUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Helper function to save debug info
  async function saveDebugInfo(debugInfo: DebugStreamInfo) {
    if (!DEBUG_MODE) return;

    const debugFile = path.join(process.cwd(), 'logs', 'video-urls.debug.json');
    let existingData: DebugStreamInfo[] = [];
    
    try {
      // Ensure logs directory exists
      const logsDir = path.dirname(debugFile);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      if (fs.existsSync(debugFile)) {
        const content = fs.readFileSync(debugFile, 'utf-8');
        existingData = JSON.parse(content);
      }
    } catch (error) {
      // If we can't create the directory or read the file, just skip saving debug info
      return;
    }

    const index = existingData.findIndex(item => item.videoId === debugInfo.videoId);
    if (index >= 0) {
      existingData[index] = debugInfo;
    } else {
      existingData.push(debugInfo);
    }

    try {
      fs.writeFileSync(debugFile, JSON.stringify(existingData, null, 2));
    } catch (error) {
      // If we can't write the file, just skip saving debug info
    }
  }

  // Test YouTube video streams
  youtubeTestRunner('YouTube Videos', () => {
    // Filter out duplicate videos by extracting unique YouTube IDs
    const uniqueYoutubeVideos = videos
      .filter(v => v.type === 'youtube')
      .reduce((acc, video) => {
        const videoId = video.url.split('v=')[1];
        // Only add if we haven't seen this video ID before
        if (!acc.some(v => v.url.split('v=')[1] === videoId)) {
          acc.push(video);
        }
        return acc;
      }, [] as typeof videos);

    uniqueYoutubeVideos.forEach(video => {
      it(`should have valid stream URLs for ${video.title}`, async () => {
        const videoId = video.url.split('v=')[1];
        let hasValidUrls = true;
        const debugInfo: DebugStreamInfo = {
          videoId,
          title: video.title,
          originalUrls: {
            videoUrl: video.streamUrl,
            audioUrl: video.audioStreamUrl
          },
          availableStreams: {
            videoStreams: [],
            audioTracks: []
          }
        };

        // Check existing URLs if present
        if (video.streamUrl) {
          const isVideoUrlValid = await checkUrl(video.streamUrl);
          if (!isVideoUrlValid) {
            hasValidUrls = false;
          }
        }

        if (video.audioStreamUrl) {
          const isAudioUrlValid = await checkUrl(video.audioStreamUrl);
          if (!isAudioUrlValid) {
            hasValidUrls = false;
          }
        }

        // If URLs are expired, try to fetch new ones
        if (!hasValidUrls) {
          try {
            const { videoStreams, audioTracks } = await YouTubeAPI.getVideoStreams(videoId);
            debugInfo.availableStreams = { videoStreams, audioTracks };

            const preferredLanguages = video.preferredLanguages || ['en'];
            const streamInfo = YouTubeAPI.getHighestQualityStream(videoStreams, audioTracks, preferredLanguages);
            debugInfo.selectedStreams = streamInfo;

            // Check if new URLs are accessible
            if (streamInfo.videoUrl) {
              const isNewVideoUrlValid = await checkUrl(streamInfo.videoUrl);
              expect(isNewVideoUrlValid).toBe(true);
            }

            if (streamInfo.audioUrl) {
              const isNewAudioUrlValid = await checkUrl(streamInfo.audioUrl);
              expect(isNewAudioUrlValid).toBe(true);
            }
          } catch (error) {
            throw error;
          }
        }

        await saveDebugInfo(debugInfo);
      }, 30000); // 30 second timeout for each test
    });
  });

  // Test local video files
  describe('Local Videos', () => {
    const localVideos = videos.filter(v => v.type === 'local');

    localVideos.forEach(video => {
      it(`should have valid file path for ${video.title}`, () => {
        expect(video.url).toBeDefined();
        expect(video.url.startsWith('file://')).toBe(true);
      });
    });
  });

  // Test DLNA video URLs
  describe('DLNA Videos', () => {
    const dlnaVideos = videos.filter(v => v.type === 'dlna');

    dlnaVideos.forEach(video => {
      it(`should have valid DLNA URL for ${video.title}`, () => {
        expect(video.url).toBeDefined();
        expect(video.url.startsWith('http://')).toBe(true);
        expect(video.server).toBeDefined();
        expect(video.port).toBeDefined();
        expect(video.path).toBeDefined();
      });
    });
  });
}); 