import fs from 'fs';

import { logVerbose } from '../../shared/logging';
import { AppPaths } from '../appPaths';
import log from '../logger';
import { getThumbnailUrl } from './thumbnailService';
import { countVideosInFolder } from './localVideoService';

/**
 * Write video metadata to database for persistence and search
 * Now uses batch operations for better performance
 */
async function writeVideosToDatabase(videos: any[]): Promise<void> {
  try {
    const { DatabaseService } = await import('./DatabaseService');
    const { DataCacheService } = await import('./DataCacheService');
    const dbService = DatabaseService.getInstance();
    const cacheService = DataCacheService.getInstance();

    if (videos.length === 0) return;

    // Use batch upsert for better performance
    logVerbose(`[VideoDataService] Batch writing ${videos.length} videos to database`);
    await dbService.batchUpsertVideos(videos);

    // Update cache with new video data
    const videoMap = new Map();
    for (const video of videos) {
      videoMap.set(video.id, {
        id: video.id,
        title: video.title || '',
        thumbnail: video.thumbnail || '',
        duration: video.duration || 0,
        source_id: video.sourceId || '',
        url: video.url || '',
        published_at: video.publishedAt || video.published_at || null,
        description: video.description || null
      });
    }
    cacheService.batchSetVideos(videoMap);

    logVerbose(`[VideoDataService] Batch written ${videos.length} videos to database`);
  } catch (dbError) {
    log.error('[VideoDataService] Database not available for video writing:', dbError);
  }
}

