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
import { logVerbose } from '../shared/logging'
import { AppPaths } from '../shared/appPaths'

// Load .env file from multiple possible locations
const possibleEnvPaths = [
  '.env', // Project root (for development)
  path.join(AppPaths.getUserDataDir(), '.env') // Production location
];

for (const envPath of possibleEnvPaths) {
  const result = dotenv.config({ path: envPath });
  if (result.parsed && Object.keys(result.parsed).length > 0) {
    log.info(`[Main] Loaded environment variables from: ${envPath}`);
    break;
  }
}

// Debug: Log environment variables
logVerbose('[Main] Environment variables loaded');
logVerbose('[Main] YOUTUBE_API_KEY:', process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY ? '***configured***' : 'NOT configured');
logVerbose('[Main] ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD ? '***configured***' : 'NOT configured');
logVerbose('[Main] NODE_ENV:', process.env.NODE_ENV);

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

    logVerbose('[Main] Scanning local folder:', absolutePath, 'with maxDepth:', maxDepth);
    
    if (!fs.existsSync(absolutePath)) {
      log.warn('[Main] Local folder does not exist:', absolutePath);
      return videos;
    }

    // Recursive function to scan folders with flattening behavior
    const scanFolder = async (currentPath: string, depth: number): Promise<void> => {
      try {
        const items = fs.readdirSync(currentPath);
        
        for (const item of items) {
          const itemPath = path.join(currentPath, item);
          const stat = fs.statSync(itemPath);
          
          if (stat.isDirectory()) {
            // If we're at maxDepth, flatten all content from this directory
            if (depth === maxDepth) {
              log.debug('[Main] At maxDepth', depth, 'flattening content from:', itemPath);
              // Recursively scan deeper content but mark it as being at maxDepth
              await scanFolderDeeper(itemPath, depth + 1);
            } else {
              // Continue scanning normally
              await scanFolder(itemPath, depth + 1);
            }
          } else if (stat.isFile()) {
            const ext = path.extname(item).toLowerCase();
            if (supportedExtensions.includes(ext)) {
              // Generate a unique ID using base64 encoding of the file path
              let videoId: string;
              try {
                videoId = encodeFilePath(itemPath);
                logVerbose('[Main] Found video at depth', depth, ':', itemPath);
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
                type: 'local', // Add explicit type for routing
                depth: depth, // Track the depth where this video was found
                relativePath: path.relative(absolutePath, itemPath) // Track relative path for debugging
              });
            }
          }
        }
      } catch (error) {
        log.warn('[Main] Error scanning folder:', currentPath, error);
      }
    };

    // Function to scan deeper content when flattening at maxDepth
    const scanFolderDeeper = async (currentPath: string, depth: number): Promise<void> => {
      try {
        const items = fs.readdirSync(currentPath);
        
        for (const item of items) {
          const itemPath = path.join(currentPath, item);
          const stat = fs.statSync(itemPath);
          
          if (stat.isDirectory()) {
            // Continue scanning deeper recursively
            await scanFolderDeeper(itemPath, depth + 1);
          } else if (stat.isFile()) {
            const ext = path.extname(item).toLowerCase();
            if (supportedExtensions.includes(ext)) {
              // Generate a unique ID using base64 encoding of the file path
              let videoId: string;
              try {
                videoId = encodeFilePath(itemPath);
                logVerbose('[Main] Found video at depth', depth, 'flattened to maxDepth:', maxDepth);
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
                type: 'local', // Add explicit type for routing
                depth: maxDepth, // Mark as being at maxDepth (flattened)
                relativePath: path.relative(absolutePath, itemPath), // Track relative path for debugging
                flattened: true // Mark as flattened content
              });
            }
          }
        }
      } catch (error) {
        log.warn('[Main] Error scanning deeper folder for flattening:', currentPath, error);
      }
    };

    // Start scanning from the root folder (depth 1)
    await scanFolder(absolutePath, 1);
    logVerbose('[Main] Found videos in local folder:', videos.length, 'with maxDepth:', maxDepth);
    
  } catch (error) {
    log.error('[Main] Error scanning local folder:', error);
  }
  
  return videos;
}

