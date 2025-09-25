import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import './setup'; // Import mocks first
import DatabaseService from '../DatabaseService';

const TEST_DB_PATH = '/tmp/claude/test-database.db';

describe('DatabaseService', () => {
  let databaseService: DatabaseService;

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Ensure test directory exists
    const testDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    databaseService = DatabaseService.getInstance();
  });

  afterEach(async () => {
    try {
      await databaseService.close();
    } catch (error) {
      // Ignore close errors in tests
    }

    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test('should initialize database successfully', async () => {
    await databaseService.initialize({ path: TEST_DB_PATH });

    const health = await databaseService.getHealthStatus();
    expect(health.initialized).toBe(true);
    expect(health.connected).toBe(true);
  });

  test('should create table and insert data', async () => {
    await databaseService.initialize({ path: TEST_DB_PATH });

    // Create test table
    await databaseService.run(`
      CREATE TABLE test_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert test data
    await databaseService.run(
      'INSERT INTO test_table (name) VALUES (?)',
      ['Test Entry']
    );

    // Verify data was inserted
    const result = await databaseService.get(
      'SELECT * FROM test_table WHERE name = ?',
      ['Test Entry']
    );

    expect(result).toBeTruthy();
    expect(result.name).toBe('Test Entry');
    expect(result.id).toBe(1);
  });

  test('should handle transactions correctly', async () => {
    await databaseService.initialize({ path: TEST_DB_PATH });

    // Create test table
    await databaseService.run(`
      CREATE TABLE test_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )
    `);

    // Execute transaction
    await databaseService.executeTransaction([
      { sql: 'INSERT INTO test_table (name) VALUES (?)', params: ['Entry 1'] },
      { sql: 'INSERT INTO test_table (name) VALUES (?)', params: ['Entry 2'] },
      { sql: 'INSERT INTO test_table (name) VALUES (?)', params: ['Entry 3'] }
    ]);

    // Verify all entries were inserted
    const results = await databaseService.all('SELECT * FROM test_table ORDER BY id');
    expect(results).toHaveLength(3);
    expect(results.map((r: any) => r.name)).toEqual(['Entry 1', 'Entry 2', 'Entry 3']);
  });

  test('should rollback transaction on error', async () => {
    await databaseService.initialize({ path: TEST_DB_PATH });

    // Create test table
    await databaseService.run(`
      CREATE TABLE test_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      )
    `);

    // Try to execute transaction with duplicate entry (should fail)
    await expect(databaseService.executeTransaction([
      { sql: 'INSERT INTO test_table (name) VALUES (?)', params: ['Entry 1'] },
      { sql: 'INSERT INTO test_table (name) VALUES (?)', params: ['Entry 1'] } // Duplicate
    ])).rejects.toThrow();

    // Verify no entries were inserted due to rollback
    const results = await databaseService.all('SELECT * FROM test_table');
    expect(results).toHaveLength(0);
  });

  test('should check database integrity', async () => {
    await databaseService.initialize({ path: TEST_DB_PATH });

    const integrity = await databaseService.checkIntegrity();
    expect(integrity.ok).toBe(true);
    expect(integrity.errors).toHaveLength(0);
  });

  test('should track metrics', async () => {
    await databaseService.initialize({ path: TEST_DB_PATH });

    // Execute some queries
    await databaseService.run('CREATE TABLE test_table (id INTEGER, name TEXT)');
    await databaseService.run('INSERT INTO test_table (id, name) VALUES (?, ?)', [1, 'Test']);
    await databaseService.get('SELECT * FROM test_table WHERE id = ?', [1]);

    const health = await databaseService.getHealthStatus();
    expect(health.metrics.queriesExecuted).toBeGreaterThan(0);
    expect(health.metrics.connectionsTotal).toBeGreaterThan(0);
  });
});