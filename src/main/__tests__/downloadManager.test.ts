import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { DownloadManager } from '../downloadManager';

// Mock the dependencies
vi.mock('../fileUtils', () => ({
  readMainSettings: vi.fn().mockResolvedValue({ downloadPath: '/tmp/test-downloads' }),
  getDefaultDownloadPath: vi.fn().mockResolvedValue('/tmp/test-downloads'),
  updateDownloadStatus: vi.fn().mockResolvedValue(undefined),
  getDownloadStatus: vi.fn().mockResolvedValue(null),
  addDownloadedVideo: vi.fn().mockResolvedValue(undefined),
  readDownloadedVideos: vi.fn().mockResolvedValue([])
}));

vi.mock('../ytDlpManager', () => ({
  YtDlpManager: {
    ensureYtDlpAvailable: vi.fn().mockResolvedValue(undefined),
    getYtDlpCommand: vi.fn().mockReturnValue('yt-dlp')
  }
}));

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    spawn: vi.fn().mockReturnValue({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event, callback) => {
        if (event === 'close') {
          // Simulate successful completion
          setTimeout(() => callback(0), 100);
        }
      }),
      kill: vi.fn()
    })
  };
});

describe('DownloadManager JSON Cleanup', () => {
  const testDir = '/tmp/test-downloads/test-channel';
  const testVideoFile = path.join(testDir, 'test-video.mp4');
  const testInfoFile = path.join(testDir, 'test-video.info.json');
  const testThumbnailFile = path.join(testDir, 'test-video.webp');
  const testDescriptionFile = path.join(testDir, 'test-video.description');

  beforeEach(() => {
    // Create test directory and files
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Create mock files
    fs.writeFileSync(testVideoFile, 'mock video content');
    fs.writeFileSync(testInfoFile, JSON.stringify({ duration: 120, title: 'Test Video' }));
    fs.writeFileSync(testThumbnailFile, 'mock thumbnail content');
    fs.writeFileSync(testDescriptionFile, 'mock description content');
  });

  afterEach(() => {
    // Clean up test files
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should clean up info.json file after extracting metadata', async () => {
    // Access the private method for testing
    const DownloadManagerAny = DownloadManager as any;
    
    // Call handleDownloadComplete
    await DownloadManagerAny.handleDownloadComplete(
      'test-video-id',
      'Test Video',
      testVideoFile,
      { type: 'youtube_channel', sourceId: 'test-channel', channelTitle: 'Test Channel' }
    );

    // Check that info.json file was deleted
    expect(fs.existsSync(testInfoFile)).toBe(false);
    
    // Check that essential files remain
    expect(fs.existsSync(testVideoFile)).toBe(true);
    expect(fs.existsSync(testThumbnailFile)).toBe(true);
    
    // Check that temporary files were cleaned up
    expect(fs.existsSync(testDescriptionFile)).toBe(false);
  });

  it('should handle missing info.json file gracefully', async () => {
    // Remove info.json file
    fs.unlinkSync(testInfoFile);
    
    const DownloadManagerAny = DownloadManager as any;
    
    // Should not throw error when info.json doesn't exist
    await expect(DownloadManagerAny.handleDownloadComplete(
      'test-video-id',
      'Test Video',
      testVideoFile,
      { type: 'youtube_channel', sourceId: 'test-channel', channelTitle: 'Test Channel' }
    )).resolves.not.toThrow();
    
    // Essential files should still remain
    expect(fs.existsSync(testVideoFile)).toBe(true);
    expect(fs.existsSync(testThumbnailFile)).toBe(true);
  });

  it('should find info.json file even with different naming patterns', async () => {
    // Create an info.json file with a slightly different name pattern
    const alternativeInfoFile = path.join(testDir, 'test-video [abcd123].info.json');
    fs.writeFileSync(alternativeInfoFile, JSON.stringify({ duration: 180, title: 'Test Video Alt' }));
    
    // Remove the original info file
    fs.unlinkSync(testInfoFile);
    
    const DownloadManagerAny = DownloadManager as any;
    
    // Call handleDownloadComplete
    await DownloadManagerAny.handleDownloadComplete(
      'test-video-id',
      'Test Video',
      testVideoFile,
      { type: 'youtube_channel', sourceId: 'test-channel', channelTitle: 'Test Channel' }
    );

    // Check that the alternative info.json file was found and deleted
    expect(fs.existsSync(alternativeInfoFile)).toBe(false);
    
    // Check that essential files remain
    expect(fs.existsSync(testVideoFile)).toBe(true);
    expect(fs.existsSync(testThumbnailFile)).toBe(true);
  });
});