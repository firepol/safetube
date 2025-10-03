import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import '../../services/__tests__/setup'; // Import mocks
import DatabaseService from '../../services/DatabaseService';
import { resetDatabaseSingleton, createTestDatabase, cleanupTestDatabase } from './testHelpers';

const TEST_DB_PATH = '/tmp/claude/test-simple-schema.db';

describe('Simple Schema Test', () => {
  let databaseService: DatabaseService;

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
  });

  afterEach(async () => {
    // Clean up test database and reset singleton
    await cleanupTestDatabase(databaseService, TEST_DB_PATH);
  });

  test('should create a simple table', async () => {
    await databaseService.run(`
      CREATE TABLE IF NOT EXISTS test_sources (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL
      )
    `);

    // Verify table was created
    const tables = await databaseService.all(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='test_sources'
    `);

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('test_sources');
  });

  test('should handle multiple statements', async () => {
    // Create table
    await databaseService.run(`
      CREATE TABLE IF NOT EXISTS test_sources (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL
      )
    `);

    // Create index
    await databaseService.run(`
      CREATE INDEX IF NOT EXISTS idx_test_sources_title ON test_sources(title)
    `);

    // Verify both table and index exist
    const tables = await databaseService.all(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='test_sources'
    `);

    const indexes = await databaseService.all(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND name='idx_test_sources_title'
    `);

    expect(tables).toHaveLength(1);
    expect(indexes).toHaveLength(1);
  });

  test('should handle FTS table creation', async () => {
    // Create base table first
    await databaseService.run(`
      CREATE TABLE IF NOT EXISTS test_videos (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT
      )
    `);

    // Create FTS table
    await databaseService.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS test_videos_fts USING fts5(
          id UNINDEXED,
          title,
          description,
          content='test_videos',
          content_rowid='rowid'
      )
    `);

    // Verify FTS table was created
    const ftsTable = await databaseService.get(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='test_videos_fts'
    `);

    expect(ftsTable).toBeTruthy();
  });
});