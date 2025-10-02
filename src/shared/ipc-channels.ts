/**
 * IPC Channel Constants - Single Source of Truth
 *
 * This file defines all IPC channel names used for communication between
 * main process, preload, and renderer processes.
 *
 * Benefits:
 * - Single source of truth for all IPC channels
 * - TypeScript autocomplete and type safety
 * - Refactoring safety - change channel name in one place
 * - Compile-time error detection for typos
 *
 * Usage:
 * - Main process: ipcMain.handle(IPC.FAVORITES.GET_ALL, ...)
 * - Preload: ipcRenderer.invoke(IPC.FAVORITES.GET_ALL)
 */

export const IPC = {
  // ============================================================================
  // DATABASE OPERATIONS
  // ============================================================================

  DATABASE: {
    HEALTH_CHECK: 'database:health-check',
    MIGRATE_PHASE1: 'database:migrate-phase1',
    VERIFY_MIGRATION: 'database:verify-migration',
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
    GET_COMPATIBLE_VIDEO_PATH: 'get-compatible-video-path',
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
  },

  // ============================================================================
  // DOWNLOADED VIDEOS
  // ============================================================================

  DOWNLOADED_VIDEOS: {
    GET_ALL: 'downloaded-videos:get-all',
    GET_BY_SOURCE: 'downloaded-videos:get-by-source',
  },

  // ============================================================================
  // YOUTUBE API
  // ============================================================================

  YOUTUBE: {
    GET_API_KEY: 'get-youtube-api-key',
    GET_VIDEO_INFO: 'get-youtube-video-info',
  },

  // ============================================================================
  // THUMBNAILS
  // ============================================================================

  THUMBNAILS: {
    GET_BEST_THUMBNAIL: 'get-best-thumbnail',
  },

  // ============================================================================
  // SETTINGS
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
  // TESTING
  // ============================================================================

  TEST: {
    TEST_HANDLER: 'test-handler',
  },
} as const;

/**
 * Type helper to extract all channel strings from the IPC object
 * Useful for validating that all channels are registered
 */
export type IPCChannel = typeof IPC[keyof typeof IPC][keyof typeof IPC[keyof typeof IPC]];

/**
 * Helper function to get all IPC channel strings as a flat array
 * Useful for testing and validation
 */
export function getAllIPCChannels(): string[] {
  const channels: string[] = [];

  for (const category of Object.values(IPC)) {
    for (const channel of Object.values(category)) {
      channels.push(channel);
    }
  }

  return channels;
}

/**
 * Helper function to validate if a string is a valid IPC channel
 */
export function isValidIPCChannel(channel: string): boolean {
  const allChannels = getAllIPCChannels();
  return allChannels.includes(channel);
}
