/**
 * Admin Data Access Abstraction Layer
 *
 * This module provides an abstraction layer that decouples admin components
 * from the underlying data access mechanism (IPC vs HTTP). Components use the
 * IAdminDataAccess interface without knowing which implementation is active.
 */

import {
  AccessMode,
  AuthResult,
  TimeLimits,
  TimeTrackingState,
  MainSettings,
  FeatureFlags,
} from '@/renderer/hooks/admin/types';
import { VideoSource, Search, SearchResult, SearchType } from '@/shared/types';

/**
 * Core data access interface that abstracts IPC vs HTTP differences.
 * Components use this interface without knowing the underlying transport.
 */
export interface IAdminDataAccess {
  /**
   * Get the access mode for feature detection
   */
  getAccessMode(): AccessMode;

  /**
   * Get feature flags for conditional rendering
   */
  getFeatureFlags(): FeatureFlags;

  /**
   * Authenticate admin user
   * @param password - Admin password
   * @returns Authentication result with token for HTTP mode
   */
  authenticate(password: string): Promise<AuthResult>;

  /**
   * Get time limits for all days of the week
   */
  getTimeLimits(): Promise<TimeLimits>;

  /**
   * Update time limits for all days
   */
  setTimeLimits(limits: TimeLimits): Promise<void>;

  /**
   * Get current time tracking state for today
   */
  getTimeState(): Promise<TimeTrackingState>;

  /**
   * Add extra time to today's limit (can be negative to subtract)
   * @param minutes - Number of minutes to add/subtract
   */
  addExtraTime(minutes: number): Promise<void>;

  /**
   * Get main settings (password hash excluded)
   */
  getMainSettings(): Promise<MainSettings>;

  /**
   * Update main settings
   * @param settings - Settings to update
   */
  setMainSettings(settings: MainSettings): Promise<void>;

  /**
   * Get default download path (IPC only)
   * @throws Error in HTTP mode
   */
  getDefaultDownloadPath(): Promise<string>;

  /**
   * Hash a password (needed when changing admin password)
   * @param password - Plain text password
   * @returns Hashed password
   */
  hashPassword(password: string): Promise<string>;

  /**
   * Get network info for remote access display
   */
  getNetworkInfo(): Promise<{ url: string } | null>;

  /**
   * Get last watched video info for smart exit (IPC only)
   * @throws Error in HTTP mode
   */
  getLastWatchedVideoWithSource(): Promise<any>;

  /**
   * Get all video sources
   */
  getVideoSources(): Promise<VideoSource[]>;

  /**
   * Save all video sources
   * @param sources - Array of video sources to save
   */
  saveVideoSources(sources: VideoSource[]): Promise<void>;

  /**
   * Validate a YouTube URL and fetch metadata
   * @param url - YouTube channel or playlist URL
   * @param type - Type of YouTube source (youtube_channel or youtube_playlist)
   * @returns Validation result with title, channelId, and cleaned URL if valid
   */
  validateYouTubeUrl(
    url: string,
    type: 'youtube_channel' | 'youtube_playlist'
  ): Promise<{ isValid: boolean; errors?: string[]; title?: string; channelId?: string; cleanedUrl?: string }>;

  /**
   * Validate a local folder path
   * @param path - Folder path to validate
   * @returns Validation result
   */
  validateLocalPath(path: string): Promise<{ isValid: boolean; errors?: string[] }>;

  /**
   * Get search history
   * @param limit - Maximum number of searches to return
   * @returns Array of search history entries
   */
  getSearchHistory(limit: number): Promise<Search[]>;

  /**
   * Get cached search results for a specific search
   * @param query - Search query string
   * @param searchType - Type of search (youtube or database)
   * @returns Array of cached search results
   */
  getCachedSearchResults(query: string, searchType: SearchType): Promise<SearchResult[]>;

