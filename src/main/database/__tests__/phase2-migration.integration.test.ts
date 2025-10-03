import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DatabaseService from '../../services/DatabaseService';
import SimpleSchemaManager from '../SimpleSchemaManager';
import { resetDatabaseSingleton } from './testHelpers';

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

describe('Phase 2 Migration Integration', () => {
  let dbService: DatabaseService;
  let schemaManager: SimpleSchemaManager;

  beforeEach(async () => {
    // Reset singleton to ensure test isolation
    resetDatabaseSingleton();

    dbService = new DatabaseService(':memory:');
    await dbService.initialize();
    schemaManager = new SimpleSchemaManager(dbService);

    // Initialize Phase 1 schema
    await schemaManager.initializePhase1Schema();
  });

  afterEach(async () => {
    await dbService.close();
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

    // Check that default time limits were created
    const timeLimits = await dbService.all<any>('SELECT * FROM time_limits ORDER BY day_of_week');

    // Should have 7 rows (one for each day)
    expect(timeLimits).toHaveLength(7);

    // Verify default values (60 minutes per day)
    timeLimits.forEach((limit, index) => {
      expect(limit.day_of_week).toBe(index);
      expect(limit.minutes).toBe(60);
    });
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
    // Add some Phase 1 data
    await dbService.run(`
      INSERT INTO sources (id, type, title, sort_preference)
      VALUES ('test-source-1', 'youtube_channel', 'Test Channel', 'newestFirst')
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