// Main video data loading function - extracted from main index.ts
export async function loadAllVideosFromSources(apiKey?: string | null) {
  let sources: any[] = [];

  // Try to load sources from database first
  try {
    const { DatabaseService } = await import('./DatabaseService');
    const dbService = DatabaseService.getInstance();
    const healthStatus = await dbService.getHealthStatus();

    if (healthStatus.initialized) {
      const dbSources = await dbService.all<any>(`
        SELECT id, type, title, sort_preference, position, url, channel_id, path, max_depth
        FROM sources
        ORDER BY position ASC, title ASC
      `);

      if (dbSources && dbSources.length > 0) {
        // Convert database format to expected format
        sources = dbSources.map(source => ({
          id: source.id,
          type: source.type,
          title: source.title,
          sortPreference: source.sort_preference || 'newestFirst',
          url: source.url,
          channelId: source.channel_id,
          path: source.path,
          maxDepth: source.max_depth
        }));

        logVerbose('[VideoDataService] Loaded sources from database:', sources.length);
      } else {
        logVerbose('[VideoDataService] No sources found in database');
      }
    }
  } catch (dbError) {
    log.error('[VideoDataService] Database not available:', dbError);
    return { videosBySource: [] };
  }

  if (sources.length === 0) {
    logVerbose('[VideoDataService] No sources found in database');
    return { videosBySource: [] };
  }

  const videosBySource: any[] = [];

  // Batch load cache for YouTube sources to optimize database queries
  const youtubeSources = sources.filter(s => s.type === 'youtube_channel' || s.type === 'youtube_playlist');
  let batchCacheMap = new Map<string, any>();

  if (youtubeSources.length > 0) {
    try {
      const { CachedYouTubeSources } = await import('../../preload/cached-youtube-sources');
      batchCacheMap = await CachedYouTubeSources.batchLoadSourcesBasicInfo(youtubeSources);
      logVerbose('[VideoDataService] Batch loaded cache for', batchCacheMap.size, 'YouTube sources');
    } catch (error) {
      logVerbose('[VideoDataService] Error in batch cache loading:', error);
    }
  }

  for (const source of sources) {
    if (!source.id || !source.type || !source.title) {
      log.warn('[VideoDataService] WARNING: Skipping invalid source entry:', source);
      continue;
    }

    if (source.type === 'youtube_channel' || source.type === 'youtube_playlist') {
      // For YouTube sources, use the batch-loaded cache results if available
      try {
        let cache = batchCacheMap.get(source.id);

        if (cache) {
          // Use batch-loaded cache results
          logVerbose('[VideoDataService] Using batch-loaded cache for source:', source.id, 'total videos:', cache.totalVideos || 0, 'cached videos:', cache.videos?.length || 0);
        } else {
          // Fallback to individual loading if not in batch results
          const { CachedYouTubeSources } = await import('../../preload/cached-youtube-sources');

          logVerbose('[VideoDataService] Loading YouTube source individually (not in batch):', source.id, source.title);

          if (apiKey) {
            const { YouTubeAPI } = await import('../../preload/youtube');
            YouTubeAPI.setApiKey(apiKey);
            await YouTubeAPI.loadCacheConfig();
            logVerbose('[VideoDataService] YouTube API configured for source:', source.id);
          } else {
            log.warn('[VideoDataService] No API key provided for YouTube source:', source.id);
          }

          // Use basic info only for initial load to save API calls
          cache = await CachedYouTubeSources.loadSourceBasicInfo(source);
          logVerbose('[VideoDataService] Basic info loaded for source:', source.id, 'total videos:', cache.totalVideos || 0, 'cached videos:', cache.videos?.length || 0);
        }

        // For initial load, we only get basic source info (no videos fetched from API)
        // Videos will be loaded on-demand when user clicks the source
        const videosWithMetadata = (cache.videos || []).map((video: any) => ({
          ...video,
          type: 'youtube',  // PlayerRouter expects this for YouTube videos
          sourceId: source.id,
          sourceType: source.type,  // Use original type (youtube_channel/youtube_playlist)
          sourceTitle: source.title
        }));

        videosBySource.push({
          id: source.id,
          type: source.type,
          title: source.title,
          thumbnail: cache.thumbnail || '',
          videoCount: cache.totalVideos || cache.videos.length,
          videos: videosWithMetadata,  // Use videos with added metadata
          paginationState: {
            currentPage: 1,
            totalPages: Math.min(Math.ceil((cache.totalVideos || cache.videos.length) / 50), 10), // Default 10 pages
            totalVideos: cache.totalVideos || cache.videos.length,
            pageSize: 50,
            maxPages: Math.min(Math.ceil((cache.totalVideos || cache.videos.length) / 50), 100) // Max 100 pages
          },
          usingCachedData: cache.usingCachedData,
          fetchedNewData: cache.fetchedNewData || false  // Flag to indicate if new data was fetched
        });

      } catch (err) {
        log.error('[VideoDataService] ERROR loading YouTube source:', source.id, err);
        videosBySource.push({
          id: source.id,
          type: source.type,
          title: source.title,
          thumbnail: '',
          videoCount: 0,
          videos: [],
          paginationState: { currentPage: 1, totalPages: 1, totalVideos: 0, pageSize: 50 },
          maxDepth: source.maxDepth,
          path: source.path
        });
      }
    } else if (source.type === 'local') {
      try {
        // For local sources, calculate video count upfront for display
        logVerbose(`[VideoDataService] Local source ${source.id}: Calculating video count upfront.`);
        const videoCount = await countVideosInFolder(source.path, source.maxDepth || 2);

        videosBySource.push({
          id: source.id,
          type: source.type,
          title: source.title,
          thumbnail: '',
          videoCount: videoCount,
          videos: [], // Empty - videos will be loaded when source is clicked
          paginationState: { currentPage: 1, totalPages: Math.min(Math.ceil(videoCount / 50), 10), totalVideos: videoCount, pageSize: 50, maxPages: Math.min(Math.ceil(videoCount / 50), 100) }, // Default 10, max 100
          maxDepth: source.maxDepth,
          path: source.path
        });
      } catch (err) {
        log.error('[VideoDataService] ERROR counting videos for local source:', source.id, err);
        // Fallback to 0 on error
        videosBySource.push({
          id: source.id,
          type: source.type,
          title: source.title,
          thumbnail: '',
          videoCount: 0,
          videos: [],
          paginationState: { currentPage: 1, totalPages: 1, totalVideos: 0, pageSize: 50 },
          maxDepth: source.maxDepth,
          path: source.path
        });
      }
    }
  }

  // Add downloaded videos as a special source
  try {
    const { DatabaseService } = await import('./DatabaseService');
    const { getAllDownloadedVideos } = await import('../database/queries/downloadedVideosQueries');
    const dbService = DatabaseService.getInstance();
    const downloadedVideosDb = await getAllDownloadedVideos(dbService);

    // Map database format to expected format
    const downloadedVideos = downloadedVideosDb.map(dv => ({
      videoId: dv.video_id,
      sourceId: dv.source_id,
      title: dv.title,
      filePath: dv.file_path,
      thumbnail: dv.thumbnail_path,
      duration: dv.duration,
      downloadedAt: dv.downloaded_at,
      sourceType: 'youtube' // Default, could be enhanced
    }));

    if (downloadedVideos.length > 0) {
      // Group downloaded videos by source
      const downloadedVideosBySource = new Map<string, any[]>();

      for (const downloadedVideo of downloadedVideos) {
        const key = downloadedVideo.sourceId;
        if (!downloadedVideosBySource.has(key)) {
          downloadedVideosBySource.set(key, []);
        }
        downloadedVideosBySource.get(key)!.push(downloadedVideo);
      }

      // Create a source entry for downloaded videos
      videosBySource.push({
        id: 'downloaded',
        type: 'downloaded',
        title: 'Downloaded Videos',
        thumbnail: '', // Could add a download icon
        videoCount: downloadedVideos.length,
        videos: downloadedVideos.map(dv => ({
          id: dv.videoId,
          type: 'local' as const,
          title: dv.title,
          thumbnail: dv.thumbnail,
          duration: dv.duration,
          url: `file://${dv.filePath}`,
          sourceId: dv.sourceId,
          sourceTitle: 'Downloaded', // Could be enhanced by joining with sources table
          sourceType: dv.sourceType,
          sourceThumbnail: '',
          downloadedAt: dv.downloadedAt,
          filePath: dv.filePath
        })),
        paginationState: { currentPage: 1, totalPages: 1, totalVideos: downloadedVideos.length, pageSize: 50 },
        downloadedVideosBySource: Object.fromEntries(downloadedVideosBySource)
      });
    }
  } catch (err) {
    log.error('[VideoDataService] ERROR loading downloaded videos:', err);
  }

  // Add favorites as a special source (using database)
  try {
    const { DatabaseService } = await import('./DatabaseService');
    const dbService = DatabaseService.getInstance();

    // Get all favorites with video metadata from database
    const favorites = await dbService.all(`
      SELECT
        f.video_id,
        f.source_id,
        f.date_added,
        v.title,
        v.thumbnail,
        v.duration,
        v.url,
        v.published_at,
        v.description,
        s.title as source_title,
        s.type as source_type
      FROM favorites f
      LEFT JOIN videos v ON f.video_id = v.id
      LEFT JOIN sources s ON f.source_id = s.id
      ORDER BY f.date_added DESC
    `);

    if (favorites.length > 0) {
      // Convert database favorites to video objects
      const favoriteVideos = [];

      for (const favorite of favorites) {
        // Use existing thumbnail or placeholder
        const bestThumbnail = favorite.thumbnail || '/placeholder-thumbnail.svg';

        const favoriteVideo = {
          id: favorite.video_id,
          title: favorite.title || 'Unknown Title',
          thumbnail: bestThumbnail,
          duration: favorite.duration || 0,
          url: favorite.url || '',
          type: favorite.source_type === 'youtube_channel' || favorite.source_type === 'youtube_playlist' ? 'youtube' : favorite.source_type,
          published_at: favorite.published_at || null,
          description: favorite.description || '',
          sourceId: favorite.source_id,
          sourceTitle: favorite.source_title || 'Unknown Source',
          sourceType: 'favorites',
          originalSourceId: favorite.source_id,
          dateAdded: favorite.date_added,
          resumeAt: undefined as number | undefined,
        };

        favoriteVideos.push(favoriteVideo);
      }

      // Create favorites source entry
      videosBySource.push({
        id: 'favorites',
        type: 'favorites',
        title: 'Favorites',
        thumbnail: '⭐', // Star emoji as thumbnail
        videoCount: favorites.length,
        videos: favoriteVideos,
        paginationState: {
          currentPage: 1,
          totalPages: Math.ceil(favorites.length / 50),
          totalVideos: favorites.length,
          pageSize: 50
        }
      });
    } else {
      // Always show favorites source even if empty
      videosBySource.push({
        id: 'favorites',
        type: 'favorites',
        title: 'Favorites',
        thumbnail: '⭐',
        videoCount: 0,
        videos: [],
        paginationState: {
          currentPage: 1,
          totalPages: 1,
          totalVideos: 0,
          pageSize: 50
        }
      });
    }
  } catch (err) {
    log.error('[VideoDataService] ERROR loading favorites from database:', err);

    // Still add empty favorites source on error
    videosBySource.push({
      id: 'favorites',
      type: 'favorites',
      title: 'Favorites',
      thumbnail: '⭐',
      videoCount: 0,
      videos: [],
      paginationState: {
        currentPage: 1,
        totalPages: 1,
        totalVideos: 0,
        pageSize: 50
      }
    });
  }

  // Collect all videos for global access (needed for video playback)
  const allVideos: any[] = [];
  const newVideosToWrite: any[] = [];

  for (const source of videosBySource) {
    if (source.videos && source.videos.length > 0) {
      allVideos.push(...source.videos);

      // Only collect videos from sources that fetched new data
      if (source.fetchedNewData === true) {
        newVideosToWrite.push(...source.videos);
        logVerbose('[VideoDataService] Source', source.id, 'fetched new data, will write', source.videos.length, 'videos to DB');
      } else {
        logVerbose('[VideoDataService] Source', source.id, 'used cache, skipping DB write');
      }
    }
  }

  // Store videos globally so the player can access them
  (global as any).currentVideos = allVideos;
  logVerbose('[VideoDataService] Set global.currentVideos with', allVideos.length, 'videos');

  // Store videos in database for persistence and search - ONLY for new data
  if (newVideosToWrite.length > 0) {
    try {
      logVerbose('[VideoDataService] Writing', newVideosToWrite.length, 'new videos to database (out of', allVideos.length, 'total)');
      await writeVideosToDatabase(newVideosToWrite);
    } catch (dbError) {
      log.error('[VideoDataService] Warning: Could not write videos to database:', dbError);
      // Continue execution - this is not critical for basic functionality
    }
  } else {
    logVerbose('[VideoDataService] No new videos to write to database - all sources used cache');
  }

  return { videosBySource };
}

