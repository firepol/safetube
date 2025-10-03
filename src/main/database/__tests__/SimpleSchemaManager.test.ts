import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import '../../services/__tests__/setup'; // Import mocks
import DatabaseService from '../../services/DatabaseService';
import SimpleSchemaManager from '../SimpleSchemaManager';
import { resetDatabaseSingleton, createTestDatabase, cleanupTestDatabase } from './testHelpers';

const TEST_DB_PATH = '/tmp/claude/test-simple-schema-manager.db';

describe('SimpleSchemaManager', () => {
  let databaseService: DatabaseService;
  let schemaManager: SimpleSchemaManager;

  beforeEach(async () => {
    // Reset singleton to ensure test isolation
    resetDatabaseSingleton();

    // Clean up any existing test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Ensure test directory exists
    const testDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    databaseService = await createTestDatabase({ useMemory: false, path: TEST_DB_PATH });

    schemaManager = new SimpleSchemaManager(databaseService);
  });

  afterEach(async () => {
    // Clean up test database and reset singleton
    await cleanupTestDatabase(databaseService, TEST_DB_PATH);
  });

  test('should initialize Phase 1 schema successfully', async () => {
    await schemaManager.initializePhase1Schema();

    // Verify schema version was set
    const version = await schemaManager.getCurrentSchemaVersion();
    expect(version).toBeTruthy();
    expect(version?.phase).toBe('phase1');
    expect(version?.version).toBe(1);
  });

  test('should validate Phase 1 schema correctly', async () => {
    await schemaManager.initializePhase1Schema();

    const validation = await schemaManager.validatePhase1Schema();
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('should create all required Phase 1 tables', async () => {
    await schemaManager.initializePhase1Schema();

    // Check that all Phase 1 tables exist
    const tables = await databaseService.all<{ name: string }>(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    const tableNames = tables.map(t => t.name);

    const expectedTables = [
      'favorites',
      'schema_version',
      'sources',
      'videos',
      'videos_fts',
      'view_records',
      'youtube_api_results'
    ];

    for (const expectedTable of expectedTables) {
      expect(tableNames).toContain(expectedTable);
    }
  });

  test('should create required indexes', async () => {
    await schemaManager.initializePhase1Schema();

    // Check that required indexes exist
    const indexes = await databaseService.all<{ name: string }>(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    const indexNames = indexes.map(i => i.name);

    const expectedIndexes = [
      'idx_sources_type',
      'idx_sources_title',
      'idx_videos_source_id',
      'idx_videos_title',
      'idx_favorites_video_id',
      'idx_view_records_video_id'
    ];

    for (const expectedIndex of expectedIndexes) {
      expect(indexNames).toContain(expectedIndex);
    }
  });

  test('should create FTS table and triggers', async () => {
    await schemaManager.initializePhase1Schema();

    // Verify FTS table exists
    const ftsTable = await databaseService.get(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='videos_fts'
    `);
    expect(ftsTable).toBeTruthy();

    // Verify triggers exist
    const triggers = await databaseService.all<{ name: string }>(`
      SELECT name FROM sqlite_master
      WHERE type='trigger'
      ORDER BY name
    `);

    const triggerNames = triggers.map(t => t.name);
    expect(triggerNames).toContain('videos_fts_insert');
    expect(triggerNames).toContain('videos_fts_update');
    expect(triggerNames).toContain('videos_fts_delete');
  });

  test('should handle foreign key constraints correctly', async () => {
    await schemaManager.initializePhase1Schema();

    // Check if foreign keys are enabled
    const fkStatus = await databaseService.get<{ foreign_keys: number }>('PRAGMA foreign_keys');
    expect(fkStatus?.foreign_keys).toBe(1);

    // Insert a source first
    await databaseService.run(`
      INSERT OR REPLACE INTO sources (id, type, title, url)
      VALUES ('test-source', 'youtube_channel', 'Test Source', 'https://youtube.com/test')
    `);

    // Insert a video referencing the source
    await databaseService.run(`
      INSERT INTO videos (id, title, source_id)
      VALUES ('test-video', 'Test Video', 'test-source')
    `);

    // Try to insert a video with non-existent source (should fail)
    await expect(databaseService.run(`
      INSERT INTO videos (id, title, source_id)
      VALUES ('invalid-video', 'Invalid Video', 'non-existent-source')
    `)).rejects.toThrow();
  });

  test('should test FTS functionality', async () => {
    await schemaManager.initializePhase1Schema();

    // Insert a source and video with description
    await databaseService.run(`
      INSERT OR REPLACE INTO sources (id, type, title, url)
      VALUES ('test-source', 'youtube_channel', 'Test Source', 'https://youtube.com/test')
    `);

    await databaseService.run(`
      INSERT INTO videos (id, title, description, source_id)
      VALUES ('test-video', 'Amazing Tutorial', 'This is an amazing tutorial about programming', 'test-source')
    `);

    // Test FTS search
    const searchResults = await databaseService.all(`
      SELECT v.id, v.title
      FROM videos_fts fts
      JOIN videos v ON fts.rowid = v.rowid
      WHERE videos_fts MATCH 'amazing'
    `);

    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].title).toBe('Amazing Tutorial');
  });

  test('should not reinitialize if schema already exists', async () => {
    // Initialize schema first time
    await schemaManager.initializePhase1Schema();
    const firstVersion = await schemaManager.getCurrentSchemaVersion();

    // Try to initialize again
    await schemaManager.initializePhase1Schema();
    const secondVersion = await schemaManager.getCurrentSchemaVersion();

    // Should be the same
    expect(firstVersion?.updated_at).toBe(secondVersion?.updated_at);
  });

  test('should drop schema correctly', async () => {
    await schemaManager.initializePhase1Schema();

    // Verify tables exist
    const tablesBefore = await databaseService.all(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    expect(tablesBefore.length).toBeGreaterThan(0);

    // Drop schema
    await schemaManager.dropSchema();

    // Verify tables are gone
    const tablesAfter = await databaseService.all(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    expect(tablesAfter).toHaveLength(0);
  });
});