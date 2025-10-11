import { describe, test, expect, vi, beforeEach } from 'vitest';
import { exec, spawn } from 'child_process';
import * as fs from 'fs';

// Hoist the mock to ensure it's available before module import
const mockExecAsync = vi.hoisted(() => vi.fn());

// Mock util module with promisify
vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    promisify: () => mockExecAsync
  };
});

import { FFmpegManager } from './ffmpegManager';

// Mock child_process
vi.mock('child_process');
const mockExec = vi.mocked(exec);
const mockSpawn = vi.mocked(spawn);

// Mock fs
vi.mock('fs');
const mockFs = vi.mocked(fs);

// Mock path and process
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
}));

// Mock logging
vi.mock('../shared/logging', () => ({
  logVerbose: vi.fn()
}));

describe('FFmpegManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset static properties
    (FFmpegManager as any).ffmpegPath = null;
    (FFmpegManager as any).ffprobePath = null;
    (FFmpegManager as any).isAvailable = null;

    // Mock process.platform
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true
    });
  });

  describe('getFFmpegPath', () => {
    test('should return correct path for Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      Object.defineProperty(process, 'cwd', { value: vi.fn(() => '/test/path'), configurable: true });

      const path = FFmpegManager.getFFmpegPath();
      expect(path).toBe('/test/path/ffmpeg.exe');
    });

    test('should return correct path for Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      Object.defineProperty(process, 'cwd', { value: vi.fn(() => '/test/path'), configurable: true });

      const path = FFmpegManager.getFFmpegPath();
      expect(path).toBe('/test/path/ffmpeg');
    });

    test('should throw error for unsupported platform', () => {
      Object.defineProperty(process, 'platform', { value: 'unsupported', configurable: true });

      expect(() => FFmpegManager.getFFmpegPath()).toThrow('Unsupported platform: unsupported');
    });
  });

  describe('getFFprobePath', () => {
    test('should return correct path for Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      Object.defineProperty(process, 'cwd', { value: vi.fn(() => '/test/path'), configurable: true });

      const path = FFmpegManager.getFFprobePath();
      expect(path).toBe('/test/path/ffprobe.exe');
    });

    test('should return correct path for Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      Object.defineProperty(process, 'cwd', { value: vi.fn(() => '/test/path'), configurable: true });

      const path = FFmpegManager.getFFprobePath();
      expect(path).toBe('/test/path/ffprobe');
    });
  });

  describe('isSystemFFmpegAvailable', () => {
    test('should return false when system ffmpeg is not available', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command not found'));

      const result = await FFmpegManager.isSystemFFmpegAvailable();
      expect(result).toBe(false);
    });
  });

  describe('isSystemFFprobeAvailable', () => {
    test('should return false when system ffprobe is not available', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command not found'));

      const result = await FFmpegManager.isSystemFFprobeAvailable();
      expect(result).toBe(false);
    });
  });

  describe('isFFmpegAvailable', () => {
    test('should return true when system ffmpeg and ffprobe are available', async () => {
      const mockPromisify = vi.fn(() => vi.fn().mockResolvedValue({ stdout: 'ffmpeg version 4.4.0' }));
      vi.doMock('util', () => ({ promisify: mockPromisify }));

      vi.spyOn(FFmpegManager, 'isSystemFFmpegAvailable').mockResolvedValue(true);
      vi.spyOn(FFmpegManager, 'isSystemFFprobeAvailable').mockResolvedValue(true);

      const result = await FFmpegManager.isFFmpegAvailable();
      expect(result).toBe(true);
    });

    test('should check local files when system ffmpeg is not available', async () => {
      vi.spyOn(FFmpegManager, 'isSystemFFmpegAvailable').mockResolvedValue(false);
      vi.spyOn(FFmpegManager, 'isSystemFFprobeAvailable').mockResolvedValue(false);

      // Mock fs.promises.access to succeed
      const mockAccess = vi.fn().mockResolvedValue(undefined);
      const mockStat = vi.fn().mockResolvedValue({ mode: 0o755 });
      mockFs.promises = {
        access: mockAccess,
        stat: mockStat,
      } as any;

      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      const result = await FFmpegManager.isFFmpegAvailable();
      expect(result).toBe(true);
      expect(mockAccess).toHaveBeenCalledTimes(2); // ffmpeg and ffprobe
    });

    test('should return false when local files are not found', async () => {
      vi.spyOn(FFmpegManager, 'isSystemFFmpegAvailable').mockResolvedValue(false);
      vi.spyOn(FFmpegManager, 'isSystemFFprobeAvailable').mockResolvedValue(false);

      // Mock fs.promises.access to fail
      const mockAccess = vi.fn().mockRejectedValue(new Error('File not found'));
      mockFs.promises = { access: mockAccess } as any;

      const result = await FFmpegManager.isFFmpegAvailable();
      expect(result).toBe(false);
    });
  });

  describe('ensureFFmpegAvailable', () => {
    test('should return early when ffmpeg is already available', async () => {
      vi.spyOn(FFmpegManager, 'isFFmpegAvailable').mockResolvedValue(true);

      await FFmpegManager.ensureFFmpegAvailable();

      // Should not attempt download
      expect(mockExec).not.toHaveBeenCalled();
    });

    test('should throw error on non-Windows platforms when ffmpeg is not available', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      vi.spyOn(FFmpegManager, 'isFFmpegAvailable').mockResolvedValue(false);

      await expect(FFmpegManager.ensureFFmpegAvailable()).rejects.toThrow(
        'FFmpeg not found. Please install ffmpeg and ffprobe manually on this platform.'
      );
    });
  });

  describe('getFFmpegCommand', () => {
    test('should return system command when using system ffmpeg', () => {
      (FFmpegManager as any).ffmpegPath = 'ffmpeg';

      const command = FFmpegManager.getFFmpegCommand();
      expect(command).toBe('ffmpeg');
    });

    test('should return quoted path on Windows when using local ffmpeg', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      Object.defineProperty(process, 'cwd', { value: vi.fn(() => '/test/path'), configurable: true });
      (FFmpegManager as any).ffmpegPath = null; // Force path generation

      const command = FFmpegManager.getFFmpegCommand();
      expect(command).toBe('"/test/path/ffmpeg.exe"');
    });

    test('should return path without quotes on Unix when using local ffmpeg', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      Object.defineProperty(process, 'cwd', { value: vi.fn(() => '/test/path'), configurable: true });
      (FFmpegManager as any).ffmpegPath = null; // Force path generation

      const command = FFmpegManager.getFFmpegCommand();
      expect(command).toBe('/test/path/ffmpeg');
    });
  });

  describe('getFFprobeCommand', () => {
    test('should return system command when using system ffprobe', () => {
      (FFmpegManager as any).ffprobePath = 'ffprobe';

      const command = FFmpegManager.getFFprobeCommand();
      expect(command).toBe('ffprobe');
    });

    test('should return quoted path on Windows when using local ffprobe', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      Object.defineProperty(process, 'cwd', { value: vi.fn(() => '/test/path'), configurable: true });
      (FFmpegManager as any).ffprobePath = null; // Force path generation

      const command = FFmpegManager.getFFprobeCommand();
      expect(command).toBe('"/test/path/ffprobe.exe"');
    });
  });

  describe('getFFmpegVersion', () => {
    test('should return unknown when version cannot be determined', async () => {
      vi.spyOn(FFmpegManager, 'ensureFFmpegAvailable').mockRejectedValue(new Error('Not available'));

      const version = await FFmpegManager.getFFmpegVersion();
      expect(version).toBe('unknown');
    });
  });

  describe('getFFprobeVersion', () => {
    test('should return unknown when version cannot be determined', async () => {
      vi.spyOn(FFmpegManager, 'ensureFFmpegAvailable').mockRejectedValue(new Error('Not available'));

      const version = await FFmpegManager.getFFprobeVersion();
      expect(version).toBe('unknown');
    });
  });
});