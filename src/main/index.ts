import fs from 'fs'
import path from 'path'

import dotenv from 'dotenv'
import { app, BrowserWindow, ipcMain, protocol } from 'electron'


import { createLocalVideoId } from '../shared/fileUtils'

// Load environment variables from .env file

import { logVerbose } from '../shared/logging'

import { AppPaths } from './appPaths'
import { readTimeLimits, readMainSettings, readVideoSources } from './fileUtils'
import { YouTubeChannelSource, VideoSource } from '../shared/types'
import log from './logger'
import { recordVideoWatching, getTimeTrackingState } from './timeTracking'
import { setupYouTubeHandlers } from './youtube'
import { YouTubeAPI } from './youtube-api'
import { extractChannelId, extractPlaylistId, resolveUsernameToChannelId } from './utils/urlUtils'
import { loadAllVideosFromSources } from './services/videoDataService'
import { migrateChannelIds } from './channelIdMigration'
import {
  scanLocalFolder,
  getLocalFolderContents,
  countVideosInFolder,
  countVideosRecursively,
  getFlattenedContent,
  filterDuplicateVideos,
  setThumbnailScheduler
} from './services/localVideoService'
import {
  scheduleBackgroundThumbnailGeneration,
  processNextThumbnailInQueue,
  getThumbnailUrl,
  notifyThumbnailReady,
  findThumbnailForVideo
} from './services/thumbnailService'
import { getDlnaFile } from './services/networkService'
import { registerAllHandlers } from './services/ipcHandlerRegistry'
import { DatabaseService } from './services/DatabaseService'

/**
 * Write video metadata to database for persistence and search
 */
async function writeVideosToDatabase(videos: any[]): Promise<void> {
  const dbService = DatabaseService.getInstance();

  for (const video of videos) {
    try {
      // Check if video already exists
      const existing = await dbService.get(`
        SELECT id FROM videos WHERE id = ?
      `, [video.id]);

      if (!existing) {
        // Insert new video
        await dbService.run(`
          INSERT OR REPLACE INTO videos (
            id, title, thumbnail, duration, source_id,
            url, published_at, description, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `, [
          video.id,
          video.title || '',
          video.thumbnail || '',
          video.duration || 0,
          video.sourceId || '',
          video.url || '',
          video.publishedAt || video.published_at || null,
          video.description || null
        ]);
      } else {
        // Update existing video metadata
        await dbService.run(`
          UPDATE videos SET
            title = ?, thumbnail = ?, duration = ?, url = ?,
            published_at = ?, description = ?, updated_at = datetime('now')
          WHERE id = ?
        `, [
          video.title || '',
          video.thumbnail || '',
          video.duration || 0,
          video.url || '',
          video.publishedAt || video.published_at || null,
          video.description || null,
          video.id
        ]);
      }
    } catch (error) {
      log.warn(`[Main] Warning: Could not write video ${video.id} to database:`, error);
      // Continue with other videos
    }
  }

  logVerbose(`[Main] Written ${videos.length} videos to database`);
}

// Load .env file from multiple possible locations
const possibleEnvPaths = [
  '.env', // Project root (for development)
  path.join(AppPaths.getUserDataDir(), '.env') // Production location
];

for (const envPath of possibleEnvPaths) {
  const result = dotenv.config({ path: envPath });
  if (result.parsed && Object.keys(result.parsed).length > 0) {
    break;
  }
}


// Global type declaration for current videos
declare global {
  var currentVideos: any[];
}

// Set up the thumbnail scheduler in the local video service
setThumbnailScheduler(scheduleBackgroundThumbnailGeneration);