  /**
   * Get wishlist items by status
   * @param status - Wishlist status filter ('pending' | 'approved' | 'denied')
   * @returns Array of wishlist items with the specified status
   */
  getWishlistByStatus(status: 'pending' | 'approved' | 'denied'): Promise<any[]>;

  /**
   * Approve a wishlist item
   * @param videoId - ID of the video to approve
   */
  approveWishlistItem(videoId: string): Promise<void>;

  /**
   * Deny a wishlist item
   * @param videoId - ID of the video to deny
   * @param reason - Optional reason for denial
   */
  denyWishlistItem(videoId: string, reason?: string): Promise<void>;

  /**
   * Bulk approve wishlist items
   * @param videoIds - IDs of videos to approve
   */
  bulkApproveWishlist(videoIds: string[]): Promise<void>;

  /**
   * Bulk deny wishlist items
   * @param videoIds - IDs of videos to deny
   * @param reason - Optional reason for denials
   */
  bulkDenyWishlist(videoIds: string[], reason?: string): Promise<void>;
}

/**
 * IPC-based admin data access for Electron mode
 * Uses window.electron.* API calls to communicate with the main process
 */
export class IPCAdminDataAccess implements IAdminDataAccess {
  getAccessMode(): AccessMode {
    return 'electron';
  }

  getFeatureFlags(): FeatureFlags {
    return {
      hasDatabase: true,
      hasFileSystem: true,
      hasAppRestart: true,
      canManageVideoSources: true,
      canViewSearchHistory: true,
      canModerateWishlist: true,
    };
  }

  async authenticate(password: string): Promise<AuthResult> {
    try {
      const result = await window.electron.adminAuthenticate(password);
      return {
        success: result.success,
        error: result.success ? undefined : 'Invalid password',
      };
    } catch (error) {
      console.error('[IPCAdminDataAccess] Authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed',
      };
    }
  }

  async getTimeLimits(): Promise<TimeLimits> {
    return await window.electron.getTimeLimits();
  }

  async setTimeLimits(limits: TimeLimits): Promise<void> {
    await window.electron.adminWriteTimeLimits(limits);
  }

  async getTimeState(): Promise<TimeTrackingState> {
    return await window.electron.getTimeTrackingState();
  }

  async addExtraTime(minutes: number): Promise<void> {
    await window.electron.adminAddExtraTime(minutes);
  }

  async getMainSettings(): Promise<MainSettings> {
    const settings = await window.electron.readMainSettings();
    // Remove password hash from returned settings
    return {
      ...settings,
      adminPassword: undefined,
    };
  }

  async setMainSettings(settings: MainSettings): Promise<void> {
    const result = await window.electron.writeMainSettings(settings);
    if (!result.success) {
      throw new Error(result.error || 'Failed to save settings');
    }
  }

  async getDefaultDownloadPath(): Promise<string> {
    return await window.electron.getDefaultDownloadPath();
  }

  async hashPassword(password: string): Promise<string> {
    const result = await window.electron.adminHashPassword(password);
    if (!result.success) {
      throw new Error(result.error || 'Failed to hash password');
    }
    return result.hashedPassword!;
  }

  async getNetworkInfo(): Promise<{ url: string } | null> {
    try {
      return await window.electron.invoke('server:get-network-info');
    } catch (error) {
      console.warn('[IPCAdminDataAccess] Failed to get network info:', error);
      return null;
    }
  }

  async getLastWatchedVideoWithSource(): Promise<any> {
    return await window.electron.adminGetLastWatchedVideoWithSource();
  }

  async getVideoSources(): Promise<VideoSource[]> {
    return await window.electron.videoSourcesGetAll();
  }

  async saveVideoSources(sources: VideoSource[]): Promise<void> {
    await window.electron.videoSourcesSaveAll(sources);
  }

  async validateYouTubeUrl(
    url: string,
    type: 'youtube_channel' | 'youtube_playlist'
  ): Promise<{ isValid: boolean; errors?: string[]; title?: string; channelId?: string; cleanedUrl?: string }> {
    return await window.electron.videoSourcesValidateYouTubeUrl(url, type);
  }

