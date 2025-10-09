import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DatabaseService from '../../services/DatabaseService';
import { SimpleSchemaManager } from '../SimpleSchemaManager';
import { resetDatabaseSingleton, createTestDatabase, cleanupTestDatabase } from './testHelpers';
import { findSourceById, findAllSources } from '../queries/sourceQueries';
import { findVideoById } from '../queries/videoQueries';
import { findViewRecordByVideoId, upsertViewRecord } from '../queries/viewRecordQueries';

// Mock Electron app for testing
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((type: string) => {
      if (type === 'userData') {
        return '/tmp/claude/test-userdata';
      }
      return '/tmp/claude';
    })
  }
}));

describe('Database Initialization', () => {
  let testDbPath: string;
  let dbService: DatabaseService;
  let schemaManager: SimpleSchemaManager;

  beforeEach(async () => {
    // Reset singleton to ensure test isolation
    resetDatabaseSingleton();

    // Use a temporary database file for testing
    testDbPath = path.join('/tmp/claude', 'test-database-init.db');

    // Ensure test directory exists
    const testDir = path.dirname(testDbPath);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testDbPath + '-wal')) {
      fs.unlinkSync(testDbPath + '-wal');
    }
    if (fs.existsSync(testDbPath + '-shm')) {
      fs.unlinkSync(testDbPath + '-shm');
    }

    // Initialize database service with test database
    dbService = await createTestDatabase({ useMemory: false, path: testDbPath });

    schemaManager = new SimpleSchemaManager(dbService);
  });

  afterEach(async () => {
    // Clean up test database and reset singleton
    await cleanupTestDatabase(dbService, testDbPath);
  });

  it('should initialize database with proper configuration', async () => {
    // Check if database file was created
    expect(fs.existsSync(testDbPath)).toBe(true);

    // Verify database health
    const healthStatus = await dbService.getHealthStatus();
    expect(healthStatus.initialized).toBe(true);
    expect(healthStatus.connected).toBe(true);

    // Test health check
    const health = await dbService.healthCheck();
    expect(health.isHealthy).toBe(true);
    expect(health.version).toBeDefined();
  });

  it('should create all tables for v1 schema correctly', async () => {
    // Initialize schema
    await schemaManager.initializeSchema();

    // Verify all required tables exist
    const tables = await dbService.all<{ name: string }>(`
      SELECT name FROM sqlite_master WHERE type='table'
      ORDER BY name
    `);

    const tableNames = tables.map(t => t.name);
    const expectedTables = [
      'schema_version',
      'sources',
      'videos',
      'videos_fts',
      'view_records',
      'favorites',
      'youtube_api_results',
      'usage_logs',
      'time_limits',
      'usage_extras',
      'settings',
      'downloads',
      'downloaded_videos',
      'searches',
      'wishlist',
      'search_results_cache'
    ];

    for (const table of expectedTables) {
      expect(tableNames).toContain(table);
    }

    // Verify schema version
    const version = await dbService.get<{ version: string }>(`
      SELECT version FROM schema_version WHERE id = 1
    `);
    expect(version?.version).toBe('v1');
  });

  it('should handle sources table operations correctly', async () => {
    await schemaManager.initializeSchema();

    // Test inserting a source
    const testSource = {
      id: 'test_source_1',
      type: 'youtube_channel',
      title: 'Test Channel',
      url: 'https://youtube.com/channel/UCtest',
      channelId: 'UCtest'
    };

    await dbService.run(`
      INSERT OR REPLACE INTO sources (id, type, title, sort_preference, position, url, channel_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      testSource.id,
      testSource.type,
      testSource.title,
      'newestFirst',
      1,
      testSource.url,
      testSource.channelId
    ]);

    // Verify the source was inserted using query helper
    const insertedSource = await findSourceById(dbService, testSource.id);

    expect(insertedSource).toBeDefined();
    expect(insertedSource?.id).toBe(testSource.id);
    expect(insertedSource?.type).toBe(testSource.type);
    expect(insertedSource?.title).toBe(testSource.title);
    expect(insertedSource?.url).toBe(testSource.url);
    expect(insertedSource?.channel_id).toBe(testSource.channelId);

    // Test count using query helper
    const allSources = await findAllSources(dbService);
    expect(allSources).toHaveLength(1);
  });

  it('should enforce foreign key constraints', async () => {
    await schemaManager.initializeSchema();

    // Insert a test source first
    await dbService.run(`
      INSERT OR REPLACE INTO sources (id, type, title, sort_preference, position, url, channel_id)
      VALUES ('test_source', 'youtube_channel', 'Test', 'newestFirst', 1, 'https://test.com', 'UC123')
    `);

    // Insert a video for the source
    await dbService.run(`
      INSERT INTO videos (id, source_id, title, url, duration, created_at)
      VALUES ('test_video', 'test_source', 'Test Video', 'https://test.com/video', 300, datetime('now'))
    `);

    // Try to insert a view record with invalid source_id - should fail
    await expect(
      dbService.run(`
        INSERT INTO view_records (source_id, video_id, position, time_watched, first_watched, last_watched)
        VALUES ('invalid_source', 'test_video', 100, 200, datetime('now'), datetime('now'))
      `)
    ).rejects.toThrow();

    // Valid insertion should work using query helper
    const now = new Date().toISOString();
    await upsertViewRecord(
      dbService,
      'test_video',
      'test_source',
      100,     // position
      200,     // timeWatched
      300,     // duration
      false,   // watched
      now,     // firstWatched
      now      // lastWatched
    );

    const record = await findViewRecordByVideoId(dbService, 'test_video');
    expect(record).toBeDefined();
    expect(record?.video_id).toBe('test_video');
  });

  it('should support database operations through IPC-like interface', async () => {
    await schemaManager.initializeSchema();

    // Test batch source insertion (simulating JSON migration)
    const testSources = [
      {
        id: 'src1',
        type: 'youtube_channel',
        title: 'Channel 1',
        url: 'https://youtube.com/channel/UC1',
        channelId: 'UC1'
      },
      {
        id: 'src2',
        type: 'youtube_playlist',
        title: 'Playlist 1',
        url: 'https://youtube.com/playlist?list=PL1',
        channelId: null
      },
      {
        id: 'src3',
        type: 'local',
        title: 'Local Videos',
        path: '/home/user/videos',
        maxDepth: 2
      }
    ];

    // Insert all sources
    let position = 1;
    for (const source of testSources) {
      const sortPref = source.type === 'youtube_channel' ? 'newestFirst' :
                       source.type === 'youtube_playlist' ? 'playlistOrder' : 'alphabetical';
      await dbService.run(`
        INSERT OR REPLACE INTO sources (id, type, title, sort_preference, position, url, channel_id, path, max_depth)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        source.id,
        source.type,
        source.title,
        sortPref,
        position++,
        (source as any).url || null,
        (source as any).channelId || null,
        (source as any).path || null,
        (source as any).maxDepth || null
      ]);
    }

    // Verify all sources were inserted
    const allSources = await dbService.all<any>(`
      SELECT id, type, title, url, channel_id, path, max_depth
      FROM sources
      ORDER BY id
    `);

    expect(allSources).toHaveLength(3);
    expect(allSources[0].id).toBe('src1');
    expect(allSources[0].type).toBe('youtube_channel');
    expect(allSources[1].id).toBe('src2');
    expect(allSources[1].type).toBe('youtube_playlist');
    expect(allSources[2].id).toBe('src3');
    expect(allSources[2].type).toBe('local');
    expect(allSources[2].path).toBe('/home/user/videos');
  });
});