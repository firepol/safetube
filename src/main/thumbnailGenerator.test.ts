import { describe, test, expect, vi, beforeEach } from 'vitest';
import './services/__tests__/setup.ts';

// Hoist the mocks to ensure they're available before module import
const mockSpawn = vi.hoisted(() => vi.fn());
const mockIsFFmpegAvailable = vi.hoisted(() => vi.fn());
const mockEnsureFFmpegAvailable = vi.hoisted(() => vi.fn());
const mockGetFFmpegCommand = vi.hoisted(() => vi.fn());
const mockGetFFprobeCommand = vi.hoisted(() => vi.fn());

// Mock child_process with hoisted spawn
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    spawn: mockSpawn
  };
});

// Mock fs
vi.mock('fs');

// Mock FFmpegManager
vi.mock('./ffmpegManager', () => ({
  FFmpegManager: {
    isFFmpegAvailable: mockIsFFmpegAvailable,
    ensureFFmpegAvailable: mockEnsureFFmpegAvailable,
    getFFmpegCommand: mockGetFFmpegCommand,
    getFFprobeCommand: mockGetFFprobeCommand,
  },
}));

import fs from 'fs';
import { ThumbnailGenerator } from './thumbnailGenerator';

const mockFs = vi.mocked(fs);

describe('ThumbnailGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock return values
    mockIsFFmpegAvailable.mockResolvedValue(true);
    mockEnsureFFmpegAvailable.mockResolvedValue(undefined);
    mockGetFFmpegCommand.mockReturnValue('ffmpeg');
    mockGetFFprobeCommand.mockReturnValue('ffprobe');
  });

  describe('isFFmpegAvailable', () => {
    test('should return true when FFmpeg is available', async () => {
      mockIsFFmpegAvailable.mockResolvedValue(true);

      const result = await ThumbnailGenerator.isFFmpegAvailable();

      expect(result).toBe(true);
      expect(mockIsFFmpegAvailable).toHaveBeenCalled();
    });

    test('should return false when FFmpeg is not available', async () => {
      mockIsFFmpegAvailable.mockResolvedValue(false);

      const result = await ThumbnailGenerator.isFFmpegAvailable();

      expect(result).toBe(false);
      expect(mockIsFFmpegAvailable).toHaveBeenCalled();
    });

    test('should return false when FFmpeg check throws error', async () => {
      mockIsFFmpegAvailable.mockRejectedValue(new Error('Command not found'));

      try {
        await ThumbnailGenerator.isFFmpegAvailable();
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Command not found');
      }
    });
  });

  describe('getVideoDuration', () => {
    test('should return video duration when FFprobe succeeds', async () => {
      const mockFFprobe = {
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() }
      };

      mockSpawn.mockImplementation(() => {
        // Trigger events immediately after creation
        setImmediate(() => {
          const stdoutHandler = mockFFprobe.stdout.on.mock.calls.find(call => call[0] === 'data')?.[1];
          stdoutHandler?.(Buffer.from('120.5\n'));

          const closeHandler = mockFFprobe.on.mock.calls.find(call => call[0] === 'close')?.[1];
          closeHandler?.(0);
        });
        return mockFFprobe as any;
      });

      const result = await ThumbnailGenerator.getVideoDuration('/path/to/video.mp4');
      expect(result).toBe(120.5);
    });

    test('should reject when FFprobe fails', async () => {
      const mockFFprobe = {
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() }
      };

      mockSpawn.mockReturnValue(mockFFprobe as any);

      const promise = ThumbnailGenerator.getVideoDuration('/path/to/video.mp4');

      // Trigger close event with error
      const closeHandler = mockFFprobe.on.mock.calls.find(call => call[0] === 'close')?.[1];
      closeHandler?.(1);

      await expect(promise).rejects.toThrow('FFprobe failed with code 1');
    });

    test('should handle invalid duration output', async () => {
      const mockFFprobe = {
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() }
      };

      mockSpawn.mockImplementation(() => {
        // Trigger events immediately after creation
        setImmediate(() => {
          const stdoutHandler = mockFFprobe.stdout.on.mock.calls.find(call => call[0] === 'data')?.[1];
          stdoutHandler?.(Buffer.from('invalid\n'));

          const closeHandler = mockFFprobe.on.mock.calls.find(call => call[0] === 'close')?.[1];
          closeHandler?.(0);
        });
        return mockFFprobe as any;
      });

      const result = await ThumbnailGenerator.getVideoDuration('/path/to/video.mp4');
      expect(result).toBe(0);
    });
  });

  describe('generateCachedThumbnail', () => {
    test('should return existing cached thumbnail', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.mkdirSync.mockReturnValue(undefined);

      const result = await ThumbnailGenerator.generateCachedThumbnail('video123', '/path/to/video.mp4');

      expect(result).toContain('thumbnail_local_video123.jpg');
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    test('should return null when FFmpeg is not available', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined);

      // Mock FFmpeg check to return false
      const mockFFmpeg = {
        on: vi.fn(),
        kill: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() }
      };

      mockSpawn.mockReturnValue(mockFFmpeg as any);

      const promise = ThumbnailGenerator.generateCachedThumbnail('video123', '/path/to/video.mp4');

      // Trigger error for FFmpeg availability check
      const errorHandler = mockFFmpeg.on.mock.calls.find(call => call[0] === 'error')?.[1];
      errorHandler?.(new Error('Command not found'));

      const result = await promise;
      expect(result).toBe(null);
    });
  });

  describe('getCacheStats', () => {
    test('should return cache statistics', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['thumb1.jpg', 'thumb2.jpg'] as any);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      const stats = ThumbnailGenerator.getCacheStats();

      expect(stats.count).toBe(2);
      expect(stats.totalSize).toBe(2048);
    });

    test('should return zero stats when cache directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const stats = ThumbnailGenerator.getCacheStats();

      expect(stats.count).toBe(0);
      expect(stats.totalSize).toBe(0);
    });

    test('should handle errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const stats = ThumbnailGenerator.getCacheStats();

      expect(stats.count).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });
});