  async validateLocalPath(path: string): Promise<{ isValid: boolean; errors?: string[] }> {
    return await window.electron.videoSourcesValidateLocalPath(path);
  }

  async getSearchHistory(limit: number): Promise<Search[]> {
    const response = await window.electron.getSearchHistory(limit);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to get search history');
  }

  async getCachedSearchResults(query: string, searchType: SearchType): Promise<SearchResult[]> {
    const response = await window.electron.getCachedSearchResults(query, searchType);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to get cached search results');
  }


  async getWishlistByStatus(status: 'pending' | 'approved' | 'denied'): Promise<any[]> {
    const response = await window.electron.wishlistGetByStatus(status);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to get wishlist items');
  }

  async approveWishlistItem(videoId: string): Promise<void> {
    const response = await window.electron.wishlistApprove(videoId);
    if (!response.success) {
      throw new Error(response.error || 'Failed to approve wishlist item');
    }
  }

  async denyWishlistItem(videoId: string, reason?: string): Promise<void> {
    const response = await window.electron.wishlistDeny(videoId, reason);
    if (!response.success) {
      throw new Error(response.error || 'Failed to deny wishlist item');
    }
  }

  async bulkApproveWishlist(videoIds: string[]): Promise<void> {
    const response = await window.electron.wishlistBulkApprove(videoIds);
    if (!response.success || (response.failed && response.failed.length > 0)) {
      throw new Error('Failed to bulk approve some or all wishlist items');
    }
  }

  async bulkDenyWishlist(videoIds: string[], reason?: string): Promise<void> {
    const response = await window.electron.wishlistBulkDeny(videoIds, reason);
    if (!response.success || (response.failed && response.failed.length > 0)) {
      throw new Error('Failed to bulk deny some or all wishlist items');
    }
  }
}

/**
 * HTTP-based admin data access for remote mode
 * Uses REST API calls to communicate with the server
 */
export class HTTPAdminDataAccess implements IAdminDataAccess {
  private authToken: string | null = null;

  getAccessMode(): AccessMode {
    return 'http';
  }

  getFeatureFlags(): FeatureFlags {
    return {
      hasDatabase: true,
      hasFileSystem: false,
      hasAppRestart: false,
      canManageVideoSources: true,
      canViewSearchHistory: true,
      canModerateWishlist: true,
    };
  }

