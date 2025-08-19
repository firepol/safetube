import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppPaths } from './appPaths';

// Mock process.env
const originalEnv = process.env;

describe('AppPaths', () => {
  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isDev', () => {
    it('should return true in development mode', () => {
      process.env.NODE_ENV = 'development';
      expect(AppPaths.isDev()).toBe(true);
    });

    it('should return false in production mode', () => {
      process.env.NODE_ENV = 'production';
      expect(AppPaths.isDev()).toBe(false);
    });

    it('should return false when NODE_ENV is undefined', () => {
      delete process.env.NODE_ENV;
      expect(AppPaths.isDev()).toBe(false);
    });
  });

  describe('getConfigDir in development mode', () => {
    it('should return development config path when in dev mode', () => {
      process.env.NODE_ENV = 'development';
      const result = AppPaths.getConfigDir();
      expect(result).toContain('config');
      expect(result).toContain(process.cwd());
    });
  });

  describe('getConfigPath in development mode', () => {
    it('should return full config file path in dev mode', () => {
      process.env.NODE_ENV = 'development';
      const result = AppPaths.getConfigPath('test.json');
      expect(result).toContain('config');
      expect(result).toContain('test.json');
      expect(result).toContain(process.cwd());
    });
  });
});