// Load videos for a specific source (called when user clicks on a source)
export async function loadVideosForSpecificSource(sourceId: string, apiKey?: string | null) {
  try {
    const { DatabaseService } = await import('./DatabaseService');
    const dbService = DatabaseService.getInstance();
    const healthStatus = await dbService.getHealthStatus();

    if (!healthStatus.initialized) {
      throw new Error('Database not initialized');
    }

    // Handle special "favorites" source
    if (sourceId === 'favorites') {
      // Get all favorites with video metadata from database
      const favorites = await dbService.all(`
        SELECT
          f.video_id,
          f.source_id,
          f.date_added,
          v.title,
          v.thumbnail,
          v.duration,
          v.url,
          v.published_at,
          v.description,
          s.title as source_title,
          s.type as source_type
        FROM favorites f
        LEFT JOIN videos v ON f.video_id = v.id
        LEFT JOIN sources s ON f.source_id = s.id
        ORDER BY f.date_added DESC
      `);

      // Convert database favorites to video objects
      const favoriteVideos = favorites.map(favorite => ({
        id: favorite.video_id,
        title: favorite.title || 'Unknown Title',
        thumbnail: favorite.thumbnail || '/placeholder-thumbnail.svg',
        duration: favorite.duration || 0,
        url: favorite.url || '',
        type: favorite.source_type === 'youtube_channel' || favorite.source_type === 'youtube_playlist' ? 'youtube' : favorite.source_type,
        published_at: favorite.published_at || null,
        description: favorite.description || '',
        sourceId: favorite.source_id,
        sourceTitle: favorite.source_title || 'Unknown Source',
        sourceType: 'favorites',
        originalSourceId: favorite.source_id,
        dateAdded: favorite.date_added,
        resumeAt: undefined as number | undefined,
      }));

      return {
        videosBySource: [{
          id: 'favorites',
          type: 'favorites',
          title: 'Favorites',
          thumbnail: '⭐',
          videoCount: favorites.length,
          videos: favoriteVideos,
          paginationState: {
            currentPage: 1,
            totalPages: Math.ceil(favorites.length / 50),
            totalVideos: favorites.length,
            pageSize: 50
          }
        }]
      };
    }

    // Get the specific source from database
    const sourceRow = await dbService.get<any>(`
      SELECT id, type, title, sort_preference, position, url, channel_id, path, max_depth
      FROM sources
      WHERE id = ?
    `, [sourceId]);

    if (!sourceRow) {
      throw new Error(`Source not found (videoDataService.ts:loadVideosForSpecificSource): ${sourceId}`);
    }

    const source = {
      id: sourceRow.id,
      type: sourceRow.type,
      title: sourceRow.title,
      sortPreference: sourceRow.sort_preference || 'newestFirst',
      url: sourceRow.url,
      channelId: sourceRow.channel_id,
      path: sourceRow.path,
      maxDepth: sourceRow.max_depth
    };

    if (source.type === 'youtube_channel' || source.type === 'youtube_playlist') {
      const { CachedYouTubeSources } = await import('../../preload/cached-youtube-sources');

      let cache;
      if (apiKey) {
        const { YouTubeAPI } = await import('../../preload/youtube');
        YouTubeAPI.setApiKey(apiKey);
        await YouTubeAPI.loadCacheConfig();
        cache = await CachedYouTubeSources.loadSourceVideos(source);
      } else {
        log.warn('[VideoDataService] No API key provided for YouTube source:', source.id);
        cache = await CachedYouTubeSources.loadSourceVideos(source);
      }

      const videosWithMetadata = cache.videos.map((video: any) => ({
        ...video,
        type: 'youtube',
        sourceId: source.id,
        sourceType: source.type,
        sourceTitle: source.title
      }));

      // Write new videos to database if fetched from API
      if (cache.fetchedNewData && videosWithMetadata.length > 0) {
        try {
          logVerbose('[VideoDataService] Writing', videosWithMetadata.length, 'new videos to database for source:', source.id);
          await writeVideosToDatabase(videosWithMetadata);
        } catch (dbError) {
          log.error('[VideoDataService] Warning: Could not write videos to database for source:', source.id, dbError);
        }
      }

      return {
        source: {
          id: source.id,
          type: source.type,
          title: cache.title || source.title,
          thumbnail: cache.thumbnail || '',
          videoCount: cache.totalVideos || cache.videos.length,
          videos: videosWithMetadata,
          paginationState: {
            currentPage: 1,
            totalPages: Math.min(Math.ceil((cache.totalVideos || cache.videos.length) / 50), 10), // Default 10 pages
            totalVideos: cache.totalVideos || cache.videos.length,
            pageSize: 50,
            maxPages: Math.min(Math.ceil((cache.totalVideos || cache.videos.length) / 50), 100) // Max 100 pages
          },
          usingCachedData: cache.usingCachedData,
          fetchedNewData: cache.fetchedNewData || false
        }
      };
    } else {
      throw new Error(`Unsupported source type for video loading: ${source.type}`);
    }

  } catch (error) {
    log.error('[VideoDataService] Error loading videos for source:', sourceId, error);
    throw error;
  }
}

