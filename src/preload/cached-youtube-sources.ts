import { YouTubeAPI } from './youtube';
import { YouTubeSourceCache, VideoSource } from './types';
import fs from 'fs';
import path from 'path';
import { logVerbose } from './logging';

// Cache directory will be retrieved from main process via IPC, with fallback
let CACHE_DIR: string | null = null;
let CACHE_DIR_INITIALIZED = false;

function getCacheDir(): string {
  if (!CACHE_DIR_INITIALIZED) {
    try {
      // Try to get proper cache directory from main process synchronously first
      if (typeof window !== 'undefined' && (window as any).electron?.getCacheDirSync) {
        try {
          const syncCacheDir = (window as any).electron.getCacheDirSync();
          if (syncCacheDir) {
            CACHE_DIR = syncCacheDir;
            logVerbose(`[CachedYouTubeSources] Got cache directory synchronously: ${syncCacheDir}`);
          }
        } catch (error) {
          console.warn('[CachedYouTubeSources] Failed to get cache directory synchronously:', error);
        }
      }

      // If sync didn't work, try async as fallback
      if (!CACHE_DIR && typeof window !== 'undefined' && (window as any).electron?.getCacheDir) {
        try {
          (window as any).electron.getCacheDir().then((cacheDir: string) => {
            CACHE_DIR = cacheDir;
            logVerbose(`[CachedYouTubeSources] Updated cache directory asynchronously: ${cacheDir}`);
          }).catch((error: any) => {
            console.warn('[CachedYouTubeSources] Failed to get cache directory asynchronously:', error);
          });
        } catch (error) {
          console.warn('[CachedYouTubeSources] Failed to call getCacheDir IPC:', error);
        }
      }

      // Use fallback only if both sync and async failed
      if (!CACHE_DIR) {
        // In production, try to use a better fallback than current working directory
        const isProduction = process.env.NODE_ENV !== 'development';
        if (isProduction && typeof process !== 'undefined' && process.platform === 'win32') {
          // On Windows production, try to use APPDATA if available
          const appData = process.env.APPDATA || process.env.USERPROFILE;
          if (appData) {
            CACHE_DIR = path.join(appData, 'safetube', '.cache');
            logVerbose(`[CachedYouTubeSources] Using Windows production fallback cache directory: ${CACHE_DIR}`);
          } else {
            CACHE_DIR = path.join('.', '.cache');
            logVerbose(`[CachedYouTubeSources] Using default fallback cache directory: ${CACHE_DIR}`);
          }
        } else {
          CACHE_DIR = path.join('.', '.cache');
          logVerbose(`[CachedYouTubeSources] Using fallback cache directory: ${CACHE_DIR}`);
        }
      }

      CACHE_DIR_INITIALIZED = true;
    } catch (error) {
      console.warn('[CachedYouTubeSources] Failed to initialize cache directory:', error);
      CACHE_DIR = path.join('.', '.cache');
    }
  }
  return CACHE_DIR!;
}

function getCacheFilePath(sourceId: string): string {
  const cacheDir = getCacheDir();
  return path.join(cacheDir, `youtube-${sourceId}.json`);
}

export class CachedYouTubeSources {
  static async loadSourceBasicInfo(source: VideoSource): Promise<YouTubeSourceCache> {
    if (source.type !== 'youtube_channel' && source.type !== 'youtube_playlist') {
      throw new Error('Invalid source type for YouTube cache');
    }

    // Try to use database for caching, fallback to file system
    let cache: YouTubeSourceCache | null = null;
    let useDatabaseCache = false;

    // Try database first
    try {
      if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
        // Check if we have cached results in database
        const dbResponse = await (window as any).electron.invoke('database:youtube-cache:get-cached-results', source.id, 1);
        if (dbResponse && dbResponse.success && dbResponse.data && dbResponse.data.length > 0) {
          // We have some cached data, construct a basic cache object
          cache = {
            sourceId: source.id,
            type: source.type,
            videos: [], // Will be populated by loadSourceVideos
            totalVideos: dbResponse.data.length,
            lastFetched: new Date().toISOString(), // We'll use current time as approximation
            thumbnail: '',
            title: source.title
          };
          useDatabaseCache = true;
          logVerbose(`[CachedYouTubeSources] Found ${dbResponse.data.length} cached videos in database for source: ${source.id}`);
        }
      }
    } catch (error) {
      logVerbose(`[CachedYouTubeSources] Failed to check database cache for source ${source.id}: ${error}`);
    }

