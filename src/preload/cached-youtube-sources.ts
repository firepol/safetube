import { YouTubeAPI } from './youtube';
import { YouTubeSourceCache, VideoSource } from './types';
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join('.', '.cache');

function getCacheFilePath(sourceId: string) {
  return path.join(CACHE_DIR, `youtube-${sourceId}.json`);
}

export class CachedYouTubeSources {
  static async loadSourceVideos(source: VideoSource): Promise<YouTubeSourceCache> {
    if (source.type !== 'youtube_channel' && source.type !== 'youtube_playlist') {
      throw new Error('Invalid source type for YouTube cache');
    }
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
    if (source.type === 'youtube_channel') {
      const channelId = extractChannelId(source.url);
      let actualChannelId = channelId;
      
      // If it's a username (starts with @), resolve it to channel ID first
      if (channelId.startsWith('@')) {
        try {
          const channelDetails = await YouTubeAPI.searchChannelByUsername(channelId);
          actualChannelId = channelDetails.channelId;
        } catch (error) {
          throw new Error(`Could not resolve username ${channelId} to channel ID: ${error}`);
        }
      }
      
      const allVideos = await YouTubeAPI.getChannelVideos(actualChannelId, 50);
      newVideos = await fetchNewYouTubeVideos(allVideos, cache?.videos || []);
    } else if (source.type === 'youtube_playlist') {
      const playlistId = extractPlaylistId(source.url);
      const allVideos = await YouTubeAPI.getPlaylistVideos(playlistId, 50);
      newVideos = await fetchNewYouTubeVideos(allVideos, cache?.videos || []);
    }
    const videos = [...(cache?.videos || []), ...newVideos];
    const updatedCache: YouTubeSourceCache = {
      sourceId: source.id,
      type: source.type,
      lastFetched: now,
      lastVideoDate: videos.length > 0 ? videos[0].publishedAt : cache?.lastVideoDate,
      videos,
    };
    fs.writeFileSync(cacheFile, JSON.stringify(updatedCache, null, 2), 'utf-8');
    return updatedCache;
  }
}

function extractChannelId(url: string): string {
  // Handle @username format (e.g., https://www.youtube.com/@skypaul77)
  if (url.includes('/@')) {
    const match = url.match(/\/@([^\/\?]+)/);
    if (match) return `@${match[1]}`; // Return with @ prefix for usernames
  }
  
  // Handle /channel/ format (e.g., https://www.youtube.com/channel/UC...)
  const match = url.match(/channel\/([\w-]+)/);
  if (match) return match[1];
  
  throw new Error('Unsupported channel URL');
}
function extractPlaylistId(url: string): string {
  const match = url.match(/[?&]list=([\w-]+)/);
  if (match) return match[1];
  throw new Error('Invalid playlist URL');
}
async function fetchNewYouTubeVideos(allVideoIds: string[], cachedVideos: any[]) {
  const cachedIds = new Set(cachedVideos.map(v => v.id));
  const newIds = allVideoIds.filter(id => !cachedIds.has(id));
  const details = await Promise.all(newIds.map(id => YouTubeAPI.getVideoDetails(id)));
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
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (parseInt(h || '0') * 3600) + (parseInt(m || '0') * 60) + parseInt(s || '0');
} 