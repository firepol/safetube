/**
 * Tests for AdminDataAccess layer
 * Tests both IPC and HTTP implementations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  IPCAdminDataAccess,
  HTTPAdminDataAccess,
  createAdminDataAccess,
  IAdminDataAccess,
} from './AdminDataAccess';
import {
  TimeLimits,
  TimeTrackingState,
  MainSettings,
} from '@/renderer/hooks/admin/types';

// Mock window.electron for IPC tests
const mockElectron = {
  adminAuthenticate: vi.fn(),
  getTimeLimits: vi.fn(),
  adminWriteTimeLimits: vi.fn(),
  getTimeTrackingState: vi.fn(),
  adminAddExtraTime: vi.fn(),
  readMainSettings: vi.fn(),
  writeMainSettings: vi.fn(),
  getDefaultDownloadPath: vi.fn(),
  adminHashPassword: vi.fn(),
  invoke: vi.fn(),
  adminGetLastWatchedVideoWithSource: vi.fn(),
};

// Helper to set up window.electron
function setupElectron(mock: any) {
  (window as any).electron = mock;
}

// Helper to clear window.electron
function clearElectron() {
  (window as any).electron = undefined;
}

// Mock fetch for HTTP tests
global.fetch = vi.fn();

describe('IPCAdminDataAccess', () => {
  let dataAccess: IPCAdminDataAccess;

  beforeEach(() => {
    setupElectron(mockElectron);
    dataAccess = new IPCAdminDataAccess();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearElectron();
  });

  describe('getAccessMode', () => {
    it('returns electron mode', () => {
      expect(dataAccess.getAccessMode()).toBe('electron');
    });
  });

  describe('getFeatureFlags', () => {
    it('returns all features enabled for IPC mode', () => {
      const flags = dataAccess.getFeatureFlags();
      expect(flags.hasDatabase).toBe(true);
      expect(flags.hasFileSystem).toBe(true);
      expect(flags.hasAppRestart).toBe(true);
      expect(flags.canManageVideoSources).toBe(true);
      expect(flags.canViewSearchHistory).toBe(true);
      expect(flags.canModerateWishlist).toBe(true);
    });
  });

  describe('authenticate', () => {
    it('returns success when IPC authenticates successfully', async () => {
      mockElectron.adminAuthenticate.mockResolvedValue({ success: true });

      const result = await dataAccess.authenticate('password');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockElectron.adminAuthenticate).toHaveBeenCalledWith('password');
    });

    it('returns error when IPC authentication fails', async () => {
      mockElectron.adminAuthenticate.mockResolvedValue({ success: false });

      const result = await dataAccess.authenticate('wrongpassword');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid password');
    });

    it('handles IPC errors gracefully', async () => {
      mockElectron.adminAuthenticate.mockRejectedValue(new Error('IPC error'));

      const result = await dataAccess.authenticate('password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
    });
  });

  describe('getTimeLimits', () => {
    it('returns time limits from IPC', async () => {
      const mockLimits: TimeLimits = {
        Monday: 120,
        Tuesday: 120,
        Wednesday: 120,
        Thursday: 120,
        Friday: 180,
        Saturday: 180,
        Sunday: 120,
      };
      mockElectron.getTimeLimits.mockResolvedValue(mockLimits);

      const result = await dataAccess.getTimeLimits();

      expect(result).toEqual(mockLimits);
      expect(mockElectron.getTimeLimits).toHaveBeenCalled();
    });
  });

  describe('setTimeLimits', () => {
    it('saves time limits via IPC', async () => {
      const limits: TimeLimits = {
        Monday: 120,
        Tuesday: 120,
        Wednesday: 120,
        Thursday: 120,
        Friday: 180,
        Saturday: 180,
        Sunday: 120,
      };
      mockElectron.adminWriteTimeLimits.mockResolvedValue(undefined);

      await dataAccess.setTimeLimits(limits);

      expect(mockElectron.adminWriteTimeLimits).toHaveBeenCalledWith(limits);
    });
  });

  describe('getTimeState', () => {
    it('returns time tracking state from IPC', async () => {
      const mockState: TimeTrackingState = {
        timeUsedToday: 1800,
        timeLimitToday: 7200,
        timeRemaining: 5400,
        isLimitReached: false,
        extraTimeToday: 10,
      };
      mockElectron.getTimeTrackingState.mockResolvedValue(mockState);

      const result = await dataAccess.getTimeState();

      expect(result).toEqual(mockState);
    });
  });

  describe('addExtraTime', () => {
    it('adds extra time via IPC', async () => {
      mockElectron.adminAddExtraTime.mockResolvedValue(undefined);

      await dataAccess.addExtraTime(10);

      expect(mockElectron.adminAddExtraTime).toHaveBeenCalledWith(10);
    });

    it('handles negative minutes for time removal', async () => {
      mockElectron.adminAddExtraTime.mockResolvedValue(undefined);

      await dataAccess.addExtraTime(-5);

      expect(mockElectron.adminAddExtraTime).toHaveBeenCalledWith(-5);
    });
  });

  describe('getMainSettings', () => {
    it('returns main settings without password hash', async () => {
      const mockSettings = {
        downloadPath: '/home/user/Downloads',
        youtubeApiKey: 'key123',
        adminPassword: 'hash',
        enableVerboseLogging: false,
      };
      mockElectron.readMainSettings.mockResolvedValue(mockSettings);

      const result = await dataAccess.getMainSettings();

      expect(result.downloadPath).toBe('/home/user/Downloads');
      expect(result.youtubeApiKey).toBe('key123');
      expect(result.adminPassword).toBeUndefined();
      expect(result.enableVerboseLogging).toBe(false);
    });
  });

  describe('setMainSettings', () => {
    it('saves main settings via IPC', async () => {
      const settings: MainSettings = {
        youtubeApiKey: 'newkey',
      };
      mockElectron.writeMainSettings.mockResolvedValue({ success: true });

      await dataAccess.setMainSettings(settings);

      expect(mockElectron.writeMainSettings).toHaveBeenCalledWith(settings);
    });

    it('throws error when save fails', async () => {
      const settings: MainSettings = {};
      mockElectron.writeMainSettings.mockResolvedValue({
        success: false,
        error: 'Permission denied',
      });

      await expect(dataAccess.setMainSettings(settings)).rejects.toThrow('Permission denied');
    });
  });

  describe('getDefaultDownloadPath', () => {
    it('returns default download path from IPC', async () => {
      mockElectron.getDefaultDownloadPath.mockResolvedValue('/home/user/Downloads');

      const result = await dataAccess.getDefaultDownloadPath();

      expect(result).toBe('/home/user/Downloads');
    });
  });

  describe('hashPassword', () => {
    it('hashes password via IPC', async () => {
      mockElectron.adminHashPassword.mockResolvedValue({
        success: true,
        hashedPassword: 'hashed_password_here',
      });

      const result = await dataAccess.hashPassword('mypassword');

      expect(result).toBe('hashed_password_here');
    });

    it('throws error when hashing fails', async () => {
      mockElectron.adminHashPassword.mockResolvedValue({
        success: false,
        error: 'Hashing failed',
      });

      await expect(dataAccess.hashPassword('password')).rejects.toThrow('Hashing failed');
    });
  });

  describe('getNetworkInfo', () => {
    it('returns network info via IPC invoke', async () => {
      mockElectron.invoke.mockResolvedValue({ url: 'http://192.168.1.100:3000' });

      const result = await dataAccess.getNetworkInfo();

      expect(result).toEqual({ url: 'http://192.168.1.100:3000' });
      expect(mockElectron.invoke).toHaveBeenCalledWith('server:get-network-info');
    });

    it('returns null when network info unavailable', async () => {
      mockElectron.invoke.mockRejectedValue(new Error('Not available'));

      const result = await dataAccess.getNetworkInfo();

      expect(result).toBeNull();
    });
  });

  describe('getLastWatchedVideoWithSource', () => {
    it('returns last watched video info', async () => {
      const mockVideo = {
        video: { id: 'video123', title: 'Test Video' },
        sourceId: 'source456',
        sourceTitle: 'Test Channel',
      };
      mockElectron.adminGetLastWatchedVideoWithSource.mockResolvedValue(mockVideo);

      const result = await dataAccess.getLastWatchedVideoWithSource();

      expect(result).toEqual(mockVideo);
    });
  });
});

describe('HTTPAdminDataAccess', () => {
  let dataAccess: HTTPAdminDataAccess;

  beforeEach(() => {
    clearElectron();
    dataAccess = new HTTPAdminDataAccess();
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  afterEach(() => {
    clearElectron();
  });

  describe('getAccessMode', () => {
    it('returns http mode', () => {
      expect(dataAccess.getAccessMode()).toBe('http');
    });
  });

  describe('getFeatureFlags', () => {
    it('returns limited features for HTTP mode', () => {
      const flags = dataAccess.getFeatureFlags();
      expect(flags.hasDatabase).toBe(false);
      expect(flags.hasFileSystem).toBe(false);
      expect(flags.hasAppRestart).toBe(false);
      expect(flags.canManageVideoSources).toBe(false);
      expect(flags.canViewSearchHistory).toBe(false);
      expect(flags.canModerateWishlist).toBe(false);
    });
  });

  describe('authenticate', () => {
    it('authenticates via HTTP API', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, token: 'jwt-token' }),
      });

      const result = await dataAccess.authenticate('password');

      expect(result.success).toBe(true);
      expect(result.token).toBe('jwt-token');
    });

    it('handles authentication failure', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
      });

      const result = await dataAccess.authenticate('wrongpassword');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid password');
    });

    it('handles network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await dataAccess.authenticate('password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });
  });

  describe('getTimeLimits', () => {
    it('fetches time limits from API', async () => {
      const mockLimits: TimeLimits = {
        Monday: 120,
        Tuesday: 120,
        Wednesday: 120,
        Thursday: 120,
        Friday: 180,
        Saturday: 180,
        Sunday: 120,
      };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockLimits,
      });

      const result = await dataAccess.getTimeLimits();

      expect(result).toEqual(mockLimits);
      expect(global.fetch).toHaveBeenCalledWith('/api/time-limits');
    });
  });

  describe('setTimeLimits', () => {
    it('saves time limits via API', async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });

      const limits: TimeLimits = {
        Monday: 120,
        Tuesday: 120,
        Wednesday: 120,
        Thursday: 120,
        Friday: 180,
        Saturday: 180,
        Sunday: 120,
      };

      await dataAccess.setTimeLimits(limits);

      expect(global.fetch).toHaveBeenCalledWith('/api/time-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(limits),
      });
    });
  });

  describe('getTimeState', () => {
    it('fetches time state from API and transforms it', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          totalTime: 1800,
          timeLimit: 120,
          timeRemaining: 5400,
          isTimeLimit: false,
          extraTime: 10,
        }),
      });

      const result = await dataAccess.getTimeState();

      expect(result.timeUsedToday).toBe(1800);
      expect(result.timeLimitToday).toBe(7200); // 120 * 60
      expect(result.timeRemaining).toBe(5400);
      expect(result.isLimitReached).toBe(false);
      expect(result.extraTimeToday).toBe(10);
    });
  });

  describe('addExtraTime', () => {
    it('adds extra time via API', async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });

      await dataAccess.addExtraTime(10);

      expect(global.fetch).toHaveBeenCalledWith('/api/extra-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: 10 }),
      });
    });
  });

  describe('getMainSettings', () => {
    it('fetches main settings from API', async () => {
      const mockSettings: MainSettings = {
        youtubeApiKey: 'key123',
      };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockSettings,
      });

      const result = await dataAccess.getMainSettings();

      expect(result).toEqual(mockSettings);
    });
  });

  describe('setMainSettings', () => {
    it('saves main settings via API', async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });

      const settings: MainSettings = { youtubeApiKey: 'newkey' };

      await dataAccess.setMainSettings(settings);

      expect(global.fetch).toHaveBeenCalledWith('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    });
  });

  describe('getDefaultDownloadPath', () => {
    it('throws error in HTTP mode', async () => {
      await expect(dataAccess.getDefaultDownloadPath()).rejects.toThrow(
        'File system access not available in HTTP mode'
      );
    });
  });

  describe('hashPassword', () => {
    it('hashes password via API', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ hashedPassword: 'hashed_password' }),
      });

      const result = await dataAccess.hashPassword('password');

      expect(result).toBe('hashed_password');
    });
  });

  describe('getNetworkInfo', () => {
    it('returns current window location origin', async () => {
      const result = await dataAccess.getNetworkInfo();

      expect(result).toEqual({
        url: window.location.origin,
      });
    });
  });

  describe('getLastWatchedVideoWithSource', () => {
    it('throws error in HTTP mode', async () => {
      await expect(dataAccess.getLastWatchedVideoWithSource()).rejects.toThrow(
        'Smart exit not available in HTTP mode'
      );
    });
  });
});

describe('createAdminDataAccess factory', () => {
  afterEach(() => {
    clearElectron();
  });

  it('returns IPCAdminDataAccess when window.electron is available', () => {
    setupElectron(mockElectron);

    const dataAccess = createAdminDataAccess();

    expect(dataAccess).toBeInstanceOf(IPCAdminDataAccess);
    expect(dataAccess.getAccessMode()).toBe('electron');
  });

  it('returns HTTPAdminDataAccess when window.electron is not available', () => {
    clearElectron();

    const dataAccess = createAdminDataAccess();

    expect(dataAccess).toBeInstanceOf(HTTPAdminDataAccess);
    expect(dataAccess.getAccessMode()).toBe('http');
  });
});
