import path from 'path'
import { app, BrowserWindow, ipcMain } from 'electron'
import log from './logger'
import { Client } from 'node-ssdp'
import { setupYouTubeHandlers } from './youtube'
import { YouTubeAPI } from './youtube-api'
import fs from 'fs'
import { recordVideoWatching, getTimeTrackingState } from '../shared/timeTracking'
import { readTimeLimits } from '../shared/fileUtils'

// Global type declaration for current videos
declare global {
  var currentVideos: any[];
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

// Handle video data loading - now integrated with video sources
ipcMain.handle('get-video-data', async (_, videoId: string) => {
  try {
    log.info('[Main] Loading video data for:', videoId);
    
    // First try to find the video in our current video sources
    // This will be populated when loadAllVideosFromSources is called
    if (global.currentVideos && global.currentVideos.length > 0) {
      const video = global.currentVideos.find((v: any) => v.id === videoId);
      if (video) {
        log.info('[Main] Video found in current sources:', video.title);
        return video;
      }
    }
    
    // Fallback: Try the old videos.json system
    const possiblePaths = [
      path.join(process.cwd(), 'src', 'renderer', 'data', 'videos.json'),
      path.join(__dirname, '..', 'renderer', 'data', 'videos.json'),
      path.join(__dirname, '..', '..', 'src', 'renderer', 'data', 'videos.json'),
      path.join(__dirname, '..', '..', '..', 'src', 'renderer', 'data', 'videos.json')
    ]
    
    let videosPath = null
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        videosPath = testPath
        break
      }
    }
    
    if (!videosPath) {
      log.warn('[Main] Videos data file not found, tried paths:', possiblePaths)
      throw new Error('Videos data file not found')
    }
    
    log.info('[Main] Loading video data from fallback path:', videosPath)
    
    const videosData = fs.readFileSync(videosPath, 'utf8')
    const videos = JSON.parse(videosData)
    const video = videos.find((v: any) => v.id === videoId)
    
    log.info('[Main] Video data loaded from fallback:', video ? video.type : 'not found')
    return video
  } catch (error) {
    log.error('[Main] Error loading video data:', error)
    throw error
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
            const apiKey = process.env.YOUTUBE_API_KEY || 'your-api-key-here';
            if (apiKey === 'your-api-key-here') {
              debugInfo.push(`[Main] YouTube source ${source.title} - API key not configured`);
              continue;
            }
            
            const youtubeAPI = new YouTubeAPI(apiKey);
            let youtubeVideos: any[] = [];
            
            if (source.sourceType === 'youtube_channel') {
              log.info('[Main] Fetching videos from YouTube channel:', source.channelId);
              youtubeVideos = await youtubeAPI.getChannelVideos(source.channelId, 20);
              
              // Get channel details if title/thumbnail are missing
              if (!source.title || !source.thumbnail) {
                try {
                  const channelDetails = await youtubeAPI.getChannelDetails(source.channelId);
                  if (!source.title) source.title = channelDetails.title;
                  if (!source.thumbnail) source.thumbnail = channelDetails.thumbnail;
                } catch (error) {
                  log.warn('[Main] Could not fetch channel details:', error);
                }
              }
              
            } else if (source.sourceType === 'youtube_playlist') {
              log.info('[Main] Fetching videos from YouTube playlist:', source.playlistId);
              youtubeVideos = await youtubeAPI.getPlaylistVideos(source.playlistId, 20);
              
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
              sourceType: 'youtube',
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
    
    return {
      videos: allVideos,
      sources: parsedSources,
      debug: debugInfo
    };
  } catch (error) {
    log.error('[Main] Error loading videos from sources:', error);
    throw error;
  }
});

// Helper functions for parsing YouTube URLs
function extractChannelId(url: string): string | null {
  try {
    if (url.includes('/@')) {
      const match = url.match(/\/@([^\/\?]+)/);
      return match ? match[1] : null;
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
      return [];
    }
    
    // Start scanning from the root folder
    scanFolderRecursive(absolutePath, 0, maxDepth, videos, supportedExtensions);
    
    log.info('[Main] Local folder scan complete, found', videos.length, 'videos');
    return videos;
    
  } catch (error) {
    log.error('[Main] Error scanning local folder:', folderPath, error);
    return [];
  }
}

// Recursive function to scan folders (defined outside to avoid strict mode issues)
function scanFolderRecursive(currentPath: string, currentDepth: number, maxDepth: number, videos: any[], supportedExtensions: string[]): void {
  if (currentDepth > maxDepth) {
    return;
  }
  
  try {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        // Recursively scan subdirectories
        scanFolderRecursive(itemPath, currentDepth + 1, maxDepth, videos, supportedExtensions);
      } else if (stats.isFile()) {
        // Check if it's a video file
        const ext = path.extname(item).toLowerCase();
        if (supportedExtensions.includes(ext)) {
          const relativePath = path.relative(process.cwd(), itemPath);
          const video = {
            id: `local-${relativePath.replace(/[^a-zA-Z0-9]/g, '-')}`,
            title: path.basename(item, ext),
            thumbnail: 'https://via.placeholder.com/300x200?text=Local+Video',
            duration: 0, // TODO: Extract duration in next phase
            type: 'local',
            path: `file://${itemPath}`,
            filename: item,
            extension: ext,
            size: stats.size,
            modified: stats.mtime
          };
          videos.push(video);
          log.info('[Main] Found video:', video.title, 'at', relativePath);
        }
      }
    }
  } catch (error) {
    log.error('[Main] Error scanning folder:', currentPath, error);
  }
}

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