import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeSchema, seedDefaultData } from '../schema';
import { DEFAULT_ADMIN_PASSWORD_HASH } from '../../../shared/constants';

describe('Database Schema Initialization', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Use an in-memory SQLite database for each test to ensure isolation
    // and prevent touching the file-system database.
    db = new Database(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required tables', () => {
    initializeSchema(db);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map((t: any) => t.name);

    const expectedTables = [
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
    ];

    expectedTables.forEach(tableName => {
      expect(tableNames).toContain(tableName);
    });
  });

  it('should not have any default data in most tables', () => {
    initializeSchema(db);

    const tablesToTest = [
      'sources',
      'videos',
      'view_records',
      'favorites',
      'youtube_api_results',
      'usage_logs',
      'usage_extras',
      'downloads',
      'downloaded_videos',
    ];

    tablesToTest.forEach(table => {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
      expect((count as any).count).toBe(0);
    });
  });

  it('should seed default data for time_limits', () => {
    initializeSchema(db);
    seedDefaultData(db);

    const limits = db.prepare('SELECT * FROM time_limits WHERE id = 1').get();
    expect(limits).toBeDefined();
    if (limits) {
      expect((limits as any).monday).toBe(30);
      expect((limits as any).tuesday).toBe(30);
      expect((limits as any).wednesday).toBe(30);
      expect((limits as any).thursday).toBe(30);
      expect((limits as any).friday).toBe(45);
      expect((limits as any).saturday).toBe(90);
      expect((limits as any).sunday).toBe(90);
      expect((limits as any).time_up_message).toBe("Time's up for today! Here's your schedule:");
      expect((limits as any).warning_threshold_minutes).toBe(3);
      expect((limits as any).countdown_warning_seconds).toBe(60);
      expect((limits as any).audio_warning_seconds).toBe(10);
    }
  });

  it('should seed the default admin password hash correctly', () => {
    initializeSchema(db);
    seedDefaultData(db);

    const key = 'main.adminPassword';
    const expectedHash = DEFAULT_ADMIN_PASSWORD_HASH;
    // The value in the database should be a JSON-encoded string.
    const expectedDbValue = JSON.stringify(expectedHash);

    const setting = db.prepare('SELECT value, type FROM settings WHERE key = ?').get(key);

    expect(setting).toBeDefined();
    if (setting) {
      // We verify the raw value from the DB is the JSON-encoded string.
      // The application's deserialization logic will handle the JSON.parse().
      expect((setting as any).value).toBe(expectedDbValue);
      expect((setting as any).type).toBe('string');
    }
  });
});
