import DatabaseService from '../../services/DatabaseService';
import { UsageLog } from './types';

/**
 * Type-safe query helpers for usage_logs table
 */

/**
 * Get usage log for a specific date (global usage - source_id = NULL)
 */
export async function getUsageLogByDate(db: DatabaseService, date: string): Promise<UsageLog | null> {
  return db.get<UsageLog>(
    `SELECT id, date, seconds_used, source_id, created_at, updated_at
     FROM usage_logs WHERE date = ? AND source_id IS NULL`,
    [date]
  );
}

/**
 * Get all usage logs ordered by date descending (global usage only - source_id = NULL)
 */
export async function getAllUsageLogs(db: DatabaseService): Promise<UsageLog[]> {
  return db.all<UsageLog>(
    `SELECT id, date, seconds_used, source_id, created_at, updated_at
     FROM usage_logs
     WHERE source_id IS NULL
     ORDER BY date DESC`
  );
}

/**
 * Get usage logs for a date range (global usage only - source_id = NULL)
 */
export async function getUsageLogsByDateRange(
  db: DatabaseService,
  startDate: string,
  endDate: string
): Promise<UsageLog[]> {
  return db.all<UsageLog>(
    `SELECT id, date, seconds_used, source_id, created_at, updated_at
     FROM usage_logs
     WHERE date BETWEEN ? AND ? AND source_id IS NULL
     ORDER BY date ASC`,
    [startDate, endDate]
  );
}

/**
 * Create or update usage log for a specific date (global usage - source_id = NULL)
 * Upserts the record if it already exists
 * Note: Uses date-only conflict resolution since global usage has source_id=NULL
 */
export async function upsertUsageLog(
  db: DatabaseService,
  date: string,
  secondsUsed: number
): Promise<void> {
  // First, delete any existing entry for this date with NULL source_id (to handle NULL uniqueness properly)
  await db.run('DELETE FROM usage_logs WHERE date = ? AND source_id IS NULL', [date]);

  // Then insert the new entry
  await db.run(
    `INSERT INTO usage_logs (date, seconds_used, source_id, updated_at)
     VALUES (?, ?, NULL, CURRENT_TIMESTAMP)`,
    [date, secondsUsed]
  );
}

/**
 * Increment usage time for a specific date (global usage - source_id = NULL)
 * Creates new record if it doesn't exist
 */
export async function incrementUsageLog(
  db: DatabaseService,
  date: string,
  secondsToAdd: number
): Promise<void> {
  // Check if entry exists
  const existing = await db.get<{ seconds_used: number }>(
    'SELECT seconds_used FROM usage_logs WHERE date = ? AND source_id IS NULL',
    [date]
  );

  if (existing) {
    // Update existing entry
    await db.run(
      'UPDATE usage_logs SET seconds_used = seconds_used + ?, updated_at = CURRENT_TIMESTAMP WHERE date = ? AND source_id IS NULL',
      [secondsToAdd, date]
    );
  } else {
    // Create new entry
    await db.run(
      'INSERT INTO usage_logs (date, seconds_used, source_id, updated_at) VALUES (?, ?, NULL, CURRENT_TIMESTAMP)',
      [date, secondsToAdd]
    );
  }
}

/**
 * Delete usage log for a specific date
 */
export async function deleteUsageLog(db: DatabaseService, date: string): Promise<void> {
  await db.run('DELETE FROM usage_logs WHERE date = ?', [date]);
}

/**
 * Get total usage in a given month (YYYY-MM format, global usage only - source_id = NULL)
 */
export async function getMonthlyUsage(db: DatabaseService, monthPrefix: string): Promise<number> {
  const result = await db.get<{ total: number }>(
    `SELECT COALESCE(SUM(seconds_used), 0) as total
     FROM usage_logs
     WHERE date LIKE ? AND source_id IS NULL`,
    [`${monthPrefix}%`]
  );
  return result?.total || 0;
}

/**
 * Count total usage log entries (global usage only - source_id = NULL)
 */
export async function countUsageLogs(db: DatabaseService): Promise<number> {
  const result = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM usage_logs WHERE source_id IS NULL'
  );
  return result?.count || 0;
}
