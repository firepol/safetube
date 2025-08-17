import path from 'path'
import { app, BrowserWindow, ipcMain } from 'electron'
import log from './logger'
import { Client } from 'node-ssdp'
import { setupYouTubeHandlers } from './youtube'
import { YouTubeAPI } from './youtube-api'
import fs from 'fs'
import { recordVideoWatching, getTimeTrackingState } from '../shared/timeTracking'
import { readTimeLimits, encodeFilePath } from '../shared/fileUtils'

// Load environment variables from .env file
import dotenv from 'dotenv'
dotenv.config()

// Debug: Log environment variables
log.info('[Main] Environment variables loaded');
log.info('[Main] YOUTUBE_API_KEY:', process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY ? '***configured***' : 'NOT configured');
log.info('[Main] NODE_ENV:', process.env.NODE_ENV);

// Global type declaration for current videos
declare global {
  var currentVideos: any[];
}

// Helper function for scanning local folders
async function scanLocalFolder(folderPath: string, maxDepth: number): Promise<any[]> {
  const videos: any[] = [];
  const supportedExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];
  
  try {
    // Resolve relative paths from project root
    const absolutePath = path.isAbsolute(folderPath) ? folderPath : path.join(process.cwd(), folderPath);

    log.info('[Main] Scanning local folder:', absolutePath);
    
    if (!fs.existsSync(absolutePath)) {
      log.warn('[Main] Local folder does not exist:', absolutePath);
      return videos;
    }

    // Recursive function to scan folders
    async function scanFolder(currentPath: string, depth: number): Promise<void> {
      if (depth > maxDepth) return;
      
      try {
        const items = fs.readdirSync(currentPath);
        
        for (const item of items) {
          const itemPath = path.join(currentPath, item);
          const stat = fs.statSync(itemPath);
          
          if (stat.isDirectory()) {
            await scanFolder(itemPath, depth + 1);
          } else if (stat.isFile()) {
            const ext = path.extname(item).toLowerCase();
            if (supportedExtensions.includes(ext)) {
              // Generate a unique ID using base64 encoding of the file path
              let videoId: string;
              try {
                videoId = encodeFilePath(itemPath);
                log.info('[Main] Generated encoded ID for local video:', { originalPath: itemPath, encodedId: videoId });
              } catch (error) {
                log.error('[Main] Error encoding file path, using fallback ID:', error);
                // Fallback: use a hash-based ID
                videoId = `local_${Buffer.from(itemPath).toString('hex').substring(0, 16)}`;
              }
              
              videos.push({
                id: videoId,
                title: path.basename(item, ext),
                thumbnail: '',
                duration: 0, // Duration would need to be extracted from video metadata
                url: itemPath,
                video: itemPath,
                audio: undefined,
                preferredLanguages: ['en'],
                type: 'local' // Add explicit type for routing
              });
            }
          }
        }
      } catch (error) {
        log.warn('[Main] Error scanning folder:', currentPath, error);
      }
    }

    await scanFolder(absolutePath, 0);
    log.info('[Main] Found videos in local folder:', videos.length);
    
  } catch (error) {
    log.error('[Main] Error scanning local folder:', error);
  }
  
  return videos;
}

// Helper function to resolve username to channel ID
async function resolveUsernameToChannelId(username: string, apiKey: string): Promise<string | null> {
  try {
    const youtubeAPI = new YouTubeAPI(apiKey);
    const channelDetails = await youtubeAPI.searchChannelByUsername(username);
    return channelDetails.channelId;
  } catch (error) {
    log.warn('[Main] Could not resolve username to channel ID:', username, error);
    return null;
  }
}

// Force TypeScript to include these functions by exporting them (even if not used elsewhere)
export { resolveUsernameToChannelId, loadAllVideosFromSourcesMain };

