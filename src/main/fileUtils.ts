import { promises as fs } from 'fs';
import * as path from 'path';
import { AppPaths } from './appPaths';
import { TimeLimits, UsageLog, WatchedVideo, VideoSource, TimeExtra, MainSettings, DownloadStatus, DownloadedVideo } from '../shared/types';

const CONFIG_DIR = AppPaths.getConfigDir();

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
          filename.includes('videoSources.json') || 
          filename.includes('watched.json')) {
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

// Time Limits Functions
export async function readTimeLimits(): Promise<TimeLimits> {
  return readJsonFile<TimeLimits>('timeLimits.json');
}

export async function writeTimeLimits(timeLimits: TimeLimits): Promise<void> {
  return writeJsonFile('timeLimits.json', timeLimits);
}

// Usage Log Functions
export async function readUsageLog(): Promise<UsageLog> {
  return readJsonFile<UsageLog>('usageLog.json');
}

export async function writeUsageLog(usageLog: UsageLog): Promise<void> {
  return writeJsonFile('usageLog.json', usageLog);
}

// Video Source Functions
export async function readVideoSources(): Promise<VideoSource[]> {
  return readJsonFile<VideoSource[]>('videoSources.json');
}

export async function writeVideoSources(videoSources: VideoSource[]): Promise<void> {
  return writeJsonFile('videoSources.json', videoSources);
}

// Watched Videos Functions
export async function readWatchedVideos(): Promise<WatchedVideo[]> {
  return readJsonFile<WatchedVideo[]>('watched.json');
}

export async function writeWatchedVideos(watchedVideos: WatchedVideo[]): Promise<void> {
  return writeJsonFile('watched.json', watchedVideos);
}

// Time Extra Functions
export async function readTimeExtra(): Promise<TimeExtra> {
  return readJsonFile<TimeExtra>('timeExtra.json');
}

export async function writeTimeExtra(timeExtra: TimeExtra): Promise<void> {
  return writeJsonFile('timeExtra.json', timeExtra);
}

// Main Settings Functions
export async function readMainSettings(): Promise<MainSettings> {
  return readJsonFile<MainSettings>('mainSettings.json');
}

export async function writeMainSettings(settings: MainSettings): Promise<void> {
  return writeJsonFile('mainSettings.json', settings);
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

// Pagination config functions
export async function readPaginationConfig(): Promise<{ pageSize: number; maxPages: number }> {
  return readJsonFile<{ pageSize: number; maxPages: number }>('pagination.json');
}

export async function writePaginationConfig(config: { pageSize: number; maxPages: number }): Promise<void> {
  return writeJsonFile('pagination.json', config);
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

