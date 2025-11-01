import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as url from 'url';
import { recordVideoWatching, getTimeTrackingState } from '../shared/timeTracking';
import { logVerbose } from '../shared/logging';
import { AppPaths } from '../shared/appPaths';
import { FirstRunSetup } from './firstRunSetup';
import { getYouTubeApiKey } from './helpers/settingsHelper';
import log from './logger';
import { IPC } from '../shared/ipc-channels';
import { HttpServerManager } from './services/HttpServerManager';
import { DatabaseService } from './services/DatabaseService';
import { registerServerHandlers } from './ipc/serverHandlers';

log.info('[Main] Main process starting...');

// Global HTTP server manager instance
let httpServerManager: HttpServerManager | null = null;

// Run first-time setup if needed (before any config files are read)
(async () => {
  try {
    log.info('[Main] Running first-time setup...');
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
})();

// Register IPC handlers immediately
console.log('[Main] Registering IPC handlers immediately...');

// Test handler to verify IPC is working
ipcMain.handle(IPC.TEST.TEST_HANDLER, async () => {
  console.log('[Main] Test handler called successfully');
  return 'test-success';
});

// Handle local file access
ipcMain.handle(IPC.LOCAL_FILES.GET_LOCAL_FILE, async (_, filePath: string) => {
  try {
    // Convert file:// URL to local path
    let localPath = filePath.replace('file://', '');
    
    // Normalize Windows paths - convert backslashes to forward slashes for file:// URLs
    if (process.platform === 'win32') {
      localPath = localPath.replace(/\\/g, '/');
    }
    
    // Check if file exists (use original path for filesystem operations)
    const originalPath = filePath.replace('file://', '');
    if (!fs.existsSync(originalPath)) {
      throw new Error('File not found');
    }

    // Return the file:// URL with normalized path
    return `file://${localPath}`;
  } catch (error) {
    console.error('Error getting local file:', error);
    throw error;
  }
});

// Handle DLNA file access
ipcMain.handle(IPC.DLNA.GET_DLNA_FILE, async (_, server: string, port: number, path: string) => {
  logVerbose('Getting DLNA file:', { server, port, path });
  const url = `http://${server}:${port}${path}`;
  logVerbose('Returning DLNA URL:', url);
  return url;
});

// Time tracking IPC handlers
ipcMain.handle(IPC.TIME_TRACKING.RECORD_VIDEO_WATCHING, async (_, videoId: string, position: number, timeWatched: number) => {
  try {
    await recordVideoWatching(videoId, position, timeWatched);
    return { success: true };
  } catch (error) {
    console.error('Error recording video watching:', error);
    throw error;
  }
});

ipcMain.handle(IPC.TIME_TRACKING.GET_TIME_TRACKING_STATE, async () => {
  try {
    return await getTimeTrackingState();
  } catch (error) {
    console.error('Error getting time tracking state:', error);
    throw error;
  }
});

ipcMain.handle(IPC.TIME_TRACKING.GET_TIME_LIMITS, async () => {
  try {
    const { readTimeLimits } = await import('../shared/fileUtils');
    return await readTimeLimits();
  } catch (error) {
    console.error('Error reading time limits:', error);
    throw error;
  }
});

// Admin IPC handlers (note: main admin handlers moved to ipcHandlerRegistry.ts)
// Admin IPC handlers are now in ipcHandlerRegistry.ts

ipcMain.handle(IPC.ADMIN.GET_TIME_EXTRA, async () => {
  try {
    // Import the function here to avoid circular dependencies
    const { readTimeExtra } = await import('../shared/fileUtils');
    return await readTimeExtra();
  } catch (error) {
    console.error('Error reading time extra:', error);
    throw error;
  }
});

// REMOVED: Duplicate handler moved to ipcHandlerRegistry.ts
// This handler was conflicting with the one in registerAdminHandlers()
// See src/main/services/ipcHandlerRegistry.ts line 434

ipcMain.handle(IPC.ADMIN.WRITE_TIME_LIMITS, async (_, timeLimits: any) => {
  try {
    // Import the function here to avoid circular dependencies
    const { writeTimeLimits } = await import('../shared/fileUtils');
    await writeTimeLimits(timeLimits);
    
    logVerbose('[Admin] Time limits updated:', timeLimits);
    return { success: true };
  } catch (error) {
    console.error('Error writing time limits:', error);
    throw error;
  }
});

// Logging configuration IPC handlers
ipcMain.handle(IPC.LOGGING.SET_VERBOSE, async (_, enabled: boolean) => {
  try {
    // Set environment variable for main process
    process.env.ELECTRON_LOG_VERBOSE = enabled ? 'true' : 'false';
    
    // Send message to all renderer processes to update their localStorage
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('logging:verbose-changed', enabled);
      }
    });
    
    return { success: true, verbose: enabled };
  } catch (error) {
    console.error('Error setting verbose logging:', error);
    throw error;
  }
});

