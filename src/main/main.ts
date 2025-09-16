import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as url from 'url';
import { recordVideoWatching, getTimeTrackingState } from '../shared/timeTracking';
import { logVerbose } from '../shared/logging';
import { AppPaths } from '../shared/appPaths';
import { FirstRunSetup } from '../shared/firstRunSetup';
import log from './logger';

log.info('[Main] Main process starting...');

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
ipcMain.handle('test-handler', async () => {
  console.log('[Main] Test handler called successfully');
  return 'test-success';
});

// Handle local file access
ipcMain.handle('get-local-file', async (_, filePath: string) => {
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

// Handle player configuration loading
ipcMain.handle('get-player-config', async () => {
  console.log('[Main] get-player-config handler called');
  try {
    const configPath = AppPaths.getConfigPath('youtubePlayer.json');
    console.log('[Main] Config path:', configPath);
    if (!fs.existsSync(configPath)) {
      console.log('[Main] Config file not found');
      throw new Error('Player configuration file not found');
    }
    const configData = fs.readFileSync(configPath, 'utf8');
    console.log('[Main] Config data loaded successfully');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error loading player config:', error);
    throw error;
  }
});

// Handle setup status request
ipcMain.handle('get-setup-status', async () => {
  try {
    return await FirstRunSetup.getSetupStatus();
  } catch (error) {
    console.error('Error getting setup status:', error);
    throw error;
  }
});

// Handle DLNA file access
ipcMain.handle('get-dlna-file', async (_, server: string, port: number, path: string) => {
  logVerbose('Getting DLNA file:', { server, port, path });
  const url = `http://${server}:${port}${path}`;
  logVerbose('Returning DLNA URL:', url);
  return url;
});

// Handle video streams
ipcMain.handle('get-video-streams', async (_, videoId: string) => {
  try {
    logVerbose('Getting video streams for:', videoId);
    // For now, return a mock response - you can implement actual YouTube API calls here
    return {
      streams: [
        { url: `https://www.youtube.com/watch?v=${videoId}`, quality: 'default' }
      ]
    };
  } catch (error) {
    console.error('Error getting video streams:', error);
    throw error;
  }
});

// Time tracking IPC handlers
ipcMain.handle('time-tracking:record-video-watching', async (_, videoId: string, position: number, timeWatched: number) => {
  try {
    await recordVideoWatching(videoId, position, timeWatched);
    return { success: true };
  } catch (error) {
    console.error('Error recording video watching:', error);
    throw error;
  }
});

ipcMain.handle('time-tracking:get-time-tracking-state', async () => {
  try {
    return await getTimeTrackingState();
  } catch (error) {
    console.error('Error getting time tracking state:', error);
    throw error;
  }
});

ipcMain.handle('time-tracking:get-time-limits', async () => {
  try {
    const { readTimeLimits } = await import('../shared/fileUtils');
    return await readTimeLimits();
  } catch (error) {
    console.error('Error reading time limits:', error);
    throw error;
  }
});

// Admin IPC handlers
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
    console.error('Error during admin authentication:', error);
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
    console.error('Error adding extra time:', error);
    throw error;
  }
});

ipcMain.handle('admin:get-time-extra', async () => {
  try {
    // Import the function here to avoid circular dependencies
    const { readTimeExtra } = await import('../shared/fileUtils');
    return await readTimeExtra();
  } catch (error) {
    console.error('Error reading time extra:', error);
    throw error;
  }
});

ipcMain.handle('admin:get-last-watched-video-with-source', async () => {
  try {
    // Import the function here to avoid circular dependencies
    const { getLastWatchedVideoWithSource } = await import('../shared/timeTracking');
    return await getLastWatchedVideoWithSource();
  } catch (error) {
    console.error('Error getting last watched video with source:', error);
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
    console.error('Error writing time limits:', error);
    throw error;
  }
});

// Logging configuration IPC handlers
ipcMain.handle('logging:set-verbose', async (_, enabled: boolean) => {
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

ipcMain.handle('logging:get-verbose', async () => {
  try {
    return { verbose: process.env.ELECTRON_LOG_VERBOSE === 'true' };
  } catch (error) {
    console.error('Error getting verbose logging state:', error);
    throw error;
  }
});



// Video data loading is handled in src/main/index.ts

// Environment variable handler
ipcMain.handle('get-env-var', async (_, varName: string) => {
  console.log('[Main] get-env-var called with:', varName);
  console.log('[Main] Available env vars:', Object.keys(process.env).filter(key => key.includes('LOG')));
  const value = process.env[varName];
  console.log('[Main] Returning value:', value);
  return value;
});

// Handle loading videos from new source system (for development)
ipcMain.handle('load-videos-from-sources', async () => {
  try {
    console.log('[Main] load-videos-from-sources handler called (development)');

    // Read API key from mainSettings.json
    let apiKey = '';
    try {
      const { readMainSettings } = await import('../shared/fileUtils');
      const mainSettings = await readMainSettings();
      apiKey = mainSettings.youtubeApiKey || '';
      console.log('[Main] API key loaded from mainSettings.json:', apiKey ? '***configured***' : 'NOT configured');
    } catch (error) {
      console.warn('[Main] Could not read mainSettings for development video loading:', error);
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
    // In production, load the built index.html
    // Try to load from local dist folder first (for development builds)
    const localPath = path.join(process.cwd(), 'dist', 'renderer', 'index.html');
    const asarPath = path.join(process.resourcesPath, 'app.asar', 'dist', 'renderer', 'index.html');
    
    log.info('[Main] Checking local path:', localPath);
    log.info('[Main] Checking asar path:', asarPath);
    log.info('[Main] Process cwd:', process.cwd());
    log.info('[Main] Resources path:', process.resourcesPath);
    
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

  // Handle CORS preflight requests
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['GET, POST, OPTIONS'],
        'Access-Control-Allow-Headers': ['Content-Type']
      }
    });
  });
}

app.whenReady().then(async () => {
  console.log('[Main] App is ready, registering IPC handlers...');
  
  // Register IPC handlers first
  registerIpcHandlers();
  
  // Initialize video sources on startup
  try {
    console.log('[Main] Initializing video sources...');

    // Read API key from mainSettings.json
    let apiKey = '';
    try {
      const { readMainSettings } = await import('../shared/fileUtils');
      const mainSettings = await readMainSettings();
      apiKey = mainSettings.youtubeApiKey || '';
      console.log('[Main] API key loaded from mainSettings.json for startup:', apiKey ? '***configured***' : 'NOT configured');
    } catch (error) {
      console.warn('[Main] Could not read mainSettings for startup video loading:', error);
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