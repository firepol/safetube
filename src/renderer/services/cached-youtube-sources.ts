import { YouTubeAPI } from './youtube';
import { YouTubeSourceCache, VideoSource } from '@/shared/types';

// Use Node.js APIs for file I/O (assume preload or main context, not renderer)
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join('.', '.cache');

function getCacheFilePath(sourceId: string) {
  return path.join(CACHE_DIR, `youtube-${sourceId}.json`);
}

export class CachedYouTubeSources {
  static async loadSourceVideos(source: VideoSource): Promise<YouTubeSourceCache> {
    if (source.type !== 'youtube_channel' && source.type !== 'youtube_playlist') {
      throw new Error('Invalid source type for YouTube cache');
    }
    // Ensure cache dir exists
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    const cacheFile = getCacheFilePath(source.id);
    let cache: YouTubeSourceCache | null = null;
    if (fs.existsSync(cacheFile)) {
      try {
        cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      } catch (e) {
        cache = null;
      }
    }
    const now = new Date().toISOString();
    let newVideos: any[] = [];
    let lastVideoDate = cache?.lastVideoDate;
    if (source.type === 'youtube_channel') {
      // Fetch new videos since lastVideoDate
      const channelId = extractChannelId(source.url);
      const allVideos = await YouTubeAPI.getChannelVideos(channelId, 50); // TODO: handle pagination
      // Fetch video details for new videos only
      newVideos = await fetchNewYouTubeVideos(allVideos, cache?.videos || [], lastVideoDate);
    } else if (source.type === 'youtube_playlist') {
      const playlistId = extractPlaylistId(source.url);
      const allVideos = await YouTubeAPI.getPlaylistVideos(playlistId, 50); // TODO: handle pagination
      newVideos = await fetchNewYouTubeVideos(allVideos, cache?.videos || [], lastVideoDate);
    }
    // Merge new videos into cache
    const videos = [...(cache?.videos || []), ...newVideos];
    const updatedCache: YouTubeSourceCache = {
      sourceId: source.id,
      type: source.type,
      lastFetched: now,
      lastVideoDate: videos.length > 0 ? videos[0].publishedAt : lastVideoDate,
      videos,
    };
    fs.writeFileSync(cacheFile, JSON.stringify(updatedCache, null, 2), 'utf-8');
    return updatedCache;
  }
}

// Helpers
function extractChannelId(url: string): string {
  // e.g. https://www.youtube.com/channel/UCxxxxx
  const match = url.match(/channel\/([\w-]+)/);
  if (match) return match[1];
  // TODO: handle custom URLs (@username)
  throw new Error('Unsupported channel URL');
}
function extractPlaylistId(url: string): string {
  // e.g. https://www.youtube.com/playlist?list=PLxxxxxx
  const match = url.match(/[?&]list=([\w-]+)/);
  if (match) return match[1];
  throw new Error('Invalid playlist URL');
}
async function fetchNewYouTubeVideos(allVideoIds: string[], cachedVideos: any[], lastVideoDate?: string) {
  // Fetch details for videos not in cache or newer than lastVideoDate
  const cachedIds = new Set(cachedVideos.map(v => v.id));
  const newIds = allVideoIds.filter(id => !cachedIds.has(id));
  const details = await Promise.all(newIds.map(id => YouTubeAPI.getVideoDetails(id)));
  // Map to cache format
  return details.map(v => ({
    id: v.id,
    title: v.snippet.title,
    publishedAt: ((v.snippet as any).publishedAt || ''),
    thumbnail: v.snippet.thumbnails.high.url,
    duration: parseISODuration(v.contentDetails.duration),
    url: `https://www.youtube.com/watch?v=${v.id}`
  }));
}
function parseISODuration(iso: string): number {
  // Simple ISO 8601 duration to seconds
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (parseInt(h || '0') * 3600) + (parseInt(m || '0') * 60) + parseInt(s || '0');
} 