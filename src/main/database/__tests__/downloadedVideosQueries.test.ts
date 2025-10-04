import './../../services/__tests__/setup'; // Import mocks first
import DatabaseService from '../../services/DatabaseService';
import SimpleSchemaManager from '../SimpleSchemaManager';
import { resetDatabaseSingleton, createTestDatabase, cleanupTestDatabase } from './testHelpers';
import {
  getAllDownloadedVideos,
  getDownloadedVideosBySource,
  getDownloadedVideoById,
  createDownloadedVideo,
  isVideoDownloaded,
  getTotalDownloadedSize,
  countDownloadedVideos,
  deleteDownloadedVideo,
  updateDownloadedVideoFileSize,
  getDownloadedVideosByFormat,
  getRecentDownloadedVideos
} from '../queries/downloadedVideosQueries';

describe('Downloaded Videos Queries', () => {
  let db: DatabaseService;
  let schemaManager: SimpleSchemaManager;

  beforeEach(async () => {
    // Reset singleton for test isolation
    resetDatabaseSingleton();

    // Create in-memory test database
    db = await createTestDatabase({ useMemory: true });
    schemaManager = new SimpleSchemaManager(db);

    // Initialize Phase 1 and Phase 2 schemas
    await schemaManager.initializePhase1Schema();
    await schemaManager.initializePhase2Schema();

    // Create test sources
    await db.run(`
      INSERT INTO sources (id, type, title, url)
      VALUES ('test-channel', 'youtube_channel', 'Test Channel', 'https://youtube.com/@test')
    `);

    await db.run(`
      INSERT INTO sources (id, type, title, url)
      VALUES ('test-playlist', 'youtube_playlist', 'Test Playlist', 'https://youtube.com/playlist?list=PLtest')
    `);
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('basic CRUD operations', () => {
    it('should create and retrieve downloaded video with all fields', async () => {
      await createDownloadedVideo(db, {
        videoId: 'vid1',
        sourceId: 'test-channel',
        title: 'My Video',
        filePath: '/path/video.mp4',
        thumbnailPath: '/path/thumb.jpg',
        duration: 300,
        fileSize: 1024000,
        format: 'mp4'
      });

      const video = await getDownloadedVideoById(db, 'vid1');
      expect(video).toBeTruthy();
      expect(video?.video_id).toBe('vid1');
      expect(video?.file_size).toBe(1024000);
    });

    it('should create downloaded video with minimal fields', async () => {
      await createDownloadedVideo(db, {
        videoId: 'vid2',
        sourceId: 'test-channel',
        title: 'Simple',
        filePath: '/path/simple.mp4'
      });

      const video = await getDownloadedVideoById(db, 'vid2');
      expect(video).toBeTruthy();
      expect(video?.thumbnail_path).toBeNull();
    });

    it('should get all downloaded videos', async () => {
      await createDownloadedVideo(db, {
        videoId: 'vid1',
        sourceId: 'test-channel',
        title: 'Video 1',
        filePath: '/path/1.mp4'
      });

      await createDownloadedVideo(db, {
        videoId: 'vid2',
        sourceId: 'test-channel',
        title: 'Video 2',
        filePath: '/path/2.mp4'
      });

      const videos = await getAllDownloadedVideos(db);
      expect(videos.length).toBe(2);
    });

    it('should filter by source', async () => {
      await createDownloadedVideo(db, {
        videoId: 'vid1',
        sourceId: 'test-channel',
        title: 'Channel Video',
        filePath: '/path/1.mp4'
      });

      await createDownloadedVideo(db, {
        videoId: 'vid2',
        sourceId: 'test-playlist',
        title: 'Playlist Video',
        filePath: '/path/2.mp4'
      });

      const channelVideos = await getDownloadedVideosBySource(db, 'test-channel');
      expect(channelVideos).toHaveLength(1);
      expect(channelVideos[0].video_id).toBe('vid1');
    });

    it('should check if video is downloaded', async () => {
      expect(await isVideoDownloaded(db, 'vid1')).toBe(false);

      await createDownloadedVideo(db, {
        videoId: 'vid1',
        sourceId: 'test-channel',
        title: 'Downloaded',
        filePath: '/path/video.mp4'
      });

      expect(await isVideoDownloaded(db, 'vid1')).toBe(true);
    });

    it('should delete downloaded video', async () => {
      await createDownloadedVideo(db, {
        videoId: 'vid1',
        sourceId: 'test-channel',
        title: 'Video',
        filePath: '/path/video.mp4'
      });

      await deleteDownloadedVideo(db, 'vid1');
      expect(await isVideoDownloaded(db, 'vid1')).toBe(false);
    });

    it('should update file size', async () => {
      await createDownloadedVideo(db, {
        videoId: 'vid1',
        sourceId: 'test-channel',
        title: 'Video',
        filePath: '/path/video.mp4'
      });

      await updateDownloadedVideoFileSize(db, 'vid1', 5000000);

      const video = await getDownloadedVideoById(db, 'vid1');
      expect(video?.file_size).toBe(5000000);
    });
  });

  describe('aggregate functions', () => {
    it('should calculate total downloaded size', async () => {
      await createDownloadedVideo(db, {
        videoId: 'vid1',
        sourceId: 'test-channel',
        title: 'Video 1',
        filePath: '/path/1.mp4',
        fileSize: 1000000
      });

      await createDownloadedVideo(db, {
        videoId: 'vid2',
        sourceId: 'test-playlist',
        title: 'Video 2',
        filePath: '/path/2.mp4',
        fileSize: 2000000
      });

      const total = await getTotalDownloadedSize(db);
      expect(total).toBe(3000000);
    });

    it('should calculate size per source', async () => {
      await createDownloadedVideo(db, {
        videoId: 'vid1',
        sourceId: 'test-channel',
        title: 'Video 1',
        filePath: '/path/1.mp4',
        fileSize: 1000000
      });

      await createDownloadedVideo(db, {
        videoId: 'vid2',
        sourceId: 'test-channel',
        title: 'Video 2',
        filePath: '/path/2.mp4',
        fileSize: 1500000
      });

      const size = await getTotalDownloadedSize(db, 'test-channel');
      expect(size).toBe(2500000);
    });

    it('should count downloaded videos', async () => {
      await createDownloadedVideo(db, {
        videoId: 'vid1',
        sourceId: 'test-channel',
        title: 'Video 1',
        filePath: '/path/1.mp4'
      });

      await createDownloadedVideo(db, {
        videoId: 'vid2',
        sourceId: 'test-playlist',
        title: 'Video 2',
        filePath: '/path/2.mp4'
      });

      expect(await countDownloadedVideos(db)).toBe(2);
      expect(await countDownloadedVideos(db, 'test-channel')).toBe(1);
    });

    it('should filter by format', async () => {
      await createDownloadedVideo(db, {
        videoId: 'vid1',
        sourceId: 'test-channel',
        title: 'MP4 Video',
        filePath: '/path/1.mp4',
        format: 'mp4'
      });

      await createDownloadedVideo(db, {
        videoId: 'vid2',
        sourceId: 'test-channel',
        title: 'WebM Video',
        filePath: '/path/2.webm',
        format: 'webm'
      });

      const mp4Videos = await getDownloadedVideosByFormat(db, 'mp4');
      expect(mp4Videos).toHaveLength(1);
    });

    it('should get recent downloads', async () => {
      for (let i = 1; i <= 5; i++) {
        await createDownloadedVideo(db, {
          videoId: `vid${i}`,
          sourceId: 'test-channel',
          title: `Video ${i}`,
          filePath: `/path/${i}.mp4`
        });
      }

      const recent = await getRecentDownloadedVideos(db, 3);
      expect(recent).toHaveLength(3);
    });
  });

  describe('constraints and foreign keys', () => {
    it('should enforce unique video_id', async () => {
      await createDownloadedVideo(db, {
        videoId: 'vid1',
        sourceId: 'test-channel',
        title: 'Video 1',
        filePath: '/path/1.mp4'
      });

      await expect(createDownloadedVideo(db, {
        videoId: 'vid1',
        sourceId: 'test-channel',
        title: 'Video 2',
        filePath: '/path/2.mp4'
      })).rejects.toThrow();
    });

    it('should cascade delete when source is deleted', async () => {
      await createDownloadedVideo(db, {
        videoId: 'vid1',
        sourceId: 'test-channel',
        title: 'Video',
        filePath: '/path/video.mp4'
      });

      await db.run('DELETE FROM sources WHERE id = ?', ['test-channel']);

      const video = await getDownloadedVideoById(db, 'vid1');
      expect(video).toBeNull();
    });
  });
});
