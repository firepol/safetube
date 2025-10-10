import { YouTubeAPI } from './youtube';
import { YouTubeSourceCache, VideoSource } from './types';
import { logVerbose } from './logging';

/**
 * Local IPC constants for preload context
 * (Preload scripts cannot import from shared modules, so constants are duplicated here)
 */
const IPC = {
  YOUTUBE_CACHE_DB: {
    SET_CACHED_RESULTS: 'database:youtube-cache:set-cached-results',
    GET_PAGE: 'youtube-cache:get-page',
  },
  SOURCES: {
    GET_BY_ID: 'database:sources:get-by-id',
    UPDATE: 'database:sources:update',
  },
} as const;

/**
 * Write YouTube cache to database using youtube_api_results table
 */
async function writeCacheToDatabase(sourceId: string, cache: YouTubeSourceCache): Promise<void> {
  try {
    // Only attempt IPC if in a renderer/preload context
    if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
      // Use the existing database:youtube-cache:set-cached-results handler
      if (cache.videos && cache.videos.length > 0) {
        const videoIds = cache.videos.map(v => v.id);
        await (window as any).electron.invoke(IPC.YOUTUBE_CACHE_DB.SET_CACHED_RESULTS, sourceId, 1, videoIds);
        logVerbose(`[CachedYouTubeSources] Written cache for ${sourceId} to database: ${videoIds.length} videos`);
      }
    } else if (typeof process !== 'undefined' && process.type === 'browser') {
      // Main process: use direct database access
      if (cache.videos && cache.videos.length > 0) {
        try {
          const { DatabaseService } = await import('../main/services/DatabaseService');
          const dbService = DatabaseService.getInstance();

          // Clear existing cache for this source and page
          await dbService.run(`
            DELETE FROM youtube_api_results WHERE source_id = ? AND page_range = ?
          `, [sourceId, '1-50']);

          // Batch insert cache entries using parameter binding
          const insertParams: any[] = [];
          const insertPlaceholders: string[] = [];

          for (let i = 0; i < cache.videos.length; i++) {
            const video = cache.videos[i];
            insertParams.push(sourceId, video.id, i + 1, '1-50', new Date().toISOString());
            insertPlaceholders.push(`(?, ?, ?, ?, ?)`);
          }

          if (insertPlaceholders.length > 0) {
            await dbService.run(`
              INSERT INTO youtube_api_results (source_id, video_id, position, page_range, fetch_timestamp)
              VALUES ${insertPlaceholders.join(',')}
            `, insertParams);
            logVerbose(`[CachedYouTubeSources] Batch inserted ${cache.videos.length} cache entries for ${sourceId}`);
          }

          logVerbose(`[CachedYouTubeSources] Written cache for ${sourceId} to database in main process: ${cache.videos.length} videos`);
        } catch (error) {
          logVerbose(`[CachedYouTubeSources] Error writing cache to database in main process: ${error}`);
        }
      }
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
 * Load YouTube cache from database using youtube_api_results table
 */
async function loadCacheFromDatabase(sourceId: string): Promise<YouTubeSourceCache | null> {
  try {
    if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
      // Renderer process: use IPC
      const result = await (window as any).electron.invoke(IPC.YOUTUBE_CACHE_DB.GET_PAGE, sourceId, 1);
      if (result && result.success && result.data && result.data.videos) {
        const pageData = result.data;

        // Reconstruct cache object from page data
        const cache: YouTubeSourceCache = {
          sourceId: sourceId,
          type: pageData.sourceType || 'youtube_channel',
          lastFetched: pageData.timestamp ? new Date(pageData.timestamp).toISOString() : new Date().toISOString(),
          lastVideoDate: pageData.videos.length > 0 ? pageData.videos[0].publishedAt : '',
          videos: pageData.videos || [],
          totalVideos: pageData.totalResults || pageData.videos.length,
          thumbnail: pageData.videos.length > 0 ? pageData.videos[0].thumbnail : '',
          usingCachedData: false,
          fetchedNewData: false
        };

        logVerbose(`[CachedYouTubeSources] Loaded cache for ${sourceId} from database: ${cache.videos.length} videos`);
        return cache;
      }
    } else if (typeof process !== 'undefined' && process.type === 'browser') {
      // Main process: use direct database access
      try {
        const { DatabaseService } = await import('../main/services/DatabaseService');
        const dbService = DatabaseService.getInstance();

        // Get cached results for page 1 (positions 1-50)
        const cacheResults = await dbService.all(`
          SELECT video_id, position, fetch_timestamp
          FROM youtube_api_results
          WHERE source_id = ? AND page_range = '1-50'
          ORDER BY position ASC
        `, [sourceId]);

        if (cacheResults && cacheResults.length > 0) {
          // Use batch operations for better performance
          const videoIds = cacheResults.map(r => r.video_id);
          const { DataCacheService } = await import('../main/services/DataCacheService');
          const cacheService = DataCacheService.getInstance();

          // Check cache first for videos
          const { found: cachedVideos, missing: missingVideoIds } = cacheService.batchGetVideos(videoIds);

          // Get missing videos from database
          let allVideos = new Map(cachedVideos);
          if (missingVideoIds.length > 0) {
            const dbVideos = await dbService.batchGetVideosByIds(missingVideoIds);
            cacheService.batchSetVideos(dbVideos);
            for (const [id, video] of dbVideos) {
              allVideos.set(id, video);
            }
          }

          if (allVideos.size > 0) {
            // Get source data with caching
            let sourceData = cacheService.getSource(sourceId);
            if (!sourceData) {
              const sourceMap = await dbService.batchGetSourcesData([sourceId]);
              sourceData = sourceMap.get(sourceId);
              if (sourceData) {
                cacheService.setSource(sourceId, sourceData);
              }
            }
            const totalVideosFromSource = sourceData ? sourceData.total_videos : allVideos.size;

            // Convert to array and sort
            const videos = Array.from(allVideos.values()).sort((a, b) =>
              new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime()
            );

            const cache: YouTubeSourceCache = {
              sourceId: sourceId,
              type: 'youtube_channel', // Default, will be overridden if needed
              lastFetched: cacheResults[0].fetch_timestamp,
              lastVideoDate: videos[0].published_at || '',
              videos: videos.map(v => ({
                id: v.id,
                title: v.title,
                publishedAt: v.published_at,
                thumbnail: v.thumbnail,
                duration: v.duration,
                url: v.url,
                description: v.description || ''
              })),
              totalVideos: totalVideosFromSource,
              thumbnail: videos[0].thumbnail || '',
              usingCachedData: false,
              fetchedNewData: false,
              apiErrorFallback: false  // Normal cache usage, no API error
            };

            logVerbose(`[CachedYouTubeSources] Loaded cache for ${sourceId} from database (main process): ${cache.videos.length} videos`);
            return cache;
          }
        }
      } catch (error) {
        logVerbose(`[CachedYouTubeSources] Error loading cache from database in main process: ${error}`);
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

    // Check if source already has total_videos in the database
    let hasExistingData = false;
    try {
      if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
        // Renderer process: use IPC
        const sourceResult = await (window as any).electron.invoke(IPC.SOURCES.GET_BY_ID, source.id);
        if (sourceResult && sourceResult.success && sourceResult.data) {
          const sourceData = sourceResult.data;
          hasExistingData = sourceData.total_videos != null && sourceData.thumbnail != null;
          if (hasExistingData) {
            logVerbose(`[CachedYouTubeSources] Source ${source.id} already has data in DB: total_videos=${sourceData.total_videos}`);
          }
        }
      } else if (typeof process !== 'undefined' && process.type === 'browser') {
        // Main process: use direct database access
        try {
          const { DatabaseService } = await import('../main/services/DatabaseService');
          const dbService = DatabaseService.getInstance();
          const sourceData = await dbService.get(`
            SELECT total_videos, thumbnail FROM sources WHERE id = ?
          `, [source.id]);
          if (sourceData) {
            hasExistingData = sourceData.total_videos != null && sourceData.thumbnail != null;
            if (hasExistingData) {
              logVerbose(`[CachedYouTubeSources] Source ${source.id} already has data in DB (main process): total_videos=${sourceData.total_videos}`);
            }
          }
        } catch (error) {
          logVerbose(`[CachedYouTubeSources] Error checking source data in main process: ${error}`);
        }
      }
    } catch (error) {
      logVerbose(`[CachedYouTubeSources] Could not check existing source data for ${source.id}: ${error}`);
    }

    const now = new Date().toISOString();
    let totalVideos = 0;
    let sourceThumbnail = '';
    let sourceTitle = source.title;
    let usingCachedData = false;
    let fetchedNewInfo = false;

    // Check if cache is still valid OR if we can reconstruct from videos table
    let reconstructedCache = null;
    if (!cache && hasExistingData) {
      // Reconstruct cache from videos table if api_results is empty but basic data exists
      try {
        if (typeof process !== 'undefined' && process.type === 'browser') {
          const { DatabaseService } = await import('../main/services/DatabaseService');
          const dbService = DatabaseService.getInstance();
          const videos = await dbService.all(`
            SELECT id, title, published_at, thumbnail, duration, url, description
            FROM videos
            WHERE source_id = ?
            ORDER BY published_at DESC
            LIMIT 50
          `, [source.id]);

          if (videos.length > 0) {
            reconstructedCache = {
              sourceId: source.id,
              type: source.type,
              lastFetched: new Date().toISOString(), // Use current time or source.updated_at if available
              lastVideoDate: videos[0].published_at || '',
              videos: videos.map(v => ({
                id: v.id,
                title: v.title,
                publishedAt: v.published_at,
                thumbnail: v.thumbnail,
                duration: v.duration,
                url: v.url,
                description: v.description || ''
              })),
              totalVideos: videos.length, // Use count or from sources table
              thumbnail: videos[0].thumbnail || '',
              usingCachedData: true,
              fetchedNewData: false
            };
            logVerbose(`[CachedYouTubeSources] Reconstructed cache for ${source.id} from videos table: ${videos.length} videos`);
            cache = reconstructedCache;
          }
        }
      } catch (reconError) {
        logVerbose(`[CachedYouTubeSources] Failed to reconstruct cache for ${source.id}: ${reconError}`);
      }
    }

    // Now check the (possibly reconstructed) cache
    if (cache && cache.lastFetched && hasExistingData) {
      const cacheAge = Date.now() - new Date(cache.lastFetched).getTime();

      // Default cache duration - 90 minutes
      const cacheDurationMs = 90 * 60 * 1000;

      if (cacheAge < cacheDurationMs) {
        logVerbose(`[CachedYouTubeSources] Using valid cache for source ${source.id} (age: ${Math.round(cacheAge / 60000)} minutes)`);
        return { ...cache, fetchedNewData: false };
      } else {
        logVerbose(`[CachedYouTubeSources] Cache expired for source ${source.id} (age: ${Math.round(cacheAge / 60000)} minutes), fetching fresh basic info`);
      }
    } else if (!hasExistingData) {
      logVerbose(`[CachedYouTubeSources] Source ${source.id} missing required data (total_videos/thumbnail), fetching from API`);
    } else if (!cache && !reconstructedCache) {
      logVerbose(`[CachedYouTubeSources] No cache found for source ${source.id}, fetching from API`);
    } else {
      logVerbose(`[CachedYouTubeSources] Cache exists but missing lastFetched timestamp for source ${source.id}, fetching from API`);
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
        return { ...cache, usingCachedData: true, fetchedNewData: false };
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
      usingCachedData,
      fetchedNewData: fetchedNewInfo,
      apiErrorFallback: false  // Basic info loading doesn't trigger API errors
    };

    // Write to database
    try {
      // Only update sources table if we fetched new info
      if (fetchedNewInfo) {
        if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
          // Renderer process: use IPC
          await (window as any).electron.invoke(IPC.SOURCES.UPDATE, source.id, {
            thumbnail: sourceThumbnail,
            total_videos: totalVideos,
            updated_at: now
          });
        } else if (typeof process !== 'undefined' && process.type === 'browser') {
          // Main process: use direct database access
          try {
            const { DatabaseService } = await import('../main/services/DatabaseService');
            const dbService = DatabaseService.getInstance();
            await dbService.run(`
              UPDATE sources SET thumbnail = ?, total_videos = ?, updated_at = ? WHERE id = ?
            `, [sourceThumbnail, totalVideos, now, source.id]);
            logVerbose(`[CachedYouTubeSources] Updated source ${source.id} with thumbnail and total_videos in main process`);
          } catch (error) {
            logVerbose(`[CachedYouTubeSources] Error updating source in main process: ${error}`);
          }
        }
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
          usingCachedData: false,  // Valid cache hit, not rate-limited fallback
          fetchedNewData: false    // No new data fetched - cache hit
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
        newVideos = await fetchNewYouTubeVideos(result.videoIds, cache?.videos || [], result.publishedDates);
        fetchedNewInfo = true;
      } else if (source.type === 'youtube_playlist') {
        const playlistId = extractPlaylistId(source.url);
        const result = await YouTubeAPI.getPlaylistVideos(playlistId, 50);
        totalVideos = result.totalResults;
        newVideos = await fetchNewYouTubeVideos(result.videoIds, cache?.videos || [], result.publishedDates);
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
        fetchedNewInfo = false; // No new data when using fallback
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
      usingCachedData, // This flag indicates if we're using cached data as fallback (API failed)
      fetchedNewData: fetchedNewInfo, // Flag to indicate if we fetched new data from API
      apiErrorFallback: usingCachedData && !fetchedNewInfo // Only true if using cache due to API error
    };

    // Write videos to database if we fetched new data from API
    if (fetchedNewInfo && newVideos.length > 0) {
      try {
        // Add sourceId to videos for database insertion
        const videosWithSourceId = newVideos.map(video => ({
          ...video,
          sourceId: source.id
        }));

        if (typeof process !== 'undefined' && process.type === 'browser') {
          // Main process: direct database access
          const { writeVideosToDatabase } = await import('../main/services/videoDataService');
          await writeVideosToDatabase(videosWithSourceId);
          logVerbose(`[CachedYouTubeSources] Wrote ${videosWithSourceId.length} new videos to database for ${source.id}`);
        } else if (typeof window !== 'undefined' && (window as any).electron?.batchUpsertVideos) {
          // Renderer process: use IPC
          const result = await (window as any).electron.batchUpsertVideos(videosWithSourceId);
          if (result.success) {
            logVerbose(`[CachedYouTubeSources] Wrote ${videosWithSourceId.length} new videos via IPC for ${source.id}`);
          } else {
            logVerbose(`[CachedYouTubeSources] Failed to write videos via IPC: ${result.error}`);
          }
        }
      } catch (error) {
        logVerbose(`[CachedYouTubeSources] Error writing videos to database: ${error}`);
      }
    }

    // Write to database
    try {
      await writeCacheToDatabase(source.id, updatedCache);
      // Only update sources table if we fetched new info
      if (fetchedNewInfo) {
        if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
          // Renderer process: use IPC
          await (window as any).electron.invoke(IPC.SOURCES.UPDATE, source.id, {
            thumbnail: sourceThumbnail,
            total_videos: totalVideos,
            updated_at: now
          });
        } else if (typeof process !== 'undefined' && process.type === 'browser') {
          // Main process: use direct database access
          try {
            const { DatabaseService } = await import('../main/services/DatabaseService');
            const dbService = DatabaseService.getInstance();
            await dbService.run(`
              UPDATE sources SET thumbnail = ?, total_videos = ?, updated_at = ? WHERE id = ?
            `, [sourceThumbnail, totalVideos, now, source.id]);
            logVerbose(`[CachedYouTubeSources] Updated source ${source.id} with thumbnail and total_videos in main process`);
          } catch (error) {
            logVerbose(`[CachedYouTubeSources] Error updating source in main process: ${error}`);
          }
        }
      }
    } catch (dbError) {
      logVerbose(`[CachedYouTubeSources] Warning: Could not write videos cache to database: ${dbError}`);
      throw dbError;
    }

    return updatedCache;
  }

  /**
   * Batch load cache for multiple sources to optimize database queries
   */
  static async batchLoadSourcesBasicInfo(sources: VideoSource[]): Promise<Map<string, YouTubeSourceCache>> {
    const cacheMap = new Map<string, YouTubeSourceCache>();

    if (sources.length === 0) {
      return cacheMap;
    }

    try {
      const sourceIds = sources.map(s => s.id);
      const placeholders = sourceIds.map(() => '?').join(',');

      if (typeof process !== 'undefined' && process.type === 'browser') {
        // Main process: use direct database access for batch operations
        try {
          const { DatabaseService } = await import('../main/services/DatabaseService');
          const { DataCacheService } = await import('../main/services/DataCacheService');
          const dbService = DatabaseService.getInstance();
          const cacheService = DataCacheService.getInstance();

          // Check cache first, then batch load missing sources data
          const { found: cachedSources, missing: missingSources } = cacheService.batchGetSources(sourceIds);

          let sourcesData: any[] = Array.from(cachedSources.values());
          if (missingSources.length > 0) {
            const missingPlaceholders = missingSources.map(() => '?').join(',');
            const dbSourcesData = await dbService.all(`
              SELECT id, total_videos, thumbnail, updated_at
              FROM sources
              WHERE id IN (${missingPlaceholders})
            `, missingSources);

            // Update cache with fetched data
            const sourceMap = new Map();
            for (const source of dbSourcesData) {
              sourceMap.set(source.id, source);
            }
            cacheService.batchSetSources(sourceMap);

            sourcesData = [...sourcesData, ...dbSourcesData];
          }

          // Batch load cache data
          const cacheResults = await dbService.all(`
            SELECT source_id, video_id, position, fetch_timestamp
            FROM youtube_api_results
            WHERE source_id IN (${placeholders}) AND page_range = '1-50'
            ORDER BY source_id, position ASC
          `, sourceIds);

          // Group cache results by source_id using forEach to avoid iteration issues
          const cacheBySource = new Map<string, any[]>();
          cacheResults.forEach(result => {
            if (!cacheBySource.has(result.source_id)) {
              cacheBySource.set(result.source_id, []);
            }
            cacheBySource.get(result.source_id)!.push(result);
          });

          // Get all video IDs for batch video details lookup
          const allVideoIds: string[] = [];
          const videoIdToSourceMap = new Map<string, string>();

          for (const [sourceId, cacheEntries] of cacheBySource) {
            for (const entry of cacheEntries) {
              allVideoIds.push(entry.video_id);
              videoIdToSourceMap.set(entry.video_id, sourceId);
            }
          }

          // Batch load video details if we have cached videos, using cache first
          let videosBySource = new Map<string, any[]>();
          if (allVideoIds.length > 0) {
            const { found: cachedVideos, missing: missingVideoIds } = cacheService.batchGetVideos(allVideoIds);

            // Get missing videos from database
            let allVideos = new Map(cachedVideos);
            if (missingVideoIds.length > 0) {
              const dbVideos = await dbService.batchGetVideosByIds(missingVideoIds);
              cacheService.batchSetVideos(dbVideos);
              for (const [id, video] of dbVideos) {
                allVideos.set(id, video);
              }
            }

            const videos = Array.from(allVideos.values()).sort((a, b) =>
              new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime()
            );

            // Group videos by source
            for (const video of videos) {
              const sourceId = videoIdToSourceMap.get(video.id);
              if (sourceId) {
                if (!videosBySource.has(sourceId)) {
                  videosBySource.set(sourceId, []);
                }
                videosBySource.get(sourceId)!.push({
                  id: video.id,
                  title: video.title,
                  publishedAt: video.published_at,
                  thumbnail: video.thumbnail,
                  duration: video.duration,
                  url: video.url,
                  description: video.description || ''
                });
              }
            }
          }

          // Build cache objects for each source
          for (const source of sources) {
            const sourceData = sourcesData.find(s => s.id === source.id);
            let hasExistingData = sourceData && sourceData.total_videos != null && sourceData.thumbnail != null;

            const sourceCacheEntries = cacheBySource.get(source.id) || [];
            const sourceVideos = videosBySource.get(source.id) || [];

            if ((sourceCacheEntries.length > 0 && sourceVideos.length > 0 && hasExistingData) || (sourceVideos.length > 0 && hasExistingData)) {
              if (sourceCacheEntries.length === 0) {
                // Reconstruct if cache entries missing but videos exist
                const firstVideo = sourceVideos[0];
                const reconstructionTimestamp = new Date().toISOString();
                const cache: YouTubeSourceCache = {
                  sourceId: source.id,
                  type: source.type as 'youtube_channel' | 'youtube_playlist',
                  lastFetched: reconstructionTimestamp,
                  lastVideoDate: firstVideo.publishedAt || '',
                  videos: sourceVideos.slice(0, 50),
                  totalVideos: sourceData ? sourceData.total_videos : sourceVideos.length,
                  thumbnail: sourceData ? sourceData.thumbnail || firstVideo.thumbnail || '' : firstVideo.thumbnail || '',
                  title: source.title,
                  usingCachedData: true,
                  fetchedNewData: false,
                  apiErrorFallback: false  // This is reconstruction, not API error
                };
                cacheMap.set(source.id, cache);
                logVerbose(`[CachedYouTubeSources] Reconstructed cache for ${source.id} in batch load: ${sourceVideos.length > 50 ? 50 : sourceVideos.length} videos`);
              } else {
                const firstEntry = sourceCacheEntries[0];
                const cache: YouTubeSourceCache = {
                  sourceId: source.id,
                  type: source.type as 'youtube_channel' | 'youtube_playlist',
                  lastFetched: firstEntry.fetch_timestamp,
                  lastVideoDate: sourceVideos[0].published_at || '',
                  videos: sourceVideos,
                  totalVideos: sourceData ? sourceData.total_videos : sourceVideos.length,
                  thumbnail: sourceData ? sourceData.thumbnail || '' : sourceVideos[0].thumbnail || '',
                  title: source.title,
                  usingCachedData: false,
                  fetchedNewData: false,
                  apiErrorFallback: false  // Normal cache usage, no API error
                };
                cacheMap.set(source.id, cache);
              }
            }
          }

          logVerbose(`[CachedYouTubeSources] Batch loaded cache for ${cacheMap.size} out of ${sources.length} sources`);

        } catch (error) {
          logVerbose(`[CachedYouTubeSources] Error in batch cache loading: ${error}`);
        }
      }

    } catch (error) {
      logVerbose(`[CachedYouTubeSources] Error in batchLoadSourcesBasicInfo: ${error}`);
    }

    return cacheMap;
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
async function fetchNewYouTubeVideos(allVideoIds: string[], cachedVideos: any[], publishedDates: Map<string, string>) {
  const cachedIds = new Set(cachedVideos.map(v => v.id));
  const newIds = allVideoIds.filter(id => !cachedIds.has(id));
  const detailsResults = await Promise.all(newIds.map(id => YouTubeAPI.getVideoDetails(id)));

  // Filter out null results (failed videos) and transform to expected format
  const details = detailsResults.filter(v => v !== null);
  return details.map(v => ({
    id: v.id,
    title: v.snippet.title,
    publishedAt: publishedDates.get(v.id) || '', // Use publishedAt from playlistItems API
    thumbnail: v.snippet.thumbnails.high.url,
    duration: parseISODuration(v.contentDetails.duration),
    url: `https://www.youtube.com/watch?v=${v.id}`,
    description: v.snippet.description || ''
  }));
}
function parseISODuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (parseInt(h || '0') * 3600) + (parseInt(m || '0') * 60) + parseInt(s || '0');
} 