# Design Document

## Overview

This document provides the complete technical blueprint for refactoring SafeTube's admin interface from two separate implementations (AdminPage.tsx for Electron IPC access and parentAccessPage.html for HTTP access) into a unified React component system with an abstraction layer that transparently handles both access modes.

The refactoring achieves:
- **Code Deduplication**: Eliminate 600+ lines of duplicated logic
- **Unified UI**: Single React component tree for both access modes
- **Maintainability**: Changes propagate automatically to both modes
- **Feature Parity**: Core features work identically in both modes
- **Graceful Degradation**: Database-dependent features hidden in HTTP mode

## Architecture Overview

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         AdminApp (Root)                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              AdminContext (Global State)                   │ │
│  │  - activeTab, messages, features, accessMode               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      AuthGate                              │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │              LoginForm                               │  │ │
│  │  │  → useAdminAuth hook                                 │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   AdminLayout                              │ │
│  │  ┌──────────────┐  ┌───────────────────────────────────┐  │ │
│  │  │ AdminHeader  │  │      TabNavigation                │  │ │
│  │  └──────────────┘  │  - Time Management               │  │ │
│  │  ┌──────────────┐  │  - Video Sources (IPC only)     │  │ │
│  │  │MessageBanner │  │  - Main Settings                 │  │ │
│  │  └──────────────┘  │  - Search History (IPC only)    │  │ │
│  │                    │  - Wishlist Mod (IPC only)       │  │ │
│  │                    └───────────────────────────────────┘  │ │
│  │                                                            │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │              Tab Content Area                      │  │ │
│  │  │  ┌──────────────────────────────────────────────┐  │  │ │
│  │  │  │  TimeManagementTab                           │  │  │ │
│  │  │  │  - QuickTimeExtension                        │  │  │ │
│  │  │  │  - DailyTimeLimitsForm                       │  │  │ │
│  │  │  └──────────────────────────────────────────────┘  │  │ │
│  │  │  ┌──────────────────────────────────────────────┐  │  │ │
│  │  │  │  MainSettingsTab                             │  │  │ │
│  │  │  │  - Settings forms (non-DB settings)          │  │  │ │
│  │  │  └──────────────────────────────────────────────┘  │  │ │
│  │  │  ┌──────────────────────────────────────────────┐  │  │ │
│  │  │  │  VideoSourcesTab (IPC only)                  │  │  │ │
│  │  │  │  - Read-only in HTTP mode                    │  │  │ │
│  │  │  └──────────────────────────────────────────────┘  │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Data Access
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  IAdminDataAccess Interface                      │
│  - authenticate(), getTimeLimits(), setTimeLimits()             │
│  - getTimeState(), addExtraTime(), getMainSettings()            │
│  - setMainSettings(), getFeatureFlags()                         │
└─────────────────────────────────────────────────────────────────┘
                   │                            │
        ┌──────────┴──────────┐    ┌───────────┴────────────┐
        │ IPCAdminDataAccess  │    │ HTTPAdminDataAccess    │
        │ (Electron Mode)     │    │ (Remote HTTP Mode)     │
        │                     │    │                        │
        │ window.electron.*   │    │ fetch('/api/*')        │
        └─────────────────────┘    └────────────────────────┘
                   │                            │
                   ▼                            ▼
        ┌─────────────────────┐    ┌────────────────────────┐
        │   IPC Handlers      │    │   HTTP API Endpoints   │
        │   (Main Process)    │    │   (Main Process)       │
        └─────────────────────┘    └────────────────────────┘
