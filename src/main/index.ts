import path from 'path'

import { app, BrowserWindow } from 'electron'
import log from './logger'

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit()
}

const createWindow = (): void => {
  log.info('Creating main window')
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  // and load the index.html of the app.
  if (process.env.NODE_ENV === 'development') {
    log.debug('Loading development URL: http://localhost:5173')
    mainWindow.loadURL('http://localhost:5173')
    // Open the DevTools.
    log.debug('Opening DevTools')
    mainWindow.webContents.openDevTools()
  } else {
    log.debug('Loading production URL:', path.join(__dirname, '../renderer/index.html'))
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
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