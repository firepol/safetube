import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DownloadResetService } from '../downloadResetService';
import { DownloadedVideo, DownloadStatus } from '../../shared/types';
import * as fileUtils from '../fileUtils';

// Create mock database instance
const mockDbRun = vi.fn().mockResolvedValue(undefined);
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

const mockDatabaseService = {
  run: mockDbRun,
  get: mockDbGet,
  all: mockDbAll
};

// Mock DatabaseService
vi.mock('../services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: vi.fn(() => mockDatabaseService)
  }
}));

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp/test-config')
  }
}));

// Mock the dependencies
vi.mock('../fileUtils');
vi.mock('../../shared/logging');

// Mock fs module
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      access: vi.fn()
    }
  };
});

const mockFileUtils = vi.mocked(fileUtils);

describe('DownloadResetService', () => {
  let mockFsAccess: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset database mocks
    mockDbRun.mockResolvedValue(undefined);
    mockDbGet.mockResolvedValue(null);
    mockDbAll.mockResolvedValue([]);
    // Get the mocked fs.access function
    const fs = await import('fs');
    mockFsAccess = vi.mocked(fs.promises.access);
  });



  describe('resetDownloadStatus', () => {
    it('should remove video from both tracking files when video exists', async () => {
      const videoId = 'test-video-id';
      
      // Mock existing data
      const mockDownloadStatuses: DownloadStatus[] = [
        { videoId: 'other-video', status: 'completed', progress: 100 },
        { videoId, status: 'completed', progress: 100 },
        { videoId: 'another-video', status: 'downloading', progress: 50 }
      ];
      
      const mockDownloadedVideos: DownloadedVideo[] = [
        {
          videoId: 'other-video',
          title: 'Other Video',
          filePath: '/path/to/other.mp4',
          downloadedAt: '2025-01-01T00:00:00.000Z',
          duration: 120,
          thumbnail: '/path/to/other.jpg',
          sourceType: 'youtube_channel',
          sourceId: 'channel1'
        },
        {
          videoId,
          title: 'Test Video',
          filePath: '/path/to/test.mp4',
          downloadedAt: '2025-01-01T00:00:00.000Z',
          duration: 180,
          thumbnail: '/path/to/test.jpg',
          sourceType: 'youtube_playlist',
          sourceId: 'playlist1'
        }
      ];

      mockFileUtils.readDownloadStatus.mockResolvedValue(mockDownloadStatuses);
      mockFileUtils.readDownloadedVideos.mockResolvedValue(mockDownloadedVideos);
      mockFileUtils.writeDownloadStatus.mockResolvedValue();
      mockFileUtils.writeDownloadedVideos.mockResolvedValue();

      await DownloadResetService.resetDownloadStatus(videoId);

      // Verify the video was removed from downloadStatus.json
      expect(mockFileUtils.writeDownloadStatus).toHaveBeenCalledWith([
        { videoId: 'other-video', status: 'completed', progress: 100 },
        { videoId: 'another-video', status: 'downloading', progress: 50 }
      ]);

      // Verify the video was removed from downloadedVideos.json
      expect(mockFileUtils.writeDownloadedVideos).toHaveBeenCalledWith([
        {
          videoId: 'other-video',
          title: 'Other Video',
          filePath: '/path/to/other.mp4',
          downloadedAt: '2025-01-01T00:00:00.000Z',
          duration: 120,
          thumbnail: '/path/to/other.jpg',
          sourceType: 'youtube_channel',
          sourceId: 'channel1'
        }
      ]);
    });

    it('should handle case when video does not exist in tracking files', async () => {
      const videoId = 'non-existent-video';
      
      const mockDownloadStatuses: DownloadStatus[] = [
        { videoId: 'other-video', status: 'completed', progress: 100 }
      ];
      
      const mockDownloadedVideos: DownloadedVideo[] = [
        {
          videoId: 'other-video',
          title: 'Other Video',
          filePath: '/path/to/other.mp4',
          downloadedAt: '2025-01-01T00:00:00.000Z',
          duration: 120,
          thumbnail: '/path/to/other.jpg',
          sourceType: 'youtube_channel',
          sourceId: 'channel1'
        }
      ];

      mockFileUtils.readDownloadStatus.mockResolvedValue(mockDownloadStatuses);
      mockFileUtils.readDownloadedVideos.mockResolvedValue(mockDownloadedVideos);
      mockFileUtils.writeDownloadStatus.mockResolvedValue();
      mockFileUtils.writeDownloadedVideos.mockResolvedValue();

      await DownloadResetService.resetDownloadStatus(videoId);

      // Should not call write functions if no changes were made (optimization)
      expect(mockFileUtils.writeDownloadStatus).not.toHaveBeenCalled();
      expect(mockFileUtils.writeDownloadedVideos).not.toHaveBeenCalled();
    });

    it('should throw error when file operations fail', async () => {
      const videoId = 'test-video-id';
      const error = new Error('File system error');

      mockFileUtils.readDownloadStatus.mockRejectedValue(error);

      await expect(DownloadResetService.resetDownloadStatus(videoId))
        .rejects.toThrow('Failed to reset download status: File system error');
    });
  });

  describe('isVideoDownloaded', () => {
    it('should return true when video exists in downloadedVideos.json', async () => {
      const videoId = 'test-video-id';
      
      const mockDownloadedVideos: DownloadedVideo[] = [
        {
          videoId,
          title: 'Test Video',
          filePath: '/path/to/test.mp4',
          downloadedAt: '2025-01-01T00:00:00.000Z',
          duration: 180,
          thumbnail: '/path/to/test.jpg',
          sourceType: 'youtube_playlist',
          sourceId: 'playlist1'
        }
      ];

      mockFileUtils.readDownloadedVideos.mockResolvedValue(mockDownloadedVideos);

      const result = await DownloadResetService.isVideoDownloaded(videoId);

      expect(result).toBe(true);
      expect(mockFileUtils.readDownloadedVideos).toHaveBeenCalledTimes(1);
    });

    it('should return false when video does not exist in downloadedVideos.json', async () => {
      const videoId = 'non-existent-video';
      
      const mockDownloadedVideos: DownloadedVideo[] = [
        {
          videoId: 'other-video',
          title: 'Other Video',
          filePath: '/path/to/other.mp4',
          downloadedAt: '2025-01-01T00:00:00.000Z',
          duration: 120,
          thumbnail: '/path/to/other.jpg',
          sourceType: 'youtube_channel',
          sourceId: 'channel1'
        }
      ];

      mockFileUtils.readDownloadedVideos.mockResolvedValue(mockDownloadedVideos);

      const result = await DownloadResetService.isVideoDownloaded(videoId);

      expect(result).toBe(false);
    });

    it('should return false when file reading fails', async () => {
      const videoId = 'test-video-id';
      const error = new Error('File read error');

      mockFileUtils.readDownloadedVideos.mockRejectedValue(error);

      const result = await DownloadResetService.isVideoDownloaded(videoId);

      expect(result).toBe(false);
    });
  });

  describe('getDownloadedVideoPath', () => {
    it('should call readDownloadedVideos when checking for video path', async () => {
      const videoId = 'test-video-id';
      const filePath = '/path/to/test.mp4';
      
      const mockDownloadedVideos: DownloadedVideo[] = [
        {
          videoId,
          title: 'Test Video',
          filePath,
          downloadedAt: '2025-01-01T00:00:00.000Z',
          duration: 180,
          thumbnail: '/path/to/test.jpg',
          sourceType: 'youtube_playlist',
          sourceId: 'playlist1'
        }
      ];

      mockFileUtils.readDownloadedVideos.mockResolvedValue(mockDownloadedVideos);
      mockFsAccess.mockResolvedValue(undefined);

      await DownloadResetService.getDownloadedVideoPath(videoId);

      // The method should read from downloadedVideos to find the video
      expect(mockFileUtils.readDownloadedVideos).toHaveBeenCalledTimes(1);
      // Note: File system access behavior is tested in integration tests
    });

    it('should handle file access errors gracefully', async () => {
      const videoId = 'test-video-id';
      const filePath = '/path/to/test.mp4';
      
      const mockDownloadedVideos: DownloadedVideo[] = [
        {
          videoId,
          title: 'Test Video',
          filePath,
          downloadedAt: '2025-01-01T00:00:00.000Z',
          duration: 180,
          thumbnail: '/path/to/test.jpg',
          sourceType: 'youtube_playlist',
          sourceId: 'playlist1'
        }
      ];

      mockFileUtils.readDownloadedVideos.mockResolvedValue(mockDownloadedVideos);
      mockFsAccess.mockRejectedValue(new Error('File not found'));

      const result = await DownloadResetService.getDownloadedVideoPath(videoId);

      // Should return null when file access fails
      expect(result).toBe(null);
    });

    it('should return null when video does not exist in downloadedVideos.json', async () => {
      const videoId = 'non-existent-video';
      
      const mockDownloadedVideos: DownloadedVideo[] = [];

      mockFileUtils.readDownloadedVideos.mockResolvedValue(mockDownloadedVideos);

      const result = await DownloadResetService.getDownloadedVideoPath(videoId);

      expect(result).toBe(null);
      expect(mockFsAccess).not.toHaveBeenCalled();
    });

    it('should return null when video has no file path recorded', async () => {
      const videoId = 'test-video-id';
      
      const mockDownloadedVideos: DownloadedVideo[] = [
        {
          videoId,
          title: 'Test Video',
          filePath: '', // Empty file path
          downloadedAt: '2025-01-01T00:00:00.000Z',
          duration: 180,
          thumbnail: '/path/to/test.jpg',
          sourceType: 'youtube_playlist',
          sourceId: 'playlist1'
        }
      ];

      mockFileUtils.readDownloadedVideos.mockResolvedValue(mockDownloadedVideos);

      const result = await DownloadResetService.getDownloadedVideoPath(videoId);

      expect(result).toBe(null);
      expect(mockFsAccess).not.toHaveBeenCalled();
    });

    it('should return null when file reading fails', async () => {
      const videoId = 'test-video-id';
      const error = new Error('File read error');

      mockFileUtils.readDownloadedVideos.mockRejectedValue(error);

      const result = await DownloadResetService.getDownloadedVideoPath(videoId);

      expect(result).toBe(null);
    });
  });

  describe('getDownloadedVideo', () => {
    it('should return downloaded video metadata when video exists', async () => {
      const videoId = 'test-video-id';
      
      const mockDownloadedVideo: DownloadedVideo = {
        videoId,
        title: 'Test Video',
        filePath: '/path/to/test.mp4',
        downloadedAt: '2025-01-01T00:00:00.000Z',
        duration: 180,
        thumbnail: '/path/to/test.jpg',
        sourceType: 'youtube_playlist',
        sourceId: 'playlist1'
      };

      const mockDownloadedVideos: DownloadedVideo[] = [mockDownloadedVideo];

      mockFileUtils.readDownloadedVideos.mockResolvedValue(mockDownloadedVideos);

      const result = await DownloadResetService.getDownloadedVideo(videoId);

      expect(result).toEqual(mockDownloadedVideo);
    });

    it('should return null when video does not exist', async () => {
      const videoId = 'non-existent-video';
      
      const mockDownloadedVideos: DownloadedVideo[] = [];

      mockFileUtils.readDownloadedVideos.mockResolvedValue(mockDownloadedVideos);

      const result = await DownloadResetService.getDownloadedVideo(videoId);

      expect(result).toBe(null);
    });

    it('should return null when file reading fails', async () => {
      const videoId = 'test-video-id';
      const error = new Error('File read error');

      mockFileUtils.readDownloadedVideos.mockRejectedValue(error);

      const result = await DownloadResetService.getDownloadedVideo(videoId);

      expect(result).toBe(null);
    });
  });
});