// Helper function to fix downloaded videos with missing file paths
async function fixDownloadedVideosPaths(downloadedVideos: any[]): Promise<any[]> {
  const { readMainSettings, getDefaultDownloadPath } = await import('./fileUtils');
  const settings = await readMainSettings();
  const downloadPath = settings.downloadPath || await getDefaultDownloadPath();

  let hasUpdates = false;
  const fixedVideos = [];

  for (const dv of downloadedVideos) {
    let fixedVideo = { ...dv };

    // If filePath is missing, try to find it
    if (!dv.filePath || dv.filePath === '') {
      // Reconstruct the expected path based on source info and title
      const folderName = dv.playlistTitle || dv.channelTitle || 'Unknown';
      const sanitizedFolderName = folderName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').substring(0, 100);
      const sanitizedTitle = dv.title
        .replace(/[\/\\]/g, ' - ')
        .replace(/:/g, ' -')
        .replace(/[<>"|?*]/g, '')
        .replace(/\|/g, ' - ')
        .replace(/\s+/g, ' ')
        .replace(/^[\s.]+|[\s.]+$/g, '')
        .substring(0, 200)
        .trim();

      const expectedDir = path.join(downloadPath, sanitizedFolderName);
      const videoExtensions = ['.mp4', '.webm', '.mkv', '.avi', '.mov'];

      for (const ext of videoExtensions) {
        const expectedPath = path.join(expectedDir, sanitizedTitle + ext);
        if (fs.existsSync(expectedPath)) {
          fixedVideo.filePath = expectedPath;
          hasUpdates = true;
          break;
        }
      }
    }

    // If thumbnail is missing, try to find it
    if ((!dv.thumbnail || dv.thumbnail === '') && fixedVideo.filePath) {
      const videoDir = path.dirname(fixedVideo.filePath);
      const baseName = path.basename(fixedVideo.filePath, path.extname(fixedVideo.filePath));
      const thumbnailExtensions = ['.webp', '.jpg', '.jpeg', '.png'];

      for (const ext of thumbnailExtensions) {
        const expectedThumbnail = path.join(videoDir, baseName + ext);
        if (fs.existsSync(expectedThumbnail)) {
          fixedVideo.thumbnail = expectedThumbnail;
          hasUpdates = true;
          break;
        }
      }
    }

    fixedVideos.push(fixedVideo);
  }

  // If we made updates, save them back to the file
  if (hasUpdates) {
    try {
      const { writeDownloadedVideos } = await import('./fileUtils');
      await writeDownloadedVideos(fixedVideos);
    } catch (error) {
      logVerbose(`[Main] Failed to update downloadedVideos.json: ${error}`);
    }
  }

  return fixedVideos;
}


// Force TypeScript to include these functions by exporting them (even if not used elsewhere)
export { getLocalFolderContents };


// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (process.platform === 'win32') {
  try {
    if (require('electron-squirrel-startup')) {
      app.quit();
    }
  } catch (error) {
    // electron-squirrel-startup not available on non-Windows platforms
  }
}

const isDev = process.env.NODE_ENV === 'development'

// All IPC handlers are now registered in the ipcHandlerRegistry service
// See registerAllHandlers() call in the app.on('ready') event below


// Handle video data loading - ONLY from new source system
ipcMain.handle('get-video-data', async (_, videoId: string, navigationContext?: any) => {
  try {
    logVerbose(`[Main] get-video-data called for videoId: ${videoId}`);
    logVerbose(`[Main] navigationContext: ${JSON.stringify(navigationContext, null, 2)}`);

    // Check if we have pre-fetched video metadata from navigation context (e.g., from related video clicks)
    if (navigationContext?.videoMetadata) {
      logVerbose('[Main] Using pre-fetched video metadata from navigation context');

      // Create video object from the provided metadata
      const video = {
        id: videoId,
        type: navigationContext.videoMetadata.type || 'youtube',
        title: navigationContext.videoMetadata.title || 'Unknown Title',
        thumbnail: navigationContext.videoMetadata.thumbnail || '',
        duration: navigationContext.videoMetadata.duration || 0,
        url: navigationContext.videoMetadata.url || `https://www.youtube.com/watch?v=${videoId}`,
        sourceId: navigationContext.videoMetadata.sourceId || 'external-youtube',
        sourceTitle: navigationContext.videoMetadata.sourceTitle || 'YouTube',
        sourceType: navigationContext.videoMetadata.sourceType || 'youtube_channel',
        sourceThumbnail: navigationContext.videoMetadata.sourceThumbnail || '',
        resumeAt: undefined as number | undefined,
      };

      // Merge with watched data to populate resumeAt
      const { mergeWatchedData } = await import('./fileUtils');
      const videosWithWatchedData = await mergeWatchedData([video]);
      const videoWithResume = videosWithWatchedData[0];

      return videoWithResume;
    }

    // Check if this is a YouTube video that has been downloaded and should be played as local
    // This supports the smart routing functionality
    try {
      const { SmartPlaybackRouter } = await import('./smartPlaybackRouter');
      const downloadedCheck = await SmartPlaybackRouter.shouldUseDownloadedVersion(videoId);

      if (downloadedCheck.useDownloaded && downloadedCheck.downloadedVideo) {
        const localVideo = await SmartPlaybackRouter.createLocalVideoFromDownload(
          downloadedCheck.downloadedVideo,
          navigationContext
        );

        // Merge with watched data to populate resumeAt
        const { mergeWatchedData } = await import('./fileUtils');
        const videosWithWatchedData = await mergeWatchedData([localVideo]);
        const videoWithResume = videosWithWatchedData[0];

        return videoWithResume;
      }
    } catch (downloadError) {
      logVerbose('[Main] Error checking for downloaded version, continuing with normal flow:', downloadError);
      // Continue with normal video loading if download check fails
    }

    // Parse the video ID to determine its type
    const { parseVideoId, extractPathFromVideoId } = await import('../shared/fileUtils');
    const parseResult = parseVideoId(videoId);

    // Handle local videos (both new URI-style and legacy encoded)
    let localFilePath: string | null = null;

    if (parseResult.success && parseResult.parsed?.type === 'local') {
      // New URI-style local video ID
      localFilePath = extractPathFromVideoId(videoId);
      if (localFilePath) {
      }
    }

    // If we have a local file path, process it
    if (localFilePath) {
      try {
        // Check if file exists
        if (!fs.existsSync(localFilePath)) {
          return null; // Return null instead of throwing error for missing files
        }

        // Extract video duration using ffprobe
        const { extractVideoDuration } = await import('../shared/videoDurationUtils');
        const duration = await extractVideoDuration(localFilePath);

        // Find the actual source ID for this local video
        let sourceId = 'unknown';
        let sourceTitle = 'Local Video';
        try {
          const { readVideoSources } = await import('./fileUtils');
          const sources = await readVideoSources();
          for (const source of sources) {
            if (source.type === 'local' && localFilePath.startsWith(source.path)) {
              sourceId = source.id;
              sourceTitle = source.title;
              break;
            }
          }
        } catch (error) {
          log.error('[Main] Error finding source for local video:', error);
        }

        // Create video object for local video
        const video = {
          id: videoId,
          type: 'local',
          title: path.basename(localFilePath, path.extname(localFilePath)),
          thumbnail: '',
          duration,
          url: localFilePath,
          video: localFilePath,
          audio: undefined,
          preferredLanguages: ['en'],
          sourceId: sourceId,
          sourceTitle: sourceTitle,
          sourceThumbnail: '',
          resumeAt: undefined as number | undefined, // Add resumeAt property
        };

        // Merge with watched data to populate resumeAt
        const { mergeWatchedData } = await import('./fileUtils');
        const videosWithWatchedData = await mergeWatchedData([video]);
        const videoWithResume = videosWithWatchedData[0];
        
        return videoWithResume;
      } catch (error) {
        log.error('[Main] Error handling local video:', error);
        return null; // Return null instead of throwing error for missing files
      }
    }

    // For non-local videos (including YouTube), use the existing logic
    if (!global.currentVideos || global.currentVideos.length === 0) {
      log.error('[Main] No videos loaded from source system. Video sources may not be initialized.');
      throw new Error('Video sources not initialized. Please restart the app.');
    }


    const video = global.currentVideos.find((v: any) => v.id === videoId);
    if (video) {

      // Merge with watched data to populate resumeAt for all video types
      const { mergeWatchedData } = await import('./fileUtils');
      const videosWithWatchedData = await mergeWatchedData([video]);
      const videoWithResume = videosWithWatchedData[0];

      return videoWithResume;
    } else {
      // Check if this might be a raw filename that needs to be matched by file path
      // This handles cases where old watched data contains raw filenames instead of encoded IDs
      if (videoId.includes('/') || videoId.startsWith('_') || videoId.endsWith('.mp4') || videoId.endsWith('.mkv') || videoId.endsWith('.webm') || videoId.endsWith('.avi') || videoId.endsWith('.mov') || videoId.endsWith('.m4v')) {

        // Try to find the video by matching the file path
        const videoByPath = global.currentVideos.find((v: any) => {
          if (v.type === 'local' && v.url) {
            // Check if the video's URL matches the videoId (possibly with path reconstruction)
            return v.url === videoId ||
              v.url.endsWith(videoId) ||
              v.url.includes(videoId) ||
              (videoId.startsWith('_') && v.url.endsWith(videoId.substring(1))) ||
              (videoId.includes('_') && v.url.includes(videoId.replace(/_/g, '/')));
          }
          return false;
        });

        if (videoByPath) {

          // Merge with watched data to populate resumeAt for path-matched videos
          const { mergeWatchedData } = await import('./fileUtils');
          const videosWithWatchedData = await mergeWatchedData([videoByPath]);
          const videoWithResume = videosWithWatchedData[0];

          return videoWithResume;
        }
      }

      // Don't log as error for YouTube videos or other expected non-local videos
      // Only log as verbose for debugging

      // For YouTube videos (11-character video IDs), try to fetch from YouTube API
      if (videoId.length === 11 && /^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        try {
          // Get YouTube API key from main settings
          const { readMainSettings } = await import('./fileUtils');
          const settings = await readMainSettings();

          if (!settings.youtubeApiKey) {
            return null;
          }

          // Fetch video details from YouTube API
          const { YouTubeAPI } = await import('./youtube-api');
          const youtubeApi = new YouTubeAPI(settings.youtubeApiKey);
          const videoDetails = await youtubeApi.getVideoDetails(videoId);

          if (!videoDetails) {
            return null;
          }

          // Convert duration from ISO 8601 to seconds
          const { parseDuration } = await import('../shared/videoDurationUtils');
          const duration = parseDuration(videoDetails.contentDetails.duration);

          // Try to find matching source for this video (for related video clicks)
          const channelId = videoDetails.snippet.channelId;
          let matchingSource: VideoSource | undefined = undefined;
          let finalSourceId = 'external-youtube';
          let finalSourceTitle = 'YouTube';
          let finalSourceType: 'youtube_channel' | 'youtube_playlist' = 'youtube_channel';

          if (channelId) {
            logVerbose(`[Main] YouTube video ${videoId} belongs to channel ${channelId}, checking for matching sources`);

            // First try to match channel sources by channelId
            const sources = await readVideoSources();
            matchingSource = sources
              .filter(s => s.type === 'youtube_channel')
              .find(s => (s as YouTubeChannelSource).channelId === channelId);

            // If no channel match, check playlist sources via existing videos
            if (!matchingSource && global.currentVideos) {
              logVerbose(`[Main] No channel match found, checking playlist sources...`);
              const videoFromPlaylist = global.currentVideos.find((v: any) =>
                v.type === 'youtube' && v.channelId === channelId
              );

              if (videoFromPlaylist) {
                matchingSource = sources.find(s => s.id === videoFromPlaylist.sourceId);
                logVerbose(`[Main] Found matching playlist source: ${matchingSource ? matchingSource.title + ' (' + matchingSource.id + ')' : 'none'}`);
              }
            }

            if (matchingSource) {
              finalSourceId = matchingSource.id;
              finalSourceTitle = matchingSource.title;
              finalSourceType = matchingSource.type as 'youtube_channel' | 'youtube_playlist';
              logVerbose(`[Main] YouTube video ${videoId} mapped to source: ${finalSourceTitle} (${finalSourceId})`);
            } else {
              logVerbose(`[Main] YouTube video ${videoId} does not belong to any approved source`);
            }
          }

          // Create video object from YouTube API data
          const video = {
            id: videoId,
            type: 'youtube',
            title: videoDetails.snippet.title || 'Unknown Title',
            thumbnail: videoDetails.snippet.thumbnails?.medium?.url ||
                      videoDetails.snippet.thumbnails?.default?.url || '',
            duration,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            sourceId: finalSourceId,
            sourceTitle: finalSourceTitle,
            sourceType: finalSourceType,
            sourceThumbnail: '',
            resumeAt: undefined as number | undefined,
            channelId: channelId,
          };

          // Merge with watched data to populate resumeAt
          const { mergeWatchedData } = await import('./fileUtils');
          const videosWithWatchedData = await mergeWatchedData([video]);
          const videoWithResume = videosWithWatchedData[0];

          return videoWithResume;

        } catch (apiError) {
          logVerbose('[Main] Failed to fetch YouTube video from API:', apiError);
          return null;
        }
      }

      // For other video types, return null instead of throwing error
      // This prevents error spam in the console
      if (videoId.startsWith('example-') || videoId.startsWith('local-')) {
        return null;
      }

      throw new Error(`Video with ID '${videoId}' not found in any source`);
    }
  } catch (error) {
    log.error('[Main] Error loading video data:', error);
    throw error;
  }
})








// Handle loading videos from sources
ipcMain.handle('load-all-videos-from-sources', async () => {
  try {

    // Step 1: Load video sources from database
    let videoSources: any[] = [];
    try {
      const dbSources = await DatabaseService.getInstance().all('SELECT * FROM sources ORDER BY sort_order');

      if (!dbSources || dbSources.length === 0) {
        log.warn('[Main] No video sources found in database');
        return {
          videos: [],
          sources: [],
          debug: [
            '[Main] No video sources found in database',
            '[Main] Please add video sources through the admin panel'
          ]
        };
      }

      // Convert database format to expected format
      videoSources = dbSources.map((source: any) => ({
        id: source.id,
        type: source.type,
        title: source.title,
        url: source.url,
        channelId: source.channel_id,
        path: source.path,
        maxDepth: source.max_depth,
        sortOrder: source.sort_order
      }));

    } catch (dbError) {
      log.error('[Main] Database error loading sources:', dbError);
      return {
        videos: [],
        sources: [],
        debug: [
          '[Main] Database error loading sources: ' + dbError,
          '[Main] Please check database connectivity'
        ]
      };
    }


    // Step 2: Parse each source into structured objects
    const parsedSources = videoSources.map((source: any) => {
      const parsed: any = {
        id: source.id,
        type: source.type,
        title: source.title,
        sortOrder: source.sortOrder
      };

      // Parse type-specific fields
      if (source.type === 'youtube_channel') {
        parsed.url = source.url;
        parsed.channelId = extractChannelId(source.url);
        parsed.sourceType = 'youtube_channel';
      } else if (source.type === 'youtube_playlist') {
        parsed.url = source.url;
        parsed.playlistId = extractPlaylistId(source.url);
        parsed.sourceType = 'youtube_playlist';
      } else if (source.type === 'local') {
        parsed.path = source.path;
        parsed.maxDepth = source.maxDepth || 2; // Default to 2 if not specified
        parsed.sourceType = 'local_folder';
      } else if (source.type === 'dlna') {
        parsed.url = source.url;
        parsed.allowedFolder = source.allowedFolder;
        parsed.sourceType = 'dlna_server';
        // Note: DLNA will be deferred for now
      }

      return parsed;
    });


    // Step 3: Load videos from local sources
    const allVideos: any[] = [];
    const debugInfo: string[] = [
      '[Main] IPC handler working correctly',
      '[Main] Successfully loaded videoSources.json',
      '[Main] Found ' + videoSources.length + ' video sources',
      '[Main] Successfully parsed ' + parsedSources.length + ' sources',
      '[Main] Source types: ' + parsedSources.map((s: any) => s.sourceType).join(', ')
    ];

    // Process each source type
    for (const source of parsedSources) {
      try {
        if (source.sourceType === 'local_folder') {
          const localVideos = await scanLocalFolder(source.path, source.maxDepth);


          // Add source info to each video
          const videosWithSource = localVideos.map(video => ({
            ...video,
            sourceId: source.id,
            sourceTitle: source.title,
            sourceType: 'local'
          }));

          allVideos.push(...videosWithSource);
          debugInfo.push(`[Main] Loaded ${localVideos.length} videos from local source: ${source.title}`);

        } else if (source.sourceType === 'youtube_channel' || source.sourceType === 'youtube_playlist') {
          try {
            // Initialize YouTube API (you'll need to add your API key to config)
            // Read API key from mainSettings.json
            let apiKey = 'your-api-key-here';
            try {
              const { readMainSettings } = await import('./fileUtils');
              const mainSettings = await readMainSettings();
              apiKey = mainSettings.youtubeApiKey || 'your-api-key-here';
            } catch (error) {
              log.warn('[Main] Could not read mainSettings, trying environment variables:', error);
              apiKey = 'your-api-key-here';
            }
            if (apiKey === 'your-api-key-here') {
              debugInfo.push(`[Main] YouTube source ${source.title} - API key not configured`);
              continue;
            }

            const youtubeAPI = new YouTubeAPI(apiKey);
            let youtubeVideos: any[] = [];

            // Read page size from pagination config once for both channel and playlist
            let pageSize = 50; // Default fallback
            try {
              const { readPaginationConfig } = await import('./fileUtils');
              const paginationConfig = await readPaginationConfig();
              pageSize = paginationConfig.pageSize;
            } catch (error) {
              log.warn('[Main] Could not read pagination config, using default page size:', error);
            }

            if (source.sourceType === 'youtube_channel') {
              let actualChannelId = source.channelId;


              // If it's a username (starts with @), resolve it to channel ID
              if (source.channelId && source.channelId.startsWith('@')) {
                try {
                  actualChannelId = await resolveUsernameToChannelId(source.channelId, apiKey);
                  if (!actualChannelId) {
                    debugInfo.push(`[Main] Could not resolve username ${source.channelId} to channel ID`);
                    continue;
                  }
                } catch (error) {
                  log.error('[Main] Error resolving username:', error);
                  debugInfo.push(`[Main] Error resolving username ${source.channelId}: ${error}`);
                  continue;
                }
              }

              youtubeVideos = await youtubeAPI.getChannelVideos(actualChannelId, pageSize); // Fetch videos using config page size

              // Get channel details if title/thumbnail are missing
              if (!source.title || !source.thumbnail) {
                try {
                  const channelDetails = await youtubeAPI.getChannelDetails(actualChannelId);
                  if (!source.title) source.title = channelDetails.title;
                  if (!source.thumbnail) source.thumbnail = channelDetails.thumbnail;
                } catch (error) {
                  log.warn('[Main] Could not fetch channel details:', error);
                }
              }

            } else if (source.sourceType === 'youtube_playlist') {
              youtubeVideos = await youtubeAPI.getPlaylistVideos(source.playlistId, pageSize); // Fetch videos using config page size

              // Get playlist details if title/thumbnail are missing
              if (!source.title || !source.thumbnail) {
                try {
                  const playlistDetails = await youtubeAPI.getPlaylistDetails(source.playlistId);
                  if (!source.title) source.title = playlistDetails.title;
                  if (!source.thumbnail) source.thumbnail = playlistDetails.thumbnail;
                } catch (error) {
                  log.warn('[Main] Could not fetch playlist details:', error);
                }
              }
            }

            // Add source info to each video
            const videosWithSource = youtubeVideos.map(video => ({
              ...video,
              sourceId: source.id,
              sourceTitle: source.title,
              sourceType: source.sourceType, // Keep original source type (youtube_channel or youtube_playlist)
              // Add duration placeholder (will be extracted in next phase)
              duration: 0
            }));

            allVideos.push(...videosWithSource);
            debugInfo.push(`[Main] Loaded ${youtubeVideos.length} videos from YouTube source: ${source.title}`);

          } catch (error) {
            log.error('[Main] Error loading YouTube videos:', error);
            debugInfo.push(`[Main] Error loading YouTube source ${source.title}: ${error}`);
          }

        } else if (source.sourceType === 'dlna_server') {
          // TODO: Implement DLNA video loading in next phase
          debugInfo.push(`[Main] DLNA source ${source.title} - TODO: implement in next phase`);
        }
      } catch (error) {
        log.error('[Main] Error processing source:', source.id, error);
        debugInfo.push(`[Main] Error processing source ${source.title}: ${error}`);
      }
    }

    // If no videos found, return empty result
    if (allVideos.length === 0) {
      return {
        videos: [],
        sources: parsedSources,
        debug: [
          ...debugInfo,
          '[Main] No videos found from any sources'
        ]
      };
    }

    // Store videos globally so the player can access them
    global.currentVideos = allVideos;

    // Store videos in database for persistence and search
    try {
      await writeVideosToDatabase(allVideos);
    } catch (dbError) {
      log.warn('[Main] Warning: Could not write videos to database:', dbError);
      // Continue execution - this is not critical for basic functionality
    }

    // Group videos by source for the UI
    const videosBySource = parsedSources.map((source: any) => {
      const sourceVideos = allVideos.filter(video => video.sourceId === source.id);
      return {
        ...source,
        videos: sourceVideos,
        videoCount: sourceVideos.length
      };
    });

    return {
      videos: allVideos, // Keep flat list for backward compatibility
      sources: parsedSources,
      videosBySource, // New grouped structure for UI
      debug: debugInfo
    };
  } catch (error) {
    log.error('[Main] Error loading videos from sources:', error);
    throw error;
  }
});

// Handle loading videos for a specific source
ipcMain.handle('load-videos-for-source', async (_, sourceId: string) => {
  try {
    console.log('[Main] load-videos-for-source handler called for:', sourceId);
    // Read API key from mainSettings.json
    let apiKey = '';
    try {
      const { readMainSettings } = await import('./fileUtils');
      const mainSettings = await readMainSettings();
      apiKey = mainSettings.youtubeApiKey || '';
      console.log('[Main] API key loaded for source:', sourceId, apiKey ? '***configured***' : 'NOT configured');
    } catch (error) {
      console.warn('[Main] Could not read mainSettings for source video loading:', error);
    }
    // Import and use the specific source loading function
    const { loadVideosForSpecificSource } = await import('./services/videoDataService');
    const result = await loadVideosForSpecificSource(sourceId, apiKey);
    console.log('[Main] Videos loaded for specific source:', sourceId, {
      videoCount: result.source.videos?.length || 0,
      fetchedNewData: result.source.fetchedNewData
    });
    return result;
  } catch (error) {
    console.error('[Main] Error loading videos for specific source:', sourceId, error);
    throw error;
  }
});

// Handle getting paginated videos from a specific source
ipcMain.handle('get-paginated-videos', async (event, sourceId: string, pageNumber: number) => {
  try {

    // Read page size from pagination config first (needed for downloaded source)
    let pageSize = 50; // Default fallback
    try {
      const { readPaginationConfig } = await import('./fileUtils');
      const paginationConfig = await readPaginationConfig();
      pageSize = paginationConfig.pageSize;
    } catch (error) {
      log.warn('[Main] Could not read pagination config, using default page size:', error);
    }

    // Read API key from mainSettings.json
    let apiKey = '';
    try {
      const { readMainSettings } = await import('./fileUtils');
      const mainSettings = await readMainSettings();
      apiKey = mainSettings.youtubeApiKey || '';
    } catch (error) {
      log.warn('[Main] Could not read mainSettings for pagination:', error);
    }

    // Fetch source from database
    let source = null;
    try {
  const DatabaseService = (await import('./services/DatabaseService')).DatabaseService;
  const dbService = DatabaseService.getInstance();
      source = await dbService.get(
        'SELECT * FROM sources WHERE id = ?',
        [sourceId]
      );
      if (!source) {
        log.error('[Main] Source not found in database:', sourceId);
        throw new Error('Source not found');
      }
    } catch (error) {
      log.error('[Main] Error reading source from database:', error);
      throw new Error('Failed to read video sources configuration');
    }

    // Handle special "downloaded" source
    if (sourceId === 'downloaded') {

      try {
        // Get download path
        const { readMainSettings, getDefaultDownloadPath } = await import('./fileUtils');
        const settings = await readMainSettings();
        const downloadPath = settings.downloadPath || await getDefaultDownloadPath();
        

        // Use the same scanLocalFolder logic that handles durations and thumbnails properly
        const allVideos = await scanLocalFolder(downloadPath, 2); // maxDepth 2 for subfolders

        // Add source metadata to videos for compatibility
        const videosWithMetadata = allVideos.map(video => ({
          ...video,
          sourceId: 'downloaded',
          sourceTitle: 'Downloaded Videos',
          sourceThumbnail: '',
          sourceType: 'local', // Use 'local' type for proper playback
          type: 'local' // Ensure type is 'local' for PlayerRouter
        }));

        // Store videos in global.currentVideos so the player can access them
        if (!global.currentVideos) {
          global.currentVideos = [];
        }

        // Add new videos to global.currentVideos, avoiding duplicates
        videosWithMetadata.forEach(video => {
          const existingIndex = global.currentVideos.findIndex((v: any) => v.id === video.id);
          if (existingIndex >= 0) {
            // Update existing video with new data
            global.currentVideos[existingIndex] = video;
          } else {
            // Add new video
            global.currentVideos.push(video);
          }
        });

        // Apply pagination manually
        const totalVideos = videosWithMetadata.length;
        const totalPages = Math.ceil(totalVideos / pageSize);
        const startIndex = (pageNumber - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedVideos = videosWithMetadata.slice(startIndex, endIndex);


        return {
          videos: paginatedVideos,
          pagination: {
            currentPage: pageNumber,
            totalPages: totalPages,
            totalVideos: totalVideos,
            pageSize: pageSize
          }
        };
      } catch (error) {
        log.error('[Main] Error loading downloaded videos as local source:', error);
        // Return empty result instead of throwing
        return {
          videos: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalVideos: 0,
            pageSize: pageSize
          }
        };
      }
    }

    // Handle special "favorites" source like History page does
    if (sourceId === 'favorites') {

      try {
        const { getFavorites } = await import('./fileUtils');
        const favorites = await getFavorites();


        // Convert favorites to video objects using getVideoData like History page
        const videosWithMetadata = [];
        for (const favorite of favorites) {
          try {
            // Use getVideoData to get proper video data with sourceId and thumbnail like History page
            const videoData = await (async (videoId: string) => {
              // This is the same logic from the get-video-data handler
              try {
                // Parse the video ID to determine its type
                const { parseVideoId, extractPathFromVideoId } = await import('../shared/fileUtils');
                const parseResult = parseVideoId(videoId);

                // Handle local videos
                let localFilePath: string | null = null;

                if (parseResult.success && parseResult.parsed?.type === 'local') {
                  localFilePath = extractPathFromVideoId(videoId);
                } else if (videoId.includes('/') && favorite.sourceType === 'local') {
                  // For favorites, videoId might be the raw path like History page
                  localFilePath = videoId.startsWith('local:') ? videoId.substring(6) : videoId;
                }

                // If we have a local file path, process it
                if (localFilePath && fs.existsSync(localFilePath)) {
                  const { extractVideoDuration } = await import('../shared/videoDurationUtils');
                  const duration = await extractVideoDuration(localFilePath);

                  const video = {
                    id: videoId,
                    type: 'local',
                    title: path.basename(localFilePath, path.extname(localFilePath)),
                    thumbnail: '',
                    duration,
                    url: localFilePath,
                    video: localFilePath,
                    audio: undefined,
                    preferredLanguages: ['en'],
                    sourceId: favorite.sourceId, // Use the actual sourceId from favorites.json
                    sourceTitle: 'Local Video',
                    sourceThumbnail: '',
                    resumeAt: undefined as number | undefined,
                  };

                  // Merge with watched data
                  const { mergeWatchedData } = await import('./fileUtils');
                  const videosWithWatchedData = await mergeWatchedData([video]);
                  return videosWithWatchedData[0];
                }

                // For non-local videos, check global.currentVideos
                if (global.currentVideos) {
                  const video = global.currentVideos.find((v: any) => v.id === videoId);
                  if (video) {
                    const { mergeWatchedData } = await import('./fileUtils');
                    const videosWithWatchedData = await mergeWatchedData([video]);
                    return videosWithWatchedData[0];
                  }
                }

                // Fallback: create video from favorite data with proper thumbnail processing
                let bestThumbnail = favorite.thumbnail || '';

                // Check for cached thumbnail for local videos (same logic as videoDataService.ts)
                if ((!bestThumbnail || bestThumbnail.trim() === '') && favorite.sourceType === 'local') {
                  try {
                    const { parseVideoId } = await import('../shared/fileUtils');
                    const { getThumbnailCacheKey } = await import('../shared/thumbnailUtils');
                    const { getThumbnailUrl } = await import('./services/thumbnailService');
                    const parsed = parseVideoId(favorite.videoId);

                    if (parsed.success && parsed.parsed?.type === 'local') {
                      const cacheKey = getThumbnailCacheKey(favorite.videoId, 'local');
                      const cachedThumbnailPath = AppPaths.getThumbnailPath(`${cacheKey}.jpg`);

                      if (fs.existsSync(cachedThumbnailPath)) {
                        const thumbnailUrl = getThumbnailUrl(cachedThumbnailPath);
                        bestThumbnail = thumbnailUrl;
                        logVerbose('[Main] Using cached thumbnail for getPaginatedVideos favorite:', favorite.videoId, '->', thumbnailUrl);
                      }
                    }
                  } catch (error) {
                    logVerbose('[Main] Error getting cached thumbnail for getPaginatedVideos favorite:', favorite.videoId, error);
                  }
                }

                return {
                  id: favorite.videoId,
                  title: favorite.title,
                  thumbnail: bestThumbnail,
                  type: favorite.sourceType,
                  duration: favorite.duration || 0,
                  sourceId: favorite.sourceId,
                  sourceTitle: `${favorite.sourceType.charAt(0).toUpperCase() + favorite.sourceType.slice(1)} Video`,
                  isAvailable: true, // Favorites should always be available
                  isFallback: false // Never show fallback UI for favorites
                };
              } catch (error) {
                logVerbose('[Main] Error in getVideoData for favorite:', videoId, error);
                return null;
              }
            })(favorite.videoId);

            if (videoData) {
              videosWithMetadata.push(videoData);
            } else {
              // Fallback video object for videos that can't be loaded like History page does
              let bestThumbnail = favorite.thumbnail || '';

              // Check for cached thumbnail for local videos (same logic as videoDataService.ts)
              if ((!bestThumbnail || bestThumbnail.trim() === '') && favorite.sourceType === 'local') {
                try {
                  const { parseVideoId } = await import('../shared/fileUtils');
                  const { getThumbnailCacheKey } = await import('../shared/thumbnailUtils');
                  const { getThumbnailUrl } = await import('./services/thumbnailService');
                  const parsed = parseVideoId(favorite.videoId);

                  if (parsed.success && parsed.parsed?.type === 'local') {
                    const cacheKey = getThumbnailCacheKey(favorite.videoId, 'local');
                    const cachedThumbnailPath = AppPaths.getThumbnailPath(`${cacheKey}.jpg`);

                    if (fs.existsSync(cachedThumbnailPath)) {
                      const thumbnailUrl = getThumbnailUrl(cachedThumbnailPath);
                      bestThumbnail = thumbnailUrl;
                      logVerbose('[Main] Using cached thumbnail for getPaginatedVideos fallback favorite:', favorite.videoId, '->', thumbnailUrl);
                    }
                  }
                } catch (error) {
                  logVerbose('[Main] Error getting cached thumbnail for getPaginatedVideos fallback favorite:', favorite.videoId, error);
                }
              }

              videosWithMetadata.push({
                id: favorite.videoId,
                title: favorite.title,
                thumbnail: bestThumbnail,
                duration: favorite.duration || 0,
                type: favorite.sourceType,
                sourceId: favorite.sourceId, // Use the actual sourceId from favorites.json
                sourceTitle: `${favorite.sourceType.charAt(0).toUpperCase() + favorite.sourceType.slice(1)} Video`,
                isAvailable: true, // Favorites should always be available
                isFallback: false // Never show fallback UI for favorites
              });
            }
          } catch (error) {
            logVerbose('[Main] Error loading video data for favorite:', favorite.videoId, error);
            // Create fallback entry like History page does
            let bestThumbnail = favorite.thumbnail || '';

            // Check for cached thumbnail for local videos (same logic as videoDataService.ts)
            if ((!bestThumbnail || bestThumbnail.trim() === '') && favorite.sourceType === 'local') {
              try {
                const { parseVideoId } = await import('../shared/fileUtils');
                const { getThumbnailCacheKey } = await import('../shared/thumbnailUtils');
                const { getThumbnailUrl } = await import('./services/thumbnailService');
                const parsed = parseVideoId(favorite.videoId);

                if (parsed.success && parsed.parsed?.type === 'local') {
                  const cacheKey = getThumbnailCacheKey(favorite.videoId, 'local');
                  const cachedThumbnailPath = AppPaths.getThumbnailPath(`${cacheKey}.jpg`);

                  if (fs.existsSync(cachedThumbnailPath)) {
                    const thumbnailUrl = getThumbnailUrl(cachedThumbnailPath);
                    bestThumbnail = thumbnailUrl;
                    logVerbose('[Main] Using cached thumbnail for getPaginatedVideos error fallback favorite:', favorite.videoId, '->', thumbnailUrl);
                  }
                }
              } catch (thumbnailError) {
                logVerbose('[Main] Error getting cached thumbnail for getPaginatedVideos error fallback favorite:', favorite.videoId, thumbnailError);
              }
            }

            videosWithMetadata.push({
              id: favorite.videoId,
              title: favorite.title,
              thumbnail: bestThumbnail,
              duration: favorite.duration || 0,
              type: favorite.sourceType,
              sourceId: favorite.sourceId,
              sourceTitle: `${favorite.sourceType.charAt(0).toUpperCase() + favorite.sourceType.slice(1)} Video`,
              isAvailable: true, // Favorites should always be available
              isFallback: false // Never show fallback UI for favorites
            });
          }
        }

        // Store videos in global.currentVideos so the player can access them
        if (!global.currentVideos) {
          global.currentVideos = [];
        }

        // Add favorites videos to global.currentVideos
        videosWithMetadata.forEach(video => {
          const existingIndex = global.currentVideos.findIndex((v: any) => v.id === video.id);
          if (existingIndex >= 0) {
            global.currentVideos[existingIndex] = video;
          } else {
            global.currentVideos.push(video);
          }
        });

        // Apply pagination
        const totalVideos = videosWithMetadata.length;
        const totalPages = Math.ceil(totalVideos / pageSize);
        const startIndex = (pageNumber - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedVideos = videosWithMetadata.slice(startIndex, endIndex);

        logVerbose('[Main] Favorites videos paginated:', {
          totalVideos,
          totalPages,
          currentPage: pageNumber,
          pageSize,
          returnedVideos: paginatedVideos.length
        });

        return {
          videos: paginatedVideos,
          pagination: {
            currentPage: pageNumber,
            totalPages: totalPages,
            totalVideos: totalVideos,
            pageSize: pageSize
          }
        };
      } catch (error) {
        log.error('[Main] Error loading favorites for pagination:', error);
        // Return empty result instead of throwing
        return {
          videos: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalVideos: 0,
            pageSize: pageSize
          }
        };
      }
    }




    // For local sources, use local video scanner with pagination
    if (source.type === 'local') {

      const { LocalVideoScanner } = await import('../preload/localVideoScanner');

      // Check if source should use pagination vs folder navigation
      // Use pagination if maxDepth is 1 or if usePagination is explicitly set
      const usePagination = source.maxDepth === 1 || source.usePagination === true;

      if (!usePagination) {
        // Use folder navigation (existing behavior)
        return {
          videos: [],
          paginationState: {
            currentPage: 1,
            totalPages: 1,
            totalVideos: 0,
            pageSize: pageSize
          }
        };
      }

      // Use pagination
      try {
        const scanResult = await LocalVideoScanner.scanFolder(
          source.id,
          source.path,
          source.maxDepth || 2
        );

        const paginatedResult = LocalVideoScanner.getPaginatedVideos(scanResult, pageNumber, pageSize);

        // Add source metadata to videos for compatibility
        const videosWithMetadata = paginatedResult.videos.map(video => ({
          ...video,
          sourceId: sourceId,
          sourceTitle: source.title,
          sourceThumbnail: '',
          sourceType: 'local'
        }));

        // Store videos in global.currentVideos so the player can access them
        if (!global.currentVideos) {
          global.currentVideos = [];
        }

        // Add new videos to global.currentVideos, avoiding duplicates
        videosWithMetadata.forEach(video => {
          const existingIndex = global.currentVideos.findIndex((v: any) => v.id === video.id);
          if (existingIndex >= 0) {
            // Update existing video with new data
            global.currentVideos[existingIndex] = video;
          } else {
            // Add new video
            global.currentVideos.push(video);
          }
        });



        return {
          videos: videosWithMetadata,
          paginationState: paginatedResult.paginationState
        };
      } catch (error) {
        console.error('[Main] Error scanning local source:', error);
        return {
          videos: [],
          paginationState: {
            currentPage: 1,
            totalPages: 1,
            totalVideos: 0,
            pageSize: pageSize
          }
        };
      }
    } else if (source.type === 'youtube_channel' || source.type === 'youtube_playlist') {
      // For YouTube sources, check DB cache first, then fall back to smart page fetching
      if (!apiKey) {
        throw new Error('YouTube API key not configured for pagination');
      }

      // Check for valid DB cache (only for page 1, as DB caches first 50 videos)
      let pageResult;
      if (pageNumber === 1) {
        try {
          const { CachedYouTubeSources } = await import('../preload/cached-youtube-sources');
          const { VideoSource } = await import('../shared/types');
          const dbSource: VideoSource = {
            id: sourceId,
            type: source.type as 'youtube_channel' | 'youtube_playlist',
            title: source.title,
            url: source.url || '',
          };
          const cache = await CachedYouTubeSources.loadSourceVideos(dbSource);

          // Check if cache is valid
          if (cache && cache.videos && cache.videos.length > 0) {
            const cacheAge = Date.now() - new Date(cache.lastFetched).getTime();
            const cacheDurationMs = 90 * 60 * 1000; // 90 minutes
            if (cacheAge < cacheDurationMs && !cache.fetchedNewData) {
              logVerbose(`[Main] Using valid DB cache for page ${pageNumber} of ${sourceId} (age: ${Math.round(cacheAge / 60000)} minutes)`);
              pageResult = {
                videos: cache.videos.slice(0, pageSize), // Slice for page size
                pageNumber,
                totalResults: cache.totalVideos,
                fromCache: true,
                fallback: false
              };
            }
          }
        } catch (dbCacheError) {
          logVerbose(`[Main] DB cache check failed for ${sourceId} page ${pageNumber}, falling back to API: ${dbCacheError}`);
        }
      }

      if (!pageResult) {
        const { YouTubeAPI } = await import('../preload/youtube');
        const { YouTubePageFetcher } = await import('../preload/youtubePageFetcher');

        YouTubeAPI.setApiKey(apiKey);
        await YouTubeAPI.loadCacheConfig(); // Load cache configuration

        pageResult = await YouTubePageFetcher.fetchPage(source, pageNumber, pageSize);
      }


      // Calculate total pages from total results
      const totalPages = Math.ceil(pageResult.totalResults / pageSize);


      // Add source metadata to videos for compatibility
      const videosWithMetadata = pageResult.videos.map(video => ({
        ...video,
        sourceId: sourceId,
        sourceTitle: source.title,
        sourceThumbnail: source.thumbnail || '',
        sourceType: source.type
      }));

      // Store videos in global.currentVideos so the player can access them
      // This is critical for fallback videos to work properly
      if (!global.currentVideos) {
        global.currentVideos = [];
      }

      // Add new videos to global.currentVideos, avoiding duplicates
      videosWithMetadata.forEach(video => {
        const existingIndex = global.currentVideos.findIndex((v: any) => v.id === video.id);
        if (existingIndex >= 0) {
          // Update existing video with new data
          global.currentVideos[existingIndex] = video;
        } else {
          // Add new video
          global.currentVideos.push(video);
        }
      });


      return {
        videos: videosWithMetadata,
        paginationState: {
          currentPage: pageNumber,
          totalPages,
          totalVideos: pageResult.totalResults,
          pageSize
        }
      };
    } else {
      throw new Error(`Unsupported source type: ${source.type}`);
    }
  } catch (error) {
    log.error('[Main] Error getting paginated videos:', error);
    throw error;
  }
});



// Helper function to fetch videos for a specific page
async function fetchVideosForPage(source: any, pageNumber: number, pageSize: number, pageToken: string | undefined): Promise<any[]> {
  try {
    // Read API key from mainSettings.json
    let apiKey = '';
    try {
      const { readMainSettings } = await import('./fileUtils');
      const mainSettings = await readMainSettings();
      apiKey = mainSettings.youtubeApiKey || '';
    } catch (error) {
      log.warn('[Main] Could not read mainSettings, trying environment variables:', error);
      apiKey = '';
    }
    if (!apiKey) {
      log.warn('[Main] YouTube API key not available for fetching videos');
      return [];
    }

    const { YouTubeAPI } = await import('../preload/youtube');
    YouTubeAPI.setApiKey(apiKey);
    await YouTubeAPI.loadCacheConfig();

    let videoIds: string[] = [];

    if (source.type === 'youtube_channel') {
      const channelId = extractChannelId(source.url);
      if (!channelId) {
        log.warn(`[Main] Could not extract channel ID from URL: ${source.url}`);
        return [];
      }

      let actualChannelId = channelId;

      if (channelId.startsWith('@')) {
        try {
          const channelDetails = await YouTubeAPI.searchChannelByUsername(channelId);
          actualChannelId = channelDetails.channelId;
        } catch (error) {
          log.warn(`[Main] Could not resolve username ${channelId} to channel ID:`, error);
          actualChannelId = channelId;
        }
      }

      const result = await YouTubeAPI.getChannelVideos(actualChannelId, pageSize, pageToken);
      videoIds = result.videoIds;
    } else if (source.type === 'youtube_playlist') {
      const playlistId = extractPlaylistId(source.url);
      if (!playlistId) {
        log.warn(`[Main] Could not extract playlist ID from URL: ${source.url}`);
        return [];
      }

      const result = await YouTubeAPI.getPlaylistVideos(playlistId, pageSize, pageToken);
      videoIds = result.videoIds;
    }

    // Enhanced batch processing with Promise.allSettled for graceful failure handling
    const videoResults = await Promise.allSettled(
      videoIds.map(async (videoId): Promise<{ success: boolean; video?: any; videoId: string; error?: any }> => {
        const video = await YouTubeAPI.getVideoDetails(videoId);
        if (video) {
          return { success: true, video, videoId };
        } else {
          return { success: false, videoId };
        }
      })
    );

    // Import fallback video creation function
    const { createFallbackVideo, classifyVideoError } = await import('../shared/videoErrorHandling');

    // Process results and create fallback entries for failed videos
    const videoDetails = videoResults.map((result, index) => {
      const videoId = videoIds[index];

      if (result.status === 'fulfilled' && result.value.success && result.value.video) {
        // Successful video load
        return result.value.video;
      } else {
        // Failed video load - create fallback entry using shared implementation
        let errorInfo;
        if (result.status === 'rejected') {
          errorInfo = classifyVideoError(result.reason, videoId);
        }
        return createFallbackVideo(videoId, errorInfo);
      }
    });

    // Calculate success/failure metrics
    const successfulLoads = videoDetails.filter((v: any) => v.isAvailable !== false).length;
    const failedLoads = videoDetails.length - successfulLoads;

    if (videoDetails.length === 0) {
      log.warn(`[Main] No videos found for page ${pageNumber} of source ${source.id}`);
    } else {
      logVerbose(`[Main] Fetched ${videoDetails.length} videos for page ${pageNumber} (${successfulLoads} available, ${failedLoads} fallback)`);
    }

    // Transform to the expected video format
    return videoDetails.map(v => ({
      id: v.id,
      type: 'youtube' as const,
      title: v.snippet.title,
      thumbnail: v.snippet.thumbnails.high.url || '',
      duration: YouTubeAPI.parseDuration(v.contentDetails.duration),
      url: `https://www.youtube.com/watch?v=${v.id}`,
      preferredLanguages: ['en'],
      sourceId: source.id,
      sourceTitle: source.title,
      sourceThumbnail: source.thumbnail || '',
    }));
  } catch (error) {
    log.error(`[Main] Error fetching videos for page ${pageNumber}:`, error);
    return [];
  }
}

// Handle loading videos from new source system
ipcMain.handle('load-videos-from-sources', async () => {
  try {

    // Read API key from mainSettings.json
    let apiKey = '';
    try {
      const { readMainSettings } = await import('./fileUtils');
      const mainSettings = await readMainSettings();
      apiKey = mainSettings.youtubeApiKey || '';
    } catch (error) {
      log.warn('[Main] Could not read mainSettings, trying environment variables:', error);
      apiKey = '';
    }
    if (!apiKey) {
      log.warn('[Main] YouTube API key not configured');
    }

    // Import and use the main process version that has the encoded IDs
    const result = await loadAllVideosFromSources(apiKey);

    // Extract all videos from the grouped structure and store them globally
    const allVideos: any[] = [];
    if (result.videosBySource) {
      for (const source of result.videosBySource) {
        if (source.videos && Array.isArray(source.videos)) {
          allVideos.push(...source.videos);
        }
      }
    }

    // Store videos globally so the player can access them
    global.currentVideos = allVideos;


    return result;
  } catch (error) {
    log.error('[Main] Error loading videos from sources:', error);
    throw error;
  }
});



// Helper function to parse ISO duration
function parseISODuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (parseInt(h || '0') * 3600) + (parseInt(m || '0') * 60) + parseInt(s || '0');
}

