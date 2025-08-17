import { contextBridge, ipcRenderer } from 'electron';

// Debug: Log what environment variables are available (only when verbose logging is enabled)
if (process.env.ELECTRON_LOG_VERBOSE === 'true') {
  console.log('[Preload] Available env vars:', Object.keys(process.env).filter(key => key.includes('LOG')));
  console.log('[Preload] ELECTRON_LOG_VERBOSE value:', process.env.ELECTRON_LOG_VERBOSE);
}

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
    getPlayerConfig: () => ipcRenderer.invoke('get-player-config'),
    getVideoData: (videoId: string) => ipcRenderer.invoke('get-video-data', videoId),
    testHandler: () => ipcRenderer.invoke('test-handler'),
    // New IPC handler for loading videos from sources
    loadAllVideosFromSources: () => ipcRenderer.invoke('load-all-videos-from-sources'),
    // New IPC handler for loading videos from new source system
    loadVideosFromSources: () => ipcRenderer.invoke('load-videos-from-sources'),
    // New IPC handler for getting YouTube API key
    getYouTubeApiKey: () => ipcRenderer.invoke('get-youtube-api-key'),
    // New IPC handler for getting paginated videos from a specific source
    getPaginatedVideos: (sourceId: string, pageNumber: number) => 
      ipcRenderer.invoke('get-paginated-videos', sourceId, pageNumber),
    // New IPC handler for getting local folder contents for navigation
    getLocalFolderContents: (folderPath: string, maxDepth: number, currentDepth: number = 1) => 
      ipcRenderer.invoke('get-local-folder-contents', folderPath, maxDepth, currentDepth),
    // Expose environment variables directly
    env: {
      ELECTRON_LOG_VERBOSE: process.env.ELECTRON_LOG_VERBOSE
    }
  }
);
