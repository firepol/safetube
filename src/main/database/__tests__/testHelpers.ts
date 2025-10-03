/**
 * Test helpers for database isolation
 * Ensures tests use isolated databases and don't pollute production data
 */

import fs from 'fs';
import path from 'path';
import DatabaseService from '../../services/DatabaseService';

/**
 * Reset the DatabaseService singleton to ensure test isolation
 * MUST be called in beforeEach of any test using DatabaseService
 */
export function resetDatabaseSingleton(): void {
  const instance = DatabaseService.getInstance();

  // Close existing connection if any
  try {
    instance.close().catch(() => {
      // Ignore close errors during reset
    });
  } catch (error) {
    // Ignore errors
  }

  // Reset the singleton instance
  (DatabaseService as any).instance = null;
}

/**
 * Create and initialize a test database
 * Uses in-memory database by default for speed and isolation
 */
export async function createTestDatabase(options?: {
  useMemory?: boolean;
  path?: string;
}): Promise<DatabaseService> {
  const useMemory = options?.useMemory ?? true;
  const dbPath = useMemory ? ':memory:' : (options?.path || '/tmp/claude/test-db.db');

  // Ensure we're not using production database
  if (!useMemory && !dbPath.includes('/tmp/') && !dbPath.includes(':memory:')) {
    throw new Error(
      `Test database path must be in /tmp/ or :memory:, got: ${dbPath}\n` +
      'This prevents tests from accidentally accessing production database.'
    );
  }

  // Create test directory if using file-based database
  if (!useMemory && dbPath !== ':memory:') {
    const testDir = path.dirname(dbPath);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  }

  const db = DatabaseService.getInstance();
  await db.initialize({ path: dbPath });

  return db;
}

/**
 * Cleanup test database files
 * Should be called in afterEach
 */
export async function cleanupTestDatabase(db: DatabaseService, dbPath?: string): Promise<void> {
  // Close database connection
  try {
    await db.close();
  } catch (error) {
    // Ignore close errors
  }

  // Clean up file-based test databases
  if (dbPath && dbPath !== ':memory:' && fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);

      // Clean up WAL and SHM files if they exist
      const walPath = dbPath + '-wal';
      const shmPath = dbPath + '-shm';

      if (fs.existsSync(walPath)) {
        fs.unlinkSync(walPath);
      }
      if (fs.existsSync(shmPath)) {
        fs.unlinkSync(shmPath);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  // Reset singleton for next test
  resetDatabaseSingleton();
}

/**
 * Validate that a database path is safe for testing
 * Throws error if path appears to be production database
 */
export function validateTestDatabasePath(dbPath: string): void {
  // Allow in-memory databases
  if (dbPath === ':memory:') {
    return;
  }

  // Only allow /tmp/ paths for file-based test databases
  if (!dbPath.includes('/tmp/')) {
    throw new Error(
      `Unsafe test database path detected: ${dbPath}\n` +
      'Test databases must use :memory: or /tmp/ paths to prevent production data pollution.\n' +
      'This error indicates a test configuration issue that could corrupt production data.'
    );
  }

  // Warn if path looks like production database
  if (dbPath.includes('safetube.db') && !dbPath.includes('test')) {
    throw new Error(
      `Production database path detected in test: ${dbPath}\n` +
      'Tests must NOT use the production database file.\n' +
      'Use :memory: or /tmp/claude/test-*.db instead.'
    );
  }
}
