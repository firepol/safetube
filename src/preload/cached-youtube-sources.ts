import { YouTubeAPI } from './youtube';
import { YouTubeSourceCache, VideoSource } from './types';
import { logVerbose } from './logging';

/**
 * Write YouTube cache to database for persistence
 */
async function writeCacheToDatabase(sourceId: string, cache: YouTubeSourceCache): Promise<void> {
  try {
    // Only attempt IPC if in a renderer/preload context
    if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
      await (window as any).electron.invoke('youtube-cache:save', sourceId, cache);
      logVerbose(`[CachedYouTubeSources] Written cache for ${sourceId} to database`);
    } else if (typeof process !== 'undefined' && process.type === 'browser') {
      // In main process: skip IPC, assume direct DB write is handled elsewhere or is unnecessary
      logVerbose(`[CachedYouTubeSources] Skipping IPC writeCacheToDatabase in main process for ${sourceId}`);
      return;
    } else {
      // Unknown context: skip or warn
      logVerbose(`[CachedYouTubeSources] Skipping writeCacheToDatabase: unknown context for ${sourceId}`);
      return;
    }
  } catch (error) {
    logVerbose(`[CachedYouTubeSources] Error writing cache to database: ${error}`);
    // Do not throw to avoid blocking main process
  }
}

/**
 * Load YouTube cache from database
 */
async function loadCacheFromDatabase(sourceId: string): Promise<YouTubeSourceCache | null> {
  try {
    if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
      const result = await (window as any).electron.invoke('youtube-cache:get', sourceId);
      if (result && result.cache_data) {
        const cache = JSON.parse(result.cache_data);
        logVerbose(`[CachedYouTubeSources] Loaded cache for ${sourceId} from database`);
        return cache;
      }
    }
    return null;
  } catch (error) {
    logVerbose(`[CachedYouTubeSources] Error loading cache from database: ${error}`);
    return null;
  }
}

export class CachedYouTubeSources {
  static async loadSourceBasicInfo(source: VideoSource): Promise<YouTubeSourceCache> {
    if (source.type !== 'youtube_channel' && source.type !== 'youtube_playlist') {
      throw new Error('Invalid source type for YouTube cache');
    }

    // Load cache from database
    let cache = await loadCacheFromDatabase(source.id);

    const now = new Date().toISOString();
    let totalVideos = 0;
    let sourceThumbnail = '';
    let sourceTitle = source.title;
    let usingCachedData = false;
    let fetchedNewInfo = false;


    // Check if cache is still valid
    if (cache && cache.lastFetched) {
      const cacheAge = Date.now() - new Date(cache.lastFetched).getTime();

      // Default cache duration - 90 minutes
      const cacheDurationMs = 90 * 60 * 1000;

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
        fetchedNewInfo = true;
        sourceTitle = basicInfo.title;

      } else if (source.type === 'youtube_playlist') {
        const playlistId = extractPlaylistId(source.url);
        const basicInfo = await YouTubeAPI.getPlaylistBasicInfo(playlistId);
        totalVideos = basicInfo.totalVideos;
        sourceThumbnail = basicInfo.thumbnail;
        fetchedNewInfo = true;
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

    // Write to database
    try {
      // Only update sources table if we fetched new info
      if (fetchedNewInfo && typeof window !== 'undefined' && (window as any).electron?.invoke) {
        await (window as any).electron.invoke('database:sources:update', source.id, {
          thumbnail: sourceThumbnail,
          total_videos: totalVideos,
          updated_at: now
        });
      }
      await writeCacheToDatabase(source.id, updatedCache);
    } catch (dbError) {
      logVerbose(`[CachedYouTubeSources] Warning: Could not write basic info cache to database: ${dbError}`);
      throw dbError;
    }

    return updatedCache;
  }

  static async loadSourceVideos(source: VideoSource): Promise<YouTubeSourceCache> {
    if (source.type !== 'youtube_channel' && source.type !== 'youtube_playlist') {
      throw new Error('Invalid source type for YouTube cache');
    }

    // Load cache from database
    let cache = await loadCacheFromDatabase(source.id);
    const now = new Date().toISOString();
    let newVideos: any[] = [];
    let totalVideos = 0;
    let sourceThumbnail = '';
    let usingCachedData = false;
    let fetchedNewInfo = false;
    
    // Check if cache is still valid
    if (cache && cache.lastFetched) {
      const cacheAge = Date.now() - new Date(cache.lastFetched).getTime();

      // Default cache duration - 90 minutes
      const cacheDurationMs = 90 * 60 * 1000;
      
      if (cacheAge < cacheDurationMs) {
        logVerbose(`[CachedYouTubeSources] Using valid cache for source ${source.id} (age: ${Math.round(cacheAge / 60000)} minutes)`);
        return {
          ...cache,
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
        fetchedNewInfo = true;
      } else if (source.type === 'youtube_playlist') {
        const playlistId = extractPlaylistId(source.url);
        const result = await YouTubeAPI.getPlaylistVideos(playlistId, 50);
        totalVideos = result.totalResults;
        newVideos = await fetchNewYouTubeVideos(result.videoIds, cache?.videos || []);
        fetchedNewInfo = true;
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
    // Write to database
    try {
      await writeCacheToDatabase(source.id, updatedCache);
      // Only update sources table if we fetched new info
      if (fetchedNewInfo && typeof window !== 'undefined' && (window as any).electron?.invoke) {
        await (window as any).electron.invoke('database:sources:update', source.id, {
          thumbnail: sourceThumbnail,
          total_videos: totalVideos,
          updated_at: now
        });
      }
    } catch (dbError) {
      logVerbose(`[CachedYouTubeSources] Warning: Could not write videos cache to database: ${dbError}`);
      throw dbError;
    }

    return updatedCache;
  }
}

function extractChannelId(url: string): string {
  // Handle @username format (e.g., https://www.youtube.com/@TEDEd)
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