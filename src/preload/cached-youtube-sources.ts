import { YouTubeAPI } from './youtube';
import { YouTubeSourceCache, VideoSource } from './types';
import fs from 'fs';
import path from 'path';
import { logVerbose } from './logging';

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
    let totalVideos = 0;
    let sourceThumbnail = '';
    let usingCachedData = false;
    
    // Check if cache is still valid
    if (cache && cache.lastFetched) {
      const cacheAge = Date.now() - new Date(cache.lastFetched).getTime();
      
      // Load cache duration from pagination config
      let cacheDurationMs = 90 * 60 * 1000; // 90 minutes default
      try {
        const configPath = 'config/pagination.json';
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          cacheDurationMs = (config.cacheDurationMinutes || 90) * 60 * 1000;
        }
      } catch (error) {
        console.warn('[CachedYouTubeSources] Failed to load cache duration config:', error);
      }
      
      if (cacheAge < cacheDurationMs) {
        logVerbose(`[CachedYouTubeSources] Using valid cache for source ${source.id} (age: ${Math.round(cacheAge / 60000)} minutes)`);
        return {
          sourceId: source.id,
          type: source.type,
          lastFetched: cache.lastFetched,
          lastVideoDate: cache.lastVideoDate,
          videos: cache.videos,
          totalVideos: cache.totalVideos,
          thumbnail: cache.thumbnail,
          usingCachedData: true
        };
      } else {
        logVerbose(`[CachedYouTubeSources] Cache expired for source ${source.id} (age: ${Math.round(cacheAge / 60000)} minutes), fetching fresh data`);
      }
    }
    
    try {
      if (source.type === 'youtube_channel') {
        const channelId = extractChannelId(source.url);
        let actualChannelId = channelId;
        
        // If it's a username (starts with @), resolve it to channel ID first
        if (channelId.startsWith('@')) {
          try {
            const channelDetails = await YouTubeAPI.searchChannelByUsername(channelId);
            actualChannelId = channelDetails.channelId;
          } catch (error) {
            console.warn(`[CachedYouTubeSources] Could not resolve username ${channelId} to channel ID:`, error);
            // Fallback: try to use the username directly
            actualChannelId = channelId;
          }
        }
        
        const result = await YouTubeAPI.getChannelVideos(actualChannelId, 50);
        totalVideos = result.totalResults;
        newVideos = await fetchNewYouTubeVideos(result.videoIds, cache?.videos || []);
      } else if (source.type === 'youtube_playlist') {
        const playlistId = extractPlaylistId(source.url);
        const result = await YouTubeAPI.getPlaylistVideos(playlistId, 50);
        totalVideos = result.totalResults;
        newVideos = await fetchNewYouTubeVideos(result.videoIds, cache?.videos || []);
      }
    } catch (error) {
      console.warn(`[CachedYouTubeSources] YouTube API failed for source ${source.id}:`, error);
      
      // Always use cached data as fallback when API fails
      if (cache && cache.videos.length > 0) {
        logVerbose(`[CachedYouTubeSources] Using cached data as fallback for source ${source.id} (API failed)`);
        totalVideos = cache.totalVideos || cache.videos.length;
        newVideos = [];
        sourceThumbnail = cache.thumbnail || '';
        usingCachedData = true;
      } else {
        // No cache available, create minimal fallback
        logVerbose(`[CachedYouTubeSources] Creating minimal fallback for source ${source.id} (no cache available)`);
        totalVideos = 0;
        newVideos = [];
        sourceThumbnail = '';
        usingCachedData = true;
      }
    }
    
    const videos = [...(cache?.videos || []), ...newVideos];
    
    // Get thumbnail from first video if available
    if (videos.length > 0 && videos[0].thumbnail) {
      sourceThumbnail = videos[0].thumbnail;
    }
    
    const updatedCache: YouTubeSourceCache = {
      sourceId: source.id,
      type: source.type,
      lastFetched: now,
      lastVideoDate: videos.length > 0 ? videos[0].publishedAt : cache?.lastVideoDate,
      videos,
      totalVideos,
      thumbnail: sourceThumbnail,
      usingCachedData // Add flag to indicate if we're using cached data
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