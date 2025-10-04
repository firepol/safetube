import { DatabaseService } from '../services/DatabaseService';
import { getSetting, getSettingsByNamespace } from '../database/queries/settingsQueries';
import { MainSettings } from '../../shared/types';

/**
 * Get YouTube API key from settings with environment variable fallback
 * Priority: Database settings > YOUTUBE_API_KEY environment variable
 */
export async function getYouTubeApiKey(): Promise<string> {
  try {
    const mainSettings = await readMainSettings();
    const apiKey = mainSettings.youtubeApiKey || '';

    if (apiKey) {
      return apiKey;
    }
  } catch (error) {
    console.warn('[SettingsHelper] Could not read API key from database, trying environment variable:', error);
  }

  // Fallback to environment variable
  return process.env.YOUTUBE_API_KEY || '';
}

/**
 * Read main settings from database
 */
export async function readMainSettings(): Promise<MainSettings> {
  try {
    const db = DatabaseService.getInstance();
    const settings = await getSettingsByNamespace(db, 'main');
    return settings as MainSettings;
  } catch (error) {
    console.error('[SettingsHelper] Error reading main settings from database:', error);
    return {};
  }
}

/**
 * Write main settings to database
 */
export async function writeMainSettings(settings: MainSettings): Promise<void> {
  const db = DatabaseService.getInstance();
  const { setSettingsByNamespace } = await import('../database/queries/settingsQueries');
  await setSettingsByNamespace(db, 'main', settings);
}

/**
 * Get a specific setting value with type safety
 */
export async function getSettingValue<T>(key: string, defaultValue?: T): Promise<T | undefined> {
  try {
    const db = DatabaseService.getInstance();
    return await getSetting<T>(db, key, defaultValue);
  } catch (error) {
    console.error(`[SettingsHelper] Error reading setting ${key}:`, error);
    return defaultValue;
  }
}
