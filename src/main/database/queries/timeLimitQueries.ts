import DatabaseService from '../../services/DatabaseService';
import { TimeLimit } from './types';

/**
 * Type-safe query helpers for time_limits table
 * This is a single-row table (id = 1)
 */

/**
 * Get time limits configuration
 * Always returns the single row or null if not initialized
 */
export async function getTimeLimits(db: DatabaseService): Promise<TimeLimit | null> {
  return db.get<TimeLimit>(
    `SELECT id, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
            warning_threshold_minutes, countdown_warning_seconds, audio_warning_seconds,
            time_up_message, use_system_beep, custom_beep_sound,
            created_at, updated_at
     FROM time_limits WHERE id = 1`
  );
}

/**
 * Get time limit for a specific day of week
 * @param dayOfWeek - 0=Sunday, 1=Monday, ..., 6=Saturday (JavaScript Date.getDay() convention)
 */
export async function getTimeLimitForDay(db: DatabaseService, dayOfWeek: number): Promise<number> {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayColumn = dayNames[dayOfWeek];

  const result = await db.get<{ minutes: number }>(
    `SELECT ${dayColumn} as minutes FROM time_limits WHERE id = 1`
  );

  return result?.minutes || 0;
}

/**
 * Create or update time limits configuration
 * Uses single-row table pattern (id always = 1)
 */
export async function upsertTimeLimits(db: DatabaseService, timeLimits: Omit<TimeLimit, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
  await db.run(
    `INSERT INTO time_limits (
      id, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
      warning_threshold_minutes, countdown_warning_seconds, audio_warning_seconds,
      time_up_message, use_system_beep, custom_beep_sound, updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      monday = excluded.monday,
      tuesday = excluded.tuesday,
      wednesday = excluded.wednesday,
      thursday = excluded.thursday,
      friday = excluded.friday,
      saturday = excluded.saturday,
      sunday = excluded.sunday,
      warning_threshold_minutes = excluded.warning_threshold_minutes,
      countdown_warning_seconds = excluded.countdown_warning_seconds,
      audio_warning_seconds = excluded.audio_warning_seconds,
      time_up_message = excluded.time_up_message,
      use_system_beep = excluded.use_system_beep,
      custom_beep_sound = excluded.custom_beep_sound,
      updated_at = CURRENT_TIMESTAMP`,
    [
      timeLimits.monday,
      timeLimits.tuesday,
      timeLimits.wednesday,
      timeLimits.thursday,
      timeLimits.friday,
      timeLimits.saturday,
      timeLimits.sunday,
      timeLimits.warning_threshold_minutes,
      timeLimits.countdown_warning_seconds,
      timeLimits.audio_warning_seconds,
      timeLimits.time_up_message,
      timeLimits.use_system_beep ? 1 : 0,
      timeLimits.custom_beep_sound
    ]
  );
}

/**
 * Update time limit for a specific day
 * @param dayOfWeek - Day name in lowercase (monday, tuesday, etc.)
 * @param minutes - Minutes allowed for that day
 */
export async function updateDayLimit(db: DatabaseService, dayOfWeek: string, minutes: number): Promise<void> {
  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  if (!validDays.includes(dayOfWeek.toLowerCase())) {
    throw new Error(`Invalid day of week: ${dayOfWeek}`);
  }

  await db.run(
    `UPDATE time_limits SET ${dayOfWeek} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
    [minutes]
  );
}

/**
 * Initialize default time limits if not exists
 */
export async function initializeDefaultTimeLimits(db: DatabaseService): Promise<void> {
  const existing = await getTimeLimits(db);
  if (!existing) {
    await upsertTimeLimits(db, {
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 0,
      warning_threshold_minutes: null,
      countdown_warning_seconds: null,
      audio_warning_seconds: null,
      time_up_message: null,
      use_system_beep: false,
      custom_beep_sound: null
    });
  }
}
