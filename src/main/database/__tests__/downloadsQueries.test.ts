import './../../services/__tests__/setup'; // Import mocks first
import DatabaseService from '../../services/DatabaseService';
import SimpleSchemaManager from '../SimpleSchemaManager';
import { resetDatabaseSingleton, createTestDatabase, cleanupTestDatabase } from './testHelpers';
import {
  getDownloadStatus,
  getAllDownloads,
  getActiveDownloads,
  createDownload,
  updateDownloadProgress,
  markDownloadCompleted,
  markDownloadFailed,
  deleteDownload,
  cleanupOldDownloads,
  countDownloadsByStatus,
  isDownloading
} from '../queries/downloadsQueries';

describe('Downloads Queries', () => {
  let db: DatabaseService;
  let schemaManager: SimpleSchemaManager;

  beforeEach(async () => {
    // Reset singleton for test isolation
    resetDatabaseSingleton();

    // Create in-memory test database
    db = await createTestDatabase({ useMemory: true });
    schemaManager = new SimpleSchemaManager(db);

    // Initialize the consolidated schema
    await schemaManager.initializeSchema();

    // Create test source for foreign key
    await db.run(`
      INSERT INTO sources (id, type, title, url)
      VALUES ('test-channel', 'youtube_channel', 'Test Channel', 'https://youtube.com/@test')
    `);
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('createDownload and getDownloadStatus', () => {
    it('should create new download with pending status', async () => {
      await createDownload(db, 'video123', 'test-channel');

      const download = await getDownloadStatus(db, 'video123');
      expect(download).toBeTruthy();
      expect(download?.video_id).toBe('video123');
      expect(download?.source_id).toBe('test-channel');
      expect(download?.status).toBe('pending');
      expect(download?.progress).toBe(0);
    });

    it('should return null for non-existent download', async () => {
      const download = await getDownloadStatus(db, 'nonexistent');
      expect(download).toBeNull();
    });

    it('should enforce unique video_id constraint', async () => {
      await createDownload(db, 'video123', 'test-channel');

      // Second insert should fail
      await expect(createDownload(db, 'video123', 'test-channel')).rejects.toThrow();
    });
  });

  describe('updateDownloadProgress', () => {
    it('should update progress and status to downloading', async () => {
      await createDownload(db, 'video123', 'test-channel');
      await updateDownloadProgress(db, 'video123', 50);

      const download = await getDownloadStatus(db, 'video123');
      expect(download?.status).toBe('downloading');
      expect(download?.progress).toBe(50);
    });

    it('should clamp progress to 0-100 range', async () => {
      await createDownload(db, 'video123', 'test-channel');

      await updateDownloadProgress(db, 'video123', 150);
      let download = await getDownloadStatus(db, 'video123');
      expect(download?.progress).toBe(100);

      await updateDownloadProgress(db, 'video123', -50);
      download = await getDownloadStatus(db, 'video123');
      expect(download?.progress).toBe(0);
    });
  });

  describe('markDownloadCompleted', () => {
    it('should mark download as completed with file path', async () => {
      await createDownload(db, 'video123', 'test-channel');
      await markDownloadCompleted(db, 'video123', '/path/to/video.mp4');

      const download = await getDownloadStatus(db, 'video123');
      expect(download?.status).toBe('completed');
      expect(download?.progress).toBe(100);
      expect(download?.file_path).toBe('/path/to/video.mp4');
      expect(download?.end_time).toBeTruthy();
    });
  });

  describe('markDownloadFailed', () => {
    it('should mark download as failed with error message', async () => {
      await createDownload(db, 'video123', 'test-channel');
      await markDownloadFailed(db, 'video123', 'Network error');

      const download = await getDownloadStatus(db, 'video123');
      expect(download?.status).toBe('failed');
      expect(download?.error_message).toBe('Network error');
      expect(download?.end_time).toBeTruthy();
    });
  });

  describe('getAllDownloads', () => {
    it('should get all downloads ordered by id (most recent first)', async () => {
      await createDownload(db, 'video1', 'test-channel');
      await createDownload(db, 'video2', 'test-channel');
      await createDownload(db, 'video3', 'test-channel');

      const downloads = await getAllDownloads(db);
      expect(downloads).toHaveLength(3);
      expect(downloads[0].video_id).toBe('video3'); // Most recent (highest id) first
    });

    it('should filter downloads by status', async () => {
      await createDownload(db, 'video1', 'test-channel');
      await createDownload(db, 'video2', 'test-channel');
      await updateDownloadProgress(db, 'video2', 50);
      await createDownload(db, 'video3', 'test-channel');

      const downloading = await getAllDownloads(db, 'downloading');
      expect(downloading).toHaveLength(1);
      expect(downloading[0].video_id).toBe('video2');

      const pending = await getAllDownloads(db, 'pending');
      expect(pending).toHaveLength(2);
    });
  });

  describe('getActiveDownloads', () => {
    it('should get only pending and downloading downloads', async () => {
      await createDownload(db, 'video1', 'test-channel');
      await createDownload(db, 'video2', 'test-channel');
      await updateDownloadProgress(db, 'video2', 50);
      await createDownload(db, 'video3', 'test-channel');
      await markDownloadCompleted(db, 'video3', '/path/to/video3.mp4');

      const active = await getActiveDownloads(db);
      expect(active).toHaveLength(2);
      expect(active.every(d => ['pending', 'downloading'].includes(d.status))).toBe(true);
    });
  });

  describe('deleteDownload', () => {
    it('should delete download record', async () => {
      await createDownload(db, 'video123', 'test-channel');
      await deleteDownload(db, 'video123');

      const download = await getDownloadStatus(db, 'video123');
      expect(download).toBeNull();
    });
  });

  describe('cleanupOldDownloads', () => {
    it('should remove completed downloads older than 7 days', async () => {
      const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);

      // Create old completed download
      await db.run(`
        INSERT INTO downloads (video_id, source_id, status, progress, start_time, end_time)
        VALUES ('old-video', 'test-channel', 'completed', 100, ?, ?)
      `, [eightDaysAgo, eightDaysAgo]);

      // Create recent completed download
      await createDownload(db, 'recent-video', 'test-channel');
      await markDownloadCompleted(db, 'recent-video', '/path/to/recent.mp4');

      const result = await cleanupOldDownloads(db);
      expect(result.removed).toBe(1);

      // Old one should be gone
      const oldDownload = await getDownloadStatus(db, 'old-video');
      expect(oldDownload).toBeNull();

      // Recent one should remain
      const recentDownload = await getDownloadStatus(db, 'recent-video');
      expect(recentDownload).toBeTruthy();
    });

    it('should remove failed downloads older than 30 days', async () => {
      const thirtyOneDaysAgo = Date.now() - (31 * 24 * 60 * 60 * 1000);

      // Create old failed download
      await db.run(`
        INSERT INTO downloads (video_id, source_id, status, progress, start_time, end_time, error_message)
        VALUES ('old-failed', 'test-channel', 'failed', 50, ?, ?, 'Network error')
      `, [thirtyOneDaysAgo, thirtyOneDaysAgo]);

      // Create recent failed download
      await createDownload(db, 'recent-failed', 'test-channel');
      await markDownloadFailed(db, 'recent-failed', 'Disk full');

      const result = await cleanupOldDownloads(db);
      expect(result.removed).toBe(1);

      // Old one should be gone
      const oldDownload = await getDownloadStatus(db, 'old-failed');
      expect(oldDownload).toBeNull();

      // Recent one should remain
      const recentDownload = await getDownloadStatus(db, 'recent-failed');
      expect(recentDownload).toBeTruthy();
    });
  });

  describe('countDownloadsByStatus', () => {
    it('should count downloads by status', async () => {
      await createDownload(db, 'video1', 'test-channel');
      await createDownload(db, 'video2', 'test-channel');
      await updateDownloadProgress(db, 'video2', 50);
      await createDownload(db, 'video3', 'test-channel');
      await markDownloadCompleted(db, 'video3', '/path/to/video3.mp4');
      await createDownload(db, 'video4', 'test-channel');
      await markDownloadFailed(db, 'video4', 'Error');

      expect(await countDownloadsByStatus(db, 'pending')).toBe(1);
      expect(await countDownloadsByStatus(db, 'downloading')).toBe(1);
      expect(await countDownloadsByStatus(db, 'completed')).toBe(1);
      expect(await countDownloadsByStatus(db, 'failed')).toBe(1);
    });
  });

  describe('isDownloading', () => {
    it('should return true if video is pending or downloading', async () => {
      await createDownload(db, 'video1', 'test-channel');
      expect(await isDownloading(db, 'video1')).toBe(true);

      await updateDownloadProgress(db, 'video1', 50);
      expect(await isDownloading(db, 'video1')).toBe(true);
    });

    it('should return false if video is completed or failed', async () => {
      await createDownload(db, 'video1', 'test-channel');
      await markDownloadCompleted(db, 'video1', '/path/to/video.mp4');
      expect(await isDownloading(db, 'video1')).toBe(false);

      await createDownload(db, 'video2', 'test-channel');
      await markDownloadFailed(db, 'video2', 'Error');
      expect(await isDownloading(db, 'video2')).toBe(false);
    });

    it('should return false for non-existent video', async () => {
      expect(await isDownloading(db, 'nonexistent')).toBe(false);
    });
  });

  describe('foreign key constraints', () => {
    it('should cascade delete when source is deleted', async () => {
      await createDownload(db, 'video123', 'test-channel');

      // Delete source
      await db.run('DELETE FROM sources WHERE id = ?', ['test-channel']);

      // Download should be deleted
      const download = await getDownloadStatus(db, 'video123');
      expect(download).toBeNull();
    });
  });

  describe('status check constraint', () => {
    it('should reject invalid status values', async () => {
      await expect(db.run(`
        INSERT INTO downloads (video_id, source_id, status, progress)
        VALUES ('video123', 'test-channel', 'invalid-status', 0)
      `)).rejects.toThrow();
    });

    it('should accept valid status values', async () => {
      const validStatuses = ['pending', 'downloading', 'completed', 'failed'];

      for (const status of validStatuses) {
        await db.run(`
          INSERT INTO downloads (video_id, source_id, status, progress)
          VALUES (?, 'test-channel', ?, 0)
        `, [`video-${status}`, status]);
      }

      const downloads = await getAllDownloads(db);
      expect(downloads).toHaveLength(validStatuses.length);
    });
  });
});
