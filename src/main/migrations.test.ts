import { describe, it, expect, vi, beforeEach } from 'vitest';
import { migrateWatchedHistory, needsHistoryMigration } from './migrations';
import * as fileUtils from './fileUtils';
import * as sharedFileUtils from '../shared/fileUtils';
import fs from 'fs';

// Mock all dependencies
vi.mock('./fileUtils');
vi.mock('../shared/fileUtils');
vi.mock('fs');
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/user/data')
  }
}));
vi.mock('../shared/videoDurationUtils', () => ({
  extractVideoDuration: vi.fn().mockResolvedValue(120)
}));

const mockFileUtils = vi.mocked(fileUtils);
const mockSharedFileUtils = vi.mocked(sharedFileUtils);
const mockFs = vi.mocked(fs);

describe('Migration System', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock global.currentVideos for YouTube metadata
    global.currentVideos = [
      {
        id: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        sourceId: 'youtube-channel-1',
        duration: 212
      }
    ];

    // Mock shared file utils
    mockSharedFileUtils.parseVideoId.mockImplementation((videoId) => {
      if (videoId.startsWith('local:')) {
        return {
          success: true,
          parsed: {
            type: 'local',
            originalId: videoId,
            path: videoId.substring(6)
          }
        };
      } else if (videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
        return {
          success: true,
          parsed: {
            type: 'youtube',
            originalId: videoId
          }
        };
      }
      return {
        success: false,
        error: 'Unknown format'
      };
    });

    mockSharedFileUtils.isEncodedFilePath.mockImplementation((videoId) => {
      return videoId.startsWith('local_') && videoId.length > 10;
    });

    mockSharedFileUtils.decodeFilePath.mockImplementation((encodedId) => {
      if (encodedId === 'local_abc123def456') {
        return '/home/user/videos/test-movie.mp4';
      }
      throw new Error('Invalid encoded path');
    });

    mockSharedFileUtils.createLocalVideoId.mockImplementation((filePath) => {
      return `local:${filePath}`;
    });

    // Mock fs
    mockFs.existsSync.mockReturnValue(true);
    mockFs.copyFileSync.mockImplementation(() => {});
  });

  describe('needsHistoryMigration', () => {
    it('should return true when legacy encoded IDs exist', async () => {
      mockFileUtils.readWatchedVideos.mockResolvedValue([
        {
          videoId: 'local_abc123def456', // Legacy encoded ID
          position: 60,
          lastWatched: '2025-01-15T10:00:00.000Z',
          timeWatched: 30
        }
      ]);

      const result = await needsHistoryMigration();
      expect(result).toBe(true);
    });

    it('should return true when entries lack metadata', async () => {
      mockFileUtils.readWatchedVideos.mockResolvedValue([
        {
          videoId: 'local:/home/user/videos/movie.mp4',
          position: 60,
          lastWatched: '2025-01-15T10:00:00.000Z',
          timeWatched: 30
          // Missing title, thumbnail, source
        }
      ]);

      const result = await needsHistoryMigration();
      expect(result).toBe(true);
    });

    it('should return false when no migration is needed', async () => {
      mockFileUtils.readWatchedVideos.mockResolvedValue([
        {
          videoId: 'local:/home/user/videos/movie.mp4',
          position: 60,
          lastWatched: '2025-01-15T10:00:00.000Z',
          timeWatched: 30,
          title: 'Test Movie',
          thumbnail: '/path/to/thumbnail.jpg',
          source: 'local-source-1'
        }
      ]);

      const result = await needsHistoryMigration();
      expect(result).toBe(false);
    });
  });

  describe('migrateWatchedHistory', () => {
    it('should migrate legacy encoded IDs to URI format', async () => {
      const originalData = [
        {
          videoId: 'local_abc123def456',
          position: 60,
          lastWatched: '2025-01-15T10:00:00.000Z',
          timeWatched: 30
        }
      ];

      mockFileUtils.readWatchedVideos.mockResolvedValue(originalData);
      mockFileUtils.writeWatchedVideos.mockResolvedValue();

      const result = await migrateWatchedHistory();

      expect(result.totalVideos).toBe(1);
      expect(result.migratedVideos).toBe(1);
      expect(result.skippedVideos).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify the migrated data was written
      expect(mockFileUtils.writeWatchedVideos).toHaveBeenCalledWith([
        expect.objectContaining({
          videoId: 'local:/home/user/videos/test-movie.mp4',
          title: 'test-movie',
          source: 'local',
          firstWatched: '2025-01-15T10:00:00.000Z'
        })
      ]);
    });

    it('should enhance YouTube video metadata', async () => {
      const originalData = [
        {
          videoId: 'dQw4w9WgXcQ',
          position: 100,
          lastWatched: '2025-01-15T10:00:00.000Z',
          timeWatched: 45
          // Missing metadata
        }
      ];

      mockFileUtils.readWatchedVideos.mockResolvedValue(originalData);
      mockFileUtils.writeWatchedVideos.mockResolvedValue();

      const result = await migrateWatchedHistory();

      expect(result.migratedVideos).toBe(1);
      expect(mockFileUtils.writeWatchedVideos).toHaveBeenCalledWith([
        expect.objectContaining({
          videoId: 'dQw4w9WgXcQ',
          title: 'Never Gonna Give You Up',
          thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
          source: 'youtube-channel-1'
        })
      ]);
    });

    it('should preserve existing metadata when updating', async () => {
      const originalData = [
        {
          videoId: 'local_abc123def456',
          position: 30,
          lastWatched: '2025-01-15T10:00:00.000Z',
          timeWatched: 15,
          title: 'Custom Title',
          source: 'custom-source'
        }
      ];

      mockFileUtils.readWatchedVideos.mockResolvedValue(originalData);
      mockFileUtils.writeWatchedVideos.mockResolvedValue();

      await migrateWatchedHistory();

      expect(mockFileUtils.writeWatchedVideos).toHaveBeenCalledWith([
        expect.objectContaining({
          videoId: 'local:/home/user/videos/test-movie.mp4',
          title: 'Custom Title', // Preserved from original
          source: 'custom-source', // Preserved from original
          firstWatched: '2025-01-15T10:00:00.000Z'
        })
      ]);
    });

    it('should create backup before migration', async () => {
      mockFileUtils.readWatchedVideos.mockResolvedValue([
        {
          videoId: 'local_abc123def456',
          position: 60,
          lastWatched: '2025-01-15T10:00:00.000Z',
          timeWatched: 30
        }
      ]);

      await migrateWatchedHistory();

      // Verify backup was created
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        expect.stringContaining('watched.json'),
        expect.stringContaining('watched.json.backup.')
      );
    });

    it('should handle decode failures by enhancing metadata', async () => {
      const originalData = [
        {
          videoId: 'local_invalid_encoded_id',
          position: 60,
          lastWatched: '2025-01-15T10:00:00.000Z',
          timeWatched: 30
        }
      ];

      mockFileUtils.readWatchedVideos.mockResolvedValue(originalData);
      mockFileUtils.writeWatchedVideos.mockResolvedValue();

      // Mock isEncodedFilePath to return false for this invalid ID
      mockSharedFileUtils.isEncodedFilePath.mockImplementation((videoId) => {
        return videoId === 'local_abc123def456'; // Only the valid one returns true
      });

      const result = await migrateWatchedHistory();

      expect(result.totalVideos).toBe(1);
      expect(result.migratedVideos).toBe(1); // Enhanced with metadata
      expect(result.skippedVideos).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Should enhance with fallback metadata
      expect(mockFileUtils.writeWatchedVideos).toHaveBeenCalledWith([
        expect.objectContaining({
          videoId: 'local_invalid_encoded_id',
          title: 'Video local_invalid_encoded_id',
          source: 'unknown'
        })
      ]);
    });

    it('should skip entries that already have complete metadata', async () => {
      const originalData = [
        {
          videoId: 'local:/home/user/videos/movie.mp4',
          position: 60,
          lastWatched: '2025-01-15T10:00:00.000Z',
          timeWatched: 30,
          title: 'Complete Movie',
          thumbnail: '/path/to/thumb.jpg',
          source: 'local-source'
        }
      ];

      mockFileUtils.readWatchedVideos.mockResolvedValue(originalData);
      mockFileUtils.writeWatchedVideos.mockResolvedValue();

      const result = await migrateWatchedHistory();

      expect(result.totalVideos).toBe(1);
      expect(result.migratedVideos).toBe(0);
      expect(result.skippedVideos).toBe(1);
    });

    it('should handle empty watched history', async () => {
      mockFileUtils.readWatchedVideos.mockResolvedValue([]);

      const result = await migrateWatchedHistory();

      expect(result.totalVideos).toBe(0);
      expect(result.migratedVideos).toBe(0);
      expect(result.skippedVideos).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });
});