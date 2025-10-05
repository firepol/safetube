import { contextBridge, ipcRenderer } from 'electron';

// IPC Channel Constants - AUTO-GENERATED from src/shared/ipc-channels.ts
// DO NOT EDIT THIS SECTION MANUALLY - Run 'yarn sync-ipc' to update
const IPC = {
  // ============================================================================
  // DATABASE OPERATIONS
  // ============================================================================

  DATABASE: {
    HEALTH_CHECK: 'database:health-check',
  },

  // ============================================================================
  // FAVORITES (Database-backed)
  // ============================================================================

  FAVORITES: {
    GET_ALL: 'database:favorites:get-all',
    ADD: 'database:favorites:add',
    REMOVE: 'database:favorites:remove',
    IS_FAVORITE: 'database:favorites:is-favorite',
    TOGGLE: 'database:favorites:toggle',
  },

  // ============================================================================
  // VIEW RECORDS (Watch history & resume positions)
  // ============================================================================

  VIEW_RECORDS: {
    GET: 'database:view-records:get',
    UPDATE: 'database:view-records:update',
    GET_HISTORY: 'database:view-records:get-history',
    GET_RECENTLY_WATCHED: 'database:view-records:get-recently-watched',
  },

  // ============================================================================
  // VIDEOS (Database operations)
  // ============================================================================

  VIDEOS: {
    GET_BY_ID: 'database:videos:get-by-id',
    GET_BY_SOURCE: 'database:videos:get-by-source',
    SEARCH: 'database:videos:search',
    UPDATE_METADATA: 'database:videos:update-metadata',
    UPDATE_AVAILABILITY: 'database:videos:update-availability',
  },

  // ============================================================================
  // SOURCES (Video source management)
  // ============================================================================

  SOURCES: {
    GET_ALL: 'database:sources:get-all',
    GET_BY_ID: 'database:sources:get-by-id',
    CREATE: 'database:sources:create',
    UPDATE: 'database:sources:update',
    DELETE: 'database:sources:delete',
  },

  // ============================================================================
  // VIDEO SOURCES (Legacy - File-backed)
  // ============================================================================

  VIDEO_SOURCES: {
    GET_ALL: 'video-sources:get-all',
    SAVE_ALL: 'video-sources:save-all',
    VALIDATE_YOUTUBE_URL: 'video-sources:validate-youtube-url',
    VALIDATE_LOCAL_PATH: 'video-sources:validate-local-path',
  },

  // ============================================================================
  // YOUTUBE CACHE (Database-backed)
  // ============================================================================

  YOUTUBE_CACHE_DB: {
    GET_CACHED_RESULTS: 'database:youtube-cache:get-cached-results',
    SET_CACHED_RESULTS: 'database:youtube-cache:set-cached-results',
    CLEAR_CACHE: 'database:youtube-cache:clear-cache',
    GET_PAGE: 'youtube-cache:get-page',
    SAVE_PAGE: 'youtube-cache:save-page',
    CLEAR_SOURCE: 'youtube-cache:clear-source',
  },

  // ============================================================================
  // YOUTUBE CACHE (Legacy - File-backed)
  // ============================================================================

  YOUTUBE_CACHE: {
    GET: 'youtube-cache:get',
    SET: 'youtube-cache:set',
    CLEAR_EXPIRED: 'youtube-cache:clear-expired',
    LOAD_CONFIG: 'youtube-cache:load-config',
  },

  // ============================================================================
  // TIME TRACKING
  // ============================================================================

  TIME_TRACKING: {
    RECORD_VIDEO_WATCHING: 'time-tracking:record-video-watching',
    GET_TIME_TRACKING_STATE: 'time-tracking:get-time-tracking-state',
    GET_TIME_LIMITS: 'time-tracking:get-time-limits',
  },

  // ============================================================================
  // ADMIN / PARENT ACCESS
  // ============================================================================

  ADMIN: {
    AUTHENTICATE: 'admin:authenticate',
    CHANGE_PASSWORD: 'admin:change-password',
    HASH_PASSWORD: 'admin:hash-password',
    ADD_EXTRA_TIME: 'admin:add-extra-time',
    GET_TIME_EXTRA: 'admin:get-time-extra',
    WRITE_TIME_LIMITS: 'admin:write-time-limits',
    GET_LAST_WATCHED_VIDEO_WITH_SOURCE: 'admin:get-last-watched-video-with-source',
  },

  // ============================================================================
  // VIDEO LOADING & DATA
  // ============================================================================

  VIDEO_LOADING: {
    LOAD_ALL_VIDEOS_FROM_SOURCES: 'load-all-videos-from-sources',
    LOAD_VIDEOS_FROM_SOURCES: 'load-videos-from-sources',
    LOAD_SOURCES_FOR_KID_SCREEN: 'load-sources-for-kid-screen',
    LOAD_VIDEOS_FOR_SOURCE: 'load-videos-for-source',
    GET_VIDEO_DATA: 'get-video-data',
    GET_PAGINATED_VIDEOS: 'get-paginated-videos',
    GET_WATCHED_VIDEOS: 'get-watched-videos',
  },

  // ============================================================================
  // LOCAL FILE OPERATIONS
  // ============================================================================

  LOCAL_FILES: {
    GET_LOCAL_FILE: 'get-local-file',
    GET_LOCAL_FOLDER_CONTENTS: 'get-local-folder-contents',
    GET_LOCAL_SOURCE_VIDEO_COUNT: 'get-local-source-video-count',
    GET_FOLDER_VIDEO_COUNT: 'get-folder-video-count',
    GET_LOCAL_VIDEO_DURATION: 'get-local-video-duration',
  },

  // ============================================================================
  // DLNA OPERATIONS
  // ============================================================================

  DLNA: {
    GET_DLNA_FILE: 'get-dlna-file',
  },

  // ============================================================================
  // VIDEO PLAYBACK
  // ============================================================================

  PLAYBACK: {
    GET_VIDEO_STREAMS: 'get-video-streams',
    GET_PLAYER_CONFIG: 'get-player-config',
  },

  // ============================================================================
  // VIDEO CONVERSION & PROCESSING
  // ============================================================================

  CONVERSION: {
    GET_VIDEO_CODEC_INFO: 'get-video-codec-info',
    NEEDS_VIDEO_CONVERSION: 'needs-video-conversion',
    HAS_CONVERTED_VIDEO: 'has-converted-video',
    GET_EXISTING_CONVERTED_VIDEO_PATH: 'get-existing-converted-video-path',
    GET_CONVERSION_STATUS: 'get-conversion-status',
    START_VIDEO_CONVERSION: 'start-video-conversion',
  },

  // ============================================================================
  // DOWNLOADS
  // ============================================================================

  DOWNLOADS: {
    START: 'download:start',
    GET_STATUS: 'download:get-status',
    CANCEL: 'download:cancel',
    IS_DOWNLOADING: 'download:is-downloading',
    RESET_STATUS: 'download:reset-status',
    CHECK_DOWNLOADED: 'download:check-downloaded',
    CLEANUP: 'downloads:cleanup',
  },

  // ============================================================================
  // DOWNLOADED VIDEOS
  // ============================================================================

  DOWNLOADED_VIDEOS: {
    GET_ALL: 'downloaded-videos:get-all',
    GET_BY_SOURCE: 'downloaded-videos:get-by-source',
    GET_BY_ID: 'downloaded-videos:get-by-id',
    GET_TOTAL_SIZE: 'downloaded-videos:get-total-size',
  },

  // ============================================================================
  // YOUTUBE API
  // ============================================================================

  YOUTUBE: {
    GET_API_KEY: 'get-youtube-api-key',
    GET_VIDEO_INFO: 'get-youtube-video-info',
  },

  // ============================================================================
  // USAGE LOGS (Database-backed)
  // ============================================================================

  USAGE_LOGS: {
    GET_BY_DATE: 'database:usage-logs:get-by-date',
    UPSERT: 'database:usage-logs:upsert',
    INCREMENT: 'database:usage-logs:increment',
    GET_BY_DATE_RANGE: 'database:usage-logs:get-by-date-range',
    GET_MONTHLY: 'database:usage-logs:get-monthly',
  },

  // ============================================================================
  // TIME LIMITS (Database-backed)
  // ============================================================================

  TIME_LIMITS: {
    GET: 'database:time-limits:get',
    UPDATE: 'database:time-limits:update',
    GET_FOR_DAY: 'database:time-limits:get-for-day',
    UPDATE_DAY: 'database:time-limits:update-day',
  },

  // ============================================================================
  // USAGE EXTRAS (Database-backed)
  // ============================================================================

  USAGE_EXTRAS: {
    GET_BY_DATE: 'database:usage-extras:get-by-date',
    GET_TOTAL_MINUTES: 'database:usage-extras:get-total-minutes',
    ADD: 'database:usage-extras:add',
    DELETE: 'database:usage-extras:delete',
  },

  // ============================================================================
  // SETTINGS (Database-backed)
  // ============================================================================

  DB_SETTINGS: {
    GET_SETTING: 'database:settings:get-setting',
    SET_SETTING: 'database:settings:set-setting',
    GET_BY_NAMESPACE: 'database:settings:get-by-namespace',
    SET_BY_NAMESPACE: 'database:settings:set-by-namespace',
  },

  // ============================================================================
  // SETTINGS (Legacy - File-backed)
  // ============================================================================

  SETTINGS: {
    READ_MAIN_SETTINGS: 'main-settings:read',
    WRITE_MAIN_SETTINGS: 'main-settings:write',
    GET_DEFAULT_DOWNLOAD_PATH: 'main-settings:get-default-download-path',
    GET_SETUP_STATUS: 'get-setup-status',
  },

  // ============================================================================
  // LOGGING
  // ============================================================================

  LOGGING: {
    SET_VERBOSE: 'logging:set-verbose',
    GET_VERBOSE: 'logging:get-verbose',
    LOG: 'logging:log',
  },

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  CACHE: {
    CLEAR_SOURCE_CACHE: 'clear-source-cache',
  },

  // ============================================================================
  // UTILITIES
  // ============================================================================

  UTILS: {
    PATH_JOIN: 'path-join',
    GET_ENV_VAR: 'get-env-var',
  },

  // ============================================================================
  // SEARCH (Database and YouTube search)
  // ============================================================================

  SEARCH: {
    DATABASE: 'search:database',
    YOUTUBE: 'search:youtube',
    HISTORY_GET: 'search:history:get',
  },

  // ============================================================================
  // WISHLIST (Video approval workflow)
  // ============================================================================

  WISHLIST: {
    ADD: 'wishlist:add',
    REMOVE: 'wishlist:remove',
    GET_BY_STATUS: 'wishlist:get-by-status',
    APPROVE: 'wishlist:approve',
    DENY: 'wishlist:deny',
    BULK_APPROVE: 'wishlist:bulk-approve',
    BULK_DENY: 'wishlist:bulk-deny',
  },

  // ============================================================================
  // TESTING
  // ============================================================================

  TEST: {
    TEST_HANDLER: 'test-handler',
  },
} as const;

