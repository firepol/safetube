import { SourceValidationService } from '../sourceValidationService';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { VideoSource } from '../../../shared/types';

// Mock video sources for testing
const mockSources: VideoSource[] = [
  {
    id: 'youtube-channel-1',
    type: 'youtube_channel',
    url: 'https://www.youtube.com/channel/UC123',
    title: 'Test Channel 1',
    channelId: 'UC123'
  },
  {
    id: 'youtube-channel-2',
    type: 'youtube_channel',
    url: 'https://www.youtube.com/channel/UC456',
    title: 'Test Channel 2',
    channelId: 'UC456'
  },
  {
    id: 'youtube-playlist-1',
    type: 'youtube_playlist',
    url: 'https://www.youtube.com/playlist?list=PL123',
    title: 'Test Playlist'
  },
  {
    id: 'local-folder-1',
    type: 'local',
    path: '/home/user/videos',
    title: 'Local Videos'
  }
];

// Mock window.electron for tests
beforeAll(() => {
  Object.defineProperty(window, 'electron', {
    value: {
      videoSourcesGetAll: vi.fn().mockResolvedValue(mockSources)
    },
    writable: true
  });
});

describe('SourceValidationService', () => {
  beforeEach(() => {
    // Clear cache before each test
    SourceValidationService.clearCache();
    vi.clearAllMocks();
  });

  describe('isVideoSourceValid', () => {
    it('should validate YouTube channel videos with existing source', async () => {
      const isValid = await SourceValidationService.isVideoSourceValid(
        'video123',
        'youtube-channel-1',
        'youtube'
      );

      expect(isValid).toBe(true);
    });

    it('should invalidate YouTube channel videos with deleted source', async () => {
      const isValid = await SourceValidationService.isVideoSourceValid(
        'video123',
        'deleted-channel',
        'youtube'
      );

      expect(isValid).toBe(false);
    });

    it('should validate YouTube playlist videos with existing source', async () => {
      const isValid = await SourceValidationService.isVideoSourceValid(
        'video123',
        'youtube-playlist-1',
        'youtube_playlist'
      );

      expect(isValid).toBe(true);
    });

    it('should invalidate YouTube playlist videos with deleted source', async () => {
      const isValid = await SourceValidationService.isVideoSourceValid(
        'video123',
        'deleted-playlist',
        'youtube_playlist'
      );

      expect(isValid).toBe(false);
    });

    it('should validate local videos with existing source', async () => {
      const isValid = await SourceValidationService.isVideoSourceValid(
        'local-video-1',
        'local-folder-1',
        'local'
      );

      expect(isValid).toBe(true);
    });

    it('should invalidate local videos with deleted source', async () => {
      const isValid = await SourceValidationService.isVideoSourceValid(
        'local-video-1',
        'deleted-folder',
        'local'
      );

      expect(isValid).toBe(false);
    });

    it('should always validate downloaded videos', async () => {
      const isValid = await SourceValidationService.isVideoSourceValid(
        'downloaded-video-1',
        'any-source-id',
        'downloaded'
      );

      expect(isValid).toBe(true);
    });

    it('should cache validation results', async () => {
      // First call
      await SourceValidationService.isVideoSourceValid(
        'video123',
        'youtube-channel-1',
        'youtube'
      );

      // Second call - should use cache
      await SourceValidationService.isVideoSourceValid(
        'video123',
        'youtube-channel-1',
        'youtube'
      );

      // Should only call IPC once due to caching
      expect(window.electron.videoSourcesGetAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('isChannelApproved', () => {
    it('should approve videos from approved channels', async () => {
      const isApproved = await SourceValidationService.isChannelApproved('UC123');

      expect(isApproved).toBe(true);
    });

    it('should reject videos from unapproved channels', async () => {
      const isApproved = await SourceValidationService.isChannelApproved('UC999');

      expect(isApproved).toBe(false);
    });

    it('should cache channel approval results', async () => {
      // First call
      await SourceValidationService.isChannelApproved('UC123');

      // Second call - should use cache
      await SourceValidationService.isChannelApproved('UC123');

      // Should only call IPC once due to caching
      expect(window.electron.videoSourcesGetAll).toHaveBeenCalledTimes(1);
    });

    it('should handle channels without channelId', async () => {
      const sourcesWithoutChannelId: VideoSource[] = [
        {
          id: 'youtube-channel-no-id',
          type: 'youtube_channel',
          url: 'https://www.youtube.com/channel/UC789',
          title: 'Test Channel Without ID'
        }
      ];

      (window.electron.videoSourcesGetAll as any).mockResolvedValueOnce(sourcesWithoutChannelId);
      SourceValidationService.clearCache();

      const isApproved = await SourceValidationService.isChannelApproved('UC789');

      expect(isApproved).toBe(false);
    });
  });

  describe('batchValidateVideos', () => {
    it('should validate multiple videos efficiently', async () => {
      const videos = [
        { videoId: 'vid1', sourceId: 'youtube-channel-1', sourceType: 'youtube' },
        { videoId: 'vid2', sourceId: 'youtube-playlist-1', sourceType: 'youtube_playlist' },
        { videoId: 'vid3', sourceId: 'local-folder-1', sourceType: 'local' },
        { videoId: 'vid4', sourceId: 'deleted-source', sourceType: 'youtube' }
      ];

      const results = await SourceValidationService.batchValidateVideos(videos);

      expect(results.get('vid1')).toBe(true);
      expect(results.get('vid2')).toBe(true);
      expect(results.get('vid3')).toBe(true);
      expect(results.get('vid4')).toBe(false);

      // Should only call IPC once for batch operation
      expect(window.electron.videoSourcesGetAll).toHaveBeenCalledTimes(1);
    });

    it('should validate downloaded videos as always valid', async () => {
      const videos = [
        { videoId: 'downloaded1', sourceId: 'any-source', sourceType: 'downloaded' }
      ];

      const results = await SourceValidationService.batchValidateVideos(videos);

      expect(results.get('downloaded1')).toBe(true);
    });

    it('should cache individual results during batch validation', async () => {
      const videos = [
        { videoId: 'vid1', sourceId: 'youtube-channel-1', sourceType: 'youtube' }
      ];

      await SourceValidationService.batchValidateVideos(videos);

      // Now individual validation should use cache
      await SourceValidationService.isVideoSourceValid('vid1', 'youtube-channel-1', 'youtube');

      // Should only call IPC once (from batch operation)
      expect(window.electron.videoSourcesGetAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('getVideoChannelId', () => {
    it('should return null when IPC method not implemented', async () => {
      const channelId = await SourceValidationService.getVideoChannelId('video123');

      expect(channelId).toBe(null);
    });

    it('should return channelId when IPC method is available', async () => {
      // Mock the IPC method
      (window.electron as any).getYouTubeVideoInfo = vi.fn().mockResolvedValue({
        channelId: 'UC123',
        title: 'Test Video'
      });

      const channelId = await SourceValidationService.getVideoChannelId('video123');

      expect(channelId).toBe('UC123');
    });

    it('should handle errors gracefully', async () => {
      // Mock the IPC method to throw error
      (window.electron as any).getYouTubeVideoInfo = vi.fn().mockRejectedValue(new Error('API Error'));

      const channelId = await SourceValidationService.getVideoChannelId('video123');

      expect(channelId).toBe(null);
    });
  });

  describe('clearCache', () => {
    it('should clear all caches', async () => {
      // Populate caches
      await SourceValidationService.isVideoSourceValid('video123', 'youtube-channel-1', 'youtube');

      expect(window.electron.videoSourcesGetAll).toHaveBeenCalledTimes(1);

      // Clear cache
      SourceValidationService.clearCache();

      // Next call should fetch fresh data
      await SourceValidationService.isVideoSourceValid('video123', 'youtube-channel-1', 'youtube');

      // After clearCache, sources cache is cleared, so we should have 2 calls total
      expect(window.electron.videoSourcesGetAll).toHaveBeenCalledTimes(2);
    });
  });

  describe('source cache expiration', () => {
    it('should refresh sources after cache duration', async () => {
      vi.useFakeTimers();

      // First call
      await SourceValidationService.isVideoSourceValid('video123', 'youtube-channel-1', 'youtube');

      expect(window.electron.videoSourcesGetAll).toHaveBeenCalledTimes(1);

      // Fast forward 6 minutes (past cache duration)
      vi.advanceTimersByTime(6 * 60 * 1000);

      // Clear individual caches but keep sources cache to test expiration
      (SourceValidationService as any).sourceCache.clear();
      (SourceValidationService as any).channelCache.clear();

      // Next call should fetch fresh sources
      await SourceValidationService.isVideoSourceValid('video123', 'youtube-channel-1', 'youtube');

      expect(window.electron.videoSourcesGetAll).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });
});