```

### Component Hierarchy Tree

```
AdminApp
├── AdminContextProvider
│   ├── accessMode: 'electron' | 'http'
│   ├── activeTab: TabType
│   ├── messages: Message[]
│   └── features: FeatureFlags
│
├── AuthGate
│   ├── LoginForm
│   │   ├── Input (password)
│   │   ├── Button (submit)
│   │   └── ErrorMessage
│   └── useAdminAuth()
│
└── AdminLayout (after auth)
    ├── AdminHeader
    │   ├── Title
    │   └── ExitButton (IPC only)
    │
    ├── MessageBanner
    │   └── Message[] (success/error)
    │
    ├── TabNavigation
    │   ├── TabButton (Time Management) - always visible
    │   ├── TabButton (Video Sources) - IPC only
    │   ├── TabButton (Main Settings) - always visible
    │   ├── TabButton (Search History) - IPC only
    │   └── TabButton (Wishlist Moderation) - IPC only
    │
    └── TabContentArea
        ├── TimeManagementTab
        │   ├── QuickTimeExtension
        │   │   ├── ExtraTimeInput
        │   │   ├── TimeStateDisplay (current)
        │   │   ├── TimeStateDisplay (projected)
        │   │   └── ApplyButton
        │   └── DailyTimeLimitsForm
        │       ├── DayInput[] (7 days)
        │       └── SaveButton
        │
        ├── MainSettingsTab
        │   ├── DownloadPathField (IPC only - file picker)
        │   ├── YouTubeAPIKeyField
        │   ├── AdminPasswordField
        │   ├── VerboseLoggingToggle
        │   ├── YouTubeClicksToggle
        │   ├── RemoteAccessToggle
        │   ├── NetworkInfoDisplay (if enabled)
        │   └── SaveButton
        │
        ├── VideoSourcesTab (IPC only)
        │   └── VideoSourcesManager (existing component, read-only in HTTP)
        │
        ├── SearchHistoryTab (IPC only)
        │   └── SearchHistoryTab (existing component)
        │
        └── WishlistModerationTab (IPC only)
            └── WishlistModerationTab (existing component)
```

### Access Mode Detection and Routing

**IPC Mode (Electron - Local Access)**:
- Route: `/admin`
- Detection: `window.electron` API is available
- Features: Full access to all tabs, database operations, file system
- Navigation: Can use "Back to last video" smart exit

**HTTP Mode (Remote Access)**:
- Route: `/parent-access` (serves React bundle instead of current HTML)
- Detection: `window.electron` is undefined
- Features: Core time management and main settings only
- Limitations: No database-dependent tabs, no file picker, no app restart

## Data Access Abstraction Layer

### IAdminDataAccess Interface

The core abstraction that decouples components from data source implementation.

```typescript
// src/renderer/services/AdminDataAccess.ts

export type AccessMode = 'electron' | 'http';

export interface AuthResult {
  success: boolean;
  error?: string;
  token?: string; // Only used in HTTP mode
}

export interface TimeLimits {
  Monday: number;
  Tuesday: number;
  Wednesday: number;
  Thursday: number;
  Friday: number;
  Saturday: number;
  Sunday: number;
}

export interface TimeTrackingState {
  timeUsedToday: number;      // seconds
  timeLimitToday: number;      // seconds
  timeRemaining: number;       // seconds
  isLimitReached: boolean;
  extraTimeToday?: number;     // minutes
}

export interface MainSettings {
  downloadPath?: string;
  youtubeApiKey?: string;
  adminPassword?: string;       // Only for setting, never returned
  enableVerboseLogging?: boolean;
  allowYouTubeClicksToOtherVideos?: boolean;
  remoteAccessEnabled?: boolean;
}

export interface FeatureFlags {
  hasDatabase: boolean;
  hasFileSystem: boolean;
  hasAppRestart: boolean;
  canManageVideoSources: boolean;
  canViewSearchHistory: boolean;
  canModerateWishlist: boolean;
}

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
}
```

### IPCAdminDataAccess Implementation

Implementation for Electron IPC mode using existing `window.electron` API.

```typescript
// src/renderer/services/AdminDataAccess.ts (continued)

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
    } catch {
      return null;
    }
  }

  async getLastWatchedVideoWithSource(): Promise<any> {
    return await window.electron.adminGetLastWatchedVideoWithSource();
  }
}
```

### HTTPAdminDataAccess Implementation

Implementation for HTTP mode using REST API fetch calls.

```typescript
// src/renderer/services/AdminDataAccess.ts (continued)

export class HTTPAdminDataAccess implements IAdminDataAccess {
  private authToken: string | null = null;

  getAccessMode(): AccessMode {
    return 'http';
  }

