import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies before importing the module
vi.mock('fs', async () => {
  return {
    default: {},
    promises: {
      access: vi.fn()
    }
  };
});

vi.mock('../../shared/logging', () => ({
  logVerbose: vi.fn()
}));

vi.mock('../downloadResetService', () => ({
  DownloadResetService: {
    isVideoDownloaded: vi.fn(),
    getDownloadedVideo: vi.fn(),
    getDownloadedVideoPath: vi.fn()
  }
}));

// Import after mocking
import { SmartPlaybackRouter } from '../smartPlaybackRouter';
import type { DownloadedVideo } from '../../shared/types';
import { promises as fs } from 'fs';

describe('SmartPlaybackRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createLocalVideoFromDownload', () => {
    it('should create local video object with navigation context preserved', async () => {
      const downloadedVideo: DownloadedVideo = {
        videoId: 'test-video-id',
        title: 'Test Video',
        channelTitle: 'Test Channel',
        playlistTitle: undefined,
        filePath: '/path/to/video.mp4',
        downloadedAt: '2023-01-01T00:00:00.000Z',
        duration: 300,
        thumbnail: '/path/to/thumbnail.jpg',
        sourceType: 'youtube_channel',
        sourceId: 'test-channel-id'
      };

      const navigationContext = {
        returnTo: '/source/test-channel-id',
        videoTitle: 'Test Video'
      };

      // Mock fs.access to succeed
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await SmartPlaybackRouter.createLocalVideoFromDownload(
        downloadedVideo,
        navigationContext
      );

      expect(result).toEqual({
        id: 'test-video-id',
        type: 'local',
        title: 'Test Video',
        thumbnail: '/path/to/thumbnail.jpg',
        duration: 300,
        url: '/path/to/video.mp4',
        filePath: '/path/to/video.mp4',
        sourceId: 'test-channel-id',
        sourceType: 'youtube_channel',
        sourceTitle: 'Test Channel',
        downloadedAt: '2023-01-01T00:00:00.000Z',
        navigationContext: navigationContext,
        isAvailable: true,
        isFallback: false
      });
    });

    it('should create local video object without navigation context when not provided', async () => {
      const downloadedVideo: DownloadedVideo = {
        videoId: 'test-video-id',
        title: 'Test Video',
        channelTitle: 'Test Channel',
        playlistTitle: undefined,
        filePath: '/path/to/video.mp4',
        downloadedAt: '2023-01-01T00:00:00.000Z',
        duration: 300,
        thumbnail: '/path/to/thumbnail.jpg',
        sourceType: 'youtube_channel',
        sourceId: 'test-channel-id'
      };

      // Mock fs.access to succeed
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await SmartPlaybackRouter.createLocalVideoFromDownload(downloadedVideo);

      expect(result.navigationContext).toBeUndefined();
      expect(result.id).toBe('test-video-id');
      expect(result.type).toBe('local');
    });

    it('should throw error when file is not accessible', async () => {
      const downloadedVideo: DownloadedVideo = {
        videoId: 'test-video-id',
        title: 'Test Video',
        channelTitle: 'Test Channel',
        playlistTitle: undefined,
        filePath: '/path/to/video.mp4',
        downloadedAt: '2023-01-01T00:00:00.000Z',
        duration: 300,
        thumbnail: '/path/to/thumbnail.jpg',
        sourceType: 'youtube_channel',
        sourceId: 'test-channel-id'
      };

      // Mock fs.access to fail
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      await expect(
        SmartPlaybackRouter.createLocalVideoFromDownload(downloadedVideo)
      ).rejects.toThrow('Downloaded video file not accessible: /path/to/video.mp4');
    });
  });
});