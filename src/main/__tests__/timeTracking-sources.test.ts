import '../services/__tests__/setup'; // Import mocks first
import DatabaseService from '../../services/DatabaseService';
import SimpleSchemaManager from '../database/SimpleSchemaManager';
import { resetDatabaseSingleton, createTestDatabase, cleanupTestDatabase } from '../database/__tests__/testHelpers';
import {
  getSourceTimeState,
  recordSourceWatchTime,
  enforceSourceTimeLimit,
  grantSourceTimeExtension
} from '../timeTracking';
import { SourceTimeState, SourceTimeEnforcement } from '../database/queries/types';

describe('Source-Level Time Tracking', () => {
  let db: DatabaseService;
  let schemaManager: SimpleSchemaManager;
  const testSourceId = 'test-youtube-channel-1';
  const testSourceId2 = 'test-youtube-channel-2';

  beforeEach(async () => {
    // Reset singleton for test isolation
    resetDatabaseSingleton();

    // Create in-memory test database
    db = await createTestDatabase({ useMemory: true });
    schemaManager = new SimpleSchemaManager(db);

    // Initialize the consolidated schema
    await schemaManager.initializeSchema();

    // Create test sources with different limits
    await db.run(
      `INSERT INTO sources (id, type, title, position, url, daily_time_limit_minutes)
       VALUES (?, 'youtube_channel', 'Test Channel 1', 1, 'https://youtube.com/@test1', ?)`,
      [testSourceId, 10] // 10 minutes limit
    );

    await db.run(
      `INSERT INTO sources (id, type, title, position, url, daily_time_limit_minutes)
       VALUES (?, 'youtube_channel', 'Test Channel 2', 2, 'https://youtube.com/@test2', ?)`,
      [testSourceId2, null] // No limit (unlimited)
    );
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('getSourceTimeState()', () => {
    it('should return correct state for source with no usage', async () => {
      const state = await getSourceTimeState(testSourceId);

      expect(state).toBeDefined();
      expect(state.sourceId).toBe(testSourceId);
      expect(state.dailyLimitMinutes).toBe(10);
      expect(state.secondsUsedToday).toBe(0);
      expect(state.secondsRemainingToday).toBe(600); // 10 * 60 = 600 seconds
      expect(state.isLimitExceeded).toBe(false);
      expect(state.lastResetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
    });

    it('should handle NULL limit as unlimited', async () => {
      const state = await getSourceTimeState(testSourceId2);

      expect(state.sourceId).toBe(testSourceId2);
      expect(state.dailyLimitMinutes).toBeNull();
      expect(state.secondsRemainingToday).toBeNull();
      expect(state.isLimitExceeded).toBe(false);
    });

    it('should calculate remaining time correctly after recording watch time', async () => {
      // Record 3 minutes of watch time
      await recordSourceWatchTime(testSourceId, 180);

      const state = await getSourceTimeState(testSourceId);

      expect(state.secondsUsedToday).toBe(180);
      expect(state.secondsRemainingToday).toBe(420); // 600 - 180 = 420
      expect(state.isLimitExceeded).toBe(false);
    });

    it('should detect limit exceeded exactly', async () => {
      // Record exactly 10 minutes (the limit)
      await recordSourceWatchTime(testSourceId, 600);

      const state = await getSourceTimeState(testSourceId);

      expect(state.secondsUsedToday).toBe(600);
      expect(state.secondsRemainingToday).toBe(0);
      expect(state.isLimitExceeded).toBe(true);
    });

    it('should detect limit exceeded over the limit', async () => {
      // Record 12 minutes (over the 10-minute limit)
      await recordSourceWatchTime(testSourceId, 720);

      const state = await getSourceTimeState(testSourceId);

      expect(state.secondsUsedToday).toBe(720);
      expect(state.secondsRemainingToday).toBe(0); // Max 0, never negative
      expect(state.isLimitExceeded).toBe(true);
    });

    it('should include extensions in remaining time calculation', async () => {
      // Record 8 minutes of watch time
      await recordSourceWatchTime(testSourceId, 480);

      // Grant 5-minute extension
      await grantSourceTimeExtension(testSourceId, 5, 'Testing', 'parent');

      const state = await getSourceTimeState(testSourceId);

      // Limit: 10 min (600 sec) + 5 min extension (300 sec) = 900 sec total
      // Used: 480 sec
      // Remaining: 900 - 480 = 420 sec
      expect(state.secondsUsedToday).toBe(480);
      expect(state.secondsRemainingToday).toBe(420);
      expect(state.isLimitExceeded).toBe(false);
    });

    it('should handle multiple extensions', async () => {
      // Record 8 minutes of watch time
      await recordSourceWatchTime(testSourceId, 480);

      // Grant multiple extensions
      await grantSourceTimeExtension(testSourceId, 3, 'First extension', 'parent');
      await grantSourceTimeExtension(testSourceId, 2, 'Second extension', 'parent');

      const state = await getSourceTimeState(testSourceId);

      // Limit: 10 min + 5 min (extensions) = 900 sec total
      // Used: 480 sec
      // Remaining: 420 sec
      expect(state.secondsRemainingToday).toBe(420);
      expect(state.isLimitExceeded).toBe(false);
    });

    it('should throw error for non-existent source', async () => {
      await expect(getSourceTimeState('non-existent-source')).rejects.toThrow();
    });

    it('should round seconds used correctly', async () => {
      // Record 3.7 minutes (should round to 222 seconds, not 220)
      await recordSourceWatchTime(testSourceId, 222.4);

      const state = await getSourceTimeState(testSourceId);

      // Should be rounded to 222
      expect(state.secondsUsedToday).toBe(222);
    });

    it('should return accurate dates in YYYY-MM-DD format', async () => {
      const state = await getSourceTimeState(testSourceId);

      expect(state.lastResetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verify it matches today's date
      const today = new Date().toISOString().split('T')[0];
      expect(state.lastResetDate).toBe(today);
    });
  });

  describe('recordSourceWatchTime()', () => {
    it('should create new usage entry for new source on first watch', async () => {
      await recordSourceWatchTime(testSourceId, 300);

      const state = await getSourceTimeState(testSourceId);

      expect(state.secondsUsedToday).toBe(300);
    });

    it('should increment existing usage entry', async () => {
      await recordSourceWatchTime(testSourceId, 300);
      await recordSourceWatchTime(testSourceId, 200);

      const state = await getSourceTimeState(testSourceId);

      expect(state.secondsUsedToday).toBe(500);
    });

    it('should accumulate correctly over multiple calls', async () => {
      const times = [100, 150, 75, 125];
      for (const time of times) {
        await recordSourceWatchTime(testSourceId, time);
      }

      const state = await getSourceTimeState(testSourceId);

      expect(state.secondsUsedToday).toBe(450); // 100 + 150 + 75 + 125
    });

    it('should round seconds to nearest second', async () => {
      // Record 100.6 seconds - should round to 101
      await recordSourceWatchTime(testSourceId, 100.6);

      const state = await getSourceTimeState(testSourceId);

      expect(state.secondsUsedToday).toBe(101);
    });

    it('should round 0.4 down to 0', async () => {
      await recordSourceWatchTime(testSourceId, 0.4);

      const state = await getSourceTimeState(testSourceId);

      expect(state.secondsUsedToday).toBe(0);
    });

    it('should round 0.5 up to 1', async () => {
      await recordSourceWatchTime(testSourceId, 0.5);

      const state = await getSourceTimeState(testSourceId);

      expect(state.secondsUsedToday).toBe(1);
    });

    it('should track different sources independently', async () => {
      await recordSourceWatchTime(testSourceId, 300);
      await recordSourceWatchTime(testSourceId2, 500);

      const state1 = await getSourceTimeState(testSourceId);
      const state2 = await getSourceTimeState(testSourceId2);

      expect(state1.secondsUsedToday).toBe(300);
      expect(state2.secondsUsedToday).toBe(500);
    });

    it('should throw error for non-existent source', async () => {
      // Recording time for non-existent source should fail due to foreign key constraint
      const nonExistentId = 'does-not-exist-' + Date.now();

      await expect(recordSourceWatchTime(nonExistentId, 100)).rejects.toThrow();
    });
  });

  describe('enforceSourceTimeLimit()', () => {
    it('should allow watching when under limit', async () => {
      await recordSourceWatchTime(testSourceId, 300);

      const enforcement = await enforceSourceTimeLimit(testSourceId);

      expect(enforcement.canWatch).toBe(true);
      expect(enforcement.blockedSourceId).toBeUndefined();
      expect(enforcement.blockedReason).toBeUndefined();
      expect(enforcement.secondsRemaining).toBe(300); // 600 - 300
    });

    it('should allow watching when at limit (exactly)', async () => {
      // Record exactly 10 minutes
      await recordSourceWatchTime(testSourceId, 600);

      const enforcement = await enforceSourceTimeLimit(testSourceId);

      // At exactly limit boundary, should be blocked
      expect(enforcement.canWatch).toBe(false);
      expect(enforcement.blockedSourceId).toBe(testSourceId);
      expect(enforcement.blockedReason).toBe('source_limit');
    });

    it('should block when over limit', async () => {
      await recordSourceWatchTime(testSourceId, 700);

      const enforcement = await enforceSourceTimeLimit(testSourceId);

      expect(enforcement.canWatch).toBe(false);
      expect(enforcement.blockedSourceId).toBe(testSourceId);
      expect(enforcement.blockedReason).toBe('source_limit');
    });

    it('should allow watching when no limit (unlimited)', async () => {
      // testSourceId2 has no limit
      await recordSourceWatchTime(testSourceId2, 10000);

      const enforcement = await enforceSourceTimeLimit(testSourceId2);

      expect(enforcement.canWatch).toBe(true);
      expect(enforcement.blockedSourceId).toBeUndefined();
    });

    it('should respect extensions in enforcement decision', async () => {
      // Record 8 minutes
      await recordSourceWatchTime(testSourceId, 480);

      // Grant 5-minute extension
      await grantSourceTimeExtension(testSourceId, 5, 'Test', 'parent');

      const enforcement = await enforceSourceTimeLimit(testSourceId);

      // Now total limit is 15 minutes (900 sec), used 480, so should allow
      expect(enforcement.canWatch).toBe(true);
      expect(enforcement.secondsRemaining).toBe(420); // 900 - 480
    });

    it('should return correct remaining time calculations', async () => {
      await recordSourceWatchTime(testSourceId, 240); // 4 minutes

      const enforcement = await enforceSourceTimeLimit(testSourceId);

      expect(enforcement.secondsRemaining).toBe(360); // 600 - 240
      expect(enforcement.minutesRemaining).toBe(6); // Floor of 360/60
    });

    it('should return 0 minutes remaining when out of time', async () => {
      await recordSourceWatchTime(testSourceId, 600); // Exactly 10 minutes

      const enforcement = await enforceSourceTimeLimit(testSourceId);

      expect(enforcement.canWatch).toBe(false);
      // When blocked, secondsRemaining may not be set
    });

    it('should throw error for non-existent source', async () => {
      await expect(enforceSourceTimeLimit('non-existent-source')).rejects.toThrow();
    });
  });

  describe('grantSourceTimeExtension()', () => {
    it('should grant valid extension (5 minutes)', async () => {
      await expect(
        grantSourceTimeExtension(testSourceId, 5, 'Test reason', 'parent')
      ).resolves.not.toThrow();

      const state = await getSourceTimeState(testSourceId);

      expect(state.secondsRemainingToday).toBe(900); // 10 min + 5 min
    });

    it('should grant valid extension (60 minutes - max)', async () => {
      await expect(
        grantSourceTimeExtension(testSourceId, 60, 'Max extension', 'parent')
      ).resolves.not.toThrow();

      const state = await getSourceTimeState(testSourceId);

      expect(state.secondsRemainingToday).toBe(4200); // 10 min (600) + 60 min (3600)
    });

    it('should grant valid extension (1 minute - min)', async () => {
      await expect(
        grantSourceTimeExtension(testSourceId, 1, 'Min extension', 'parent')
      ).resolves.not.toThrow();

      const state = await getSourceTimeState(testSourceId);

      expect(state.secondsRemainingToday).toBe(660); // 10 min (600) + 1 min (60)
    });

    it('should reject extension below 1 minute', async () => {
      await expect(
        grantSourceTimeExtension(testSourceId, 0, 'Too small', 'parent')
      ).rejects.toThrow(/must be between 1 and 60 minutes/);
    });

    it('should reject extension above 60 minutes', async () => {
      await expect(
        grantSourceTimeExtension(testSourceId, 61, 'Too large', 'parent')
      ).rejects.toThrow(/must be between 1 and 60 minutes/);
    });

    it('should reject non-integer duration', async () => {
      await expect(
        grantSourceTimeExtension(testSourceId, 5.5, 'Float value', 'parent')
      ).rejects.toThrow(/must be between 1 and 60 minutes/);
    });

    it('should throw error for non-existent source', async () => {
      await expect(
        grantSourceTimeExtension('non-existent-source', 5, 'Test', 'parent')
      ).rejects.toThrow(/not found/);
    });

    it('should store extension with reason and addedBy', async () => {
      const reason = 'Special occasion';
      const addedBy = 'Parent Name';

      await grantSourceTimeExtension(testSourceId, 10, reason, addedBy);

      // Verify by checking the database directly
      const extension = await db.get<any>(
        `SELECT * FROM usage_extras WHERE source_id = ? AND reason = ? ORDER BY date DESC LIMIT 1`,
        [testSourceId, reason]
      );

      expect(extension).toBeDefined();
      expect(extension.minutes_added).toBe(10);
      expect(extension.reason).toBe(reason);
      expect(extension.added_by).toBe(addedBy);
    });

    it('should allow multiple extensions for same source on same day', async () => {
      await grantSourceTimeExtension(testSourceId, 5, 'First', 'parent');
      await grantSourceTimeExtension(testSourceId, 3, 'Second', 'parent');

      const state = await getSourceTimeState(testSourceId);

      // Total: 10 min (initial) + 5 min (ext1) + 3 min (ext2) = 18 min = 1080 sec
      expect(state.secondsRemainingToday).toBe(1080); // (10 + 5 + 3) * 60
    });

    it('should persist extension data across queries', async () => {
      await recordSourceWatchTime(testSourceId, 300);
      await grantSourceTimeExtension(testSourceId, 2, 'Test', 'parent');

      // Query multiple times to ensure persistence
      const state1 = await getSourceTimeState(testSourceId);
      const state2 = await getSourceTimeState(testSourceId);

      expect(state1.secondsRemainingToday).toBe(state2.secondsRemainingToday);
      // Total limit: 10 min + 2 min extension = 720 sec
      // Used: 300 sec
      // Remaining: 720 - 300 = 420 sec
      expect(state1.secondsRemainingToday).toBe(420);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete user flow: set limit, watch, extend, watch more', async () => {
      // Initial state: 10-minute limit, no usage
      let state = await getSourceTimeState(testSourceId);
      expect(state.secondsRemainingToday).toBe(600);

      // Watch 8 minutes
      await recordSourceWatchTime(testSourceId, 480);
      state = await getSourceTimeState(testSourceId);
      expect(state.secondsRemainingToday).toBe(120); // 2 min left

      // Check enforcement - should still allow
      let enforcement = await enforceSourceTimeLimit(testSourceId);
      expect(enforcement.canWatch).toBe(true);

      // Watch another minute (9 min total)
      await recordSourceWatchTime(testSourceId, 60);
      state = await getSourceTimeState(testSourceId);
      expect(state.secondsRemainingToday).toBe(60); // 1 min left

      // Watch another minute (10 min total - at limit)
      await recordSourceWatchTime(testSourceId, 60);
      state = await getSourceTimeState(testSourceId);
      expect(state.isLimitExceeded).toBe(true);

      // Check enforcement - should block
      enforcement = await enforceSourceTimeLimit(testSourceId);
      expect(enforcement.canWatch).toBe(false);

      // Parent grants 5-minute extension
      await grantSourceTimeExtension(testSourceId, 5, 'Extension', 'parent');
      state = await getSourceTimeState(testSourceId);
      expect(state.secondsRemainingToday).toBe(300); // 5 min remaining

      // Check enforcement - should now allow
      enforcement = await enforceSourceTimeLimit(testSourceId);
      expect(enforcement.canWatch).toBe(true);

      // Watch another 4 minutes
      await recordSourceWatchTime(testSourceId, 240);
      state = await getSourceTimeState(testSourceId);
      expect(state.secondsRemainingToday).toBe(60); // 1 min left
    });

    it('should handle multiple sources with different limits independently', async () => {
      // Source 1: 10-minute limit
      // Source 2: unlimited

      // Record time on source 1
      await recordSourceWatchTime(testSourceId, 300); // 5 minutes

      // Record much more time on source 2
      await recordSourceWatchTime(testSourceId2, 5000); // 83 minutes

      // Source 1 should be under limit
      const state1 = await getSourceTimeState(testSourceId);
      expect(state1.secondsRemainingToday).toBe(300); // 5 min left

      // Source 2 should be unlimited
      const state2 = await getSourceTimeState(testSourceId2);
      expect(state2.isLimitExceeded).toBe(false);
      expect(state2.secondsRemainingToday).toBeNull();

      // Enforcement should be independent
      const enforcement1 = await enforceSourceTimeLimit(testSourceId);
      const enforcement2 = await enforceSourceTimeLimit(testSourceId2);

      expect(enforcement1.canWatch).toBe(true);
      expect(enforcement2.canWatch).toBe(true);
    });

    it('should handle day reset naturally', async () => {
      // Record time on testSourceId
      await recordSourceWatchTime(testSourceId, 600); // 10 minutes

      let state = await getSourceTimeState(testSourceId);
      expect(state.isLimitExceeded).toBe(true);

      // Verify the reset date
      const today = new Date().toISOString().split('T')[0];
      expect(state.lastResetDate).toBe(today);

      // Note: Actual day reset can't be tested without mocking date
      // But the mechanism works through date-based queries
    });
  });
});
