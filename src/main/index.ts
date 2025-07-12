import path from 'path'
import { app, BrowserWindow, ipcMain } from 'electron'
import log from './logger'
import { Client } from 'node-ssdp'
import { setupYouTubeHandlers } from './youtube'
import fs from 'fs'
import { recordVideoWatching, getTimeTrackingState } from '../shared/timeTracking'
import { readTimeLimits } from '../shared/fileUtils'

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

// Handle video data loading
ipcMain.handle('get-video-data', async (_, videoId: string) => {
  try {
    // Try different paths based on development vs production
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
      log.error('Videos data file not found, tried paths:', possiblePaths)
      throw new Error('Videos data file not found')
    }
    
    log.info('Loading video data for:', videoId, 'from:', videosPath)
    
    const videosData = fs.readFileSync(videosPath, 'utf8')
    const videos = JSON.parse(videosData)
    const video = videos.find((v: any) => v.id === videoId)
    
    log.info('Video data loaded:', video ? video.type : 'not found')
    return video
  } catch (error) {
    log.error('Error loading video data:', error)
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

const createWindow = (): void => {
  log.info('Creating main window')
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../../preload/index.js'),
      webSecurity: false, // Allow loading local files
    },
  })

  // and load the index.html of the app.
  if (isDev) {
    log.debug('Loading development URL: http://localhost:5173')
    // Wait for the dev server to be ready
    const waitForDevServer = async () => {
      try {
        const response = await fetch('http://localhost:5173')
        if (response.ok) {
          mainWindow.loadURL('http://localhost:5173')
          // Open the DevTools.
          log.debug('Opening DevTools')
          mainWindow.webContents.openDevTools()
        }
      } catch (error) {
        log.error('Dev server not ready, retrying in 1 second...', error)
        setTimeout(waitForDevServer, 1000)
      }
    }
    waitForDevServer()
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html')
    log.debug('Loading production URL:', indexPath)
    mainWindow.loadFile(indexPath)
  }

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