ipcMain.handle(IPC.LOGGING.GET_VERBOSE, async () => {
  try {
    return { verbose: process.env.ELECTRON_LOG_VERBOSE === 'true' };
  } catch (error) {
    console.error('Error getting verbose logging state:', error);
    throw error;
  }
});



// Video data loading is handled in src/main/index.ts

// Environment variable handler
ipcMain.handle(IPC.UTILS.GET_ENV_VAR, async (_, varName: string) => {
  console.log('[Main] get-env-var called with:', varName);
  console.log('[Main] Available env vars:', Object.keys(process.env).filter(key => key.includes('LOG')));
  const value = process.env[varName];
  console.log('[Main] Returning value:', value);
  return value;
});

// Handle loading videos from new source system (for development)
ipcMain.handle(IPC.VIDEO_LOADING.LOAD_VIDEOS_FROM_SOURCES, async () => {
  try {
    console.log('[Main] load-videos-from-sources handler called (development)');

    let apiKey = '';
    try {
      apiKey = await getYouTubeApiKey();
      console.log('[Main] API key loaded:', apiKey ? '***configured***' : 'NOT configured');
    } catch (error) {
      console.warn('[Main] Could not read API key for development video loading:', error);
    }

    // Import and use the main process version that has the encoded IDs
    const { loadAllVideosFromSourcesMain } = await import('../main/index');
    const result = await loadAllVideosFromSourcesMain(AppPaths.getConfigPath('videoSources.json'), apiKey);
    
    console.log('[Main] Videos loaded in development:', { 
      totalVideos: result.videosBySource?.length || 0, 
      sources: result.videosBySource?.length || 0 
    });
    
    return result;
  } catch (error) {
    console.error('[Main] Error loading videos from sources in development:', error);
    throw error;
  }
});

// Handler for loading videos from a specific source (when user clicks a source)
ipcMain.handle(IPC.VIDEO_LOADING.LOAD_VIDEOS_FOR_SOURCE, async (_, sourceId: string) => {
  try {
    console.log('[Main] load-videos-for-source handler called for:', sourceId);

    let apiKey = '';
    try {
      apiKey = await getYouTubeApiKey();
      console.log('[Main] API key loaded for source:', sourceId, apiKey ? '***configured***' : 'NOT configured');
    } catch (error) {
      console.warn('[Main] Could not read API key for source video loading:', error);
    }

    // Import and use the specific source loading function
    const { loadVideosForSpecificSource } = await import('../main/services/videoDataService');
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

// Handler for opening external videos in a controlled Electron window
ipcMain.handle(IPC.UI.OPEN_VIDEO_IN_WINDOW, async (_, videoUrl: string) => {
  try {
    const videoWindow = new BrowserWindow({
      width: 1280,
      height: 720,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        allowRunningInsecureContent: false
      }
    });

    // Prevent navigation away from the video URL domain
    videoWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      // Allow navigation within the same domain
      try {
        const videoUrlDomain = new URL(videoUrl).hostname;
        const navUrlDomain = new URL(navigationUrl).hostname;

        if (videoUrlDomain !== navUrlDomain) {
          event.preventDefault();
          console.log('[Main] Blocked navigation to different domain:', navUrlDomain);
        }
      } catch (error) {
        event.preventDefault();
      }
    });

    // Block new windows from opening (related videos, advertisements)
    videoWindow.webContents.setWindowOpenHandler(({ url }) => {
      console.log('[Main] Blocked attempt to open new window for:', url);
      return { action: 'deny' };
    });

    // Load the video URL
    await videoWindow.loadURL(videoUrl);

    console.log('[Main] Video window opened for:', videoUrl);
    return { success: true };
  } catch (error) {
    console.error('[Main] Error opening video window:', error);
    throw error;
  }
});