// Channel validation cache with TTL
interface ChannelValidationCache {
  channelId: string;
  isApproved: boolean;
  timestamp: number;
}

const channelValidationCache = new Map<string, ChannelValidationCache>();
const CHANNEL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Request throttling for YouTube API
const apiRequestQueue: Array<{ videoId: string; timestamp: number }> = [];
const API_REQUEST_WINDOW = 10 * 1000; // 10 seconds
const MAX_REQUESTS_PER_WINDOW = 5;

function isChannelValidationCached(channelId: string): boolean | null {
  const cached = channelValidationCache.get(channelId);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > CHANNEL_CACHE_TTL) {
    channelValidationCache.delete(channelId);
    return null;
  }

  return cached.isApproved;
}

function cacheChannelValidation(channelId: string, isApproved: boolean): void {
  channelValidationCache.set(channelId, {
    channelId,
    isApproved,
    timestamp: Date.now()
  });
}

function canMakeApiRequest(): boolean {
  const now = Date.now();
  // Remove old requests outside the window
  while (apiRequestQueue.length > 0 && now - apiRequestQueue[0].timestamp > API_REQUEST_WINDOW) {
    apiRequestQueue.shift();
  }

  return apiRequestQueue.length < MAX_REQUESTS_PER_WINDOW;
}

