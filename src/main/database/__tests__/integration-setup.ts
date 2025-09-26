/**
 * Integration test setup utilities for SQLite database testing
 */

import fs from 'fs';
import path from 'path';
import DatabaseService from '../../services/DatabaseService';
import SimpleSchemaManager from '../SimpleSchemaManager';
import { MigrationService } from '../MigrationService';
import DatabaseErrorHandler from '../../services/DatabaseErrorHandler';

export class IntegrationTestSetup {
  private static tempDatabases: string[] = [];

  /**
   * Create an in-memory SQLite database for testing
   */
  static async createInMemoryDatabase(): Promise<DatabaseService> {
    const dbService = DatabaseService.getInstance();
    await dbService.initialize({ path: ':memory:' });

    // Initialize schema
    const schemaManager = new SimpleSchemaManager(dbService);
    await schemaManager.initializeSchema();

    return dbService;
  }

  /**
   * Create a temporary file-based database for testing
   */
  static async createTempDatabase(): Promise<{ dbService: DatabaseService; dbPath: string }> {
    const tempDir = '/tmp/claude/test-databases';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const dbPath = path.join(tempDir, `test-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    IntegrationTestSetup.tempDatabases.push(dbPath);

    const dbService = DatabaseService.getInstance();
    await dbService.initialize({ path: dbPath });

    // Initialize schema
    const schemaManager = new SimpleSchemaManager(dbService);
    await schemaManager.initializeSchema();

    return { dbService, dbPath };
  }

  /**
   * Create sample test data matching real JSON structure
   */
  static createSampleData() {
    return {
      videoSources: [
        {
          id: 'test-channel-1',
          type: 'youtube_channel',
          title: 'Test Channel 1',
          url: 'https://youtube.com/channel/UC123',
          sortOrder: 1
        },
        {
          id: 'test-local-1',
          type: 'local',
          title: 'Local Videos',
          path: '/test/videos',
          maxDepth: 2,
          sortOrder: 2
        }
      ],
      videos: [
        {
          id: 'test-video-1',
          title: 'Test Video 1',
          thumbnail: 'https://img.youtube.com/vi/test1/default.jpg',
          duration: 300,
          url: 'https://youtube.com/watch?v=test1',
          sourceId: 'test-channel-1'
        },
        {
          id: 'test-video-2',
          title: 'Local Test Video',
          duration: 600,
          url: '/test/videos/local.mp4',
          sourceId: 'test-local-1'
        }
      ],
      favorites: [
        {
          videoId: 'test-video-1',
          sourceType: 'youtube',
          title: 'Test Video 1',
          thumbnail: 'https://img.youtube.com/vi/test1/default.jpg',
          duration: 300,
          dateAdded: '2023-01-01T00:00:00.000Z',
          sourceId: 'test-channel-1'
        }
      ],
      watched: [
        {
          videoId: 'test-video-1',
          position: 150,
          timeWatched: 120,
          duration: 300,
          watched: false,
          firstWatched: '2023-01-01T10:00:00.000Z',
          lastWatched: '2023-01-01T10:02:00.000Z'
        }
      ]
    };
  }

  /**
   * Create a complete migration service for testing
   */
  static async createMigrationService(dbService: DatabaseService): Promise<MigrationService> {
    const schemaManager = new SimpleSchemaManager(dbService);
    const errorHandler = new DatabaseErrorHandler();
    return new MigrationService(dbService, schemaManager, errorHandler);
  }

  /**
   * Clean up all temporary databases
   */
  static cleanupTempDatabases() {
    for (const dbPath of IntegrationTestSetup.tempDatabases) {
      try {
        if (fs.existsSync(dbPath)) {
          fs.unlinkSync(dbPath);
        }
      } catch (error) {
        console.warn(`Failed to clean up temp database: ${dbPath}`, error);
      }
    }
    IntegrationTestSetup.tempDatabases = [];
  }

  /**
   * Create mock JSON loader with test data
   */
  static createMockJsonLoader(testData?: any) {
    const data = testData || IntegrationTestSetup.createSampleData();

    return {
      loadVideoSources: () => data.videoSources,
      loadFavorites: () => data.favorites,
      loadWatchedVideos: () => data.watched,
      loadUsageLogs: () => [],
      loadTimeLimits: () => ({}),
      loadMainSettings: () => ({})
    };
  }
}

export default IntegrationTestSetup;