console.log('[Main] IPC handlers registered successfully');

// Register IPC handlers function (for app.whenReady if needed)
function registerIpcHandlers() {
  console.log('[Main] IPC handlers already registered at module load');
}

function createWindow() {
  const preloadPath = path.join(__dirname, '../../preload/index.js');
  log.info('[Main] Preload path:', preloadPath);
  log.info('[Main] Preload path exists:', fs.existsSync(preloadPath));
  log.info('[Main] __dirname:', __dirname);

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      webSecurity: false // Allow cross-origin requests
    }
  });

  // Check if we're in development or production
  const isDev = process.env.NODE_ENV === 'development';
  log.info('[Main] NODE_ENV:', process.env.NODE_ENV);
  log.info('[Main] Is development:', isDev);

  if (isDev) {
    // In development, load from Vite dev server
    const devUrl = 'http://localhost:5173';
    log.info('[Main] Loading development URL:', devUrl);
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from HTTP server if available
    const serverInfo = httpServerManager?.getInfo();
    if (serverInfo && serverInfo.started) {
      log.info('[Main] Loading from local HTTP server:', serverInfo.url);
      mainWindow.loadURL(serverInfo.url);
    } else {
      // Fallback: Try to load the built index.html
      log.warn('[Main] HTTP server not available, falling back to file:// protocol');
      const localPath = path.join(process.cwd(), 'dist', 'renderer', 'index.html');
      const asarPath = path.join(process.resourcesPath, 'app.asar', 'dist', 'renderer', 'index.html');

      log.info('[Main] Checking local path:', localPath);
      log.info('[Main] Checking asar path:', asarPath);

      if (fs.existsSync(localPath)) {
        log.info('[Main] Loading from local dist folder:', localPath);
        mainWindow.loadFile(localPath);
      } else if (fs.existsSync(asarPath)) {
        log.info('[Main] Loading from asar:', asarPath);
        mainWindow.loadFile(asarPath);
      } else {
        log.error('[Main] Could not find index.html in any expected location');
        // Fallback: load a simple HTML page
        mainWindow.loadURL('data:text/html,<h1>SafeTube</h1><p>Loading...</p>');
      }
    }
  }

  // Add headers to all requests
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        'Origin': 'http://localhost:5173',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  });

  // Handle CORS preflight requests and CSP
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['GET, POST, OPTIONS'],
        'Access-Control-Allow-Headers': ['Content-Type'],
        // Set Referrer-Policy for YouTube iframe API (fixes error 153)
        'Referrer-Policy': ['strict-origin-when-cross-origin'],
        // Set CSP to allow file:// protocol for downloaded YouTube videos
        // This fixes "Refused to load media from 'file://...' because it violates CSP" error
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "media-src 'self' file: blob: data: http://localhost:* https://*.youtube.com https://*.youtube-nocookie.com https://*.googlevideo.com; " +
          "img-src 'self' file: blob: data: https: http:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://www.youtube-nocookie.com https://s.ytimg.com; " +
          "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; " +
          "connect-src 'self' http://localhost:* https://*.googlevideo.com https://www.youtube.com https://www.youtube-nocookie.com https://youtube.com;"
        ]
      }
    });
  });
}

