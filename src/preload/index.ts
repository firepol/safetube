import { contextBridge, ipcRenderer } from 'electron';

// Debug: Log what environment variables are available (only when verbose logging is enabled)
// Note: We'll get the verbose setting from the main process via IPC instead
console.log('[Preload] Preload process starting...');
console.log('[Preload] Context bridge available:', typeof contextBridge);
console.log('[Preload] IPC renderer available:', typeof ipcRenderer);

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
    getLocalFolderContents: (folderPath: string) => 
      ipcRenderer.invoke('get-local-folder-contents', folderPath),
    // Admin IPC handlers
    adminAuthenticate: (password: string) => ipcRenderer.invoke('admin:authenticate', password),
    adminAddExtraTime: (minutes: number) => ipcRenderer.invoke('admin:add-extra-time', minutes),
    adminGetTimeExtra: () => ipcRenderer.invoke('admin:get-time-extra'),
    adminWriteTimeLimits: (timeLimits: any) => ipcRenderer.invoke('admin:write-time-limits', timeLimits),
    adminGetLastWatchedVideoWithSource: () => ipcRenderer.invoke('admin:get-last-watched-video-with-source'),
    // Setup status
    getSetupStatus: () => ipcRenderer.invoke('get-setup-status'),
    // Expose environment variables directly
    env: {
      ELECTRON_LOG_VERBOSE: process.env.ELECTRON_LOG_VERBOSE
    },
    // Logging configuration methods
    setVerboseLogging: (enabled: boolean) => ipcRenderer.invoke('logging:set-verbose', enabled),
    getVerboseLogging: () => ipcRenderer.invoke('logging:get-verbose'),
    // Logging methods
    log: (level: string, ...args: any[]) => ipcRenderer.invoke('logging:log', level, ...args)
  }
);
