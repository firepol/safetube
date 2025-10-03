import { promises as fs } from 'fs';
import * as path from 'path';
import { AppPaths } from './appPaths';
import { TimeLimits, UsageLog, WatchedVideo, VideoSource, TimeExtra, MainSettings, DownloadStatus, DownloadedVideo, FavoritesConfig, FavoriteVideo, VideoMetadata } from '../shared/types';

const CONFIG_DIR = AppPaths.getConfigDir();

/**
 * Write favorite to database for persistence and synchronization
 */
async function writeFavoriteToDatabase(metadata: VideoMetadata, operation: 'add' | 'remove'): Promise<void> {
  try {
    const { DatabaseService } = await import('./services/DatabaseService');
    const dbService = DatabaseService.getInstance();

    if (operation === 'add') {
      // Insert new favorite
      await dbService.run(`
        INSERT OR REPLACE INTO favorites (
          video_id, title, thumbnail, duration, source_id, source_type,
          added_at, video_type
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `, [
  metadata.id,
  metadata.title || '',
  metadata.thumbnail || '',
  metadata.duration || 0,
  metadata.source || '',
  '', // source_type not present in VideoMetadata, leave empty or adjust as needed
  metadata.type || 'unknown'
      ]);

      console.log(`[FileUtils] Added favorite ${metadata.id} to database`);
    } else {
      // Remove favorite
      await dbService.run(`
        DELETE FROM favorites WHERE video_id = ?
      `, [metadata.id]);

      console.log(`[FileUtils] Removed favorite ${metadata.id} from database`);
    }
  } catch (error) {
    console.error(`[FileUtils] Error writing favorite to database: ${error}`);
    throw error;
  }
}

/**
 * Ensures the config directory exists
 */
async function ensureConfigDir(): Promise<void> {
  try {
    await fs.access(CONFIG_DIR);
  } catch {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Reads a JSON file from the config directory
 */
async function readJsonFile<T>(filename: string): Promise<T> {
  await ensureConfigDir();
  const filePath = path.join(CONFIG_DIR, filename);
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, return default value based on filename
      if (filename.includes('downloadStatus.json') ||
          filename.includes('downloadedVideos.json') ||
          filename.includes('videoSources.json')) {
        return [] as T; // Return empty array for array-type files
      }
      return {} as T; // Return empty object for object-type files
    }
    throw new Error(`Failed to read ${filename}: ${error}`);
  }
}

/**
 * Writes a JSON file to the config directory
 */
