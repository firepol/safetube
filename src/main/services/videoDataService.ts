import fs from 'fs';

import { logVerbose } from '../../shared/logging';
import { AppPaths } from '../appPaths';
import log from '../logger';
import { getThumbnailUrl } from './thumbnailService';

// Main video data loading function - extracted from main index.ts
export async function loadAllVideosFromSources(apiKey?: string | null) {
  let sources: any[] = [];

  // Try to load sources from database first
  try {
    const DatabaseService = await import('./DatabaseService');
    const dbService = DatabaseService.default.getInstance();
    const healthStatus = await dbService.getHealthStatus();

    if (healthStatus.initialized) {
      const dbSources = await dbService.all<any>(`
        SELECT id, type, title, sort_order, url, channel_id, path, max_depth
        FROM sources
        ORDER BY sort_order ASC, title ASC
      `);

      if (dbSources && dbSources.length > 0) {
        // Convert database format to expected format
        sources = dbSources.map(source => ({
          id: source.id,
          type: source.type,
          title: source.title,
          sortOrder: source.sort_order || 'newestFirst',
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

  for (const source of sources) {
    if (!source.id || !source.type || !source.title) {
      log.warn('[VideoDataService] WARNING: Skipping invalid source entry:', source);
      continue;
    }

    if (source.type === 'youtube_channel' || source.type === 'youtube_playlist') {
      // For YouTube sources, use the cached version directly in main process
      try {
        const { CachedYouTubeSources } = await import('../../preload/cached-youtube-sources');

        // Set up YouTube API using the preload context (matching the expected pattern)
        logVerbose('[VideoDataService] Loading YouTube source:', source.id, source.title);

        let cache;
        if (apiKey) {
          const { YouTubeAPI } = await import('../../preload/youtube');
          YouTubeAPI.setApiKey(apiKey);
          await YouTubeAPI.loadCacheConfig();
          logVerbose('[VideoDataService] YouTube API configured for source:', source.id);
          cache = await CachedYouTubeSources.loadSourceVideos(source);
        } else {
          log.warn('[VideoDataService] No API key provided for YouTube source:', source.id);
          // Try to load from cache without API key (cache-only mode)
          cache = await CachedYouTubeSources.loadSourceVideos(source);
        }

        logVerbose('[VideoDataService] Cache loaded for source:', source.id, 'videos:', cache.videos?.length || 0, 'cached:', cache.usingCachedData);

        // Add source metadata to each video for global.currentVideos compatibility
        const videosWithMetadata = cache.videos.map((video: any) => ({
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
            totalPages: Math.ceil((cache.totalVideos || cache.videos.length) / 50),
            totalVideos: cache.totalVideos || cache.videos.length,
            pageSize: 50
          },
          usingCachedData: cache.usingCachedData
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
        // For local sources, don't scan videos upfront - let the LocalFolderNavigator handle it dynamically
        // This allows proper folder structure navigation instead of flattening
        logVerbose(`[VideoDataService] Local source ${source.id}: Using folder navigation (not scanning videos upfront).`);

        // For local sources, don't count videos upfront to avoid performance issues
        // Video count will be calculated lazily when needed
        videosBySource.push({
          id: source.id,
          type: source.type,
          title: source.title,
          thumbnail: '',
          videoCount: 0, // Will be calculated lazily
          videos: [], // Empty - LocalFolderNavigator will load videos dynamically
          paginationState: { currentPage: 1, totalPages: 1, totalVideos: 0, pageSize: 50 },
          maxDepth: source.maxDepth, // Pass through maxDepth for navigation
          path: source.path // Pass through path for navigation
        });
      } catch (err) {
        log.error('[VideoDataService] ERROR scanning local source:', source.id, err);
      }
    }
  }

  // Add downloaded videos as a special source
  try {
    const { readDownloadedVideos } = await import('../fileUtils');
    const downloadedVideos = await readDownloadedVideos();

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
          sourceTitle: dv.channelTitle || dv.playlistTitle || 'Unknown Source',
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

  // Add favorites as a special source
  try {
    const { getFavorites } = await import('../fileUtils');
    const favorites = await getFavorites();

    if (favorites.length > 0) {
      // Convert favorites to video objects with proper metadata
      const favoriteVideos = [];

      for (const favorite of favorites) {
        // Generate appropriate URL based on video type
        let videoUrl = '';
        const videoId = favorite.videoId;

        if (favorite.sourceType === 'youtube') {
          // For YouTube videos, extract the actual video ID (remove any prefix)
          const actualVideoId = videoId.startsWith('youtube:') ? videoId.substring(8) : videoId;
          videoUrl = `https://www.youtube.com/watch?v=${actualVideoId}`;
        } else if (favorite.sourceType === 'local') {
          // For local videos, the videoId contains the file path after "local:" prefix
          const filePath = videoId.startsWith('local:') ? videoId.substring(6) : videoId;
          videoUrl = `file://${filePath}`;
        } else if (favorite.sourceType === 'dlna') {
          // For DLNA videos, the videoId contains the URL after "dlna:" prefix
          const dlnaUrl = videoId.startsWith('dlna:') ? videoId.substring(5) : videoId;
          videoUrl = dlnaUrl;
        }

        // Check for best available thumbnail if original is empty (like History page does)
        let bestThumbnail = favorite.thumbnail;
        if (!bestThumbnail || bestThumbnail.trim() === '') {
          try {
            const { parseVideoId } = await import('../../shared/fileUtils');
            const { getThumbnailCacheKey } = await import('../../shared/thumbnailUtils');
            const parsed = parseVideoId(favorite.videoId);

            if (parsed.success && parsed.parsed?.type === 'local') {
              const cacheKey = getThumbnailCacheKey(favorite.videoId, 'local');
              const cachedThumbnailPath = AppPaths.getThumbnailPath(`${cacheKey}.jpg`);

              if (fs.existsSync(cachedThumbnailPath)) {
                const thumbnailUrl = getThumbnailUrl(cachedThumbnailPath);
                bestThumbnail = thumbnailUrl;
              }
            }
          } catch (error) {
            logVerbose('[VideoDataService] Error getting best thumbnail for favorite:', favorite.videoId, error);
          }
        }

        // Create video object compatible with existing video structure
        const favoriteVideo = {
          id: favorite.videoId,
          type: favorite.sourceType || 'youtube', // Use sourceType from FavoriteVideo interface
          title: favorite.title,
          thumbnail: bestThumbnail,
          duration: favorite.duration,
          url: videoUrl,
          sourceId: favorite.sourceId, // Use actual sourceId from favorites.json
          originalSourceId: favorite.sourceId, // Keep for compatibility
          sourceTitle: 'Favorites',
          sourceType: 'favorites',
          sourceThumbnail: '⭐',
          favoriteId: favorite.videoId,
          addedAt: favorite.dateAdded, // Use dateAdded from FavoriteVideo interface
          isAvailable: true, // Will be validated in renderer
          isFallback: false // Never show fallback UI for favorites
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
    log.error('[VideoDataService] ERROR loading favorites:', err);

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
  for (const source of videosBySource) {
    if (source.videos && source.videos.length > 0) {
      allVideos.push(...source.videos);
    }
  }

  // Store videos globally so the player can access them
  global.currentVideos = allVideos;
  logVerbose('[VideoDataService] Set global.currentVideos with', allVideos.length, 'videos');

  return { videosBySource };
}