/**
 * Optimized function to load only source metadata for Kid Screen startup
 * Avoids loading any video data, just source info needed for tiles
 */
export async function loadSourcesForKidScreen() {
  try {
    const { DatabaseService } = await import('./DatabaseService');
    const dbService = DatabaseService.getInstance();
    const healthStatus = await dbService.getHealthStatus();

    if (!healthStatus.initialized) {
      throw new Error('Database not initialized');
    }

    // Check for stale YouTube sources and refresh them before loading
    const { readMainSettings } = await import('../fileUtils');
    const settings = await readMainSettings();
    if (settings.youtubeApiKey) {
      await refreshStaleYouTubeSources(settings.youtubeApiKey);
    }

    // Single query to get all source metadata needed for Kid Screen
    const sources = await dbService.all<any>(`
      SELECT
        id, type, title, sort_preference, position, url, channel_id, path, max_depth,
        total_videos, thumbnail, updated_at
      FROM sources
      ORDER BY position ASC, title ASC
    `);

    logVerbose(`[VideoDataService] Loaded ${sources.length} sources for Kid Screen (metadata only)`);

    // Transform to expected format for Kid Screen
    const sourcesByType = sources.map(source => {
      // Calculate display video count
      let videoCount = 0;
      if (source.type === 'youtube_channel' || source.type === 'youtube_playlist') {
        videoCount = source.total_videos || 0;
      } else if (source.type === 'local') {
        // For local sources, use cached total_videos from database
        videoCount = source.total_videos || 0;
      }

      return {
        id: source.id,
        type: source.type,
        title: source.title,
        thumbnail: source.thumbnail || '',
        videoCount: videoCount,
        videos: [], // Empty for Kid Screen - videos loaded on-demand
        paginationState: {
          currentPage: 1,
          totalPages: Math.ceil(videoCount / 50),
          totalVideos: videoCount,
          pageSize: 50
        },
        // Source-specific fields
        url: source.url,
        channelId: source.channel_id,
        path: source.path,
        maxDepth: source.max_depth,
        // Optimization flags
        usingCachedData: false,
        fetchedNewData: false,
        apiErrorFallback: false,
        isKidScreenOptimized: true // Flag to indicate this is optimized loading
      };
    });

    // Add favorites count from database
    const favoritesCount = await dbService.get<{ count: number }>(`
      SELECT COUNT(*) as count FROM favorites
    `);

    // Get download path for downloaded source
    let downloadPath = '';
    let downloadedCount = 0;
    try {
      const { readMainSettings, getDefaultDownloadPath } = await import('../fileUtils');
      const settings = await readMainSettings();
      downloadPath = settings.downloadPath || await getDefaultDownloadPath();
      const { countVideosInFolder } = await import('./localVideoService');
      downloadedCount = await countVideosInFolder(downloadPath, 2);
    } catch (error) {
      logVerbose('[VideoDataService] Could not get download path or count:', error);
    }

    // Always add favorites and downloaded as special sources
    sourcesByType.push(
      {
        id: 'favorites',
        type: 'favorites',
        title: 'Favorites',
        thumbnail: '⭐',
        videoCount: favoritesCount?.count || 0, // Actual count from database
        videos: [],
        paginationState: { currentPage: 1, totalPages: 1, totalVideos: 0, pageSize: 50 },
        // Source-specific fields
        url: null,
        channelId: null,
        path: null,
        maxDepth: null,
        // Optimization flags
        usingCachedData: false,
        fetchedNewData: false,
        apiErrorFallback: false,
        isKidScreenOptimized: true
      },
      {
        id: 'downloaded',
        type: 'local',
        title: 'Downloaded Videos',
        thumbnail: '💾',
        videoCount: downloadedCount,
        videos: [],
        paginationState: { currentPage: 1, totalPages: 1, totalVideos: 0, pageSize: 50 },
        // Source-specific fields
        url: null,
        channelId: null,
        path: downloadPath,
        maxDepth: 2,
        // Optimization flags
        usingCachedData: false,
        fetchedNewData: false,
        apiErrorFallback: false,
        isKidScreenOptimized: true
      }
    );

    return { videosBySource: sourcesByType };
  } catch (error) {
    log.error('[VideoDataService] Error loading sources for Kid Screen:', error);
    throw error;
  }
}