// New function to get folder contents for navigation (not flattened)
async function getLocalFolderContents(folderPath: string, maxDepth: number, currentDepth: number = 1): Promise<{folders: any[], videos: any[], depth: number}> {
  const folders: any[] = [];
  const videos: any[] = [];
  const supportedExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];
  
  try {
    // Resolve relative paths from project root
    const absolutePath = path.isAbsolute(folderPath) ? folderPath : path.join(process.cwd(), folderPath);

    logVerbose('[Main] Getting folder contents:', absolutePath, 'at depth:', currentDepth, 'with maxDepth:', maxDepth);
    
    if (!fs.existsSync(absolutePath)) {
      log.warn('[Main] Local folder does not exist:', absolutePath);
      return { folders, videos, depth: currentDepth };
    }

    const items = fs.readdirSync(absolutePath);
    
    for (const item of items) {
      const itemPath = path.join(absolutePath, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        // Only show folders if we haven't reached maxDepth
        if (currentDepth < maxDepth) {
          folders.push({
            name: item,
            path: itemPath,
            type: 'folder',
            depth: currentDepth + 1
          });
        } else {
          // At maxDepth, flatten deeper content
          log.debug('[Main] At maxDepth', currentDepth, 'flattening content from:', itemPath);
          const flattenedContent = await getFlattenedContent(itemPath, currentDepth + 1);
          videos.push(...flattenedContent);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (supportedExtensions.includes(ext)) {
          // Generate a unique ID using base64 encoding of the file path
          let videoId: string;
          try {
            videoId = encodeFilePath(itemPath);
            logVerbose('[Main] Found video at depth', currentDepth, ':', itemPath);
          } catch (error) {
            log.error('[Main] Error encoding file path, using fallback ID:', error);
            // Fallback: use a hash-based ID
            videoId = `local_${Buffer.from(itemPath).toString('hex').substring(0, 16)}`;
          }
          
          videos.push({
            id: videoId,
            title: path.basename(item, ext),
            thumbnail: '',
            duration: 0,
            url: itemPath,
            video: itemPath,
            audio: undefined,
            preferredLanguages: ['en'],
            type: 'local',
            depth: currentDepth,
            relativePath: path.relative(path.join(process.cwd(), 'test-videos'), itemPath)
          });
        }
      }
    }
    
    logVerbose('[Main] Folder contents:', { folders: folders.length, videos: videos.length, depth: currentDepth });
    
  } catch (error) {
    log.error('[Main] Error getting folder contents:', error);
  }
  
  return { folders, videos, depth: currentDepth };
}