function recordApiRequest(videoId: string): void {
  apiRequestQueue.push({
    videoId,
    timestamp: Date.now()
  });
}

// Helper functions for parsing YouTube URLs
const createWindow = (): void => {
  const preloadPath = path.join(__dirname, '../../preload/preload/index.js');

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      webSecurity: false, // Allow loading local files
    },
  })

  // Prevent external navigation from YouTube iframes and other sources
  mainWindow.webContents.setWindowOpenHandler((details) => {

    // Check if it's a YouTube URL that should be played internally
    if (details.url.startsWith('https://www.youtube.com/watch') || details.url.startsWith('https://www.youtu.be/')) {
      // Extract video ID from YouTube URL
      let videoId = '';
      const match = details.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      if (match) {
        videoId = match[1];

        // Handle validation asynchronously
        (async () => {
          try {
            // Load main settings to check YouTube click control setting
            const settings = await readMainSettings();
            const allowClicksToOtherVideos = settings.allowYouTubeClicksToOtherVideos || false;

            if (allowClicksToOtherVideos) {
              // Validate channel ID against approved sources
              const apiKey = settings.youtubeApiKey;

              if (!apiKey) {
                logVerbose('[Main] Cannot validate YouTube click: No API key configured');
                mainWindow.webContents.send('show-validation-error', {
                  message: 'YouTube API key not configured'
                });
                return;
              }

              // Check rate limiting before making API request
              if (!canMakeApiRequest()) {
                logVerbose('[Main] YouTube click blocked: Rate limit reached');
                mainWindow.webContents.send('show-validation-error', {
                  message: 'Too many requests, please try again in a moment'
                });
                return;
              }

              // Fetch video info to get channel ID
              recordApiRequest(videoId);
              const youtubeApi = new YouTubeAPI(apiKey);
              const videoInfo = await youtubeApi.getVideoDetails(videoId);

              if (!videoInfo || !videoInfo.snippet) {
                logVerbose('[Main] Cannot validate YouTube click: Video not found');
                mainWindow.webContents.send('show-validation-error', {
                  message: 'Unable to load video information'
                });
                return;
              }

              const channelId = videoInfo.snippet.channelId;
              const videoTitle = videoInfo.snippet.title;

              logVerbose(`[Main] YouTube related video validation for ${videoId}:`);
              logVerbose(`[Main] - Video title: ${videoTitle}`);
              logVerbose(`[Main] - Channel ID: ${channelId}`);

              // Check cache first
              const cachedResult = isChannelValidationCached(channelId);
              logVerbose(`[Main] - Cached result: ${cachedResult}`);
              if (cachedResult !== null) {
                logVerbose('[Main] Using cached channel validation result');
                if (cachedResult) {
                  // Find the matching source for complete metadata
                  const sources = await readVideoSources();
                  logVerbose(`[Main] - Loaded ${sources.length} sources`);

                  // First try to match channel sources by channelId
                  let matchingSource: VideoSource | undefined = sources
                    .filter(s => s.type === 'youtube_channel')
                    .find(s => (s as YouTubeChannelSource).channelId === channelId);

                  // If no channel match, check if this video might belong to a playlist source
                  // by looking at the channel of videos already loaded from those playlists
                  if (!matchingSource && global.currentVideos) {
                    logVerbose(`[Main] - No channel match found, checking playlist sources...`);
                    const videoFromPlaylist = global.currentVideos.find((v: any) =>
                      v.type === 'youtube' && v.channelId === channelId
                    );

                    if (videoFromPlaylist) {
                      matchingSource = sources.find(s => s.id === videoFromPlaylist.sourceId);
                      logVerbose(`[Main] - Found matching playlist source via existing video: ${matchingSource ? matchingSource.title + ' (' + matchingSource.id + ')' : 'none'}`);
                    }
                  }

                  logVerbose(`[Main] - Final matching source: ${matchingSource ? matchingSource.title + ' (' + matchingSource.id + ')' : 'none'}`);

                  if (matchingSource) {
                    // Convert duration from ISO 8601 to seconds
                    const { parseDuration } = await import('../shared/videoDurationUtils');
                    const duration = parseDuration(videoInfo.contentDetails.duration);

                    const videoMetadata = {
                      id: videoId,
                      type: 'youtube',
                      title: videoInfo.snippet.title || 'Unknown Title',
                      thumbnail: videoInfo.snippet.thumbnails?.medium?.url ||
                                videoInfo.snippet.thumbnails?.default?.url || '',
                      duration,
                      url: `https://www.youtube.com/watch?v=${videoId}`,
                      sourceId: matchingSource.id,
                      sourceTitle: matchingSource.title,
                      sourceType: matchingSource.type as 'youtube_channel' | 'youtube_playlist',
                      sourceThumbnail: '',
                      channelId: channelId
                    };

                    logVerbose(`[Main] - Sending navigation with complete metadata`);
                    mainWindow.webContents.send('navigate-to-video', {
                      videoId,
                      videoMetadata
                    });
                  } else {
                    // Fallback if source not found
                    logVerbose(`[Main] - Fallback: source not found, sending only videoId`);
                    mainWindow.webContents.send('navigate-to-video', videoId);
                  }
                } else {
                  logVerbose(`[Main] - Channel not approved, showing error`);
                  mainWindow.webContents.send('show-channel-not-approved-error', {
                    videoId,
                    channelId,
                    title: videoTitle
                  });
                }
                return;
              }

              // Load video sources to check approved channels
              const sources = await readVideoSources();
              const approvedChannelIds = sources
                .filter(s => s.type === 'youtube_channel')
                .map(s => (s as YouTubeChannelSource).channelId)
                .filter(Boolean);

              // Check if channel is approved and find the matching source
              // First try to match channel sources by channelId
              let matchingSource: VideoSource | undefined = sources
                .filter(s => s.type === 'youtube_channel')
                .find(s => (s as YouTubeChannelSource).channelId === channelId);

              // If no channel match, check if this video might belong to a playlist source
              // by looking at the channel of videos already loaded from those playlists
              if (!matchingSource && global.currentVideos) {
                logVerbose(`[Main] - No channel match found for fresh validation, checking playlist sources...`);
                const videoFromPlaylist = global.currentVideos.find((v: any) =>
                  v.type === 'youtube' && v.channelId === channelId
                );

                if (videoFromPlaylist) {
                  matchingSource = sources.find(s => s.id === videoFromPlaylist.sourceId);
                  logVerbose(`[Main] - Found matching playlist source via existing video: ${matchingSource ? matchingSource.title + ' (' + matchingSource.id + ')' : 'none'}`);
                }
              }

              const isApproved = matchingSource !== undefined;

              // Cache the result
              cacheChannelValidation(channelId, isApproved);

              if (isApproved && matchingSource) {
                // Allow playback - navigate to video with complete metadata
                logVerbose('[Main] YouTube click approved: Channel is in approved sources');

                // Convert duration from ISO 8601 to seconds
                const { parseDuration } = await import('../shared/videoDurationUtils');
                const duration = parseDuration(videoInfo.contentDetails.duration);

                const videoMetadata = {
                  id: videoId,
                  type: 'youtube',
                  title: videoInfo.snippet.title || 'Unknown Title',
                  thumbnail: videoInfo.snippet.thumbnails?.medium?.url ||
                            videoInfo.snippet.thumbnails?.default?.url || '',
                  duration,
                  url: `https://www.youtube.com/watch?v=${videoId}`,
                  sourceId: matchingSource.id,
                  sourceTitle: matchingSource.title,
                  sourceType: matchingSource.type as 'youtube_channel' | 'youtube_playlist',
                  sourceThumbnail: '',
                  channelId: channelId
                };

                mainWindow.webContents.send('navigate-to-video', {
                  videoId,
                  videoMetadata
                });
              } else {
                // Block and show error
                logVerbose('[Main] YouTube click blocked: Channel not in approved sources');
                mainWindow.webContents.send('show-channel-not-approved-error', {
                  videoId,
                  channelId,
                  title: videoTitle
                });
              }
            } else {
              // Original behavior: block all clicks (setting is false/undefined)
              logVerbose('[Main] YouTube click blocked: Setting disables all clicks to other videos');
              // Just deny, no navigation
            }
          } catch (error) {
            // On error, deny access
            console.error('[Main] Error validating YouTube video channel:', error);
            mainWindow.webContents.send('show-validation-error', {
              message: 'Unable to validate video channel'
            });
          }
        })();

        return { action: 'deny' }; // Always prevent external window
      }
    }

    // Block all other external navigation attempts
    return { action: 'deny' };
  })

  const devUrl = 'http://localhost:5173'
  const prodIndexPath = path.join(__dirname, '../../../dist/renderer/index.html');

  const waitForDevServer = async (retries = 5, delayMs = 200): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(devUrl)
        if (res.ok) {
          return true
        }
      } catch (error) {
        logVerbose(`[Main] Dev server check ${i + 1}/${retries} failed:`, error instanceof Error ? error.message : String(error));
      }
      await new Promise(r => setTimeout(r, delayMs))
    }
    return false
  }

    ; (async () => {

      const useDev = await waitForDevServer()
      if (useDev) {
        await mainWindow.loadURL(devUrl)
        mainWindow.webContents.openDevTools()
      } else {

        // Try multiple possible paths for the HTML file
        const possiblePaths = [
          path.join(__dirname, '../../../dist/renderer/index.html'),
          path.join(process.cwd(), 'dist/renderer/index.html'),
          path.join(process.resourcesPath, 'dist/renderer/index.html')
        ];

        let indexPath = null;
        for (const testPath of possiblePaths) {
          if (fs.existsSync(testPath)) {
            indexPath = testPath;
            break;
          }
        }

        if (indexPath) {

          // Add debugging for renderer process BEFORE loading
          mainWindow.webContents.on('did-finish-load', () => {
          });

          mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            log.error('[Main] Failed to load HTML:', errorCode, errorDescription);
          });


          // Try loading as file:// URL instead of loadFile
          const fileUrl = `file://${indexPath.replace(/\\/g, '/')}`;
          await mainWindow.loadURL(fileUrl);

          // Note: 'crashed' event is not available in this Electron version

        } else {
          log.error('[Main] Could not find index.html in any expected location');
          // Fallback: load a simple HTML page
          await mainWindow.loadURL('data:text/html,<h1>SafeTube</h1><p>Loading...</p>');
        }
      }
    })()

  // Log any errors that occur during page load
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    log.error('Failed to load page:', { errorCode, errorDescription })
  })

  // Set up YouTube handlers (may already be registered)
  try {
    setupYouTubeHandlers()
  } catch (error) {
    log.warn('YouTube handlers may already be registered:', error)
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {

  // Initialize SQLite database with automatic videoSources migration FIRST
  try {
    const DatabaseService = await import('./services/DatabaseService');
    const { SimpleSchemaManager } = await import('./database/SimpleSchemaManager');
    const dbService = DatabaseService.default.getInstance();

    log.info('[Main] Initializing SQLite database...');
    await dbService.initialize();

    // Initialize Phase 1 schema
    const schemaManager = new SimpleSchemaManager(dbService);
    await schemaManager.initializePhase1Schema();

    // Check if sources table is empty and migrate from JSON if needed
    const sourceCount = await dbService.get<{ count: number }>('SELECT COUNT(*) as count FROM sources');
    if (sourceCount && sourceCount.count === 0) {
      log.info('[Main] Sources table empty, migrating from videoSources.json...');

      // Read existing JSON sources
      const sourcesPath = AppPaths.getConfigPath('videoSources.json');
      if (fs.existsSync(sourcesPath)) {
        const sourcesData = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));

        // Migrate sources to database
        for (const source of sourcesData) {
          await dbService.run(`
            INSERT OR REPLACE INTO sources (id, type, title, sort_order, url, channel_id, path, max_depth)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            source.id,
            source.type,
            source.title,
            source.sortOrder || 0,
            source.url || null,
            source.channelId || null,
            source.path || null,
            source.maxDepth || null
          ]);
        }

        log.info(`[Main] Successfully migrated ${sourcesData.length} sources to database`);
      }
    } else {
      log.info(`[Main] Database already contains ${sourceCount?.count || 0} sources`);
    }
  } catch (error) {
    log.error('[Main] Error initializing database:', error);
    log.warn('[Main] Continuing without database - will use JSON fallback');
  }

  // Run first-time setup if needed (AFTER database initialization)
  try {
    const { FirstRunSetup } = await import('./firstRunSetup');
    const setupResult = await FirstRunSetup.setupIfNeeded();

    if (!setupResult.success) {
      log.error('[Main] First-time setup failed:', setupResult.errors);
    }
  } catch (error) {
    log.error('[Main] Error during first-time setup:', error);
  }

  // Run background channel ID migration (non-blocking)
  try {
    migrateChannelIds();
  } catch (error) {
    // Silent failure - don't log errors to avoid noise
  }

  // Register all IPC handlers
  try {
    registerAllHandlers();
  } catch (error) {
    log.error('[Main] Error registering IPC handlers:', error);
  }

  // Set up custom protocol for serving thumbnails from user data folder
  try {
    protocol.handle('safetube-thumbnails', (request) => {
      const url = new URL(request.url);

      // For custom protocols, the "filename" might be in the hostname part
      let filename = url.hostname || url.pathname.slice(1);

      // Remove trailing slash if present
      if (filename.endsWith('/')) {
        filename = filename.slice(0, -1);
      }

      // Decode URL encoding to handle spaces, emojis, and special characters
      try {
        filename = decodeURIComponent(filename);
      } catch (error) {
        logVerbose('[Main] ⚠️ Failed to decode thumbnail filename, using as-is:', filename, error);
      }


      // Validate filename
      if (!filename || filename.trim() === '') {
        logVerbose('[Main] ❌ Invalid thumbnail filename:', filename);
        return new Response('Bad Request - No filename', { status: 400 });
      }

      const thumbnailPath = AppPaths.getThumbnailPath(filename);


      if (fs.existsSync(thumbnailPath)) {
        // Check if it's a file, not a directory
        const stats = fs.statSync(thumbnailPath);
        if (stats.isFile()) {
          return new Response(fs.readFileSync(thumbnailPath), {
            headers: { 'Content-Type': 'image/jpeg' }
          });
        } else {
          logVerbose('[Main] ❌ Thumbnail path is not a file:', thumbnailPath);
          return new Response('Bad Request - Not a file', { status: 400 });
        }
      } else {
        logVerbose('[Main] ❌ Thumbnail file not found at:', thumbnailPath);
        return new Response('Not Found', { status: 404 });
      }
    });
  } catch (error) {
    log.error('[Main] Error setting up thumbnail protocol:', error);
  }

  createWindow()
})

// IPC handler to get the best available thumbnail for a video ID
ipcMain.handle('get-best-thumbnail', async (event, videoId: string) => {
  try {

    const { parseVideoId } = await import('../shared/fileUtils');
    const { getThumbnailCacheKey } = await import('../shared/thumbnailUtils');

    const parsed = parseVideoId(videoId);
    if (!parsed.success) {
      logVerbose('[Main] Failed to parse video ID:', parsed.error);
      return null;
    }

    // Only handle local videos for now
    if (parsed.parsed?.type === 'local') {
      const cacheKey = getThumbnailCacheKey(videoId, 'local');
      const cachedThumbnailPath = AppPaths.getThumbnailPath(`${cacheKey}.jpg`);

      if (fs.existsSync(cachedThumbnailPath)) {
        const thumbnailUrl = getThumbnailUrl(cachedThumbnailPath);
        return thumbnailUrl;
      }
    }

    return null;
  } catch (error) {
    logVerbose('[Main] Error getting best thumbnail for:', videoId, error);
    return null;
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})








// Log uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error)
})

// Log unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  log.error('Unhandled promise rejection:', reason)
})