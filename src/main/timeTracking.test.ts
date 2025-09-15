import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordVideoWatching } from './timeTracking';
import * as fileUtils from './fileUtils';
import * as sharedFileUtils from '../shared/fileUtils';

// Mock the dependencies
vi.mock('./fileUtils');
vi.mock('../shared/fileUtils');
vi.mock('../shared/videoDurationUtils', () => ({
  extractVideoDuration: vi.fn().mockResolvedValue(120) // 2 minutes
}));

// Mock fs
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false)
  };
});

describe('Enhanced History Recording', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the file utils
    vi.mocked(fileUtils.readWatchedVideos).mockResolvedValue([]);
    vi.mocked(fileUtils.writeWatchedVideos).mockResolvedValue();
    vi.mocked(fileUtils.readUsageLog).mockResolvedValue({});
    vi.mocked(fileUtils.writeUsageLog).mockResolvedValue();
    vi.mocked(fileUtils.readVideoSources).mockResolvedValue([
      {
        id: 'test-local',
        type: 'local',
        path: '/home/user/videos',
        title: 'Test Videos'
      }
    ]);

    // Mock global videos for YouTube tests
    global.currentVideos = [
      {
        id: 'dQw4w9WgXcQ',
        title: 'Test YouTube Video',
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        sourceId: 'youtube-channel-1',
        duration: 180
      }
    ];

    // Mock shared file utils
    vi.mocked(sharedFileUtils.parseVideoId).mockImplementation((videoId) => {
      if (videoId.startsWith('local:')) {
        return {
          success: true,
          parsed: {
            type: 'local',
            originalId: videoId,
            path: videoId.substring(6)
          }
        };
      } else if (videoId.length === 11) {
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

    vi.mocked(sharedFileUtils.extractPathFromVideoId).mockImplementation((videoId) => {
      if (videoId.startsWith('local:')) {
        return videoId.substring(6);
      }
      return null;
    });
  });

  it('should record local video with enhanced metadata', async () => {
    const videoId = 'local:/home/user/videos/test-movie.mp4';
    const mockWriteWatchedVideos = vi.mocked(fileUtils.writeWatchedVideos);

    await recordVideoWatching(videoId, 60, 30, 120);

    expect(mockWriteWatchedVideos).toHaveBeenCalledWith([
      expect.objectContaining({
        videoId,
        position: 60,
        timeWatched: 30,
        duration: 120,
        title: 'test-movie',
        thumbnail: '',
        source: 'test-local',
        watched: false // 60/120 = 50%, not 90%+
      })
    ]);
  });

  it('should record YouTube video with enhanced metadata', async () => {
    const videoId = 'dQw4w9WgXcQ';
    const mockWriteWatchedVideos = vi.mocked(fileUtils.writeWatchedVideos);

    await recordVideoWatching(videoId, 162, 45, 180);

    expect(mockWriteWatchedVideos).toHaveBeenCalledWith([
      expect.objectContaining({
        videoId,
        position: 162,
        timeWatched: 45,
        duration: 180,
        title: 'Test YouTube Video',
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        source: 'youtube-channel-1',
        watched: true // 162/180 = 90%+
      })
    ]);
  });

  it('should preserve existing data when updating', async () => {
    const videoId = 'local:/home/user/videos/test-movie.mp4';
    const existingEntry = {
      videoId,
      position: 30,
      lastWatched: '2025-01-01T10:00:00.000Z',
      timeWatched: 15,
      duration: 120,
      title: 'Old Title',
      source: 'old-source'
    };

    vi.mocked(fileUtils.readWatchedVideos).mockResolvedValue([existingEntry]);
    const mockWriteWatchedVideos = vi.mocked(fileUtils.writeWatchedVideos);

    await recordVideoWatching(videoId, 60, 30, 120);

    expect(mockWriteWatchedVideos).toHaveBeenCalledWith([
      expect.objectContaining({
        videoId,
        position: 60, // Updated
        timeWatched: 30, // Updated
        title: 'test-movie', // Updated with fresh metadata
        source: 'test-local', // Updated with fresh metadata
        firstWatched: '2025-01-01T10:00:00.000Z', // Preserved
      })
    ]);
  });

  it('should handle unknown video IDs gracefully', async () => {
    const videoId = 'unknown-video-format';
    const mockWriteWatchedVideos = vi.mocked(fileUtils.writeWatchedVideos);

    await recordVideoWatching(videoId, 30, 15, 60);

    expect(mockWriteWatchedVideos).toHaveBeenCalledWith([
      expect.objectContaining({
        videoId,
        position: 30,
        timeWatched: 15,
        duration: 60,
        title: 'Video unknown-video-format',
        thumbnail: '',
        source: 'unknown'
      })
    ]);
  });

  it('should determine watched status correctly', async () => {
    const videoId = 'local:/home/user/videos/test.mp4';
    const mockWriteWatchedVideos = vi.mocked(fileUtils.writeWatchedVideos);

    // Test 90% completion (watched = true)
    await recordVideoWatching(videoId, 108, 30, 120); // 108/120 = 90%

    expect(mockWriteWatchedVideos).toHaveBeenCalledWith([
      expect.objectContaining({
        watched: true
      })
    ]);
  });
});