// Helper function to get flattened content from deeper levels
async function getFlattenedContent(folderPath: string, depth: number): Promise<any[]> {
  const videos: any[] = [];
  const supportedExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];
  
  try {
    const items = fs.readdirSync(folderPath);
    
    for (const item of items) {
      const itemPath = path.join(folderPath, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        // Continue scanning deeper recursively
        const deeperVideos = await getFlattenedContent(itemPath, depth + 1);
        videos.push(...deeperVideos);
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (supportedExtensions.includes(ext)) {
          // Generate a unique ID using base64 encoding of the file path
          let videoId: string;
          try {
            videoId = encodeFilePath(itemPath);
            log.debug('[Main] Found flattened video at depth', depth, ':', itemPath);
          } catch (error) {
            log.error('[Main] Error encoding file path, using fallback ID:', error);
            videoId = `local_${Buffer.from(itemPath).toString('hex').substring(0, 16)}`;
          }
          
          videos.push({
            id: videoId,
            title: path.basename(item, ext),
            thumbnail: '',
            duration: 0,
            url: itemPath,
            video: itemPath,
            audio: undefined,
            preferredLanguages: ['en'],
            type: 'local',
            depth: depth - 1, // Mark as being at the previous depth (flattened)
            relativePath: path.relative(path.join(process.cwd(), 'test-videos'), itemPath),
            flattened: true
          });
        }
      }
    }
  } catch (error) {
    log.warn('[Main] Error getting flattened content:', error);
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
export { resolveUsernameToChannelId, loadAllVideosFromSourcesMain, getLocalFolderContents };

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
if (process.platform === 'win32') {
  try {
    if (require('electron-squirrel-startup')) {
      app.quit();
    }
  } catch (error) {
    // electron-squirrel-startup not available on non-Windows platforms
    logVerbose('electron-squirrel-startup not available on this platform');
  }
}

const isDev = process.env.NODE_ENV === 'development'

// Initialize SSDP client
const ssdpClient = new Client()

// Handle local file access
ipcMain.handle('get-local-file', async (event, filePath: string) => {
  try {
    // Convert file:// URL to actual file path
    const decodedPath = decodeURIComponent(filePath.replace('file://', ''))
    logVerbose('Accessing local file:', decodedPath)
    
    // Check if file exists
    if (!fs.existsSync(decodedPath)) {
      log.error('File not found:', decodedPath)
      throw new Error('File not found')
    }

    // Return the file:// URL for the video element
    const fileUrl = `file://${decodedPath}`
    logVerbose('Returning file URL:', fileUrl)
    return fileUrl
  } catch (error) {
    log.error('Error accessing local file:', error)
    throw error
  }
})

// Handle DLNA file access
ipcMain.handle('get-dlna-file', async (event, server: string, port: number, path: string) => {
  try {
    logVerbose('Searching for DLNA server:', server)
    
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

    logVerbose('Found DLNA server:', targetDevice.LOCATION)
    
    // For now, just return the direct URL since we know the server and path
    // In a real implementation, we would:
    // 1. Parse the device description XML from LOCATION
    // 2. Find the ContentDirectory service
    // 3. Browse the content directory to find the video
    // 4. Get the direct media URL
    const url = `http://${server}:${port}${path}`
    logVerbose('Using media URL:', url)
    
    return url
  } catch (error) {
    log.error('Error accessing DLNA file:', error)
    throw error
  }
})

// Test handler to verify IPC is working
ipcMain.handle('test-handler', async () => {
  logVerbose('Test handler called successfully')
  return 'test-success'
})

// Handle player configuration loading
ipcMain.handle('get-player-config', async () => {
  try {
    const configPath = AppPaths.getConfigPath('youtubePlayer.json')
    logVerbose('Loading player config from:', configPath)
    
    if (!fs.existsSync(configPath)) {
      log.error('Player configuration file not found:', configPath)
      throw new Error('Player configuration file not found')
    }
    
    const configData = fs.readFileSync(configPath, 'utf8')
    const config = JSON.parse(configData)
    logVerbose('Player config loaded successfully')
    return config
  } catch (error) {
    log.error('Error loading player config:', error)
    throw error
  }
})

// Handle video data loading - ONLY from new source system
ipcMain.handle('get-video-data', async (_, videoId: string) => {
  try {
    logVerbose('[Main] Loading video data for:', videoId);
    
    // Only use the new source system - no fallback to old videos.json
    if (!global.currentVideos || global.currentVideos.length === 0) {
      log.error('[Main] No videos loaded from source system. Video sources may not be initialized.');
      throw new Error('Video sources not initialized. Please restart the app.');
    }
    
    logVerbose('[Main] Checking global.currentVideos:', {
      exists: !!global.currentVideos,
      length: global.currentVideos.length,
      videoIds: global.currentVideos.map((v: any) => v.id).slice(0, 5) // Show first 5 IDs
    });
    
    const video = global.currentVideos.find((v: any) => v.id === videoId);
    if (video) {
      logVerbose('[Main] Video found in source system:', { id: video.id, type: video.type, title: video.title });
      return video;
    } else {
      log.error('[Main] Video not found in source system:', videoId);
      logVerbose('[Main] Available video IDs:', global.currentVideos.map((v: any) => v.id));
      throw new Error(`Video with ID '${videoId}' not found in any source`);
    }
  } catch (error) {
    log.error('[Main] Error loading video data:', error);
    throw error;
  }
})

// Time tracking IPC handlers
ipcMain.handle('time-tracking:record-video-watching', async (_, videoId: string, position: number, timeWatched: number) => {
  try {
    await recordVideoWatching(videoId, position, timeWatched);
  } catch (error) {
    log.error('Error recording video watching:', error);
    throw error;
  }
});

ipcMain.handle('time-tracking:get-time-tracking-state', async () => {
  try {
    return await getTimeTrackingState();
  } catch (error) {
    log.error('Error getting time tracking state:', error);
    throw error;
  }
});

ipcMain.handle('time-tracking:get-time-limits', async () => {
  try {
    return await readTimeLimits();
  } catch (error) {
    log.error('Error reading time limits:', error);
    throw error;
  }
});

// New admin IPC handlers
ipcMain.handle('admin:authenticate', async (_, password: string) => {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      throw new Error('Admin password not configured');
    }
    
    const isAuthenticated = password === adminPassword;
    logVerbose('[Admin] Authentication attempt:', { success: isAuthenticated });
    
    return { isAuthenticated };
  } catch (error) {
    log.error('Error during admin authentication:', error);
    throw error;
  }
});

ipcMain.handle('admin:add-extra-time', async (_, minutes: number) => {
  try {
    // Import the function here to avoid circular dependencies
    const { addExtraTimeToday } = await import('../shared/timeTracking');
    await addExtraTimeToday(minutes);
    
    logVerbose('[Admin] Extra time added:', { minutes });
    return { success: true };
  } catch (error) {
    log.error('Error adding extra time:', error);
    throw error;
  }
});

ipcMain.handle('admin:get-time-extra', async () => {
  try {
    // Import the function here to avoid circular dependencies
    const { readTimeExtra } = await import('../shared/fileUtils');
    return await readTimeExtra();
  } catch (error) {
    log.error('Error reading time extra:', error);
    throw error;
  }
});

