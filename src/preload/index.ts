import { contextBridge, ipcRenderer } from 'electron';

// Debug: Log what environment variables are available (only when verbose logging is enabled)
// Note: We'll get the verbose setting from the main process via IPC instead
// console.log('[Preload] Preload process starting...');
// console.log('[Preload] Context bridge available:', typeof contextBridge);
// console.log('[Preload] IPC renderer available:', typeof ipcRenderer);

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    getLocalFile: (filePath: string) => ipcRenderer.invoke('get-local-file', filePath),
    getDlnaFile: (server: string, port: number, path: string) => 
      ipcRenderer.invoke('get-dlna-file', server, port, path),
    getVideoStreams: (videoId: string) => ipcRenderer.invoke('get-video-streams', videoId),
    recordVideoWatching: (videoId: string, position: number, timeWatched: number, duration?: number) =>
      ipcRenderer.invoke('time-tracking:record-video-watching', videoId, position, timeWatched, duration),
    getTimeTrackingState: () => ipcRenderer.invoke('time-tracking:get-time-tracking-state'),
    getTimeLimits: () => ipcRenderer.invoke('time-tracking:get-time-limits'),
    getWatchedVideos: () => ipcRenderer.invoke('get-watched-videos'),
    getPlayerConfig: () => ipcRenderer.invoke('get-player-config'),
    getVideoData: (videoId: string, navigationContext?: any) => ipcRenderer.invoke('get-video-data', videoId, navigationContext),
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
    // New IPC handler for getting video count for local sources (lazy counting)
    getLocalSourceVideoCount: (sourcePath: string, maxDepth: number) => 
      ipcRenderer.invoke('get-local-source-video-count', sourcePath, maxDepth),
    // New IPC handler for getting video count for a specific folder (for subfolder counts)
    getFolderVideoCount: (folderPath: string, maxDepth: number) => 
      ipcRenderer.invoke('get-folder-video-count', folderPath, maxDepth),
    // New IPC handler for getting video duration for local videos (lazy duration extraction)
    getLocalVideoDuration: (videoPath: string) => 
      ipcRenderer.invoke('get-local-video-duration', videoPath),
    // Admin IPC handlers
    adminAuthenticate: (password: string) => ipcRenderer.invoke('admin:authenticate', password),
    adminChangePassword: (currentPassword: string, newPassword: string) => ipcRenderer.invoke('admin:change-password', currentPassword, newPassword),
    adminHashPassword: (password: string) => ipcRenderer.invoke('admin:hash-password', password),
    adminAddExtraTime: (minutes: number) => ipcRenderer.invoke('admin:add-extra-time', minutes),
    adminGetTimeExtra: () => ipcRenderer.invoke('admin:get-time-extra'),
    adminWriteTimeLimits: (timeLimits: any) => ipcRenderer.invoke('admin:write-time-limits', timeLimits),
    adminGetLastWatchedVideoWithSource: () => ipcRenderer.invoke('admin:get-last-watched-video-with-source'),
    // Video source management
    videoSourcesGetAll: () => ipcRenderer.invoke('video-sources:get-all'),
    videoSourcesSaveAll: (sources: any[]) => ipcRenderer.invoke('video-sources:save-all', sources),
    videoSourcesValidateYouTubeUrl: (url: string, type: 'youtube_channel' | 'youtube_playlist') => 
      ipcRenderer.invoke('video-sources:validate-youtube-url', url, type),
    videoSourcesValidateLocalPath: (path: string) => 
      ipcRenderer.invoke('video-sources:validate-local-path', path),
    // Video codec detection and conversion
    getVideoCodecInfo: (filePath: string) => ipcRenderer.invoke('get-video-codec-info', filePath),
    getCompatibleVideoPath: (originalPath: string, cacheDir?: string) => 
      ipcRenderer.invoke('get-compatible-video-path', originalPath, cacheDir),
    needsVideoConversion: (filePath: string) => ipcRenderer.invoke('needs-video-conversion', filePath),
    hasConvertedVideo: (filePath: string, cacheDir?: string) => 
      ipcRenderer.invoke('has-converted-video', filePath, cacheDir),
    getExistingConvertedVideoPath: (filePath: string, cacheDir?: string) => 
      ipcRenderer.invoke('get-existing-converted-video-path', filePath, cacheDir),
    getConversionStatus: (filePath: string) => ipcRenderer.invoke('get-conversion-status', filePath),
    startVideoConversion: (filePath: string, options?: any) => 
      ipcRenderer.invoke('start-video-conversion', filePath, options),
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
    log: (level: string, ...args: any[]) => ipcRenderer.invoke('logging:log', level, ...args),
    // Clear source cache
    clearSourceCache: (sourceId: string) => ipcRenderer.invoke('clear-source-cache', sourceId),
    // Download management
    startDownload: (videoId: string, videoTitle: string, sourceInfo: any) => 
      ipcRenderer.invoke('download:start', videoId, videoTitle, sourceInfo),
    getDownloadStatus: (videoId: string) => ipcRenderer.invoke('download:get-status', videoId),
    cancelDownload: (videoId: string) => ipcRenderer.invoke('download:cancel', videoId),
    isDownloading: (videoId: string) => ipcRenderer.invoke('download:is-downloading', videoId),
    // Main settings
    readMainSettings: () => ipcRenderer.invoke('main-settings:read'),
    writeMainSettings: (settings: any) => ipcRenderer.invoke('main-settings:write', settings),
    getDefaultDownloadPath: () => ipcRenderer.invoke('main-settings:get-default-download-path'),
    // Downloaded videos
    getDownloadedVideos: () => ipcRenderer.invoke('downloaded-videos:get-all'),
    getDownloadedVideosBySource: (sourceId: string) => ipcRenderer.invoke('downloaded-videos:get-by-source', sourceId),
    // YouTube Cache
    getYouTubeCache: (cacheKey: string) => ipcRenderer.invoke('youtube-cache:get', cacheKey),
    setYouTubeCache: (cacheKey: string, data: any) => ipcRenderer.invoke('youtube-cache:set', cacheKey, data),
    clearExpiredYouTubeCache: () => ipcRenderer.invoke('youtube-cache:clear-expired'),
    loadYouTubeCacheConfig: () => ipcRenderer.invoke('youtube-cache:load-config'),
    // Download reset functionality
    resetDownloadStatus: (videoId: string) => ipcRenderer.invoke('download:reset-status', videoId),
    checkDownloadedVideo: (videoId: string) => ipcRenderer.invoke('download:check-downloaded', videoId),
    // Thumbnail update events
    onThumbnailReady: (callback: (data: { videoId: string; thumbnailUrl: string }) => void) => {
      const wrappedCallback = (_: any, data: { videoId: string; thumbnailUrl: string }) => callback(data);
      ipcRenderer.on('thumbnail-ready', wrappedCallback);
      return wrappedCallback; // Return wrapped callback for cleanup
    },
    offThumbnailReady: (wrappedCallback: any) => {
      ipcRenderer.off('thumbnail-ready', wrappedCallback);
    },
    // Get best available thumbnail for a video ID
    getBestThumbnail: (videoId: string) => ipcRenderer.invoke('get-best-thumbnail', videoId),
    // Navigation events for YouTube iframe links
    onNavigateToVideo: (callback: (videoId: string) => void) => {
      const wrappedCallback = (_: any, videoId: string) => callback(videoId);
      ipcRenderer.on('navigate-to-video', wrappedCallback);
      return wrappedCallback; // Return wrapped callback for cleanup
    },
    offNavigateToVideo: (wrappedCallback: any) => {
      ipcRenderer.off('navigate-to-video', wrappedCallback);
    },
    // Favorites management
    favoritesGetAll: () => ipcRenderer.invoke('favorites:get-all'),
    favoritesAdd: (videoId: string, source: string, type: 'youtube' | 'local' | 'dlna', title: string, thumbnail: string, duration: number, lastWatched?: string) =>
      ipcRenderer.invoke('favorites:add', { id: videoId, type, title, thumbnail, duration }),
    favoritesRemove: (videoId: string) => ipcRenderer.invoke('favorites:remove', videoId),
    favoritesIsFavorite: (videoId: string) => ipcRenderer.invoke('favorites:is-favorite', videoId),
    favoritesToggle: (videoId: string, source: string, type: 'youtube' | 'local' | 'dlna', title: string, thumbnail: string, duration: number, lastWatched?: string) =>
      ipcRenderer.invoke('favorites:toggle', videoId, source, type, title, thumbnail, duration, lastWatched),
    favoritesUpdateMetadata: (videoId: string, metadata: any) => ipcRenderer.invoke('favorites:update-metadata', videoId, metadata),
    favoritesGetBySource: (sourceId: string) => ipcRenderer.invoke('favorites:get-by-source', sourceId),
    favoritesGetConfig: () => ipcRenderer.invoke('favorites:get-config'),
    favoritesUpdateConfig: (config: any) => ipcRenderer.invoke('favorites:update-config', config),
    favoritesCleanupOrphaned: () => ipcRenderer.invoke('favorites:cleanup-orphaned'),
    favoritesSyncWatchHistory: () => ipcRenderer.invoke('favorites:sync-watch-history'),
    // App paths
    getCacheDir: () => ipcRenderer.invoke('app-paths:get-cache-dir'),
    getCachePath: (filename: string) => ipcRenderer.invoke('app-paths:get-cache-path', filename)
  }
);
