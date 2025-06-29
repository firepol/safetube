import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as url from 'url';
import { recordVideoWatching, getTimeTrackingState } from '../shared/timeTracking';
import { logVerbose } from '../shared/logging';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
      webSecurity: false // Allow cross-origin requests
    }
  });

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built index.html
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
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

app.whenReady().then(() => {
  console.log('[Main] App is ready, registering IPC handlers...');
  
  // Test handler to verify IPC is working
  ipcMain.handle('test-handler', async () => {
    console.log('[Main] Test handler called successfully');
    return 'test-success';
  });
  
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

// Environment variable handler
ipcMain.handle('get-env-var', async (_, varName: string) => {
  console.log('[Main] get-env-var called with:', varName);
  console.log('[Main] Available env vars:', Object.keys(process.env).filter(key => key.includes('LOG')));
  const value = process.env[varName];
  console.log('[Main] Returning value:', value);
  return value;
}); 