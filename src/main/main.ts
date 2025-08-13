import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as url from 'url';
import { recordVideoWatching, getTimeTrackingState } from '../shared/timeTracking';
import { logVerbose } from '../shared/logging';

console.log('[Main] Main process starting...');

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
    const localPath = filePath.replace('file://', '');
    
    // Check if file exists
    if (!fs.existsSync(localPath)) {
      throw new Error('File not found');
    }

    // Return the file:// URL
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
    const configPath = path.join(process.cwd(), 'config', 'youtubePlayer.json');
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

// Handle video data loading
ipcMain.handle('get-video-data', async (_, videoId: string) => {
  try {
    // Try different paths based on development vs production
    const possiblePaths = [
      path.join(process.cwd(), 'src', 'renderer', 'data', 'videos.json'),
      path.join(__dirname, '..', 'renderer', 'data', 'videos.json'),
      path.join(__dirname, '..', '..', 'src', 'renderer', 'data', 'videos.json'),
      path.join(__dirname, '..', '..', '..', 'src', 'renderer', 'data', 'videos.json')
    ];
    
    let videosPath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        videosPath = testPath;
        break;
      }
    }
    
    if (!videosPath) {
      console.error('[Main] Videos data file not found, tried paths:', possiblePaths);
      throw new Error('Videos data file not found');
    }
    
    console.log('[Main] Loading video data for:', videoId, 'from:', videosPath);
    
    const videosData = fs.readFileSync(videosPath, 'utf8');
    const videos = JSON.parse(videosData);
    const video = videos.find((v: any) => v.id === videoId);
    
    console.log('[Main] Video data loaded:', video ? video.type : 'not found');
    return video;
  } catch (error) {
    console.error('[Main] Error loading video data:', error);
    throw error;
  }
});

// Environment variable handler
ipcMain.handle('get-env-var', async (_, varName: string) => {
  console.log('[Main] get-env-var called with:', varName);
  console.log('[Main] Available env vars:', Object.keys(process.env).filter(key => key.includes('LOG')));
  const value = process.env[varName];
  console.log('[Main] Returning value:', value);
  return value;
});



console.log('[Main] IPC handlers registered successfully');

// Register IPC handlers function (for app.whenReady if needed)
function registerIpcHandlers() {
  console.log('[Main] IPC handlers already registered at module load');
}

function createWindow() {
  const preloadPath = path.join(__dirname, '../preload/index.js');
  console.log('[Main] Preload path:', preloadPath);

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

  // In production, load the built index.html
  const indexPath = path.join(__dirname, '../../renderer/index.html');
  console.log('[Main] Loading renderer HTML:', indexPath);
  mainWindow.loadFile(indexPath);

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

app.whenReady().then(() => {
  console.log('[Main] App is ready, registering IPC handlers...');
  
  // Register IPC handlers first
  registerIpcHandlers();
  
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