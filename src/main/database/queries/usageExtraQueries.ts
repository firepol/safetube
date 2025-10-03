import DatabaseService from '../../services/DatabaseService';
import { UsageExtra } from './types';

/**
 * Type-safe query helpers for usage_extras table
 */

/**
 * Get all usage extras for a specific date
 */
export async function getUsageExtrasByDate(db: DatabaseService, date: string): Promise<UsageExtra[]> {
  return db.all<UsageExtra>(
    `SELECT id, date, minutes_added, reason, added_by, created_at
     FROM usage_extras
     WHERE date = ?
     ORDER BY created_at ASC`,
    [date]
  );
}

/**
 * Get total extra minutes for a specific date
 */
export async function getTotalExtraMinutes(db: DatabaseService, date: string): Promise<number> {
  const result = await db.get<{ total: number }>(
    `SELECT COALESCE(SUM(minutes_added), 0) as total
     FROM usage_extras
     WHERE date = ?`,
    [date]
  );
  return result?.total || 0;
}

/**
 * Get all usage extras in date range
 */
export async function getUsageExtrasByDateRange(
  db: DatabaseService,
  startDate: string,
  endDate: string
): Promise<UsageExtra[]> {
  return db.all<UsageExtra>(
    `SELECT id, date, minutes_added, reason, added_by, created_at
     FROM usage_extras
     WHERE date BETWEEN ? AND ?
     ORDER BY date ASC, created_at ASC`,
    [startDate, endDate]
  );
}

/**
 * Add extra time for a specific date
 */
export async function addUsageExtra(
  db: DatabaseService,
  date: string,
  minutesAdded: number,
  reason?: string,
  addedBy: string = 'admin'
): Promise<void> {
  await db.run(
    `INSERT INTO usage_extras (date, minutes_added, reason, added_by)
     VALUES (?, ?, ?, ?)`,
    [date, minutesAdded, reason || null, addedBy]
  );
}

/**
 * Delete a specific usage extra entry
 */
export async function deleteUsageExtra(db: DatabaseService, id: number): Promise<void> {
  await db.run('DELETE FROM usage_extras WHERE id = ?', [id]);
}

/**
 * Delete all usage extras for a specific date
 */
export async function deleteUsageExtrasByDate(db: DatabaseService, date: string): Promise<void> {
  await db.run('DELETE FROM usage_extras WHERE date = ?', [date]);
}

/**
 * Get all usage extras (audit trail)
 */
export async function getAllUsageExtras(db: DatabaseService): Promise<UsageExtra[]> {
  return db.all<UsageExtra>(
    `SELECT id, date, minutes_added, reason, added_by, created_at
     FROM usage_extras
     ORDER BY date DESC, created_at DESC`
  );
}

/**
 * Count total usage extra entries
 */
export async function countUsageExtras(db: DatabaseService): Promise<number> {
  const result = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM usage_extras'
  );
  return result?.count || 0;
}
