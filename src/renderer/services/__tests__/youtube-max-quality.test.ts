import { YouTubeAPI, VideoStream, AudioTrack } from '../youtube';

describe('YouTubeAPI - Max Quality Filtering', () => {
  const mockVideoStreams: VideoStream[] = [
    {
      url: 'https://example.com/video1.mp4',
      quality: '144p',
      mimeType: 'video/mp4',
      width: 256,
      height: 144,
      fps: 25,
      bitrate: 100
    },
    {
      url: 'https://example.com/video2.mp4',
      quality: '720p',
      mimeType: 'video/mp4',
      width: 1280,
      height: 720,
      fps: 30,
      bitrate: 1500
    },
    {
      url: 'https://example.com/video3.mp4',
      quality: '1080p',
      mimeType: 'video/mp4',
      width: 1920,
      height: 1080,
      fps: 30,
      bitrate: 3000
    },
    {
      url: 'https://example.com/video4.mp4',
      quality: '4k',
      mimeType: 'video/mp4',
      width: 3840,
      height: 2160,
      fps: 30,
      bitrate: 8000
    }
  ];

  const mockAudioTracks: AudioTrack[] = [
    {
      url: 'https://example.com/audio1.m4a',
      language: 'en',
      mimeType: 'audio/m4a',
      bitrate: 128
    }
  ];

  describe('getHighestQualityStream with maxQuality', () => {
    it('should filter out streams above max quality', () => {
      const result = YouTubeAPI.getHighestQualityStream(
        mockVideoStreams,
        mockAudioTracks,
        ['en'],
        '720p'
      );

      // Should select 720p (highest quality within limit)
      expect(result.quality).toBe('720p');
      expect(result.resolution).toBe('1280x720');
    });

    it('should allow 1080p when max quality is 1080p', () => {
      const result = YouTubeAPI.getHighestQualityStream(
        mockVideoStreams,
        mockAudioTracks,
        ['en'],
        '1080p'
      );

      // Should select 1080p (highest quality within limit)
      expect(result.quality).toBe('1080p');
      expect(result.resolution).toBe('1920x1080');
    });

    it('should allow 4k when max quality is 4k', () => {
      const result = YouTubeAPI.getHighestQualityStream(
        mockVideoStreams,
        mockAudioTracks,
        ['en'],
        '4k'
      );

      // Should select 4k (highest quality within limit)
      expect(result.quality).toBe('4k');
      expect(result.resolution).toBe('3840x2160');
    });

    it('should fallback to lower quality when max quality is very low', () => {
      const result = YouTubeAPI.getHighestQualityStream(
        mockVideoStreams,
        mockAudioTracks,
        ['en'],
        '240p'
      );

      // Should select 144p (highest available within 240p limit)
      expect(result.quality).toBe('144p');
      expect(result.resolution).toBe('256x144');
    });

    it('should work without max quality limit (select highest available)', () => {
      const result = YouTubeAPI.getHighestQualityStream(
        mockVideoStreams,
        mockAudioTracks,
        ['en']
        // No maxQuality parameter
      );

      // Should select 4k (highest available)
      expect(result.quality).toBe('4k');
      expect(result.resolution).toBe('3840x2160');
    });

    it('should handle unknown quality strings gracefully', () => {
      const result = YouTubeAPI.getHighestQualityStream(
        mockVideoStreams,
        mockAudioTracks,
        ['en'],
        'unknown'
      );

      // Should fallback to default (1080p) and select 1080p
      expect(result.quality).toBe('1080p');
      expect(result.resolution).toBe('1920x1080');
    });
  });
}); 