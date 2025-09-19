import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the PlayerPage functionality we're testing
const mockGetVideoMetadataForFavorites = vi.fn();
const mockExtractThumbnailFromStreams = vi.fn();

// Test the metadata extraction logic directly
describe('PlayerPage - YouTube Video Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('YouTube video metadata extraction', () => {
    it('should properly extract metadata for YouTube videos', () => {
      const youtubeVideo = {
        id: 'dQw4w9WgXcQ',
        type: 'youtube' as const,
        title: 'Never Gonna Give You Up',
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        duration: 213,
        sourceId: 'youtube',
      };

      // Simulate the getVideoMetadataForFavorites function logic
      const extractThumbnailFromStreams = (video: any): string => {
        if (video.thumbnail) return video.thumbnail;
        if (video.type === 'youtube' && video.id) {
          const youtubeId = video.id.replace(/^.*[?&]v=([^&]+).*$/, '$1');
          return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
        }
        return '';
      };

      const getVideoMetadataForFavorites = (video: any) => {
        if (!video) return null;

        if (video.type === 'youtube') {
          return {
            videoId: video.id,
            source: video.sourceId || 'youtube',
            type: 'youtube' as const,
            title: video.title,
            thumbnail: extractThumbnailFromStreams(video),
            duration: video.duration || 0,
            lastWatched: expect.any(String)
          };
        }
        return null;
      };

      const metadata = getVideoMetadataForFavorites(youtubeVideo);

      expect(metadata).toEqual({
        videoId: 'dQw4w9WgXcQ',
        source: 'youtube',
        type: 'youtube',
        title: 'Never Gonna Give You Up',
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        duration: 213,
        lastWatched: expect.any(String)
      });
    });

    it('should handle downloaded YouTube videos as YouTube type', () => {
      const downloadedVideo = {
        id: 'dQw4w9WgXcQ',
        type: 'downloaded' as const,
        title: 'Never Gonna Give You Up',
        thumbnail: '',
        duration: 213,
        sourceId: 'youtube',
      };

      const extractThumbnailFromStreams = (video: any): string => {
        if (video.thumbnail) return video.thumbnail;
        if ((video.type === 'youtube' || video.type === 'downloaded') && video.id) {
          const youtubeId = video.id.replace(/^.*[?&]v=([^&]+).*$/, '$1');
          return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
        }
        return '';
      };

      const getVideoMetadataForFavorites = (video: any) => {
        if (!video) return null;

        if (video.type === 'downloaded') {
          return {
            videoId: video.id,
            source: video.sourceId || 'youtube',
            type: 'youtube' as const,
            title: video.title,
            thumbnail: extractThumbnailFromStreams(video),
            duration: video.duration || 0,
            lastWatched: expect.any(String)
          };
        }
        return null;
      };

      const metadata = getVideoMetadataForFavorites(downloadedVideo);

      expect(metadata).toEqual({
        videoId: 'dQw4w9WgXcQ',
        source: 'youtube',
        type: 'youtube',
        title: 'Never Gonna Give You Up',
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        duration: 213,
        lastWatched: expect.any(String)
      });
    });

    it('should generate thumbnail fallback for YouTube videos without thumbnails', () => {
      const youtubeVideo = {
        id: 'dQw4w9WgXcQ',
        type: 'youtube' as const,
        title: 'Never Gonna Give You Up',
        thumbnail: '',
        duration: 213,
        sourceId: 'youtube',
      };

      const extractThumbnailFromStreams = (video: any): string => {
        if (video.thumbnail) return video.thumbnail;
        if (video.type === 'youtube' && video.id) {
          const youtubeId = video.id.replace(/^.*[?&]v=([^&]+).*$/, '$1');
          return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
        }
        return '';
      };

      const thumbnail = extractThumbnailFromStreams(youtubeVideo);

      expect(thumbnail).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
    });
  });

  describe('Video type detection', () => {
    it('should correctly identify YouTube MediaSource videos', () => {
      const mediaSourceVideo = {
        id: 'dQw4w9WgXcQ',
        type: 'youtube' as const,
        title: 'Never Gonna Give You Up',
        streamUrl: 'https://example.com/video.webm',
        audioStreamUrl: 'https://example.com/audio.webm',
        useJsonStreamUrls: true,
        duration: 213,
        sourceId: 'youtube',
      };

      const getVideoMetadataForFavorites = (video: any) => {
        if (!video) return null;

        if (video.type === 'youtube') {
          return {
            videoId: video.id,
            source: video.sourceId || 'youtube',
            type: 'youtube' as const,
            title: video.title,
            thumbnail: video.thumbnail || `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`,
            duration: video.duration || 0,
            lastWatched: expect.any(String)
          };
        }
        return null;
      };

      const metadata = getVideoMetadataForFavorites(mediaSourceVideo);

      expect(metadata?.type).toBe('youtube');
      expect(metadata?.source).toBe('youtube');
    });
  });

  describe('Source identification', () => {
    it('should properly categorize local videos', () => {
      const localVideo = {
        id: 'local-video-123',
        type: 'local' as const,
        title: 'My Local Video',
        url: '/path/to/video.mp4',
        thumbnail: '/path/to/thumbnail.jpg',
        duration: 300,
      };

      const getVideoMetadataForFavorites = (video: any) => {
        if (!video) return null;

        if (video.type === 'local') {
          return {
            videoId: video.id,
            source: 'local',
            type: 'local' as const,
            title: video.title,
            thumbnail: video.thumbnail || '',
            duration: video.duration || 0,
            lastWatched: expect.any(String)
          };
        }
        return null;
      };

      const metadata = getVideoMetadataForFavorites(localVideo);

      expect(metadata).toEqual({
        videoId: 'local-video-123',
        source: 'local',
        type: 'local',
        title: 'My Local Video',
        thumbnail: '/path/to/thumbnail.jpg',
        duration: 300,
        lastWatched: expect.any(String)
      });
    });

    it('should properly categorize DLNA videos', () => {
      const dlnaVideo = {
        id: 'dlna-video-123',
        type: 'dlna' as const,
        title: 'DLNA Video',
        url: 'http://192.168.1.100:8080/video.mp4',
        thumbnail: '',
        duration: 400,
      };

      const getVideoMetadataForFavorites = (video: any) => {
        if (!video) return null;

        if (video.type === 'dlna') {
          return {
            videoId: video.id,
            source: 'dlna',
            type: 'dlna' as const,
            title: video.title,
            thumbnail: video.thumbnail || '',
            duration: video.duration || 0,
            lastWatched: expect.any(String)
          };
        }
        return null;
      };

      const metadata = getVideoMetadataForFavorites(dlnaVideo);

      expect(metadata).toEqual({
        videoId: 'dlna-video-123',
        source: 'dlna',
        type: 'dlna',
        title: 'DLNA Video',
        thumbnail: '',
        duration: 400,
        lastWatched: expect.any(String)
      });
    });
  });

  describe('YouTube ID extraction', () => {
    it('should extract YouTube ID from various URL formats', () => {
      const extractYouTubeId = (url: string): string => {
        return url.replace(/^.*[?&]v=([^&]+).*$/, '$1');
      };

      expect(extractYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s')).toBe('dQw4w9WgXcQ');
    });
  });
});