// Database response type
interface DatabaseResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

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
    // Generic invoke for DatabaseClient and other advanced usage
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    getLocalFile: (filePath: string) => ipcRenderer.invoke(IPC.LOCAL_FILES.GET_LOCAL_FILE, filePath),
    getDlnaFile: (server: string, port: number, path: string) =>
      ipcRenderer.invoke(IPC.DLNA.GET_DLNA_FILE, server, port, path),
    getVideoStreams: (videoId: string) => ipcRenderer.invoke(IPC.PLAYBACK.GET_VIDEO_STREAMS, videoId),
    recordVideoWatching: (videoId: string, position: number, timeWatched: number, duration?: number) =>
      ipcRenderer.invoke(IPC.TIME_TRACKING.RECORD_VIDEO_WATCHING, videoId, position, timeWatched, duration),
    getTimeTrackingState: () => ipcRenderer.invoke(IPC.TIME_TRACKING.GET_TIME_TRACKING_STATE),
    getTimeLimits: () => ipcRenderer.invoke(IPC.TIME_TRACKING.GET_TIME_LIMITS),
    getWatchedVideos: () => ipcRenderer.invoke(IPC.VIDEO_LOADING.GET_WATCHED_VIDEOS),
    getPlayerConfig: () => ipcRenderer.invoke(IPC.PLAYBACK.GET_PLAYER_CONFIG),
    getVideoData: (videoId: string, navigationContext?: any) => ipcRenderer.invoke(IPC.VIDEO_LOADING.GET_VIDEO_DATA, videoId, navigationContext),
    testHandler: () => ipcRenderer.invoke(IPC.TEST.TEST_HANDLER),
    // New IPC handler for loading videos from sources
    loadAllVideosFromSources: () => ipcRenderer.invoke(IPC.VIDEO_LOADING.LOAD_ALL_VIDEOS_FROM_SOURCES),
    // New IPC handler for loading videos from new source system
    loadVideosFromSources: () => ipcRenderer.invoke(IPC.VIDEO_LOADING.LOAD_VIDEOS_FROM_SOURCES),
    loadSourcesForKidScreen: () => ipcRenderer.invoke(IPC.VIDEO_LOADING.LOAD_SOURCES_FOR_KID_SCREEN),
    // New IPC handler for loading videos from a specific source
    loadVideosForSource: (sourceId: string) => ipcRenderer.invoke(IPC.VIDEO_LOADING.LOAD_VIDEOS_FOR_SOURCE, sourceId),
    // New IPC handler for getting YouTube API key
    getYouTubeApiKey: () => ipcRenderer.invoke(IPC.YOUTUBE.GET_API_KEY),
    // New IPC handler for getting YouTube video info (for source validation)
    getYouTubeVideoInfo: (videoId: string) => ipcRenderer.invoke(IPC.YOUTUBE.GET_VIDEO_INFO, videoId),
    // New IPC handler for getting paginated videos from a specific source
    getPaginatedVideos: (sourceId: string, pageNumber: number) =>
      ipcRenderer.invoke(IPC.VIDEO_LOADING.GET_PAGINATED_VIDEOS, sourceId, pageNumber),
    // New IPC handler for getting local folder contents for navigation
    getLocalFolderContents: (folderPath: string, maxDepth: number, currentDepth: number = 1) =>
      ipcRenderer.invoke(IPC.LOCAL_FILES.GET_LOCAL_FOLDER_CONTENTS, folderPath, maxDepth, currentDepth),
    // New IPC handler for getting video count for local sources (lazy counting)
    getLocalSourceVideoCount: (sourcePath: string, maxDepth: number) =>
      ipcRenderer.invoke(IPC.LOCAL_FILES.GET_LOCAL_SOURCE_VIDEO_COUNT, sourcePath, maxDepth),
    // New IPC handler for getting video count for a specific folder (for subfolder counts)
    getFolderVideoCount: (folderPath: string, maxDepth: number) =>
      ipcRenderer.invoke(IPC.LOCAL_FILES.GET_FOLDER_VIDEO_COUNT, folderPath, maxDepth),
    // New IPC handler for getting video duration for local videos (lazy duration extraction)
    getLocalVideoDuration: (videoPath: string) =>
      ipcRenderer.invoke(IPC.LOCAL_FILES.GET_LOCAL_VIDEO_DURATION, videoPath),
    // Admin IPC handlers
    adminAuthenticate: (password: string) => ipcRenderer.invoke(IPC.ADMIN.AUTHENTICATE, password),
    adminChangePassword: (currentPassword: string, newPassword: string) => ipcRenderer.invoke(IPC.ADMIN.CHANGE_PASSWORD, currentPassword, newPassword),
    adminHashPassword: (password: string) => ipcRenderer.invoke(IPC.ADMIN.HASH_PASSWORD, password),
    adminAddExtraTime: (minutes: number) => ipcRenderer.invoke(IPC.ADMIN.ADD_EXTRA_TIME, minutes),
    adminGetTimeExtra: () => ipcRenderer.invoke(IPC.ADMIN.GET_TIME_EXTRA),
    adminWriteTimeLimits: (timeLimits: any) => ipcRenderer.invoke(IPC.ADMIN.WRITE_TIME_LIMITS, timeLimits),
    adminGetLastWatchedVideoWithSource: () => ipcRenderer.invoke(IPC.ADMIN.GET_LAST_WATCHED_VIDEO_WITH_SOURCE),
    // Video source management
    videoSourcesGetAll: () => ipcRenderer.invoke(IPC.VIDEO_SOURCES.GET_ALL),
    videoSourcesSaveAll: (sources: any[]) => ipcRenderer.invoke(IPC.VIDEO_SOURCES.SAVE_ALL, sources),
    videoSourcesValidateYouTubeUrl: (url: string, type: 'youtube_channel' | 'youtube_playlist') =>
      ipcRenderer.invoke(IPC.VIDEO_SOURCES.VALIDATE_YOUTUBE_URL, url, type),
    videoSourcesValidateLocalPath: (path: string) =>
      ipcRenderer.invoke(IPC.VIDEO_SOURCES.VALIDATE_LOCAL_PATH, path),
    // Video codec detection and conversion
    getVideoCodecInfo: (filePath: string) => ipcRenderer.invoke(IPC.CONVERSION.GET_VIDEO_CODEC_INFO, filePath),
    needsVideoConversion: (filePath: string) => ipcRenderer.invoke(IPC.CONVERSION.NEEDS_VIDEO_CONVERSION, filePath),
    hasConvertedVideo: (filePath: string, cacheDir?: string) =>
      ipcRenderer.invoke(IPC.CONVERSION.HAS_CONVERTED_VIDEO, filePath, cacheDir),
    getExistingConvertedVideoPath: (filePath: string, cacheDir?: string) =>
      ipcRenderer.invoke(IPC.CONVERSION.GET_EXISTING_CONVERTED_VIDEO_PATH, filePath, cacheDir),
    getConversionStatus: (filePath: string) => ipcRenderer.invoke(IPC.CONVERSION.GET_CONVERSION_STATUS, filePath),
    startVideoConversion: (filePath: string, options?: any) =>
      ipcRenderer.invoke(IPC.CONVERSION.START_VIDEO_CONVERSION, filePath, options),
    // Setup status
    getSetupStatus: () => ipcRenderer.invoke(IPC.SETTINGS.GET_SETUP_STATUS),
    // Expose environment variables directly
    env: {
      ELECTRON_LOG_VERBOSE: process.env.ELECTRON_LOG_VERBOSE
    },
    // Logging configuration methods
    getVerboseLogging: () => ipcRenderer.invoke(IPC.LOGGING.GET_VERBOSE),
    // Logging methods
    log: (level: string, ...args: any[]) => ipcRenderer.invoke(IPC.LOGGING.LOG, level, ...args),
    // Clear source cache
    clearSourceCache: (sourceId: string) => ipcRenderer.invoke(IPC.CACHE.CLEAR_SOURCE_CACHE, sourceId),
    // Download management
    startDownload: (videoId: string, videoTitle: string, sourceInfo: any) =>
      ipcRenderer.invoke(IPC.DOWNLOADS.START, videoId, videoTitle, sourceInfo),
    getDownloadStatus: async (videoId: string) => {
      const response = await ipcRenderer.invoke(IPC.DOWNLOADS.GET_STATUS, videoId);
      return response.success ? response.data : null;
    },
    cancelDownload: (videoId: string) => ipcRenderer.invoke(IPC.DOWNLOADS.CANCEL, videoId),
    isDownloading: (videoId: string) => ipcRenderer.invoke(IPC.DOWNLOADS.IS_DOWNLOADING, videoId),
    // Main settings
    readMainSettings: () => ipcRenderer.invoke(IPC.SETTINGS.READ_MAIN_SETTINGS),
    writeMainSettings: (settings: any) => ipcRenderer.invoke(IPC.SETTINGS.WRITE_MAIN_SETTINGS, settings),
    getDefaultDownloadPath: () => ipcRenderer.invoke(IPC.SETTINGS.GET_DEFAULT_DOWNLOAD_PATH),
    // Downloaded videos
    getDownloadedVideos: async () => {
      const response = await ipcRenderer.invoke(IPC.DOWNLOADED_VIDEOS.GET_ALL);
      return response.success ? response.data : [];
    },
    getDownloadedVideosBySource: async (sourceId: string) => {
      const response = await ipcRenderer.invoke(IPC.DOWNLOADED_VIDEOS.GET_BY_SOURCE, sourceId);
      return response.success ? response.data : [];
    },
    // YouTube Cache
    getYouTubeCache: (cacheKey: string) => ipcRenderer.invoke(IPC.YOUTUBE_CACHE.GET, cacheKey),
    setYouTubeCache: (cacheKey: string, data: any) => ipcRenderer.invoke(IPC.YOUTUBE_CACHE.SET, cacheKey, data),
    clearExpiredYouTubeCache: () => ipcRenderer.invoke(IPC.YOUTUBE_CACHE.CLEAR_EXPIRED),
    loadYouTubeCacheConfig: () => ipcRenderer.invoke(IPC.YOUTUBE_CACHE.LOAD_CONFIG),
    // Download reset functionality
    resetDownloadStatus: (videoId: string) => ipcRenderer.invoke(IPC.DOWNLOADS.RESET_STATUS, videoId),
    checkDownloadedVideo: (videoId: string) => ipcRenderer.invoke(IPC.DOWNLOADS.CHECK_DOWNLOADED, videoId),
    // Thumbnail update events
    onThumbnailReady: (callback: (data: { videoId: string; thumbnailUrl: string }) => void) => {
      const wrappedCallback = (_: any, data: { videoId: string; thumbnailUrl: string }) => callback(data);
      ipcRenderer.on('thumbnail-ready', wrappedCallback);
      return wrappedCallback; // Return wrapped callback for cleanup
    },
    offThumbnailReady: (wrappedCallback: any) => {
      ipcRenderer.off('thumbnail-ready', wrappedCallback);
    },
    // Navigation events for YouTube iframe links
    onNavigateToVideo: (callback: (data: { videoId: string; videoMetadata?: any }) => void) => {
      const wrappedCallback = (_: any, data: any) => {
        // Handle both old format (just videoId string) and new format (object with videoId and videoMetadata)
        if (typeof data === 'string') {
          callback({ videoId: data });
        } else {
          callback(data);
        }
      };
      ipcRenderer.on('navigate-to-video', wrappedCallback);
      return wrappedCallback; // Return wrapped callback for cleanup
    },
    offNavigateToVideo: (wrappedCallback: any) => {
      ipcRenderer.off('navigate-to-video', wrappedCallback);
    },
    // Validation error events
    onShowChannelNotApprovedError: (callback: (data: { videoId: string; channelId: string; title: string }) => void) => {
      const wrappedCallback = (_: any, data: { videoId: string; channelId: string; title: string }) => callback(data);
      ipcRenderer.on('show-channel-not-approved-error', wrappedCallback);
      return wrappedCallback;
    },
    offShowChannelNotApprovedError: (wrappedCallback: any) => {
      ipcRenderer.off('show-channel-not-approved-error', wrappedCallback);
    },
    onShowValidationError: (callback: (data: { message: string }) => void) => {
      const wrappedCallback = (_: any, data: { message: string }) => callback(data);
      ipcRenderer.on('show-validation-error', wrappedCallback);
      return wrappedCallback;
    },
    offShowValidationError: (wrappedCallback: any) => {
      ipcRenderer.off('show-validation-error', wrappedCallback);
    },
    // Favorites management
    favoritesGetAll: (): Promise<DatabaseResponse<any[]>> => ipcRenderer.invoke(IPC.FAVORITES.GET_ALL),
    favoritesAdd: (videoId: string, sourceId: string, type: 'youtube' | 'local' | 'dlna' | 'downloaded', title: string, thumbnail: string, duration: number, lastWatched?: string): Promise<DatabaseResponse<boolean>> =>
      ipcRenderer.invoke(IPC.FAVORITES.ADD, videoId, sourceId),
    favoritesRemove: (videoId: string): Promise<DatabaseResponse<boolean>> => ipcRenderer.invoke(IPC.FAVORITES.REMOVE, videoId),
    favoritesIsFavorite: (videoId: string): Promise<DatabaseResponse<boolean>> => ipcRenderer.invoke(IPC.FAVORITES.IS_FAVORITE, videoId),
    favoritesToggle: (videoId: string, sourceId: string, type: 'youtube' | 'local' | 'dlna' | 'downloaded', title: string, thumbnail: string, duration: number, lastWatched?: string): Promise<DatabaseResponse<{ isFavorite: boolean }>> =>
      ipcRenderer.invoke(IPC.FAVORITES.TOGGLE, videoId, sourceId),
    // Path utilities for cross-platform compatibility
    pathJoin: (...paths: string[]) => ipcRenderer.invoke(IPC.UTILS.PATH_JOIN, ...paths),

    // Search handlers
    searchDatabase: (query: string) => ipcRenderer.invoke(IPC.SEARCH.DATABASE, query),
    searchYouTube: (query: string) => ipcRenderer.invoke(IPC.SEARCH.YOUTUBE, query),
    getSearchHistory: (limit?: number) => ipcRenderer.invoke(IPC.SEARCH.HISTORY_GET, limit),
    getCachedSearchResults: (query: string, searchType: 'database' | 'youtube') => 
      ipcRenderer.invoke(IPC.SEARCH.CACHED_RESULTS_GET, query, searchType),

    // Wishlist handlers
    wishlistAdd: (video: any) => ipcRenderer.invoke(IPC.WISHLIST.ADD, video),
    wishlistRemove: (videoId: string) => ipcRenderer.invoke(IPC.WISHLIST.REMOVE, videoId),
    wishlistGetByStatus: (status: 'pending' | 'approved' | 'denied') =>
      ipcRenderer.invoke(IPC.WISHLIST.GET_BY_STATUS, status),
    wishlistApprove: (videoId: string) => ipcRenderer.invoke(IPC.WISHLIST.APPROVE, videoId),
    wishlistDeny: (videoId: string, reason?: string) =>
      ipcRenderer.invoke(IPC.WISHLIST.DENY, videoId, reason),
    wishlistBulkApprove: (videoIds: string[]) => ipcRenderer.invoke(IPC.WISHLIST.BULK_APPROVE, videoIds),
    wishlistBulkDeny: (videoIds: string[], reason?: string) =>
      ipcRenderer.invoke(IPC.WISHLIST.BULK_DENY, videoIds, reason),

    // Wishlist events
    onWishlistUpdated: (callback: () => void) => {
      const wrappedCallback = () => callback();
      ipcRenderer.on('wishlist:updated', wrappedCallback);
      return wrappedCallback;
    },
    offWishlistUpdated: (wrappedCallback: any) => {
      ipcRenderer.off('wishlist:updated', wrappedCallback);
    }
  }
);
