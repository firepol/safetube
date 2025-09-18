import fs from 'fs'
import path from 'path'

import dotenv from 'dotenv'
import { app, BrowserWindow, ipcMain, protocol } from 'electron'


import { createLocalVideoId } from '../shared/fileUtils'

// Load environment variables from .env file

import { logVerbose } from '../shared/logging'

import { AppPaths } from './appPaths'
import { readTimeLimits } from './fileUtils'
import log from './logger'
import { recordVideoWatching, getTimeTrackingState } from './timeTracking'
import { setupYouTubeHandlers } from './youtube'
import { YouTubeAPI } from './youtube-api'
import { extractChannelId, extractPlaylistId, resolveUsernameToChannelId } from './utils/urlUtils'
import { loadAllVideosFromSources } from './services/videoDataService'
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
        
        logVerbose('[Main] Returning downloaded video as local format:', {
          id: videoWithResume.id,
          type: videoWithResume.type,
          title: videoWithResume.title,
          filePath: videoWithResume.filePath,
          hasNavigationContext: !!videoWithResume.navigationContext
        });
        
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
          sourceId: 'local', // We'll need to determine the actual source ID
          sourceTitle: 'Local Video',
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

          // Create video object from YouTube API data
          const video = {
            id: videoId,
            type: 'youtube',
            title: videoDetails.snippet.title || 'Unknown Title',
            thumbnail: videoDetails.snippet.thumbnails?.medium?.url ||
                      videoDetails.snippet.thumbnails?.default?.url || '',
            duration,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            sourceId: 'external-youtube',
            sourceTitle: 'YouTube',
            sourceType: 'youtube_channel' as 'youtube_channel',
            sourceThumbnail: '',
            resumeAt: undefined as number | undefined,
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

    // Step 1: Read and parse videoSources.json configuration
    const configPath = AppPaths.getConfigPath('videoSources.json');

    if (!fs.existsSync(configPath)) {
      log.warn('[Main] videoSources.json not found, returning empty result');
      return {
        videos: [],
        sources: [],
        debug: [
          '[Main] videoSources.json not found at: ' + configPath,
          '[Main] Please create videoSources.json in your config directory'
        ]
      };
    }

    const configData = fs.readFileSync(configPath, 'utf8');
    const videoSources = JSON.parse(configData);


    // Step 2: Parse each source into structured objects
    const parsedSources = videoSources.map((source: any) => {
      const parsed: any = {
        id: source.id,
        type: source.type,
        title: source.title,
        sortOrder: source.sortOrder
      };

      // Parse type-specific fields
      if (source.type === 'skypaul77' || source.type === 'youtube_channel') {
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

    // Read source configuration directly (don't load all videos)
    let sources = [];
    try {
      const sourcesPath = AppPaths.getConfigPath('videoSources.json');
      const sourcesData = fs.readFileSync(sourcesPath, 'utf-8');
      sources = JSON.parse(sourcesData);
    } catch (error) {
      log.error('[Main] Error reading videoSources.json:', error);
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
                    sourceId: favorite.sourceType, // Use sourceType instead of 'favorites'
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

                // Fallback: create video from favorite data
                return {
                  id: favorite.videoId,
                  title: favorite.title,
                  thumbnail: favorite.thumbnail || '',
                  type: favorite.sourceType,
                  duration: favorite.duration || 0,
                  sourceId: favorite.sourceType,
                  sourceTitle: `${favorite.sourceType.charAt(0).toUpperCase() + favorite.sourceType.slice(1)} Video`,
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
              videosWithMetadata.push({
                id: favorite.videoId,
                title: favorite.title,
                thumbnail: favorite.thumbnail || '',
                duration: favorite.duration || 0,
                type: favorite.sourceType,
                sourceId: favorite.sourceType, // Use original source type as sourceId
                sourceTitle: `${favorite.sourceType.charAt(0).toUpperCase() + favorite.sourceType.slice(1)} Video`,
              });
            }
          } catch (error) {
            logVerbose('[Main] Error loading video data for favorite:', favorite.videoId, error);
            // Create fallback entry like History page does
            videosWithMetadata.push({
              id: favorite.videoId,
              title: favorite.title,
              thumbnail: favorite.thumbnail || '',
              duration: favorite.duration || 0,
              type: favorite.sourceType,
              sourceId: favorite.sourceType,
              sourceTitle: `${favorite.sourceType.charAt(0).toUpperCase() + favorite.sourceType.slice(1)} Video`,
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

    // Find the specific source
    const source = sources.find((s: any) => s.id === sourceId);
    if (!source) {
      log.error('[Main] Source not found:', sourceId);
      log.error('[Main] Available sources:', sources.map((s: any) => ({ id: s.id, type: s.type, title: s.title })));
      throw new Error('Source not found');
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
      // For YouTube sources, use smart page fetching with caching
      if (!apiKey) {
        throw new Error('YouTube API key not configured for pagination');
      }

      const { YouTubeAPI } = await import('../preload/youtube');
      const { YouTubePageFetcher } = await import('../preload/youtubePageFetcher');

      YouTubeAPI.setApiKey(apiKey);
      await YouTubeAPI.loadCacheConfig(); // Load cache configuration

      const pageResult = await YouTubePageFetcher.fetchPage(source, pageNumber, pageSize);

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
    const result = await loadAllVideosFromSources(AppPaths.getConfigPath('videoSources.json'), apiKey);

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

        // Send event to renderer to handle internal navigation
        mainWindow.webContents.send('navigate-to-video', videoId);
        return { action: 'deny' }; // Prevent external window
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

  // Run first-time setup if needed
  try {
    const { FirstRunSetup } = await import('./firstRunSetup');
    const setupResult = await FirstRunSetup.setupIfNeeded();

    if (!setupResult.success) {
      log.error('[Main] First-time setup failed:', setupResult.errors);
    }
  } catch (error) {
    log.error('[Main] Error during first-time setup:', error);
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