app.whenReady().then(async () => {
  console.log('[Main] App is ready, registering IPC handlers...');

  // Register IPC handlers first
  registerIpcHandlers();

  // Start HTTP server in production mode
  if (process.env.NODE_ENV !== 'development') {
    try {
      log.info('[Main] Starting HTTP server in production mode...');

      // Initialize database service
      const dbService = await DatabaseService.getInstance();

      // Get remote access setting from database
      const { getSetting } = await import('./database/queries/settingsQueries');
      const remoteAccessEnabled = await getSetting(dbService, 'main.remoteAccessEnabled', false);

      // Determine paths
      const distPath = fs.existsSync(path.join(process.cwd(), 'dist', 'renderer'))
        ? path.join(process.cwd(), 'dist', 'renderer')
        : path.join(process.resourcesPath, 'app.asar', 'dist', 'renderer');

      log.info('[Main] HTTP server config:', {
        port: 3000,
        host: remoteAccessEnabled ? '0.0.0.0' : '127.0.0.1',
        distPath,
        remoteAccessEnabled
      });

      // Create and start HTTP server
      httpServerManager = new HttpServerManager({
        port: 3000,
        host: remoteAccessEnabled ? '0.0.0.0' : '127.0.0.1',
        distPath
      });

      const serverInfo = await httpServerManager.start();
      log.info('[Main] HTTP server started successfully:', serverInfo);
    } catch (error) {
      log.error('[Main] Failed to start HTTP server:', error instanceof Error ? error.message : error);
      // Continue without HTTP server - will fallback to file:// protocol
    }
  }

  // Register server IPC handlers
  registerServerHandlers(httpServerManager);

  // Initialize video sources on startup
  try {
    console.log('[Main] Initializing video sources...');

    let apiKey = '';
    try {
      apiKey = await getYouTubeApiKey();
      console.log('[Main] API key loaded for startup:', apiKey ? '***configured***' : 'NOT configured');
    } catch (error) {
      console.warn('[Main] Could not read API key for startup video loading:', error);
    }

    const { loadAllVideosFromSourcesMain } = await import('../main/index');
    const result = await loadAllVideosFromSourcesMain(AppPaths.getConfigPath('videoSources.json'), apiKey);
    console.log('[Main] Videos loaded on startup:', { totalVideos: result.videosBySource?.length || 0, sources: result.videosBySource?.length || 0 });

    // Store videos globally for access by other handlers
    // Extract all videos from the videosBySource structure
    const allVideos = result.videosBySource?.flatMap(source => source.videos || []) || [];
    global.currentVideos = allVideos;

    if (allVideos.length > 0) {
      const sampleVideos = allVideos.slice(0, 5);
    }

    // Refresh stale YouTube sources in the background
    if (apiKey) {
      try {
        const { refreshStaleYouTubeSources } = await import('./services/videoDataService');
        // Run in background, don't await
        refreshStaleYouTubeSources(apiKey).catch((error) => {
          log.error('[Main] Error refreshing stale YouTube sources:', error);
        });
        log.info('[Main] Started background refresh of stale YouTube sources');
      } catch (refreshError) {
        log.warn('[Main] Could not start background source refresh:', refreshError);
      }
    }
  } catch (error) {
    console.error('[Main] Error loading videos on startup:', error);
  }

  // Then create the window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up HTTP server on application quit
app.on('will-quit', async () => {
  if (httpServerManager) {
    try {
      await httpServerManager.stop();
      log.info('[Main] HTTP server stopped successfully');
    } catch (error) {
      log.error('[Main] Error stopping HTTP server:', error instanceof Error ? error.message : error);
    }
  }
}); 