/**
 * Refresh YouTube sources that are stale (updated_at is NULL or older than cache TTL)
 * This runs in the background on app startup
 */
export async function refreshStaleYouTubeSources(apiKey?: string | null) {
  log.info('[VideoDataService] refreshStaleYouTubeSources called');

  if (!apiKey) {
    log.warn('[VideoDataService] No API key provided, skipping stale source refresh');
    return;
  }

  try {
    const { DatabaseService } = await import('./DatabaseService');
    const dbService = DatabaseService.getInstance();
    const healthStatus = await dbService.getHealthStatus();

    if (!healthStatus.initialized) {
      log.warn('[VideoDataService] Database not initialized, skipping refresh');
      return;
    }

    // Get cache TTL from config (default 6 hours)
    const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
    const staleThreshold = new Date(Date.now() - CACHE_TTL_MS).toISOString();
    log.info(`[VideoDataService] Stale threshold: ${staleThreshold}`);

    // Find YouTube sources that need refreshing
    const staleSources = await dbService.all<any>(`
      SELECT id, type, url, channel_id
      FROM sources
      WHERE (type = 'youtube_channel' OR type = 'youtube_playlist')
        AND (updated_at IS NULL OR updated_at < ?)
    `, [staleThreshold]);

    log.info(`[VideoDataService] Found ${staleSources.length} stale YouTube sources`);

    if (staleSources.length === 0) {
      log.info('[VideoDataService] No stale YouTube sources found');
      return;
    }

    log.info(`[VideoDataService] Refreshing ${staleSources.length} stale YouTube sources`);

    const { YouTubeAPI } = await import('../youtube-api');
    const youtubeApi = new YouTubeAPI(apiKey);

    // Refresh each source in the background
    for (const source of staleSources) {
      try {
        let totalVideos = 0;
        let thumbnail = '';

        if (source.type === 'youtube_channel') {
          let channelId = source.channel_id;

          // If channel_id is missing, try to resolve from @handle URL
          if (!channelId && source.url) {
            const handleMatch = source.url.match(/@([^/?]+)/);
            if (handleMatch) {
              const handle = handleMatch[1];
              log.info(`[VideoDataService] Resolving channel ID for handle @${handle}`);
              channelId = await youtubeApi.getChannelIdFromHandle(handle);

              // Update the database with the resolved channel_id
              if (channelId) {
                await dbService.run(`
                  UPDATE sources
                  SET channel_id = ?
                  WHERE id = ?
                `, [channelId, source.id]);
                log.info(`[VideoDataService] Updated source ${source.id} with channel_id: ${channelId}`);
              }
            }
          }

          // Skip if still no channel_id
          if (!channelId) {
            log.warn(`[VideoDataService] Skipping source ${source.id} - could not resolve channel_id (URL: ${source.url})`);
            continue;
          }

          // Get channel details
          const channelData = await youtubeApi.getChannelDetails(channelId);
          if (channelData) {
            totalVideos = channelData.videoCount || 0;
            thumbnail = channelData.thumbnail || '';
          }
        } else if (source.type === 'youtube_playlist') {
          // Get playlist details
          const playlistId = source.url?.split('list=')[1] || '';
          if (playlistId) {
            const playlistData = await youtubeApi.getPlaylistDetails(playlistId);
            if (playlistData) {
              totalVideos = playlistData.videoCount || 0;
              thumbnail = playlistData.thumbnail || '';
            }
          }
        }

        // Update source in database
        const now = new Date().toISOString();
        await dbService.run(`
          UPDATE sources
          SET total_videos = ?, thumbnail = ?, updated_at = ?
          WHERE id = ?
        `, [totalVideos, thumbnail, now, source.id]);

        logVerbose(`[VideoDataService] Refreshed source ${source.id}: ${totalVideos} videos`);
      } catch (error) {
        log.error(`[VideoDataService] Error refreshing source ${source.id}:`, error);
        // Continue with next source even if this one fails
      }
    }

    logVerbose('[VideoDataService] Stale source refresh complete');
  } catch (error) {
    log.error('[VideoDataService] Error in refreshStaleYouTubeSources:', error);
  }
}

// Export the writeVideosToDatabase function for use by other modules
export { writeVideosToDatabase };