ipcMain.handle('admin:write-time-limits', async (_, timeLimits: any) => {
  try {
    // Import the function here to avoid circular dependencies
    const { writeTimeLimits } = await import('../shared/fileUtils');
    await writeTimeLimits(timeLimits);
    
    logVerbose('[Admin] Time limits updated:', timeLimits);
    return { success: true };
  } catch (error) {
    log.error('Error writing time limits:', error);
    throw error;
  }
});

ipcMain.handle('admin:get-last-watched-video-with-source', async () => {
  try {
    // Import the function here to avoid circular dependencies
    const { getLastWatchedVideoWithSource } = await import('../shared/timeTracking');
    return await getLastWatchedVideoWithSource();
  } catch (error) {
    log.error('Error getting last watched video with source:', error);
    throw error;
  }
});

// Video source management handlers
ipcMain.handle('video-sources:get-all', async () => {
  try {
    const { readVideoSources } = await import('../shared/fileUtils');
    return await readVideoSources();
  } catch (error) {
    log.error('Error reading video sources:', error);
    throw error;
  }
});

ipcMain.handle('video-sources:save-all', async (_, sources: any[]) => {
  try {
    const { writeVideoSources } = await import('../shared/fileUtils');
    await writeVideoSources(sources);
    logVerbose('[Main] Video sources saved successfully');
    return { success: true };
  } catch (error) {
    log.error('Error saving video sources:', error);
    throw error;
  }
});

ipcMain.handle('video-sources:validate-youtube-url', async (_, url: string, type: 'youtube_channel' | 'youtube_playlist') => {
  try {
    const { validateVideoSource, cleanYouTubePlaylistUrl } = await import('../shared/videoSourceUtils');
    
    // Clean the URL if it's a playlist watch URL
    const cleanedUrl = type === 'youtube_playlist' ? cleanYouTubePlaylistUrl(url) : url;
    
    // Basic validation
    const validation = validateVideoSource(type, cleanedUrl, undefined, 'Test Title');
    
    if (!validation.isValid) {
      return {
        isValid: false,
        errors: validation.errors,
        cleanedUrl
      };
    }
    
    // For now, return basic validation success
    // TODO: Add actual YouTube API validation when API key is available
    return {
      isValid: true,
      cleanedUrl,
      message: 'URL format is valid (API validation not implemented yet)'
    };
    } catch (error) {
      log.error('Error validating YouTube URL:', error);
      return {
        isValid: false,
        errors: ['Validation failed: ' + (error instanceof Error ? error.message : String(error))]
      };
    }
});

ipcMain.handle('video-sources:validate-local-path', async (_, path: string) => {
  try {
    const fs = await import('fs');
    const pathModule = await import('path');
    
    // Check if path exists and is a directory
    const stats = fs.statSync(path);
    if (!stats.isDirectory()) {
      return {
        isValid: false,
        errors: ['Path exists but is not a directory']
      };
    }
    
    return {
      isValid: true,
      message: 'Path is valid and accessible'
    };
  } catch (error) {
    return {
      isValid: false,
      errors: ['Path does not exist or is not accessible: ' + (error instanceof Error ? error.message : String(error))]
    };
  }
});

// Handle getting local folder contents for navigation
ipcMain.handle('get-local-folder-contents', async (event, folderPath: string, maxDepth: number, currentDepth: number = 1) => {
  try {
    logVerbose('[Main] IPC: get-local-folder-contents called with:', { folderPath, maxDepth, currentDepth });
    
    if (!folderPath) {
      throw new Error('Folder path is required');
    }
    
    const contents = await getLocalFolderContents(folderPath, maxDepth, currentDepth);
    logVerbose('[Main] IPC: get-local-folder-contents result:', contents);
    
    return contents;
  } catch (error) {
    log.error('[Main] IPC: get-local-folder-contents error:', error);
    throw error;
  }
});

