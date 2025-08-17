import { promises as fs } from 'fs';
import * as path from 'path';
import { TimeLimits, UsageLog, WatchedVideo, VideoSource } from './types';

const CONFIG_DIR = path.join(process.cwd(), 'config');

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
      // File doesn't exist, return default value
      return {} as T;
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

/**
 * Reads time limits configuration
 */
export async function readTimeLimits(): Promise<TimeLimits> {
  return readJsonFile<TimeLimits>('timeLimits.json');
}

/**
 * Writes time limits configuration
 */
export async function writeTimeLimits(timeLimits: TimeLimits): Promise<void> {
  await writeJsonFile('timeLimits.json', timeLimits);
}

/**
 * Reads usage log
 */
export async function readUsageLog(): Promise<UsageLog> {
  return readJsonFile<UsageLog>('usageLog.json');
}

/**
 * Writes usage log
 */
export async function writeUsageLog(usageLog: UsageLog): Promise<void> {
  await writeJsonFile('usageLog.json', usageLog);
}

/**
 * Reads watched videos history
 */
export async function readWatchedVideos(): Promise<WatchedVideo[]> {
  return readJsonFile<WatchedVideo[]>('watched.json');
}

/**
 * Writes watched videos history
 */
export async function writeWatchedVideos(watchedVideos: WatchedVideo[]): Promise<void> {
  await writeJsonFile('watched.json', watchedVideos);
}

/**
 * Reads video sources configuration
 */
export async function readVideoSources(): Promise<VideoSource[]> {
  return readJsonFile<VideoSource[]>('videoSources.json');
}

/**
 * Writes video sources configuration
 */
export async function writeVideoSources(videoSources: VideoSource[]): Promise<void> {
  await writeJsonFile('videoSources.json', videoSources);
}

/**
 * Creates a backup of all configuration files
 */
export async function backupConfig(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(CONFIG_DIR, 'backup', timestamp);
  
  await fs.mkdir(backupDir, { recursive: true });
  
  const files = ['timeLimits.json', 'usageLog.json', 'watched.json', 'videoSources.json'];
  
  for (const file of files) {
    try {
      const sourcePath = path.join(CONFIG_DIR, file);
      const backupPath = path.join(backupDir, file);
      await fs.copyFile(sourcePath, backupPath);
    } catch (error) {
      // Ignore files that don't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
} 

/**
 * Encode a file path to make it URL-safe for routing
 * Uses base64 encoding and replaces problematic characters
 */
export function encodeFilePath(filePath: string): string {
  try {
    // Convert to base64 and replace problematic characters
    const base64 = btoa(filePath);
    return base64.replace(/[+/=]/g, (match) => {
      switch (match) {
        case '+': return '-';
        case '/': return '_';
        case '=': return '';
        default: return match;
      }
    });
  } catch (error) {
    console.error('Error encoding file path:', error);
    // Fallback: replace problematic characters with underscores
    return filePath.replace(/[\/\\:]/g, '_').replace(/\s+/g, '_');
  }
}

/**
 * Decode a file path ID back to the original path
 * Reverses the base64 encoding
 */
export function decodeFilePath(encodedPath: string): string {
  try {
    // Restore base64 characters
    const base64 = encodedPath.replace(/[-_]/g, (match) => {
      switch (match) {
        case '-': return '+';
        case '_': return '/';
        default: return match;
      }
    });
    
    // Add padding if needed
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    
    return atob(padded);
  } catch (error) {
    console.error('Error decoding file path:', error);
    // Fallback: return the encoded path as-is
    return encodedPath;
  }
}

/**
 * Check if a string is an encoded file path
 * Useful for determining if a video ID is a local file
 */
export function isEncodedFilePath(id: string): boolean {
  // Encoded paths are typically longer and contain only safe characters
  return id.length > 10 && /^[a-zA-Z0-9_-]+$/.test(id);
} 