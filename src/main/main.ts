import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as url from 'url';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
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
}

app.whenReady().then(() => {
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
  return new Promise((resolve, reject) => {
    const options = {
      hostname: server,
      port: port,
      path: path,
      method: 'HEAD'
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        // If HEAD request succeeds, return the full URL
        resolve(`http://${server}:${port}${path}`);
      } else {
        reject(new Error(`Failed to access DLNA file: ${res.statusCode}`));
      }
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}); 