import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    getLocalFile: (filePath: string) => ipcRenderer.invoke('get-local-file', filePath),
    getDlnaFile: (server: string, port: number, path: string) => 
      ipcRenderer.invoke('get-dlna-file', server, port, path),
    getVideoStreams: (videoId: string) => ipcRenderer.invoke('get-video-streams', videoId),
    recordVideoWatching: (videoId: string, position: number, timeWatched: number) =>
      ipcRenderer.invoke('time-tracking:record-video-watching', videoId, position, timeWatched),
    getTimeTrackingState: () => ipcRenderer.invoke('time-tracking:get-time-tracking-state'),
    getTimeLimits: () => ipcRenderer.invoke('time-tracking:get-time-limits'),
    // Expose environment variables for logging
    env: {
      ELECTRON_LOG_VERBOSE: process.env.ELECTRON_LOG_VERBOSE
    }
  }
); 