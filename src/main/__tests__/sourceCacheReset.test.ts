import { vi, describe, it, expect, beforeEach } from 'vitest';
import { YouTubePageCache } from '../../preload/youtubePageCache';

// Create mock database instance
const mockDbRun = vi.fn().mockResolvedValue(undefined);
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();

const mockDatabaseService = {
  getInstance: vi.fn(() => ({
    run: mockDbRun,
    get: mockDbGet,
    all: mockDbAll
  }))
};

// Mock DatabaseService - this will be used by dynamic imports
vi.mock('../../main/services/DatabaseService', () => ({
  DatabaseService: mockDatabaseService
}));

// Mock process.type to simulate main process
Object.defineProperty(process, 'type', {
  value: 'browser',
  writable: true,
  configurable: true
});

describe('Source Cache Reset', () => {
  const testSourceId = 'test-source-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should clear cache from database for a specific source', async () => {
    await YouTubePageCache.clearSourcePages(testSourceId);

    expect(mockDbRun).toHaveBeenCalledWith(
      'DELETE FROM youtube_api_results WHERE source_id = ?',
      [testSourceId]
    );
  });

  it('should handle clearing cache when no cache exists', async () => {
    await expect(YouTubePageCache.clearSourcePages(testSourceId)).resolves.not.toThrow();

    expect(mockDbRun).toHaveBeenCalledWith(
      'DELETE FROM youtube_api_results WHERE source_id = ?',
      [testSourceId]
    );
  });
});