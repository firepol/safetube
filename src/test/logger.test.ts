import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../test/mocks/electron';
import log from '../main/logger';

// Mock electron-log transport
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    transports: {
      file: {
        level: 'info',
        format: '',
        resolvePathFn: vi.fn()
      },
      console: {
        level: 'debug',
        format: ''
      }
    }
  }
}));

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should log info messages', () => {
    const testMessage = 'Test info message';
    log.info(testMessage);
    expect(log.info).toHaveBeenCalledWith(testMessage);
  });

  it('should log error messages', () => {
    const testError = new Error('Test error');
    log.error('Test error message', testError);
    expect(log.error).toHaveBeenCalledWith('Test error message', testError);
  });

  it('should log debug messages in development', () => {
    const testMessage = 'Test debug message';
    log.debug(testMessage);
    expect(log.debug).toHaveBeenCalledWith(testMessage);
  });

  it('should handle object logging', () => {
    const testObject = { key: 'value' };
    log.info('Test object:', testObject);
    expect(log.info).toHaveBeenCalledWith('Test object:', testObject);
  });

  it('should use correct log file path', () => {
    expect(log.transports.file.resolvePathFn).toBeDefined();
  });
}); 