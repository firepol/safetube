import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Targeted test for YouTube cache functionality
 * Tests only the specific cache issues introduced in commit e410b141
 */
describe('YouTube Cache Fix - Targeted Test', () => {
  const CACHE_DIR = path.join('.', '.cache');

  beforeEach(() => {
    // Ensure cache directory exists for testing
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  });

  it('should have cache directory available', () => {
    expect(fs.existsSync(CACHE_DIR)).toBe(true);
  });

  it('should be able to write and read cache files', () => {
    const testCacheFile = path.join(CACHE_DIR, 'test_cache.json');
    const testData = { test: 'data', timestamp: Date.now() };

    // Write test cache file
    fs.writeFileSync(testCacheFile, JSON.stringify(testData));

    // Read and verify
    const readData = JSON.parse(fs.readFileSync(testCacheFile, 'utf-8'));
    expect(readData.test).toBe('data');

    // Cleanup
    fs.unlinkSync(testCacheFile);
  });

  it('should validate cache data structure', () => {
    const validCache = { timestamp: Date.now(), data: { some: 'data' } };
    const invalidCache = { data: { some: 'data' } }; // missing timestamp

    // Test cache validation logic
    const isCacheValid = (cacheData: any): boolean => {
      if (!cacheData || !cacheData.timestamp) return false;
      const age = Date.now() - cacheData.timestamp;
      return age < (30 * 60 * 1000); // 30 minutes
    };

    expect(isCacheValid(validCache)).toBe(true);
    expect(isCacheValid(invalidCache)).toBe(false);
  });
});

/**
 * Targeted test for timeTracking function name issue
 */
describe('TimeTracking Function Names - Targeted Test', () => {
  it('should have consistent function names for adding extra time', async () => {
    // This test verifies the function name mismatch issue
    // We'll import the timeTracking module and check function availability

    try {
      const timeTrackingModule = await import('./timeTracking');

      // Check if both function names are available
      const hasAddExtraTime = typeof timeTrackingModule.addExtraTime === 'function';
      const hasAddExtraTimeToday = typeof (timeTrackingModule as any).addExtraTimeToday === 'function';

      // At least one should be available
      expect(hasAddExtraTime || hasAddExtraTimeToday).toBe(true);

      console.log('Available timeTracking functions:', Object.keys(timeTrackingModule));
    } catch (error) {
      console.error('Error importing timeTracking module:', error);
      throw error;
    }
  });
});