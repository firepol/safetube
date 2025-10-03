import DatabaseService from '../../services/DatabaseService';

/**
 * Type-safe query helpers for settings table
 * Settings use namespace.key format (e.g., main.downloadPath, pagination.pageSize)
 */

export type SettingType = 'string' | 'number' | 'boolean' | 'object';

export interface SettingRow {
  key: string;
  value: string; // JSON-encoded
  type: SettingType;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Serialize a value to JSON string for storage
 */
export function serializeSetting(value: any): string {
  return JSON.stringify(value);
}

/**
 * Deserialize a JSON string to typed value
 */
export function deserializeSetting<T>(value: string, type: SettingType): T {
  try {
    const parsed = JSON.parse(value);

    // Type coercion based on type hint
    switch (type) {
      case 'boolean':
        return (typeof parsed === 'boolean' ? parsed : Boolean(parsed)) as T;
      case 'number':
        return (typeof parsed === 'number' ? parsed : Number(parsed)) as T;
      case 'string':
        return (typeof parsed === 'string' ? parsed : String(parsed)) as T;
      case 'object':
        return parsed as T;
      default:
        return parsed as T;
    }
  } catch (error) {
    throw new Error(`Failed to deserialize setting: ${error}`);
  }
}

/**
 * Infer setting type from value
 */
export function inferType(value: any): SettingType {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  return 'object';
}

/**
 * Get single setting by key
 */
export async function getSetting<T>(
  db: DatabaseService,
  key: string,
  defaultValue?: T
): Promise<T | undefined> {
  const row = await db.get<SettingRow>(
    'SELECT value, type FROM settings WHERE key = ?',
    [key]
  );

  if (!row) return defaultValue;

  return deserializeSetting<T>(row.value, row.type);
}

/**
 * Set single setting (upsert)
 */
export async function setSetting<T>(
  db: DatabaseService,
  key: string,
  value: T,
  type: SettingType = inferType(value),
  description?: string
): Promise<void> {
  await db.run(
    `INSERT INTO settings (key, value, type, description, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       type = excluded.type,
       description = excluded.description,
       updated_at = CURRENT_TIMESTAMP`,
    [key, serializeSetting(value), type, description || null]
  );
}

/**
 * Get all settings for a namespace (e.g., 'main', 'pagination')
 * Returns object with short keys (without namespace prefix)
 */
export async function getSettingsByNamespace(
  db: DatabaseService,
  namespace: string
): Promise<Record<string, any>> {
  const rows = await db.all<SettingRow>(
    'SELECT key, value, type FROM settings WHERE key LIKE ?',
    [`${namespace}.%`]
  );

  return rows.reduce((acc, row) => {
    const shortKey = row.key.replace(`${namespace}.`, '');
    acc[shortKey] = deserializeSetting(row.value, row.type);
    return acc;
  }, {} as Record<string, any>);
}

/**
 * Set multiple settings for a namespace (bulk upsert)
 */
export async function setSettingsByNamespace(
  db: DatabaseService,
  namespace: string,
  settings: Record<string, any>
): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    const fullKey = `${namespace}.${key}`;
    await setSetting(db, fullKey, value);
  }
}

/**
 * Delete setting by key
 */
export async function deleteSetting(db: DatabaseService, key: string): Promise<void> {
  await db.run('DELETE FROM settings WHERE key = ?', [key]);
}

/**
 * Delete all settings for a namespace
 */
export async function deleteSettingsByNamespace(db: DatabaseService, namespace: string): Promise<void> {
  await db.run('DELETE FROM settings WHERE key LIKE ?', [`${namespace}.%`]);
}

/**
 * Get all settings (for debugging/export)
 */
export async function getAllSettings(db: DatabaseService): Promise<Record<string, any>> {
  const rows = await db.all<SettingRow>('SELECT key, value, type FROM settings ORDER BY key');

  return rows.reduce((acc, row) => {
    acc[row.key] = deserializeSetting(row.value, row.type);
    return acc;
  }, {} as Record<string, any>);
}

/**
 * Count total settings
 */
export async function countSettings(db: DatabaseService): Promise<number> {
  const result = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM settings');
  return result?.count || 0;
}

/**
 * Check if setting exists
 */
export async function settingExists(db: DatabaseService, key: string): Promise<boolean> {
  const result = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM settings WHERE key = ?',
    [key]
  );
  return (result?.count || 0) > 0;
}