  async authenticate(password: string): Promise<AuthResult> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: 'Invalid password',
        };
      }

      const data = await response.json();
      this.authToken = data.token;
      return {
        success: true,
        token: data.token,
      };
    } catch (error) {
      console.error('[HTTPAdminDataAccess] Authentication error:', error);
      return {
        success: false,
        error: 'Connection failed',
      };
    }
  }

  async getTimeLimits(): Promise<TimeLimits> {
    const response = await fetch('/api/time-limits');
    if (!response.ok) throw new Error('Failed to get time limits');
    return await response.json();
  }

  async setTimeLimits(limits: TimeLimits): Promise<void> {
    const response = await fetch('/api/time-limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(limits),
    });
    if (!response.ok) throw new Error('Failed to save time limits');
  }

  async getTimeState(): Promise<TimeTrackingState> {
    const response = await fetch('/api/usage-stats');
    if (!response.ok) throw new Error('Failed to get time state');
    const data = await response.json();

    // Transform API response to TimeTrackingState format
    return {
      timeUsedToday: data.totalTime,
      timeLimitToday: data.timeLimit * 60, // Convert minutes to seconds
      timeRemaining: data.timeRemaining,
      isLimitReached: data.isTimeLimit,
      extraTimeToday: data.extraTime || 0,
    };
  }

  async addExtraTime(minutes: number): Promise<void> {
    const response = await fetch('/api/extra-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes }),
    });
    if (!response.ok) throw new Error('Failed to add extra time');
  }

  async getMainSettings(): Promise<MainSettings> {
    const response = await fetch('/api/settings');
    if (!response.ok) throw new Error('Failed to get settings');
    return await response.json();
  }

  async setMainSettings(settings: MainSettings): Promise<void> {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) throw new Error('Failed to save settings');
  }

  async getDefaultDownloadPath(): Promise<string> {
    throw new Error('File system access not available in HTTP mode');
  }

  async hashPassword(password: string): Promise<string> {
    const response = await fetch('/api/admin/hash-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) throw new Error('Failed to hash password');
    const data = await response.json();
    return data.hashedPassword;
  }

  async getNetworkInfo(): Promise<{ url: string } | null> {
    // In HTTP mode, we can derive this from window.location
    return {
      url: window.location.origin,
    };
  }

  async getLastWatchedVideoWithSource(): Promise<any> {
    throw new Error('Smart exit not available in HTTP mode');
  }

  async getVideoSources(): Promise<VideoSource[]> {
    const response = await fetch('/api/video-sources');
    if (!response.ok) throw new Error('Failed to get video sources');
    return await response.json();
  }

  async saveVideoSources(sources: VideoSource[]): Promise<void> {
    const response = await fetch('/api/video-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sources),
    });
    if (!response.ok) throw new Error('Failed to save video sources');
  }

  async validateYouTubeUrl(
    url: string,
    type: 'youtube_channel' | 'youtube_playlist'
  ): Promise<{ isValid: boolean; errors?: string[]; title?: string; channelId?: string; cleanedUrl?: string }> {
    const response = await fetch('/api/validate/youtube-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, type }),
    });
    if (!response.ok) {
      const error = await response.json();
      return { isValid: false, errors: [error.error || 'Failed to validate YouTube URL'] };
    }
    return await response.json();
  }

  async validateLocalPath(path: string): Promise<{ isValid: boolean; errors?: string[] }> {
    const response = await fetch('/api/validate/local-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!response.ok) {
      const error = await response.json();
      return { isValid: false, errors: [error.error || 'Failed to validate local path'] };
    }
    return await response.json();
  }

  async getSearchHistory(limit: number): Promise<Search[]> {
    const response = await fetch(`/api/search-history?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to get search history');
    return await response.json();
  }

  async getCachedSearchResults(query: string, searchType: SearchType): Promise<SearchResult[]> {
    const response = await fetch('/api/search-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, searchType }),
    });
    if (!response.ok) throw new Error('Failed to get cached search results');
    return await response.json();
  }


  async getWishlistByStatus(status: 'pending' | 'approved' | 'denied'): Promise<any[]> {
    const response = await fetch(`/api/wishlist?status=${status}`);
    if (!response.ok) throw new Error('Failed to get wishlist items');
    return await response.json();
  }

  async approveWishlistItem(videoId: string): Promise<void> {
    const response = await fetch(`/api/wishlist/${videoId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to approve wishlist item');
  }

  async denyWishlistItem(videoId: string, reason?: string): Promise<void> {
    const response = await fetch(`/api/wishlist/${videoId}/deny`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) throw new Error('Failed to deny wishlist item');
  }

  async bulkApproveWishlist(videoIds: string[]): Promise<void> {
    const response = await fetch('/api/wishlist/bulk/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds }),
    });
    if (!response.ok) throw new Error('Failed to bulk approve wishlist items');
  }

  async bulkDenyWishlist(videoIds: string[], reason?: string): Promise<void> {
    const response = await fetch('/api/wishlist/bulk/deny', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds, reason }),
    });
    if (!response.ok) throw new Error('Failed to bulk deny wishlist items');
  }
}

/**
 * Factory function to create the appropriate data access implementation
 * Detects access mode by checking for window.electron availability
 */
export function createAdminDataAccess(): IAdminDataAccess {
  // Detect access mode by checking for window.electron
  if (typeof window !== 'undefined' && window.electron) {
    return new IPCAdminDataAccess();
  } else {
    return new HTTPAdminDataAccess();
  }
}