  getFeatureFlags(): FeatureFlags {
    return {
      hasDatabase: false,
      hasFileSystem: false,
      hasAppRestart: false,
      canManageVideoSources: false,
      canViewSearchHistory: false,
      canModerateWishlist: false,
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
}

/**
 * Factory function to create the appropriate data access implementation
 */
export function createAdminDataAccess(): IAdminDataAccess {
  // Detect access mode by checking for window.electron
  if (typeof window !== 'undefined' && window.electron) {
    return new IPCAdminDataAccess();
  } else {
    return new HTTPAdminDataAccess();
  }
}
```

## Custom Hooks Design

Custom hooks encapsulate data access logic and provide clean APIs to components.

### useAdminDataAccess Hook

Context hook that provides the data access instance to all components.

```typescript
// src/renderer/hooks/admin/useAdminDataAccess.ts

import { createContext, useContext } from 'react';
import { IAdminDataAccess } from '@/renderer/services/AdminDataAccess';

const AdminDataAccessContext = createContext<IAdminDataAccess | undefined>(undefined);

export const AdminDataAccessProvider = AdminDataAccessContext.Provider;

export function useAdminDataAccess(): IAdminDataAccess {
  const context = useContext(AdminDataAccessContext);
  if (!context) {
    throw new Error('useAdminDataAccess must be used within AdminDataAccessProvider');
  }
  return context;
}
```

### useAdminAuth Hook

Manages authentication state and login/logout flows.

```typescript
// src/renderer/hooks/admin/useAdminAuth.ts

export function useAdminAuth() {
  const dataAccess = useAdminDataAccess();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await dataAccess.authenticate(password);
      if (result.success) {
        setIsAuthenticated(true);
        return true;
      } else {
        setError(result.error || 'Authentication failed');
        return false;
      }
    } catch (err) {
      setError('Connection error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  return { isAuthenticated, isLoading, error, login, logout };
}
```

### useTimeLimits Hook

CRUD operations for time limits.

```typescript
// src/renderer/hooks/admin/useTimeLimits.ts

export function useTimeLimits() {
  const dataAccess = useAdminDataAccess();
  const [timeLimits, setTimeLimits] = useState<TimeLimits | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const limits = await dataAccess.getTimeLimits();
      setTimeLimits(limits);
      setError(null);
    } catch (err) {
      setError('Failed to load time limits');
    } finally {
      setIsLoading(false);
    }
  };

  const save = async (limits: TimeLimits) => {
    setIsLoading(true);
    try {
      await dataAccess.setTimeLimits(limits);
      setTimeLimits(limits);
      setError(null);
      return true;
    } catch (err) {
      setError('Failed to save time limits');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const update = (day: keyof TimeLimits, value: number) => {
    if (!timeLimits) return;
    setTimeLimits({
      ...timeLimits,
      [day]: Math.max(0, Math.min(1440, value)),
    });
  };

  return { timeLimits, isLoading, error, load, save, update };
}
```

### useTimeTracking Hook

Fetches and manages current/projected time state.

```typescript
// src/renderer/hooks/admin/useTimeTracking.ts

export function useTimeTracking() {
  const dataAccess = useAdminDataAccess();
  const [currentState, setCurrentState] = useState<TimeTrackingState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const state = await dataAccess.getTimeState();
      setCurrentState(state);
    } finally {
      setIsLoading(false);
    }
  };

  const addExtraTime = async (minutes: number) => {
    setIsLoading(true);
    try {
      await dataAccess.addExtraTime(minutes);
      await load(); // Reload state
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { currentState, isLoading, load, addExtraTime };
}
```

### useMainSettings Hook

Settings CRUD with password handling.

```typescript
// src/renderer/hooks/admin/useMainSettings.ts

export function useMainSettings() {
  const dataAccess = useAdminDataAccess();
  const [settings, setSettings] = useState<MainSettings>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const loaded = await dataAccess.getMainSettings();
      setSettings(loaded);
      setError(null);
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const save = async (updates: Partial<MainSettings>) => {
    setIsLoading(true);
    try {
      // Hash password if provided
      if (updates.adminPassword && updates.adminPassword.trim()) {
        const hashed = await dataAccess.hashPassword(updates.adminPassword);
        updates = { ...updates, adminPassword: hashed };
      }

      const merged = { ...settings, ...updates };
      await dataAccess.setMainSettings(merged);
      setSettings(merged);
      setError(null);
      return true;
    } catch (err) {
      setError('Failed to save settings');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const update = (key: keyof MainSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return { settings, isLoading, error, load, save, update };
}
```

## State Management Strategy

### Global State (AdminContext)

```typescript
// src/renderer/contexts/AdminContext.ts

export type TabType = 'time' | 'sources' | 'main' | 'search' | 'wishlist';

export interface Message {
  id: string;
  text: string;
  type: 'success' | 'error' | 'warning';
  duration?: number; // ms, auto-dismiss if set
}

export interface AdminContextValue {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  messages: Message[];
  addMessage: (text: string, type: Message['type'], duration?: number) => void;
  clearMessages: () => void;
  features: FeatureFlags;
  accessMode: AccessMode;
}
```

### Local State via Custom Hooks

Each feature area manages its own state through custom hooks:
- **useTimeLimits**: Manages time limits state and CRUD
- **useTimeTracking**: Manages current/projected time state
- **useMainSettings**: Manages settings state and updates
- **useAdminAuth**: Manages authentication state

### Feature Flags System

Feature flags determine which components are available:

```typescript
// Example feature flag usage in TabNavigation

function TabNavigation() {
  const { features, activeTab, setActiveTab } = useAdminContext();

  return (
    <nav>
      <TabButton active={activeTab === 'time'} onClick={() => setActiveTab('time')}>
        Time Management
      </TabButton>

      {features.canManageVideoSources && (
        <TabButton active={activeTab === 'sources'} onClick={() => setActiveTab('sources')}>
          Video Sources
        </TabButton>
      )}

      <TabButton active={activeTab === 'main'} onClick={() => setActiveTab('main')}>
        Main Settings
      </TabButton>

      {features.canViewSearchHistory && (
        <TabButton active={activeTab === 'search'} onClick={() => setActiveTab('search')}>
          Search History
        </TabButton>
      )}

      {features.canModerateWishlist && (
        <TabButton active={activeTab === 'wishlist'} onClick={() => setActiveTab('wishlist')}>
          Wishlist Moderation
        </TabButton>
      )}
    </nav>
  );
}
```

### Data Flow Example: Adding Extra Time

Complete flow from UI interaction to state update:

```
1. User clicks "Add 10 Minutes" button
   → QuickTimeExtension component

2. Component calls hook method
   → const { addExtraTime } = useTimeTracking()
   → addExtraTime(10)

3. Hook calls abstraction layer
   → dataAccess.addExtraTime(10)

4. Abstraction routes to implementation
   → IPCAdminDataAccess: window.electron.adminAddExtraTime(10)
   → HTTPAdminDataAccess: fetch('/api/extra-time', { method: 'POST', body: { minutes: 10 } })

5. Backend processes request
   → IPC: timeTracking.addExtraTime() updates database
   → HTTP: apiHandler.handleAddExtraTime() updates database

6. Hook reloads state
   → dataAccess.getTimeState()

7. Component re-renders with new state
   → Updated TimeIndicator shows new time remaining
```

## UI/Styling Strategy

### Design System Constants

```typescript
// src/renderer/styles/admin-theme.ts

export const adminTheme = {
  colors: {
    primary: '#667eea',
    primaryDark: '#764ba2',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      300: '#d1d5db',
      600: '#4b5563',
      900: '#111827',
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  },
  borderRadius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
  },
};
```

### Tailwind Class Organization

Components use consistent Tailwind patterns:

```typescript
// Button patterns
const buttonClasses = {
  base: 'px-4 py-2 rounded-lg font-medium transition-colors duration-200',
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-600 text-white hover:bg-gray-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  disabled: 'opacity-50 cursor-not-allowed',
};

// Card patterns
const cardClasses = 'bg-white rounded-lg shadow-lg p-6';

// Input patterns
const inputClasses = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
```

### Responsive Design

Mobile-first approach with breakpoints:

```typescript
// Grid layouts adapt to screen size
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Stacks on mobile, side-by-side on desktop */}
</div>

// Tab navigation scrolls on mobile
<nav className="flex space-x-8 px-6 overflow-x-auto">
  {/* Horizontal scroll on mobile */}
</nav>
```

## Authentication & Security

### Login Flow - IPC Mode

```
1. User enters password in LoginForm
2. LoginForm calls useAdminAuth().login(password)
3. IPCAdminDataAccess.authenticate(password)
4. IPC: window.electron.adminAuthenticate(password)
5. Main process: compares bcrypt hash
6. Success: setIsAuthenticated(true)
7. AuthGate renders AdminLayout
```

### Login Flow - HTTP Mode

```
1. User enters password in LoginForm
2. LoginForm calls useAdminAuth().login(password)
3. HTTPAdminDataAccess.authenticate(password)
4. HTTP: POST /api/auth/login { password }
5. API: compares bcrypt hash
6. Success: returns { success: true, token: 'temp-token' }
7. HTTPAdminDataAccess stores token
8. setIsAuthenticated(true)
9. AuthGate renders AdminLayout
```

### Password Handling

- Passwords are never stored in plain text
- IPC mode: bcrypt hashing in main process
- HTTP mode: bcrypt hashing on server
- Password changes trigger re-hashing before save

### Security Considerations

- **IPC Mode**: Already secured by Electron's contextIsolation
- **HTTP Mode**:
  - CORS headers restrict access to same origin
  - Token-based auth (simple implementation)
  - No sensitive data in HTTP responses
  - Rate limiting recommended (future enhancement)

## Feature Availability Per Mode

| Feature                  | Electron IPC | Remote HTTP | Reason                          |
|--------------------------|--------------|-------------|---------------------------------|
| Time Management          | ✅ Full      | ✅ Full     | Core feature, no DB required    |
| Add Extra Time           | ✅ Full      | ✅ Full     | Core feature, API available     |
| Daily Time Limits        | ✅ Full      | ✅ Full     | Core feature, API available     |
| Main Settings            | ✅ Full      | ⚠️ Limited  | File picker IPC-only            |
| Download Path            | ✅ Edit      | ❌ Hidden   | Requires file system            |
| YouTube API Key          | ✅ Edit      | ✅ Edit     | Simple text field               |
| Admin Password           | ✅ Edit      | ✅ Edit     | Hash via API                    |
| Verbose Logging          | ✅ Edit      | ✅ Edit     | Simple toggle                   |
| YouTube Clicks Toggle    | ✅ Edit      | ✅ Edit     | Simple toggle                   |
| Remote Access Toggle     | ✅ Edit      | ✅ Edit     | Simple toggle                   |
| App Restart              | ✅ Available | ❌ Hidden   | Requires Electron API           |
| Video Sources Manager    | ✅ Full      | ❌ Hidden   | Requires DatabaseService        |
| Search History           | ✅ Full      | ❌ Hidden   | Requires DatabaseService        |
| Wishlist Moderation      | ✅ Full      | ❌ Hidden   | Requires DatabaseService        |
| Smart Exit Button        | ✅ Available | ❌ Hidden   | Requires navigation API         |

## Integration Points

### AdminPage.tsx Integration

Current AdminPage.tsx will be replaced with a simple wrapper:

```typescript
// src/renderer/pages/AdminPage.tsx (refactored)

import { AdminApp } from '@/renderer/components/admin/AdminApp';

export const AdminPage: React.FC = () => {
  return <AdminApp />;
};
```

### App.tsx Routing

Routes remain unchanged:

```typescript
// src/renderer/App.tsx

<Routes>
  {/* ... other routes ... */}
  <Route path="/admin" element={<AdminPage />} />
  {/* /parent-access will be handled by HTTP server */}
</Routes>
```

### HTTP Server Integration

The HTTP server will serve the React bundle for `/parent-access`:

```typescript
// src/main/http/apiHandler.ts (enhanced)

if (path === '/parent-access' || path === '/parent-access/') {
  // Instead of serving HTML string, serve React bundle
  const bundleHtml = await loadReactAdminBundle();
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(bundleHtml);
  return true;
}
```

### Required API Endpoints

All existing endpoints remain, with additions:

**Existing Endpoints**:
- `POST /api/auth/login` - Authentication
- `GET /api/time-limits` - Get time limits
- `POST /api/time-limits` - Update time limits
- `GET /api/usage-stats` - Get time state
- `POST /api/extra-time` - Add extra time
- `GET /api/settings` - Get main settings (limited)

**New Endpoints Needed**:
- `POST /api/settings` - Update main settings
- `POST /api/admin/hash-password` - Hash password for password changes
- `GET /api/features` - Get feature flags (optional, can be derived client-side)

### Message Handling

Components use AdminContext for user feedback:

```typescript
const { addMessage } = useAdminContext();

// Success message
addMessage('Settings saved successfully!', 'success', 3000);

// Error message
addMessage('Failed to save settings', 'error');
```

## Testing Strategy

### Unit Tests

- Test all custom hooks with mock data access
- Test components with mock hooks
- Test data access implementations with mock backends
- Test utility functions

### Integration Tests

- Test IPC data access against real IPC handlers
- Test HTTP data access against real API endpoints
- Test authentication flows for both modes

### E2E Tests

- Test complete user flows: login → add time → save settings
- Test feature visibility based on access mode
- Test error handling and recovery

## Performance Considerations

- Initial render < 100ms (lazy load tabs)
- Data fetches < 500ms IPC, < 1000ms HTTP
- Tab switching < 50ms (no refetch)
- Optimistic updates for better UX

## Migration Path

The refactoring maintains backward compatibility:

1. New AdminApp component coexists with old AdminPage
2. HTTP route `/parent-access` switches to React bundle
3. All IPC handlers remain unchanged
4. All API endpoints remain compatible
5. Tests validate no regressions

## Future Enhancements

- Real token-based auth with expiry
- Session persistence across refreshes
- Real-time sync between modes
- Mobile-optimized responsive design
- Audit logging for admin actions
