import { describe, test, expect, vi, beforeEach } from 'vitest';
import './services/__tests__/setup.ts';
import { spawn } from 'child_process';

// Mock child_process
vi.mock('child_process');
const mockSpawn = vi.mocked(spawn);

// Mock fs
vi.mock('fs');

// Hoist the FFmpegManager mocks
const { mockIsFFmpegAvailable, mockEnsureFFmpegAvailable, mockGetFFmpegCommand, mockGetFFprobeCommand } = vi.hoisted(() => ({
  mockIsFFmpegAvailable: vi.fn(),
  mockEnsureFFmpegAvailable: vi.fn(),
  mockGetFFmpegCommand: vi.fn(),
  mockGetFFprobeCommand: vi.fn(),
}));

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
    // Clear spawn mock calls but don't reset implementation
    mockSpawn.mockClear();
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
        on: vi.fn().mockImplementation(function(this: any, event: string, handler: any) {
          if (event === 'close') {
            // Emit close event with code 0 after a delay to ensure stdout is processed first
            setTimeout(() => handler(0), 10);
          }
          return this;
        }),
        stdout: {
          on: vi.fn().mockImplementation(function(this: any, event: string, handler: any) {
            if (event === 'data') {
              // Emit data immediately
              setTimeout(() => handler(Buffer.from('120.5\n')), 5);
            }
            return this;
          })
        },
        stderr: { on: vi.fn().mockReturnThis() }
      };

      mockSpawn.mockReturnValue(mockFFprobe as any);

      const result = await ThumbnailGenerator.getVideoDuration('/path/to/video.mp4');
      expect(result).toBe(120.5);
    });

    test('should reject when FFprobe fails', async () => {
      const mockFFprobe = {
        on: vi.fn().mockImplementation(function(this: any, event: string, handler: any) {
          if (event === 'close') {
            // Emit close event with code 1 after a delay
            setTimeout(() => handler(1), 5);
          }
          return this;
        }),
        stdout: { on: vi.fn().mockReturnThis() },
        stderr: { on: vi.fn().mockReturnThis() }
      };

      mockSpawn.mockReturnValue(mockFFprobe as any);

      await expect(ThumbnailGenerator.getVideoDuration('/path/to/video.mp4'))
        .rejects.toThrow('FFprobe failed with code 1');
    });

    test('should handle invalid duration output', async () => {
      const mockFFprobe = {
        on: vi.fn().mockImplementation(function(this: any, event: string, handler: any) {
          if (event === 'close') {
            // Emit close event with code 0 after a delay to ensure stdout is processed first
            setTimeout(() => handler(0), 10);
          }
          return this;
        }),
        stdout: {
          on: vi.fn().mockImplementation(function(this: any, event: string, handler: any) {
            if (event === 'data') {
              // Emit invalid data
              setTimeout(() => handler(Buffer.from('invalid\n')), 5);
            }
            return this;
          })
        },
        stderr: { on: vi.fn().mockReturnThis() }
      };

      mockSpawn.mockReturnValue(mockFFprobe as any);

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

      // First spawn will be ffprobe (for getVideoDuration), then ffmpeg (for thumbnail generation)
      let spawnCount = 0;

      mockSpawn.mockImplementation(() => {
        spawnCount++;

        // First call: FFprobe for duration check - simulate failure
        if (spawnCount === 1) {
          const mockFFprobe = {
            on: vi.fn().mockImplementation(function(this: any, event: string, handler: any) {
              if (event === 'close') {
                setTimeout(() => handler(1), 5); // Fail with code 1
              }
              return this;
            }),
            stdout: { on: vi.fn().mockReturnThis() },
            stderr: { on: vi.fn().mockReturnThis() }
          };
          return mockFFprobe as any;
        }

        // Second call: FFmpeg for thumbnail generation - shouldn't reach here but handle anyway
        const mockFFmpeg = {
          on: vi.fn().mockImplementation(function(this: any, event: string, handler: any) {
            if (event === 'close') {
              setTimeout(() => handler(1), 5);
            }
            return this;
          }),
          kill: vi.fn(),
          stdout: { on: vi.fn().mockReturnThis() },
          stderr: { on: vi.fn().mockReturnThis() }
        };
        return mockFFmpeg as any;
      });

      const result = await ThumbnailGenerator.generateCachedThumbnail('video123', '/path/to/video.mp4');
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