/**
 * Admin System Type Definitions
 *
 * This file contains all type definitions for the admin refactoring feature,
 * including interfaces for data access, authentication, state management, and feature flags.
 */

/**
 * Access mode for the admin interface
 * - 'electron': Local Electron app access via IPC
 * - 'http': Remote HTTP access via REST API
 */
export type AccessMode = 'electron' | 'http';

/**
 * Tab navigation types
 */
export type TabType = 'time' | 'sources' | 'main' | 'search' | 'wishlist';

/**
 * Authentication result returned from login attempts
 */
export interface AuthResult {
  success: boolean;
  error?: string;
  token?: string; // JWT token for HTTP mode sessions
}

/**
 * Time limits for each day of the week (in minutes)
 */
export interface TimeLimits {
  Monday: number;
  Tuesday: number;
  Wednesday: number;
  Thursday: number;
  Friday: number;
  Saturday: number;
  Sunday: number;
}

/**
 * Current time tracking state including usage, limits, and extra time
 */
export interface TimeTrackingState {
  timeUsedToday: number;      // seconds
  timeLimitToday: number;      // seconds
  timeRemaining: number;       // seconds (calculated: limit - used)
  isLimitReached: boolean;
  extraTimeToday?: number;     // minutes
}

/**
 * Main application settings
 */
export interface MainSettings {
  downloadPath?: string;
  youtubeApiKey?: string;
  adminPassword?: string;       // Only used for setting, never returned
  enableVerboseLogging?: boolean;
  allowYouTubeClicksToOtherVideos?: boolean;
  remoteAccessEnabled?: boolean;
}

/**
 * Feature flags that indicate which capabilities are available in current access mode
 */
export interface FeatureFlags {
  hasDatabase: boolean;           // Can access database features
  hasFileSystem: boolean;         // Can access file system
  hasAppRestart: boolean;         // Can trigger app restart
  canManageVideoSources: boolean; // Video sources tab visible
  canViewSearchHistory: boolean;  // Search history tab visible
  canModerateWishlist: boolean;   // Wishlist moderation tab visible
}

/**
 * Message displayed in the admin UI message banner
 */
export interface Message {
  id: string;
  text: string;
  type: 'success' | 'error' | 'warning';
  duration?: number; // milliseconds for auto-dismiss, undefined = manual dismiss only
}

/**
 * Global admin context value
 */
export interface AdminContextValue {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  messages: Message[];
  addMessage: (text: string, type: Message['type'], duration?: number) => void;
  clearMessages: () => void;
  removeMessage: (id: string) => void;
  features: FeatureFlags;
  accessMode: AccessMode;
}
