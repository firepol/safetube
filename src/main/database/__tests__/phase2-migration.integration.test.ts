import './../../services/__tests__/setup'; // Import mocks first
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import DatabaseService from '../../services/DatabaseService';
import SimpleSchemaManager from '../SimpleSchemaManager';
import { resetDatabaseSingleton, createTestDatabase, cleanupTestDatabase } from './testHelpers';

describe('Phase 2 Migration Integration', () => {
  let dbService: DatabaseService;
  let schemaManager: SimpleSchemaManager;

  beforeEach(async () => {
    // Reset singleton to ensure test isolation
    resetDatabaseSingleton();

    // Create in-memory test database
    dbService = await createTestDatabase({ useMemory: true });
    schemaManager = new SimpleSchemaManager(dbService);

    // Initialize Phase 1 schema
    await schemaManager.initializePhase1Schema();
  });

  afterEach(async () => {
    await cleanupTestDatabase(dbService);
  });

  it('should create Phase 2 tables successfully', async () => {
    // Initialize Phase 2 schema
    await schemaManager.initializePhase2Schema();

    // Verify all Phase 2 tables exist
    const tables = await dbService.all<{ name: string }>(`
      SELECT name FROM sqlite_master WHERE type='table' AND name IN ('usage_logs', 'time_limits', 'usage_extras', 'settings')
    `);

    expect(tables).toHaveLength(4);
    const tableNames = tables.map(t => t.name).sort();
    expect(tableNames).toEqual(['settings', 'time_limits', 'usage_extras', 'usage_logs']);
  });

  it('should create default time limits', async () => {
    // Initialize Phase 2 schema
    await schemaManager.initializePhase2Schema();

    // Check that default time limits were created (single-row table)
    const timeLimits = await dbService.get<any>('SELECT * FROM time_limits WHERE id = 1');

    // Should have 1 row with id = 1
    expect(timeLimits).toBeDefined();
    expect(timeLimits?.id).toBe(1);

    // Verify default values (0 minutes per day by default)
    expect(timeLimits?.monday).toBe(0);
    expect(timeLimits?.tuesday).toBe(0);
    expect(timeLimits?.wednesday).toBe(0);
    expect(timeLimits?.thursday).toBe(0);
    expect(timeLimits?.friday).toBe(0);
    expect(timeLimits?.saturday).toBe(0);
    expect(timeLimits?.sunday).toBe(0);
  });

  it('should update schema version to phase2', async () => {
    // Initialize Phase 2 schema
    await schemaManager.initializePhase2Schema();

    // Update schema version manually
    await dbService.run(`UPDATE schema_version SET phase = 'phase2', updated_at = CURRENT_TIMESTAMP WHERE id = 1`);

    // Verify schema version
    const schemaVersion = await dbService.get<{ phase: string }>('SELECT phase FROM schema_version WHERE id = 1');

    expect(schemaVersion?.phase).toBe('phase2');
  });

  it('should preserve existing Phase 1 data when adding Phase 2 tables', async () => {
    // Add some Phase 1 data (youtube_channel requires url per CHECK constraint)
    await dbService.run(`
      INSERT INTO sources (id, type, title, sort_preference, url)
      VALUES ('test-source-1', 'youtube_channel', 'Test Channel', 'newestFirst', 'https://youtube.com/@test')
    `);

    await dbService.run(`
      INSERT INTO videos (id, title, source_id, is_available)
      VALUES ('test-video-1', 'Test Video', 'test-source-1', 1)
    `);

    // Initialize Phase 2 schema
    await schemaManager.initializePhase2Schema();

    // Verify Phase 1 data is still intact
    const sources = await dbService.all<any>('SELECT * FROM sources');
    const videos = await dbService.all<any>('SELECT * FROM videos');

    expect(sources).toHaveLength(1);
    expect(videos).toHaveLength(1);
    expect(sources[0].id).toBe('test-source-1');
    expect(videos[0].id).toBe('test-video-1');
  });
});
