import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock AppPaths
vi.mock('./appPaths', () => ({
  AppPaths: {
    isDev: vi.fn(),
    getConfigDir: vi.fn(),
    getCacheDir: vi.fn(),
    getLogsDir: vi.fn(),
    getUserDataDir: vi.fn()
  }
}));

// Mock fs
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    promises: {
      mkdir: vi.fn(),
      copyFile: vi.fn(),
      writeFile: vi.fn(),
      stat: vi.fn(),
      access: vi.fn()
    }
  };
});

describe('FirstRunSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    const { AppPaths } = require('./appPaths');
    AppPaths.isDev.mockReturnValue(false);
    AppPaths.getConfigDir.mockReturnValue('/mock/config');
    AppPaths.getCacheDir.mockReturnValue('/mock/cache');
    AppPaths.getLogsDir.mockReturnValue('/mock/logs');
    AppPaths.getUserDataDir.mockReturnValue('/mock/userdata');
    
    // Mock process.cwd
    Object.defineProperty(process, 'cwd', {
      value: vi.fn().mockReturnValue('/mock/project')
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setupIfNeeded', () => {
    it('should skip setup in development mode', async () => {
      const { AppPaths } = require('./appPaths');
      AppPaths.isDev.mockReturnValue(true);
      
      const { FirstRunSetup } = await import('./firstRunSetup');
      const result = await FirstRunSetup.setupIfNeeded();
      
      expect(result.success).toBe(true);
      expect(result.createdDirs).toHaveLength(0);
      expect(result.copiedFiles).toHaveLength(0);
    });

    it('should create directories in production mode', async () => {
      const { promises: fs } = require('fs');
      fs.mkdir.mockResolvedValue(undefined);
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.access.mockRejectedValue(new Error('File not found'));
      
      const { FirstRunSetup } = await import('./firstRunSetup');
      const result = await FirstRunSetup.setupIfNeeded();
      
      expect(result.success).toBe(true);
      expect(result.createdDirs).toHaveLength(3);
      expect(fs.mkdir).toHaveBeenCalledTimes(3);
    });

    it('should handle directory creation errors gracefully', async () => {
      const { promises: fs } = require('fs');
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));
      
      const { FirstRunSetup } = await import('./firstRunSetup');
      const result = await FirstRunSetup.setupIfNeeded();
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe('getSetupStatus', () => {
    it('should return setup status', async () => {
      const { promises: fs } = require('fs');
      fs.access.mockResolvedValue(undefined);
      
      const { FirstRunSetup } = await import('./firstRunSetup');
      const status = await FirstRunSetup.getSetupStatus();
      
      expect(status.isDev).toBe(false);
      expect(status.configDir).toBe('/mock/config');
      expect(typeof status.configFiles).toBe('object');
      expect(typeof status.envFile).toBe('boolean');
    });
  });
});
