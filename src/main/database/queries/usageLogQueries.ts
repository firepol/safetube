import DatabaseService from '../../services/DatabaseService';
import { UsageLog } from './types';

/**
 * Type-safe query helpers for usage_logs table
 */

/**
 * Get usage log for a specific date
 */
export async function getUsageLogByDate(db: DatabaseService, date: string): Promise<UsageLog | null> {
  return db.get<UsageLog>(
    `SELECT id, date, seconds_used, created_at, updated_at
     FROM usage_logs WHERE date = ?`,
    [date]
  );
}

/**
 * Get all usage logs ordered by date descending
 */
export async function getAllUsageLogs(db: DatabaseService): Promise<UsageLog[]> {
  return db.all<UsageLog>(
    `SELECT id, date, seconds_used, created_at, updated_at
     FROM usage_logs
     ORDER BY date DESC`
  );
}

/**
 * Get usage logs for a date range
 */
export async function getUsageLogsByDateRange(
  db: DatabaseService,
  startDate: string,
  endDate: string
): Promise<UsageLog[]> {
  return db.all<UsageLog>(
    `SELECT id, date, seconds_used, created_at, updated_at
     FROM usage_logs
     WHERE date BETWEEN ? AND ?
     ORDER BY date ASC`,
    [startDate, endDate]
  );
}

/**
 * Create or update usage log for a specific date
 * Upserts the record if it already exists
 */
export async function upsertUsageLog(
  db: DatabaseService,
  date: string,
  secondsUsed: number
): Promise<void> {
  await db.run(
    `INSERT INTO usage_logs (date, seconds_used, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(date) DO UPDATE SET
       seconds_used = excluded.seconds_used,
       updated_at = CURRENT_TIMESTAMP`,
    [date, secondsUsed]
  );
}

/**
 * Increment usage time for a specific date
 * Creates new record if it doesn't exist
 */
export async function incrementUsageLog(
  db: DatabaseService,
  date: string,
  secondsToAdd: number
): Promise<void> {
  await db.run(
    `INSERT INTO usage_logs (date, seconds_used, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(date) DO UPDATE SET
       seconds_used = seconds_used + ?,
       updated_at = CURRENT_TIMESTAMP`,
    [date, secondsToAdd, secondsToAdd]
  );
}

/**
 * Delete usage log for a specific date
 */
export async function deleteUsageLog(db: DatabaseService, date: string): Promise<void> {
  await db.run('DELETE FROM usage_logs WHERE date = ?', [date]);
}

/**
 * Get total usage in a given month (YYYY-MM format)
 */
export async function getMonthlyUsage(db: DatabaseService, monthPrefix: string): Promise<number> {
  const result = await db.get<{ total: number }>(
    `SELECT COALESCE(SUM(seconds_used), 0) as total
     FROM usage_logs
     WHERE date LIKE ?`,
    [`${monthPrefix}%`]
  );
  return result?.total || 0;
}

/**
 * Count total usage log entries
 */
export async function countUsageLogs(db: DatabaseService): Promise<number> {
  const result = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM usage_logs'
  );
  return result?.count || 0;
}