// Handle loading videos from sources
ipcMain.handle('load-all-videos-from-sources', async () => {
  try {
    logVerbose('[Main] load-all-videos-from-sources handler called');
    logVerbose('[Main] Helper functions available:', {
      resolveUsernameToChannelId: typeof resolveUsernameToChannelId,
      extractChannelId: typeof extractChannelId,
      scanLocalFolder: typeof scanLocalFolder
    });
    
    // Step 1: Read and parse videoSources.json configuration
    const configPath = AppPaths.getConfigPath('videoSources.json');
    logVerbose('[Main] Reading video sources config from:', configPath);
    
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
    
    logVerbose('[Main] Successfully parsed video sources config:', {
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
    
    logVerbose('[Main] Successfully parsed sources:', parsedSources.map((s: any) => ({
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
          logVerbose('[Main] Scanning local folder:', source.path);
          const localVideos = await scanLocalFolder(source.path, source.maxDepth);
          logVerbose('[Main] Found', localVideos.length, 'videos in local folder');
          
          // Debug: Log the first few local video IDs
          if (localVideos.length > 0) {
            logVerbose('[Main] Sample local video IDs:', localVideos.slice(0, 3).map(v => ({ id: v.id, title: v.title, url: v.url })));
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
            
            // Read page size from pagination config once for both channel and playlist
            let pageSize = 50; // Default fallback
            try {
              const { readPaginationConfig } = await import('../shared/fileUtils');
              const paginationConfig = await readPaginationConfig();
              pageSize = paginationConfig.pageSize;
              logVerbose('[Main] Using page size from config for YouTube API:', pageSize);
            } catch (error) {
              log.warn('[Main] Could not read pagination config, using default page size:', error);
            }
            
            if (source.sourceType === 'youtube_channel') {
              let actualChannelId = source.channelId;
              
              logVerbose('[Main] Processing YouTube channel source:', {
                sourceId: source.id,
                channelId: source.channelId,
                startsWithAt: source.channelId?.startsWith('@'),
                type: typeof source.channelId
              });
              
              // If it's a username (starts with @), resolve it to channel ID
              if (source.channelId && source.channelId.startsWith('@')) {
                logVerbose('[Main] Resolving username to channel ID:', source.channelId);
                logVerbose('[Main] About to call resolveUsernameToChannelId function');
                try {
                  actualChannelId = await resolveUsernameToChannelId(source.channelId, apiKey);
                  logVerbose('[Main] Username resolution result:', { username: source.channelId, resolvedId: actualChannelId });
                  if (!actualChannelId) {
                    debugInfo.push(`[Main] Could not resolve username ${source.channelId} to channel ID`);
                    continue;
                  }
                  logVerbose('[Main] Resolved username to channel ID:', actualChannelId);
                } catch (error) {
                  log.error('[Main] Error resolving username:', error);
                  debugInfo.push(`[Main] Error resolving username ${source.channelId}: ${error}`);
                  continue;
                }
              } else {
                logVerbose('[Main] Not a username, using channel ID directly:', source.channelId);
              }
              
              logVerbose('[Main] Fetching videos from YouTube channel:', actualChannelId);
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
              logVerbose('[Main] Fetching videos from YouTube playlist:', source.playlistId);
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
    
    // Debug: Log some sample video IDs from global.currentVideos
    if (allVideos.length > 0) {
      const sampleVideos = allVideos.slice(0, 5);
      logVerbose('[Main] Sample videos in global.currentVideos:', sampleVideos.map(v => ({ id: v.id, type: v.type, title: v.title, sourceId: v.sourceId })));
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
    logVerbose('[Main] get-paginated-videos handler called:', { sourceId, pageNumber });
    
    // Use the existing working video loading logic from global state
    if (!global.currentVideos) {
      throw new Error('No videos loaded. Please load videos from sources first.');
    }
    
    // Get videos by source from global state
    const videosBySource = [];
    const sourceIds: string[] = [];
    
    // Collect unique source IDs
    for (const video of global.currentVideos) {
      if (!sourceIds.includes(video.sourceId)) {
        sourceIds.push(video.sourceId);
      }
    }
    
    for (const sourceId of sourceIds) {
      const sourceVideos = global.currentVideos.filter(v => v.sourceId === sourceId);
      if (sourceVideos.length > 0) {
        const firstVideo = sourceVideos[0];
        videosBySource.push({
          id: sourceId,
          type: firstVideo.sourceType || 'unknown',
          title: firstVideo.sourceTitle || sourceId,
          videos: sourceVideos,
          videoCount: sourceVideos.length
        });
      }
    }
    
    // Find the specific source
    const foundSource = videosBySource.find((s: any) => s.id === sourceId);
    if (!foundSource) {
      throw new Error('Source not found in source data');
    }
    
    // Get all videos for this source
    const allVideos = foundSource.videos || [];
    const totalVideos = allVideos.length;
    
    // Read page size from pagination config
    let pageSize = 50; // Default fallback
    try {
      const { readPaginationConfig } = await import('../shared/fileUtils');
      const paginationConfig = await readPaginationConfig();
      pageSize = paginationConfig.pageSize;
      logVerbose('[Main] Using page size from config:', pageSize);
    } catch (error) {
      log.warn('[Main] Could not read pagination config, using default page size:', error);
    }
    
    // Calculate pagination
    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageVideos = allVideos.slice(startIndex, endIndex);
    
    const totalPages = Math.ceil(totalVideos / pageSize);
    
    logVerbose('[Main] Pagination result:', {
      sourceId,
      pageNumber,
      videosReturned: pageVideos.length,
      totalVideos: totalVideos,
      totalPages: totalPages,
      pageSize: pageSize
    });
    
    return {
      videos: pageVideos,
      paginationState: {
        currentPage: pageNumber,
        totalPages: totalPages,
        totalVideos: totalVideos,
        pageSize: pageSize
      }
    };
  } catch (error) {
    log.error('[Main] Error getting paginated videos:', error);
    throw error;
  }
});



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
      logVerbose(`[Main] Successfully fetched ${videoDetails.length} videos for page ${pageNumber} (${videoIds.length - videoDetails.length} failed)`);
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
    logVerbose('[Main] load-videos-from-sources handler called');
    
    // Get YouTube API key first
    const apiKey = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      log.warn('[Main] YouTube API key not configured');
    } else {
      logVerbose('[Main] YouTube API key available');
    }
    
    // Import and use the main process version that has the encoded IDs
    const result = await loadAllVideosFromSourcesMain(AppPaths.getConfigPath('videoSources.json'), apiKey);
    
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
    
    logVerbose('[Main] Loaded videos from new source system:', {
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
    logVerbose('[Main] Providing YouTube API key to preload script');
    return apiKey;
  } catch (error) {
    log.error('[Main] Error getting YouTube API key:', error);
    return null;
  }
});

// Handle getting verbose logging setting for preload script
ipcMain.handle('logging:get-verbose', async () => {
  try {
    const isVerbose = process.env.ELECTRON_LOG_VERBOSE === 'true';
    logVerbose('[Main] Providing verbose logging setting to preload script:', isVerbose);
    return { verbose: isVerbose };
  } catch (error) {
    log.error('[Main] Error getting verbose logging setting:', error);
    return { verbose: false };
  }
});

// Handle setup status request
ipcMain.handle('get-setup-status', async () => {
  try {
    const { FirstRunSetup } = await import('../shared/firstRunSetup');
    return await FirstRunSetup.getSetupStatus();
  } catch (error) {
    log.error('Error getting setup status:', error);
    throw error;
  }
});

// Handle logging from renderer process
ipcMain.handle('logging:log', async (_, level: string, ...args: any[]) => {
  try {
    const isVerbose = process.env.ELECTRON_LOG_VERBOSE === 'true';
    if (level === 'verbose' && !isVerbose) {
      return; // Don't log verbose messages if verbose logging is disabled
    }
    
    // Log to main process console
    if (level === 'verbose') {
      logVerbose('[Renderer]', ...args);
    } else if (level === 'error') {
      log.error('[Renderer]', ...args);
    } else if (level === 'warn') {
      log.warn('[Renderer]', ...args);
    } else {
      log.info('[Renderer]', ...args);
    }
  } catch (error) {
    log.error('[Main] Error handling renderer log:', error);
  }
});

// Handle clearing cache for a specific source
ipcMain.handle('clear-source-cache', async (_, sourceId: string) => {
  try {
    logVerbose('[Main] Clearing cache for source:', sourceId);
    
    const fs = require('fs');
    const path = require('path');
    const cacheDir = path.join('.', '.cache');
    
    // Clear YouTube source cache
    const sourceCacheFile = path.join(cacheDir, `youtube-${sourceId}.json`);
    if (fs.existsSync(sourceCacheFile)) {
      fs.unlinkSync(sourceCacheFile);
      logVerbose('[Main] Deleted YouTube source cache file:', sourceCacheFile);
    }
    
    // Clear ALL YouTube API cache files (since we can't easily map sourceId to specific API calls)
    // This ensures fresh API calls for the next load
    try {
      const files = fs.readdirSync(cacheDir);
      let clearedApiCacheCount = 0;
      
      for (const file of files) {
        if (file.startsWith('youtube_api_') && file.endsWith('.json')) {
          const filePath = path.join(cacheDir, file);
          fs.unlinkSync(filePath);
          clearedApiCacheCount++;
        }
      }
      
      if (clearedApiCacheCount > 0) {
        logVerbose(`[Main] Cleared ${clearedApiCacheCount} YouTube API cache files`);
      }
    } catch (error) {
      log.warn('[Main] Error clearing YouTube API cache:', error);
    }
    
    // Clear pagination cache for this source
    const { PaginationService } = await import('../preload/paginationService');
    const paginationService = PaginationService.getInstance();
    paginationService.clearCache(sourceId);
    logVerbose('[Main] Cleared pagination cache for source:', sourceId);
    
    return { success: true };
  } catch (error) {
    log.error('[Main] Error clearing source cache:', error);
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

// Main process version of loadAllVideosFromSources that uses local scanLocalFolder
async function loadAllVideosFromSourcesMain(configPath = AppPaths.getConfigPath('videoSources.json'), apiKey?: string | null) {
  const debug: string[] = [
    '[Main] IPC handler working correctly',
    '[Main] Successfully loaded videoSources.json',
    '[Main] Found 0 video sources' // Will be updated after loading
  ];
  let sources: any[] = [];
  
  try {
    logVerbose('[Main] Loading video sources from:', configPath);
    sources = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    logVerbose('[Main] Loaded sources:', sources.length);
    debug[2] = '[Main] Found ' + sources.length + ' video sources'; // Update with actual count
  } catch (err) {
    log.error('[Main] ERROR loading videoSources.json:', err);
    return { videosBySource: [], debug };
  }

  const videosBySource: any[] = [];

  for (const source of sources) {
    if (!source.id || !source.type || !source.title) {
      log.warn('[Main] WARNING: Skipping invalid source entry:', source);
      continue;
    }
    
    logVerbose('[Main] Processing source:', source.id, '(', source.type, ')');
    debug.push(`[Main] Processing source: ${source.id} (${source.type})`);
    
    if (source.type === 'youtube_channel' || source.type === 'youtube_playlist') {
      // For YouTube sources, we'll use the preload version since it has the YouTube API logic
      try {
        const { loadAllVideosFromSources } = await import('../preload/loadAllVideosFromSources');
        const result = await loadAllVideosFromSources(configPath, apiKey);
        const youtubeSource = result.videosBySource.find((s: any) => s.id === source.id);
        if (youtubeSource) {
          videosBySource.push(youtubeSource);
          debug.push(`[Main] Successfully loaded YouTube source: ${source.id} with ${youtubeSource.videos?.length || 0} videos`);
        } else {
          debug.push(`[Main] YouTube source ${source.id} not found in result`);
        }
      } catch (err) {
        log.error('[Main] ERROR loading YouTube source:', source.id, err);
        debug.push(`[Main] ERROR loading YouTube source: ${source.id} - ${err}`);
        videosBySource.push({
          id: source.id,
          type: source.type,
          title: source.title,
          thumbnail: '',
          videoCount: 0,
          videos: [],
          paginationState: { currentPage: 1, totalPages: 1, totalVideos: 0, pageSize: 50 }, // Will be updated with actual config
          maxDepth: source.maxDepth, // Pass through maxDepth for navigation
          path: source.path // Pass through path for navigation
        });
      }
    } else if (source.type === 'local') {
      try {
        const maxDepth = source.maxDepth || 2;
        const localVideos = await scanLocalFolder(source.path, maxDepth);
        debug.push(`[Main] Local source ${source.id}: ${localVideos.length} videos found.`);
        logVerbose(`[Main] Local source ${source.id}: ${localVideos.length} videos found.`);
        
        const videos = localVideos.map(v => ({
          id: v.id,
          type: 'local' as const,
          title: v.title,
          thumbnail: v.thumbnail || '',
          duration: v.duration || 0,
          url: v.url || v.id,
          // For local videos with separate streams
          video: v.video || undefined,
          audio: v.audio || undefined,
          // For YouTube videos (not applicable for local)
          streamUrl: undefined,
          audioStreamUrl: undefined,
          resumeAt: undefined,
          server: undefined,
          port: undefined,
          path: undefined,
          preferredLanguages: undefined,
          useJsonStreamUrls: undefined,
          // Additional properties for source management
          sourceId: source.id,
          sourceTitle: source.title,
          sourceThumbnail: '',
        }));

        // Merge with watched data to populate resumeAt
        const { mergeWatchedData } = await import('../shared/fileUtils');
        const videosWithWatchedData = await mergeWatchedData(videos);

        const paginationState = { currentPage: 1, totalPages: 1, totalVideos: videosWithWatchedData.length, pageSize: 50 }; // Will be updated with actual config
        
        videosBySource.push({
          id: source.id,
          type: source.type,
          title: source.title,
          thumbnail: '',
          videoCount: videosWithWatchedData.length,
          videos: videosWithWatchedData,
          paginationState: paginationState,
          maxDepth: source.maxDepth, // Pass through maxDepth for navigation
          path: source.path // Pass through path for navigation
        });
      } catch (err) {
        log.error('[Main] ERROR scanning local source:', source.id, err);
        debug.push(`[Main] ERROR scanning local source: ${source.id} - ${err}`);
        videosBySource.push({
          id: source.id,
          type: source.type,
          title: source.title,
          thumbnail: '',
          videoCount: 0,
          videos: [],
          paginationState: { currentPage: 1, totalPages: 1, totalVideos: 0, pageSize: 50 }, // Will be updated with actual config
          maxDepth: source.maxDepth, // Pass through maxDepth for navigation
          path: source.path // Pass through path for navigation
        });
      }
    } else {
      debug.push(`[Main] WARNING: Unsupported source type: ${source.type}`);
    }
  }

  return { videosBySource, debug };
}

// Helper functions for parsing YouTube URLs
const createWindow = (): void => {
  log.info('[Main] Creating main window...');
  
  const preloadPath = path.join(__dirname, '../../preload/preload/index.js');
  log.info('[Main] Preload path:', preloadPath);
  log.info('[Main] Preload path exists:', fs.existsSync(preloadPath));
  log.info('[Main] __dirname:', __dirname);

  log.info('[Main] Creating main window...')
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
  const prodIndexPath = path.join(__dirname, '../../../dist/renderer/index.html');
  log.debug('Loading production URL:', prodIndexPath);

  const waitForDevServer = async (retries = 5, delayMs = 200): Promise<boolean> => {
    log.info('[Main] Checking for development server...');
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(devUrl)
        if (res.ok) {
          log.info('[Main] Development server found');
          return true
        }
      } catch (error) {
        log.debug(`[Main] Dev server check ${i + 1}/${retries} failed:`, error instanceof Error ? error.message : String(error));
      }
      await new Promise(r => setTimeout(r, delayMs))
    }
    log.info('[Main] Development server not found, using production mode');
    return false
  }

  ;(async () => {
    log.info('[Main] Starting HTML loading process...');
    
    const useDev = await waitForDevServer()
    if (useDev) {
      log.info('[Main] Loading development URL:', devUrl)
      await mainWindow.loadURL(devUrl)
      mainWindow.webContents.openDevTools()
    } else {
      log.info('[Main] Loading production URL:', prodIndexPath)
      log.info('[Main] Production file exists:', fs.existsSync(prodIndexPath))
      
      // Try multiple possible paths for the HTML file
      const possiblePaths = [
        path.join(__dirname, '../../../dist/renderer/index.html'),
        path.join(process.cwd(), 'dist/renderer/index.html'),
        path.join(process.resourcesPath, 'dist/renderer/index.html')
      ];
      
      let indexPath = null;
      for (const testPath of possiblePaths) {
        log.info('[Main] Checking path:', testPath);
        if (fs.existsSync(testPath)) {
          indexPath = testPath;
          log.info('[Main] Found HTML file at:', testPath);
          break;
        }
      }
      
      if (indexPath) {
        log.info('[Main] Loading HTML from:', indexPath);
        
        // Add debugging for renderer process BEFORE loading
        mainWindow.webContents.on('did-finish-load', () => {
          log.info('[Main] HTML finished loading');
        });
        
        mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
          log.error('[Main] Failed to load HTML:', errorCode, errorDescription);
        });
        
        mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
          // Handle objects and arrays properly
          const messageStr = typeof message === 'object' ? JSON.stringify(message) : String(message);
          log.info(`[Main] Renderer console [${level}]: ${messageStr}`);
        });
        
        // Try loading as file:// URL instead of loadFile
        const fileUrl = `file://${indexPath.replace(/\\/g, '/')}`;
        log.info('[Main] Loading as file URL:', fileUrl);
        await mainWindow.loadURL(fileUrl);
        
        // Note: 'crashed' event is not available in this Electron version
        
      } else {
        log.error('[Main] Could not find index.html in any expected location');
        // Fallback: load a simple HTML page
        log.info('[Main] Loading fallback HTML page');
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
  log.info('[Main] App is ready')
  
  // Run first-time setup if needed
  try {
    log.info('[Main] Running first-time setup...');
    const { FirstRunSetup } = await import('../shared/firstRunSetup');
    const setupResult = await FirstRunSetup.setupIfNeeded();
    
    if (setupResult.success) {
      log.info('[Main] First-time setup completed successfully');
      if (setupResult.createdDirs.length > 0) {
        log.info('[Main] Created directories:', setupResult.createdDirs);
      }
      if (setupResult.copiedFiles.length > 0) {
        log.info('[Main] Copied files:', setupResult.copiedFiles);
      }
    } else {
      log.error('[Main] First-time setup failed:', setupResult.errors);
    }
  } catch (error) {
    log.error('[Main] Error during first-time setup:', error);
  }
  
  log.info('[Main] About to call createWindow...');
  createWindow()
  log.info('[Main] createWindow called');
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  logVerbose('All windows closed')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  logVerbose('App activated')
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