    // Fallback to file system cache if database not available
    if (!cache) {
      const cacheDir = getCacheDir();
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      const cacheFile = getCacheFilePath(source.id);
      if (fs.existsSync(cacheFile)) {
        try {
          cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
          logVerbose(`[CachedYouTubeSources] Using file system cache for source: ${source.id}`);
        } catch (e) {
          cache = null;
        }
      }
    }

    const now = new Date().toISOString();
    let totalVideos = 0;
    let sourceThumbnail = '';
    let sourceTitle = source.title;
    let usingCachedData = false;

    // Ensure we have cacheFile for fallback file writes
    const cacheFile = getCacheFilePath(source.id);

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
        return cache;
      } else {
        logVerbose(`[CachedYouTubeSources] Cache expired for source ${source.id} (age: ${Math.round(cacheAge / 60000)} minutes), fetching fresh basic info`);
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
            actualChannelId = channelId;
          }
        }

        const basicInfo = await YouTubeAPI.getChannelBasicInfo(actualChannelId);
        totalVideos = basicInfo.totalVideos;
        sourceThumbnail = basicInfo.thumbnail;
        sourceTitle = basicInfo.title;

      } else if (source.type === 'youtube_playlist') {
        const playlistId = extractPlaylistId(source.url);
        const basicInfo = await YouTubeAPI.getPlaylistBasicInfo(playlistId);
        totalVideos = basicInfo.totalVideos;
        sourceThumbnail = basicInfo.thumbnail;
        sourceTitle = basicInfo.title;
      }
    } catch (error) {
      console.warn(`[CachedYouTubeSources] YouTube API failed for source ${source.id}:`, error);

      // Always use cached data as fallback when API fails
      if (cache) {
        logVerbose(`[CachedYouTubeSources] Using cached data as fallback for source ${source.id} (API failed)`);
        return { ...cache, usingCachedData: true };
      } else {
        // No cache available, create minimal fallback
        logVerbose(`[CachedYouTubeSources] Creating minimal fallback for source ${source.id} (no cache available)`);
        totalVideos = 0;
        sourceThumbnail = '';
        sourceTitle = source.title;
        usingCachedData = true;
      }
    }

    const updatedCache: YouTubeSourceCache = {
      sourceId: source.id,
      type: source.type,
      lastFetched: now,
      lastVideoDate: cache?.lastVideoDate || '',
      videos: cache?.videos || [], // Keep existing videos if any, don't fetch new ones for basic info
      totalVideos,
      thumbnail: sourceThumbnail,
      title: sourceTitle,
      usingCachedData
    };

    fs.writeFileSync(cacheFile, JSON.stringify(updatedCache, null, 2), 'utf-8');
    return updatedCache;
  }

  static async loadSourceVideos(source: VideoSource): Promise<YouTubeSourceCache> {
    if (source.type !== 'youtube_channel' && source.type !== 'youtube_playlist') {
      throw new Error('Invalid source type for YouTube cache');
    }
    const cacheDir = getCacheDir();
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
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
          usingCachedData: false  // Valid cache hit, not rate-limited fallback
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
      usingCachedData // This flag indicates if we're using cached data as fallback (API failed)
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
  const detailsResults = await Promise.all(newIds.map(id => YouTubeAPI.getVideoDetails(id)));
  
  // Filter out null results (failed videos) and transform to expected format
  const details = detailsResults.filter(v => v !== null);
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