import { describe, it, expect } from 'vitest';
import videos from '../data/videos.json';
import { YouTubeAPI } from './youtube';
import fs from 'fs';
import path from 'path';

// Set to true to save debug info
const DEBUG_MODE = true;

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
  // Helper function to check if a URL is accessible
  async function checkUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error(`Error checking URL ${url}:`, error);
      return false;
    }
  }

  // Helper function to save debug info
  async function saveDebugInfo(debugInfo: DebugStreamInfo) {
    if (!DEBUG_MODE) return;

    const debugFile = path.join(process.cwd(), 'logs', 'video-urls.debug.json');
    let existingData: DebugStreamInfo[] = [];
    
    try {
      if (fs.existsSync(debugFile)) {
        const content = fs.readFileSync(debugFile, 'utf-8');
        existingData = JSON.parse(content);
      }
    } catch (error) {
      console.error('Error reading debug file:', error);
    }

    const index = existingData.findIndex(item => item.videoId === debugInfo.videoId);
    if (index >= 0) {
      existingData[index] = debugInfo;
    } else {
      existingData.push(debugInfo);
    }

    fs.writeFileSync(debugFile, JSON.stringify(existingData, null, 2));
  }

  // Test YouTube video streams
  describe('YouTube Videos', () => {
    const youtubeVideos = videos.filter(v => v.type === 'youtube');

    youtubeVideos.forEach(video => {
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
            console.log(`Video stream URL for ${video.title} is expired`);
            hasValidUrls = false;
          }
        }

        if (video.audioStreamUrl) {
          const isAudioUrlValid = await checkUrl(video.audioStreamUrl);
          if (!isAudioUrlValid) {
            console.log(`Audio stream URL for ${video.title} is expired`);
            hasValidUrls = false;
          }
        }

        // If URLs are expired, try to fetch new ones
        if (!hasValidUrls) {
        //   console.log(`Fetching new stream URLs for ${video.title}`);
          try {
            const { videoStreams, audioTracks } = await YouTubeAPI.getVideoStreams(videoId);
            debugInfo.availableStreams = { videoStreams, audioTracks };

            const preferredLanguages = video.preferredLanguages || ['en'];
            const streamInfo = YouTubeAPI.getHighestQualityStream(videoStreams, audioTracks, preferredLanguages);
            debugInfo.selectedStreams = streamInfo;

            // Check if new URLs are accessible
            if (streamInfo.videoUrl) {
              const isNewVideoUrlValid = await checkUrl(streamInfo.videoUrl);
              expect(isNewVideoUrlValid, `New video stream URL for ${video.title} is not accessible`).toBe(true);
            }

            if (streamInfo.audioUrl) {
              const isNewAudioUrlValid = await checkUrl(streamInfo.audioUrl);
              expect(isNewAudioUrlValid, `New audio stream URL for ${video.title} is not accessible`).toBe(true);
            }

            // Log the new URLs for updating videos.json
            // console.log('New URLs for', video.title);
            // console.log('Video URL:', streamInfo.videoUrl);
            // console.log('Audio URL:', streamInfo.audioUrl);
          } catch (error) {
            console.error(`Error fetching new URLs for ${video.title}:`, error);
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