async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  await ensureConfigDir();
  const filePath = path.join(CONFIG_DIR, filename);
  
  try {
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write ${filename}: ${error}`);
  }
}

// Time Limits Functions - Now use database
export async function readTimeLimits(): Promise<TimeLimits> {
  try {
    const { default: DatabaseService } = await import('./services/DatabaseService');
    const db = DatabaseService.getInstance();

    const result = await db.get(`
      SELECT monday, tuesday, wednesday, thursday, friday, saturday, sunday
      FROM time_limits
      WHERE id = 1
    `) as any;

    if (!result) {
      // Return defaults if not in database
      return {
        Monday: 30, Tuesday: 30, Wednesday: 30, Thursday: 30,
        Friday: 30, Saturday: 60, Sunday: 60
      };
    }

    return {
      Monday: result.monday,
      Tuesday: result.tuesday,
      Wednesday: result.wednesday,
      Thursday: result.thursday,
      Friday: result.friday,
      Saturday: result.saturday,
      Sunday: result.sunday
    };
  } catch (error) {
    console.error('[fileUtils] Error reading time limits from database:', error);
    // Fallback to defaults
    return {
      Monday: 30, Tuesday: 30, Wednesday: 30, Thursday: 30,
      Friday: 30, Saturday: 60, Sunday: 60
    };
  }
}

export async function writeTimeLimits(timeLimits: TimeLimits): Promise<void> {
  const { default: DatabaseService } = await import('./services/DatabaseService');
  const db = DatabaseService.getInstance();

  await db.run(`
    INSERT OR REPLACE INTO time_limits (
      id, monday, tuesday, wednesday, thursday, friday, saturday, sunday
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
  `, [
    timeLimits.Monday || 0,
    timeLimits.Tuesday || 0,
    timeLimits.Wednesday || 0,
    timeLimits.Thursday || 0,
    timeLimits.Friday || 0,
    timeLimits.Saturday || 0,
    timeLimits.Sunday || 0
  ]);
}

// Usage Log Functions - Now use database
export async function readUsageLog(): Promise<UsageLog> {
  try {
    const { default: DatabaseService } = await import('./services/DatabaseService');
    const db = DatabaseService.getInstance();

    const rows = await db.all(`
      SELECT date, seconds_used
      FROM usage_logs
      ORDER BY date DESC
    `) as Array<{ date: string; seconds_used: number }>;

    const usageLog: UsageLog = {};
    for (const row of rows) {
      usageLog[row.date] = row.seconds_used;
    }

    return usageLog;
  } catch (error) {
    console.error('[fileUtils] Error reading usage log from database:', error);
    return {};
  }
}

export async function writeUsageLog(usageLog: UsageLog): Promise<void> {
  const { default: DatabaseService } = await import('./services/DatabaseService');
  const db = DatabaseService.getInstance();

  // Convert UsageLog object to array of queries
  const queries = Object.entries(usageLog).map(([date, seconds]) => ({
    sql: `
      INSERT OR REPLACE INTO usage_logs (date, seconds_used)
      VALUES (?, ?)
    `,
    params: [date, seconds]
  }));

  if (queries.length > 0) {
    await db.executeTransaction(queries);
  }
}

// Video Source Functions
export async function readVideoSources(): Promise<VideoSource[]> {
  return readJsonFile<VideoSource[]>('videoSources.json');
}

export async function writeVideoSources(videoSources: VideoSource[]): Promise<void> {
  return writeJsonFile('videoSources.json', videoSources);
}

// Watched Videos Functions
// @deprecated - Use database view_records table instead. These functions are kept only for migration and testing purposes.
export async function readWatchedVideos(): Promise<WatchedVideo[]> {
  try {
    // Read from database first (primary storage)
    const { DatabaseService } = await import('./services/DatabaseService');
    const dbService = DatabaseService.getInstance();

    const viewRecords = await dbService.all<any>(`
      SELECT
        video_id as videoId,
        source_id as source,
        position,
        time_watched as timeWatched,
        duration,
        watched,
        first_watched as firstWatched,
        last_watched as lastWatched
      FROM view_records
    `);

    return viewRecords as WatchedVideo[];
  } catch (error) {
    console.warn('[FileUtils] Error reading watched videos from database, falling back to JSON:', error);
    // Fallback to JSON file for backwards compatibility
    try {
      return await readJsonFile<WatchedVideo[]>('watched.json');
    } catch (jsonError) {
      return []; // Return empty array if neither source exists
    }
  }
}

// @deprecated - Use database view_records table instead. This function is kept only for migration and testing purposes.
export async function writeWatchedVideos(watchedVideos: WatchedVideo[]): Promise<void> {
  return writeJsonFile('watched.json', watchedVideos);
}

// Time Extra Functions - Now use database
export async function readTimeExtra(): Promise<TimeExtra> {
  try {
    const { default: DatabaseService } = await import('./services/DatabaseService');
    const db = DatabaseService.getInstance();

    const rows = await db.all(`
      SELECT date, minutes_added
      FROM usage_extras
      ORDER BY date DESC
    `) as Array<{ date: string; minutes_added: number }>;

    const timeExtra: TimeExtra = {};
    for (const row of rows) {
      timeExtra[row.date] = row.minutes_added;
    }

    return timeExtra;
  } catch (error) {
    console.error('[fileUtils] Error reading time extra from database:', error);
    return {};
  }
}

export async function writeTimeExtra(timeExtra: TimeExtra): Promise<void> {
  const { default: DatabaseService } = await import('./services/DatabaseService');
  const db = DatabaseService.getInstance();

  // Convert TimeExtra object to array of queries
  const queries = Object.entries(timeExtra).map(([date, minutes]) => ({
    sql: `
      INSERT OR REPLACE INTO usage_extras (date, minutes_added)
      VALUES (?, ?)
    `,
    params: [date, minutes]
  }));

  if (queries.length > 0) {
    await db.executeTransaction(queries);
  }
}

// Main Settings Functions - Now use database
export async function readMainSettings(): Promise<MainSettings> {
  try {
    const { default: DatabaseService } = await import('./services/DatabaseService');
    const db = DatabaseService.getInstance();

    const rows = await db.all(`
      SELECT key, value FROM settings WHERE key LIKE 'main.%'
    `) as Array<{ key: string; value: string }>;

    const settings: any = {};
    for (const row of rows) {
      const key = row.key.replace('main.', '');
      settings[key] = JSON.parse(row.value);
    }

    return settings;
  } catch (error) {
    console.error('[fileUtils] Error reading main settings from database:', error);
    return {};
  }
}

export async function writeMainSettings(settings: MainSettings): Promise<void> {
  const { default: DatabaseService } = await import('./services/DatabaseService');
  const db = DatabaseService.getInstance();

  const queries = Object.entries(settings).map(([key, value]) => ({
    sql: `
      INSERT OR REPLACE INTO settings (key, value, type)
      VALUES (?, ?, ?)
    `,
    params: [
      `main.${key}`,
      JSON.stringify(value),
      typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string'
    ]
  }));

  if (queries.length > 0) {
    await db.executeTransaction(queries);
  }
}

export async function getDefaultDownloadPath(): Promise<string> {
  const { app } = await import('electron');
  const userHome = app.getPath('home');
  
  // Use user's Videos folder as default
  const videosPath = path.join(userHome, 'Videos', 'SafeTube');
  return videosPath;
}

// Download Status Functions
export async function readDownloadStatus(): Promise<DownloadStatus[]> {
  return readJsonFile<DownloadStatus[]>('downloadStatus.json');
}

export async function writeDownloadStatus(statuses: DownloadStatus[]): Promise<void> {
  return writeJsonFile('downloadStatus.json', statuses);
}

export async function updateDownloadStatus(videoId: string, status: Partial<DownloadStatus>): Promise<void> {
  const statuses = await readDownloadStatus();
  const existingIndex = statuses.findIndex(s => s.videoId === videoId);
  
  if (existingIndex >= 0) {
    statuses[existingIndex] = { ...statuses[existingIndex], ...status };
  } else {
    statuses.push({ videoId, status: 'pending', progress: 0, ...status });
  }
  
  await writeDownloadStatus(statuses);
}

export async function getDownloadStatus(videoId: string): Promise<DownloadStatus | null> {
  const statuses = await readDownloadStatus();
  return statuses.find(s => s.videoId === videoId) || null;
}

// Downloaded Videos Functions
export async function readDownloadedVideos(): Promise<DownloadedVideo[]> {
  return readJsonFile<DownloadedVideo[]>('downloadedVideos.json');
}

export async function writeDownloadedVideos(videos: DownloadedVideo[]): Promise<void> {
  return writeJsonFile('downloadedVideos.json', videos);
}

export async function addDownloadedVideo(video: DownloadedVideo): Promise<void> {
  const videos = await readDownloadedVideos();
  videos.push(video);
  await writeDownloadedVideos(videos);
}

// Pagination config functions - Now use database
export async function readPaginationConfig(): Promise<{ pageSize: number; maxPages: number }> {
  try {
    const { default: DatabaseService } = await import('./services/DatabaseService');
    const db = DatabaseService.getInstance();

    const rows = await db.all(`
      SELECT key, value FROM settings WHERE key LIKE 'pagination.%'
    `) as Array<{ key: string; value: string }>;

    const config: any = {};
    for (const row of rows) {
      const key = row.key.replace('pagination.', '');
      config[key] = JSON.parse(row.value);
    }

    // Return defaults if not in database
    return {
      pageSize: config.pageSize || 20,
      maxPages: config.maxPages || 5
    };
  } catch (error) {
    console.error('[fileUtils] Error reading pagination config from database:', error);
    return { pageSize: 20, maxPages: 5 };
  }
}

export async function writePaginationConfig(config: { pageSize: number; maxPages: number }): Promise<void> {
  const { default: DatabaseService } = await import('./services/DatabaseService');
  const db = DatabaseService.getInstance();

  const queries = Object.entries(config).map(([key, value]) => ({
    sql: `
      INSERT OR REPLACE INTO settings (key, value, type)
      VALUES (?, ?, ?)
    `,
    params: [
      `pagination.${key}`,
      JSON.stringify(value),
      'number'
    ]
  }));

  if (queries.length > 0) {
    await db.executeTransaction(queries);
  }
}

// Merge watched data with video list
export async function mergeWatchedData(videos: any[]): Promise<any[]> {
  try {
    const watchedData = await readWatchedVideos();
    const watchedMap = new Map(watchedData.map(w => [w.videoId, w]));

    return videos.map(video => {
      const watchedEntry = watchedMap.get(video.id);
      if (watchedEntry) {
        return {
          ...video,
          resumeAt: watchedEntry.position
        };
      }
      return video;
    });
  } catch (error) {
    console.warn('[FileUtils] Error merging watched data:', error);
    return videos;
  }
}

// Favorites Configuration Functions
export async function readFavoritesConfig(): Promise<FavoritesConfig> {
  try {
    const data = await readJsonFile<any>('favorites.json');

    // Handle both old and new format
    if (data.settings) {
      // Old format - migrate to new format
      return {
        favorites: data.favorites || [],
        lastModified: new Date().toISOString(),
      };
    }

    // New format - validate structure
    return {
      favorites: data.favorites || [],
      lastModified: data.lastModified || new Date().toISOString(),
    };
  } catch (error) {
    // Return default config if file doesn't exist or is corrupted
    console.warn('[FileUtils] Error reading favorites config, using defaults:', error);
    return {
      favorites: [],
      lastModified: new Date().toISOString(),
    };
  }
}

export async function writeFavoritesConfig(config: FavoritesConfig): Promise<void> {
  // Write the new config with updated timestamp
  const configToWrite: FavoritesConfig = {
    ...config,
    lastModified: new Date().toISOString(),
  };

  return writeJsonFile('favorites.json', configToWrite);
}

// Core Favorites Management Functions
export async function addFavorite(metadata: VideoMetadata): Promise<void> {
  const config = await readFavoritesConfig();

  // Import utility functions
  const { addToFavorites } = await import('../shared/favoritesUtils');
  const result = addToFavorites(config, metadata);

  if (!result.success) {
    throw new Error(result.error || 'Failed to add favorite');
  }

  await writeFavoritesConfig(result.data as FavoritesConfig);

  // Also write to database
  try {
    await writeFavoriteToDatabase(metadata, 'add');
  } catch (dbError) {
    console.warn('[FileUtils] Warning: Could not write favorite to database:', dbError);
    // Continue - JSON fallback is still available
  }
}

export async function removeFavorite(videoId: string): Promise<void> {
  const config = await readFavoritesConfig();

  // Import utility functions
  const { removeFromFavorites } = await import('../shared/favoritesUtils');
  const result = removeFromFavorites(config, videoId);

  if (!result.success) {
    throw new Error(result.error || 'Failed to remove favorite');
  }

  await writeFavoritesConfig(result.data as FavoritesConfig);

  // Also remove from database
  try {
    await writeFavoriteToDatabase({ id: videoId } as VideoMetadata, 'remove');
  } catch (dbError) {
    console.warn('[FileUtils] Warning: Could not remove favorite from database:', dbError);
    // Continue - JSON fallback is still available
  }
}

export async function isFavorite(videoId: string): Promise<boolean> {
  const config = await readFavoritesConfig();

  // Import utility functions
  const { isFavorited } = await import('../shared/favoritesUtils');
  return isFavorited(config, videoId);
}

export async function getFavorites(): Promise<FavoriteVideo[]> {
  const config = await readFavoritesConfig();

  // Import utility functions
  const { getFavorites: getFavoritesFromConfig } = await import('../shared/favoritesUtils');
  return getFavoritesFromConfig(config, 'dateAdded', 'desc');
}

