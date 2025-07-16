import { VideoSource, YouTubeSourceCache } from '@/shared/types';
import { CachedYouTubeSources } from '../services/cached-youtube-sources';
import fs from 'fs';
import path from 'path';

// Helper to scan local folders recursively up to maxDepth
async function scanLocalFolder(folderPath: string, maxDepth: number, currentDepth = 1): Promise<any[]> {
  let videos: any[] = [];
  if (currentDepth > maxDepth) return videos;
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      if (currentDepth < maxDepth) {
        videos = videos.concat(await scanLocalFolder(fullPath, maxDepth, currentDepth + 1));
      }
    } else if (entry.isFile() && isVideoFile(entry.name)) {
      videos.push({
        id: fullPath,
        type: 'local',
        title: path.basename(entry.name, path.extname(entry.name)),
        thumbnail: '', // Could generate or use a placeholder
        duration: 0, // Could be filled in later
        url: fullPath
      });
    }
  }
  return videos;
}

function isVideoFile(filename: string): boolean {
  return /\.(mp4|mkv|webm|mov|avi)$/i.test(filename);
}

export async function loadAllVideosFromSources(configPath = 'config/videoSources.json'): Promise<any[]> {
  // Load sources
  const sources: VideoSource[] = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  let allVideos: any[] = [];
  for (const source of sources) {
    if (source.type === 'youtube_channel' || source.type === 'youtube_playlist') {
      const cache: YouTubeSourceCache = await CachedYouTubeSources.loadSourceVideos(source);
      allVideos = allVideos.concat(cache.videos.map(v => ({
        ...v,
        type: 'youtube',
        sourceId: source.id
      })));
    } else if (source.type === 'local') {
      const maxDepth = source.maxDepth || 2;
      const localVideos = await scanLocalFolder(source.path, maxDepth);
      allVideos = allVideos.concat(localVideos.map(v => ({
        ...v,
        sourceId: source.id
      })));
    }
  }
  return allVideos;
} 