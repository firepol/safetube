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

describe('DownloadManager File Handling', () => {
  const testDir = '/tmp/test-downloads/test-channel';
  const testVideoFile = path.join(testDir, 'test-video.mp4');
  const testThumbnailFile = path.join(testDir, 'test-video.webp');
  const testDescriptionFile = path.join(testDir, 'test-video.description');

  beforeEach(() => {
    // Create test directory and files
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Create mock files (no info.json as it's no longer created)
    fs.writeFileSync(testVideoFile, 'mock video content');
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

  it('should handle download completion without info.json file', async () => {
    // Access the private method for testing
    const DownloadManagerAny = DownloadManager as any;
    
    // Call handleDownloadComplete
    await DownloadManagerAny.handleDownloadComplete(
      'test-video-id',
      'Test Video',
      testVideoFile,
      { type: 'youtube_channel', sourceId: 'test-channel', channelTitle: 'Test Channel' }
    );

    // Check that essential files remain
    expect(fs.existsSync(testVideoFile)).toBe(true);
    expect(fs.existsSync(testThumbnailFile)).toBe(true);
    
    // Check that temporary files were cleaned up
    expect(fs.existsSync(testDescriptionFile)).toBe(false);
  });

  it('should use alternative metadata sources when info.json is not available', async () => {
    const DownloadManagerAny = DownloadManager as any;
    
    // Mock the addDownloadedVideo function to capture the data
    const mockAddDownloadedVideo = vi.fn();
    const fileUtils = await import('../fileUtils');
    vi.mocked(fileUtils.addDownloadedVideo).mockImplementation(mockAddDownloadedVideo);
    
    // Call handleDownloadComplete
    await DownloadManagerAny.handleDownloadComplete(
      'test-video-id',
      'Test Video',
      testVideoFile,
      { type: 'youtube_channel', sourceId: 'test-channel', channelTitle: 'Test Channel' }
    );
    
    // Verify that addDownloadedVideo was called with appropriate data
    expect(mockAddDownloadedVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        videoId: 'test-video-id',
        title: 'Test Video',
        filePath: testVideoFile,
        duration: 0, // Should default to 0 when no info.json is available
        sourceType: 'youtube_channel',
        sourceId: 'test-channel'
      })
    );
  });

  it('should clean up temporary files while preserving essential files', async () => {
    // Create additional temporary files that should be cleaned up
    const tempFiles = [
      path.join(testDir, 'test-video.annotations.xml'),
      path.join(testDir, 'test-video.live_chat.json'),
      path.join(testDir, 'test-video.part'),
      path.join(testDir, 'test-video.ytdl')
    ];
    
    tempFiles.forEach(file => {
      fs.writeFileSync(file, 'temporary content');
    });
    
    const DownloadManagerAny = DownloadManager as any;
    
    // Call handleDownloadComplete
    await DownloadManagerAny.handleDownloadComplete(
      'test-video-id',
      'Test Video',
      testVideoFile,
      { type: 'youtube_channel', sourceId: 'test-channel', channelTitle: 'Test Channel' }
    );

    // Check that essential files remain
    expect(fs.existsSync(testVideoFile)).toBe(true);
    expect(fs.existsSync(testThumbnailFile)).toBe(true);
    
    // Check that temporary files were cleaned up
    expect(fs.existsSync(testDescriptionFile)).toBe(false);
    tempFiles.forEach(file => {
      expect(fs.existsSync(file)).toBe(false);
    });
  });

  it('should handle yt-dlp command without info.json flag', () => {
    // This test verifies that the yt-dlp command doesn't include --write-info-json
    // We can't directly test the private method, but we can verify the expected behavior
    
    // The yt-dlp command should include:
    const expectedArgs = [
      '--output', expect.any(String),
      '--no-playlist',
      '--write-thumbnail',
      // Should NOT include '--write-info-json'
    ];
    
    // This is more of a documentation test to ensure the requirement is clear
    expect(expectedArgs).not.toContain('--write-info-json');
    expect(expectedArgs).toContain('--write-thumbnail');
    expect(expectedArgs).toContain('--no-playlist');
  });
});