// Helper functions for parsing YouTube URLs
function extractChannelId(url: string): string | null {
  try {
    if (url.includes('/@')) {
      const match = url.match(/\/@([^\/\?]+)/);
      return match ? `@${match[1]}` : null; // Return with @ prefix for usernames
    } else if (url.includes('/channel/')) {
      const match = url.match(/\/channel\/([^\/\?]+)/);
      return match ? match[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

function extractPlaylistId(url: string): string | null {
  try {
    const match = url.match(/[?&]list=([^&]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit()
}

const isDev = process.env.NODE_ENV === 'development'

// Initialize SSDP client
const ssdpClient = new Client()

// Handle local file access
ipcMain.handle('get-local-file', async (event, filePath: string) => {
  try {
    // Convert file:// URL to actual file path
    const decodedPath = decodeURIComponent(filePath.replace('file://', ''))
    log.info('Accessing local file:', decodedPath)
    
    // Check if file exists
    if (!fs.existsSync(decodedPath)) {
      log.error('File not found:', decodedPath)
      throw new Error('File not found')
    }

    // Return the file:// URL for the video element
    const fileUrl = `file://${decodedPath}`
    log.info('Returning file URL:', fileUrl)
    return fileUrl
  } catch (error) {
    log.error('Error accessing local file:', error)
    throw error
  }
})

// Handle DLNA file access
ipcMain.handle('get-dlna-file', async (event, server: string, port: number, path: string) => {
  try {
    log.info('Searching for DLNA server:', server)
    
    // Search for DLNA servers
    const devices = await new Promise<any[]>((resolve) => {
      const foundDevices: any[] = []
      
      ssdpClient.on('response', (headers: any) => {
        if (headers.ST === 'urn:schemas-upnp-org:service:ContentDirectory:1') {
          foundDevices.push(headers)
        }
      })

      ssdpClient.search('urn:schemas-upnp-org:service:ContentDirectory:1')
      
      // Wait for 5 seconds to collect responses
      setTimeout(() => {
        resolve(foundDevices)
      }, 5000)
    })

    // Find our target server
    const targetDevice = devices.find(device => device.LOCATION.includes(server))
    if (!targetDevice) {
      throw new Error(`DLNA server ${server} not found`)
    }

    log.info('Found DLNA server:', targetDevice.LOCATION)
    
    // For now, just return the direct URL since we know the server and path
    // In a real implementation, we would:
    // 1. Parse the device description XML from LOCATION
    // 2. Find the ContentDirectory service
    // 3. Browse the content directory to find the video
    // 4. Get the direct media URL
    const url = `http://${server}:${port}${path}`
    log.info('Using media URL:', url)
    
    return url
  } catch (error) {
    log.error('Error accessing DLNA file:', error)
    throw error
  }
})

// Test handler to verify IPC is working
ipcMain.handle('test-handler', async () => {
  log.info('Test handler called successfully')
  return 'test-success'
})

// Handle player configuration loading
ipcMain.handle('get-player-config', async () => {
  try {
    const configPath = path.join(process.cwd(), 'config', 'youtubePlayer.json')
    log.info('Loading player config from:', configPath)
    
    if (!fs.existsSync(configPath)) {
      log.error('Player configuration file not found:', configPath)
      throw new Error('Player configuration file not found')
    }
    
    const configData = fs.readFileSync(configPath, 'utf8')
    const config = JSON.parse(configData)
    log.info('Player config loaded successfully')
    return config
  } catch (error) {
    log.error('Error loading player config:', error)
    throw error
  }
})

// Handle video data loading - ONLY from new source system
ipcMain.handle('get-video-data', async (_, videoId: string) => {
  try {
    log.info('[Main] Loading video data for:', videoId);
    
    // Only use the new source system - no fallback to old videos.json
    if (!global.currentVideos || global.currentVideos.length === 0) {
      log.error('[Main] No videos loaded from source system. Video sources may not be initialized.');
      throw new Error('Video sources not initialized. Please restart the app.');
    }
    
    log.info('[Main] Checking global.currentVideos:', {
      exists: !!global.currentVideos,
      length: global.currentVideos.length,
      videoIds: global.currentVideos.map((v: any) => v.id).slice(0, 5) // Show first 5 IDs
    });
    
    const video = global.currentVideos.find((v: any) => v.id === videoId);
    if (video) {
      log.info('[Main] Video found in source system:', { id: video.id, type: video.type, title: video.title });
      return video;
    } else {
      log.error('[Main] Video not found in source system:', videoId);
      log.info('[Main] Available video IDs:', global.currentVideos.map((v: any) => v.id));
      throw new Error(`Video with ID '${videoId}' not found in any source`);
    }
  } catch (error) {
    log.error('[Main] Error loading video data:', error);
    throw error;
  }
})

// Time tracking IPC handlers
ipcMain.handle('time-tracking:record-video-watching', async (event, videoId: string, position: number, timeWatched: number) => {
  try {
    await recordVideoWatching(videoId, position, timeWatched)
    return { success: true }
  } catch (error) {
    log.error('Error recording video watching:', error)
    throw error
  }
})

ipcMain.handle('time-tracking:get-time-tracking-state', async () => {
  try {
    return await getTimeTrackingState()
  } catch (error) {
    log.error('Error getting time tracking state:', error)
    throw error
  }
})

ipcMain.handle('time-tracking:get-time-limits', async () => {
  try {
    return await readTimeLimits()
  } catch (error) {
    log.error('Error getting time limits:', error)
    throw error
  }
})

// Handle loading videos from sources
ipcMain.handle('load-all-videos-from-sources', async () => {
  try {
    log.info('[Main] load-all-videos-from-sources handler called');
    log.info('[Main] Helper functions available:', {
      resolveUsernameToChannelId: typeof resolveUsernameToChannelId,
      extractChannelId: typeof extractChannelId,
      scanLocalFolder: typeof scanLocalFolder
    });
    
    // Step 1: Read and parse videoSources.json configuration
    const configPath = path.join(process.cwd(), 'config', 'videoSources.json');
    log.info('[Main] Reading video sources config from:', configPath);
    
    if (!fs.existsSync(configPath)) {
      log.warn('[Main] videoSources.json not found, returning empty result');
      return {
        videos: [],
        sources: [],
        debug: [
          '[Main] videoSources.json not found at: ' + configPath,
          '[Main] Please create config/videoSources.json with your video sources'
        ]
      };
    }
    
    const configData = fs.readFileSync(configPath, 'utf8');
    const videoSources = JSON.parse(configData);
    
    log.info('[Main] Successfully parsed video sources config:', {
      sourceCount: videoSources.length,
      sourceTypes: videoSources.map((s: any) => s.type)
    });
    
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
    
    log.info('[Main] Successfully parsed sources:', parsedSources.map((s: any) => ({
      id: s.id,
      type: s.type,
      sourceType: s.sourceType
    })));
    
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
          log.info('[Main] Scanning local folder:', source.path);
          const localVideos = await scanLocalFolder(source.path, source.maxDepth);
          log.info('[Main] Found', localVideos.length, 'videos in local folder');
          
          // Debug: Log the first few local video IDs
          if (localVideos.length > 0) {
            log.info('[Main] Sample local video IDs:', localVideos.slice(0, 3).map(v => ({ id: v.id, title: v.title, url: v.url })));
          }
          
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
                              const apiKey = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY || 'your-api-key-here';
            if (apiKey === 'your-api-key-here') {
              debugInfo.push(`[Main] YouTube source ${source.title} - API key not configured`);
              continue;
            }
            
            const youtubeAPI = new YouTubeAPI(apiKey);
            let youtubeVideos: any[] = [];
            
            if (source.sourceType === 'youtube_channel') {
              let actualChannelId = source.channelId;
              
              log.info('[Main] Processing YouTube channel source:', {
                sourceId: source.id,
                channelId: source.channelId,
                startsWithAt: source.channelId?.startsWith('@'),
                type: typeof source.channelId
              });
              
              // If it's a username (starts with @), resolve it to channel ID
              if (source.channelId && source.channelId.startsWith('@')) {
                log.info('[Main] Resolving username to channel ID:', source.channelId);
                log.info('[Main] About to call resolveUsernameToChannelId function');
                try {
                  actualChannelId = await resolveUsernameToChannelId(source.channelId, apiKey);
                  log.info('[Main] Username resolution result:', { username: source.channelId, resolvedId: actualChannelId });
                  if (!actualChannelId) {
                    debugInfo.push(`[Main] Could not resolve username ${source.channelId} to channel ID`);
                    continue;
                  }
                  log.info('[Main] Resolved username to channel ID:', actualChannelId);
                } catch (error) {
                  log.error('[Main] Error resolving username:', error);
                  debugInfo.push(`[Main] Error resolving username ${source.channelId}: ${error}`);
                  continue;
                }
              } else {
                log.info('[Main] Not a username, using channel ID directly:', source.channelId);
              }
              
              log.info('[Main] Fetching videos from YouTube channel:', actualChannelId);
              youtubeVideos = await youtubeAPI.getChannelVideos(actualChannelId, 50); // Fetch 50 videos max per page
              
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
              log.info('[Main] Fetching videos from YouTube playlist:', source.playlistId);
              youtubeVideos = await youtubeAPI.getPlaylistVideos(source.playlistId, 50); // Fetch 50 videos max per page
              
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
    
    // Debug: Log some sample video IDs from global.currentVideos
    if (allVideos.length > 0) {
      const sampleVideos = allVideos.slice(0, 5);
      log.info('[Main] Sample videos in global.currentVideos:', sampleVideos.map(v => ({ id: v.id, type: v.type, title: v.title, sourceId: v.sourceId })));
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

// Handle getting paginated videos from a specific source
ipcMain.handle('get-paginated-videos', async (event, sourceId: string, pageNumber: number) => {
  try {
    log.info('[Main] get-paginated-videos handler called:', { sourceId, pageNumber });
    
    // Get the source data to find the total count and source details
    const { loadAllVideosFromSources } = await import('../preload/loadAllVideosFromSources');
    const apiKey = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
    const sourceData = await loadAllVideosFromSources('config/videoSources.json', apiKey);
    
    // Find the specific source to get its total count
    const foundSource = sourceData.videosBySource?.find(s => s.id === sourceId);
    if (!foundSource) {
      throw new Error('Source not found in source data');
    }
    
    // Get the original source configuration with URL from the config file
    const fs = require('fs');
    const videoSourcesConfig = JSON.parse(fs.readFileSync('config/videoSources.json', 'utf-8'));
    const originalSource = videoSourcesConfig.find((s: any) => s.id === sourceId);
    if (!originalSource) {
      throw new Error('Original source configuration not found');
    }
    
    // Use the total count from the source data
    const totalVideos = foundSource.videoCount || 0;
    
    // Calculate the page token for YouTube API pagination
    const pageSize = 50;
    const pageToken: string | undefined = pageNumber > 1 ? await getPageTokenForPage(sourceId, originalSource, pageNumber) : undefined;
    
    // Fetch videos for the specific page
    let pageVideos: any[] = [];
    if (foundSource.type === 'youtube_channel' || foundSource.type === 'youtube_playlist') {
      // For YouTube sources, use cached data instead of making API calls
      const allVideos = foundSource.videos || [];
      const startIndex = (pageNumber - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      pageVideos = allVideos.slice(startIndex, endIndex);
      
      log.info(`[Main] Using cached data for YouTube source ${sourceId}, page ${pageNumber}: ${pageVideos.length} videos from ${allVideos.length} total cached videos`);
    } else {
      // For local sources, use the existing pagination logic
      const { PaginationService } = await import('../preload/paginationService');
      const paginationService = PaginationService.getInstance();
      const allVideos = global.currentVideos?.filter(video => video.sourceId === sourceId) || [];
      pageVideos = paginationService.getPage(sourceId, pageNumber, allVideos);
    }
    
    // Load pagination service for state calculation
    const { PaginationService } = await import('../preload/paginationService');
    const paginationService = PaginationService.getInstance();
    const paginationState = paginationService.getPaginationState(sourceId, totalVideos, pageNumber);
    
    log.info('[Main] Pagination result:', {
      sourceId,
      pageNumber,
      videosReturned: pageVideos.length,
      totalVideos: totalVideos,
      totalPages: paginationState.totalPages
    });
    
    return {
      videos: pageVideos,
      paginationState: {
        ...paginationState,
        currentPage: pageNumber
      }
    };
  } catch (error) {
    log.error('[Main] Error getting paginated videos:', error);
    throw error;
  }
});

// Helper function to get page token for a specific page
async function getPageTokenForPage(sourceId: string, source: any, pageNumber: number): Promise<string | undefined> {
  if (pageNumber <= 1) return undefined;
  
  try {
    // Get API key from environment
    const apiKey = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      log.warn('[Main] YouTube API key not available for pagination');
      return undefined;
    }
    
    // For YouTube sources, we need to iterate through pages to get to the requested page
    // This is not efficient but YouTube API doesn't provide direct page access
    const { YouTubeAPI } = await import('../preload/youtube');
    YouTubeAPI.setApiKey(apiKey);
    
    let currentPage = 1;
    let nextPageToken: string | undefined;
    
    // Iterate through pages until we reach the target page
    while (currentPage < pageNumber) {
      if (source.type === 'youtube_channel') {
        const channelId = extractChannelId(source.url);
        if (!channelId) {
          log.warn(`[Main] Could not extract channel ID from URL: ${source.url}`);
          break;
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
        
        const result = await YouTubeAPI.getChannelVideos(actualChannelId, 50, nextPageToken || undefined);
        nextPageToken = result.nextPageToken;
      } else if (source.type === 'youtube_playlist') {
        const playlistId = extractPlaylistId(source.url);
        if (!playlistId) {
          log.warn(`[Main] Could not extract playlist ID from URL: ${source.url}`);
          break;
        }
        
        const result = await YouTubeAPI.getPlaylistVideos(playlistId, 50, nextPageToken || undefined);
        nextPageToken = result.nextPageToken;
      }
      
      currentPage++;
      
      if (!nextPageToken) {
        log.warn(`[Main] No more pages available for source ${sourceId} at page ${pageNumber}`);
        break;
      }
    }
    
    return nextPageToken;
  } catch (error) {
    log.error(`[Main] Error getting page token for page ${pageNumber}:`, error);
    return undefined;
  }
}

// Helper function to fetch videos for a specific page
async function fetchVideosForPage(source: any, pageNumber: number, pageSize: number, pageToken: string | undefined): Promise<any[]> {
  try {
    // Get API key from environment
    const apiKey = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      log.warn('[Main] YouTube API key not available for fetching videos');
      return [];
    }
    
    const { YouTubeAPI } = await import('../preload/youtube');
    YouTubeAPI.setApiKey(apiKey);
    
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
    
    // Fetch video details for the IDs
    const videoDetailsPromises = videoIds.map(async (id) => {
      try {
        return await YouTubeAPI.getVideoDetails(id);
      } catch (error) {
        log.warn(`[Main] Failed to get details for video ${id}:`, error);
        return null; // Return null for failed videos
      }
    });
    
    const videoDetailsResults = await Promise.all(videoDetailsPromises);
    
    // Filter out null results (failed videos) and transform to expected format
    const videoDetails = videoDetailsResults.filter(v => v !== null);
    
    if (videoDetails.length === 0) {
      log.warn(`[Main] No valid videos found for page ${pageNumber} of source ${source.id}`);
    } else {
      log.info(`[Main] Successfully fetched ${videoDetails.length} videos for page ${pageNumber} (${videoIds.length - videoDetails.length} failed)`);
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
    log.info('[Main] load-videos-from-sources handler called');
    
    // Get YouTube API key first
    const apiKey = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      log.warn('[Main] YouTube API key not configured');
    } else {
      log.info('[Main] YouTube API key available');
    }
    
    // Import and use the new source system
    const { loadAllVideosFromSources } = await import('../preload/loadAllVideosFromSources');
    const result = await loadAllVideosFromSources('config/videoSources.json', apiKey);
    
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
    
    log.info('[Main] Loaded videos from new source system:', {
      totalVideos: allVideos.length,
      sources: result.videosBySource?.length || 0
    });
    
    return result;
  } catch (error) {
    log.error('[Main] Error loading videos from sources:', error);
    throw error;
  }
});

// Handle getting YouTube API key for preload script
ipcMain.handle('get-youtube-api-key', async () => {
  try {
    const apiKey = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      log.warn('[Main] YouTube API key not configured');
      return null;
    }
    log.info('[Main] Providing YouTube API key to preload script');
    return apiKey;
  } catch (error) {
    log.error('[Main] Error getting YouTube API key:', error);
    return null;
  }
});

// Helper function to parse ISO duration
function parseISODuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (parseInt(h || '0') * 3600) + (parseInt(m || '0') * 60) + parseInt(s || '0');
}

// Main process version of loadAllVideosFromSources that uses local scanLocalFolder
async function loadAllVideosFromSourcesMain(configPath = 'config/videoSources.json', apiKey?: string | null) {
  const debug: string[] = [];
  let sources: any[] = [];
  
  try {
    log.info('[Main] Loading video sources from:', configPath);
    sources = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    log.info('[Main] Loaded sources:', sources.length);
  } catch (err) {
    log.error('[Main] ERROR loading videoSources.json:', err);
    return { videosBySource: [], debug };
  }

  const videosBySource: any[] = [];

  for (const source of sources) {
    if (!source || typeof source !== 'object' || !('type' in source) || !('id' in source)) {
      log.warn('[Main] WARNING: Skipping invalid source entry:', source);
      continue;
    }
    
    log.info('[Main] Processing source:', source.id, '(', source.type, ')');
    
    if (source.type === 'youtube_channel' || source.type === 'youtube_playlist') {
      // For YouTube sources, we'll use the preload version since it has the YouTube API logic
      try {
        const { loadAllVideosFromSources } = await import('../preload/loadAllVideosFromSources');
        const result = await loadAllVideosFromSources(configPath, apiKey);
        const youtubeSource = result.videosBySource.find((s: any) => s.id === source.id);
        if (youtubeSource) {
          videosBySource.push(youtubeSource);
        }
      } catch (err) {
        log.error('[Main] ERROR loading YouTube source:', source.id, err);
        videosBySource.push({
          id: source.id,
          type: source.type,
          title: source.title,
          thumbnail: '',
          videoCount: 0,
          videos: [],
          paginationState: { currentPage: 1, totalPages: 1, totalVideos: 0, pageSize: 50 }
        });
      }
    } else if (source.type === 'local') {
      try {
        const maxDepth = source.maxDepth || 2;
        const localVideos = await scanLocalFolder(source.path, maxDepth);
        log.info('[Main] Local source', source.id, ':', localVideos.length, 'videos found.');
        
        const videos = localVideos.map(v => ({
          id: v.id,
          type: 'local' as const,
          title: v.title,
          thumbnail: v.thumbnail || '',
          duration: v.duration || 0,
          url: v.url,
          video: v.video,
          audio: v.audio,
          sourceId: source.id,
          sourceTitle: source.title,
          sourceThumbnail: '',
        }));

        videosBySource.push({
          id: source.id,
          type: source.type,
          title: source.title,
          thumbnail: '',
          videoCount: videos.length,
          videos: videos,
          paginationState: { currentPage: 1, totalPages: 1, totalVideos: videos.length, pageSize: 50 }
        });
      } catch (err) {
        log.error('[Main] ERROR scanning local source:', source.id, err);
        videosBySource.push({
          id: source.id,
          type: source.type,
          title: source.title,
          thumbnail: '',
          videoCount: 0,
          videos: [],
          paginationState: { currentPage: 1, totalPages: 1, totalVideos: 0, pageSize: 50 }
        });
      }
    } else {
      log.warn('[Main] WARNING: Unsupported source type:', source.type, '(id:', source.id, ') - skipping.');
    }
  }
  
  log.info('[Main] Total sources processed:', videosBySource.length);
  return { videosBySource, debug };
}

// Helper functions for parsing YouTube URLs
const createWindow = (): void => {
  const preloadPath = path.join(__dirname, '../../preload/index.js');
  log.info('[Main] Preload path:', preloadPath);

  log.info('Creating main window')
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

  const devUrl = 'http://localhost:5173'
  const prodIndexPath = path.join(__dirname, '../../renderer/index.html');
  log.debug('Loading production URL:', prodIndexPath);

  const waitForDevServer = async (retries = 30, delayMs = 200): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(devUrl)
        if (res.ok) return true
      } catch {}
      await new Promise(r => setTimeout(r, delayMs))
    }
    return false
  }

  ;(async () => {
    const useDev = await waitForDevServer()
    if (useDev) {
      log.debug('Loading development URL:', devUrl)
      await mainWindow.loadURL(devUrl)
      mainWindow.webContents.openDevTools()
    } else {
      log.debug('Loading production URL:', prodIndexPath)
      await mainWindow.loadFile(prodIndexPath)
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
app.on('ready', () => {
  log.info('App is ready')
  createWindow()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  log.info('All windows closed')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  log.info('App activated')
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