import { vi } from 'vitest';

// Mock Electron app for testing
const mockApp = {
  getPath: vi.fn((name: string) => {
    switch (name) {
      case 'userData':
        return '/tmp/claude/safetube-test';
      case 'logs':
        return '/tmp/claude/safetube-test/logs';
      case 'downloads':
        return '/tmp/claude/downloads';
      default:
        return '/tmp/claude/safetube-test';
    }
  })
};

// Mock Electron module
vi.mock('electron', () => ({
  app: mockApp
}));

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    transports: {
      file: {
        resolvePathFn: vi.fn(),
        level: 'info',
        format: ''
      },
      console: {
        level: 'info',
        format: ''
      }
    }
  }
}));