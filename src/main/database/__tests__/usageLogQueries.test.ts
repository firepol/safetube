import './../../services/__tests__/setup'; // Import mocks first
import DatabaseService from '../../services/DatabaseService';
import SimpleSchemaManager from '../SimpleSchemaManager';
import { resetDatabaseSingleton, createTestDatabase, cleanupTestDatabase } from './testHelpers';
import {
  getUsageLogByDate,
  getAllUsageLogs,
  getUsageLogsByDateRange,
  upsertUsageLog,
  incrementUsageLog,
  deleteUsageLog,
  getMonthlyUsage,
  countUsageLogs
} from '../queries/usageLogQueries';
import { UsageLog } from '../queries/types';

describe('Usage Log Queries', () => {
  let db: DatabaseService;
  let schemaManager: SimpleSchemaManager;

  beforeEach(async () => {
    // Reset singleton for test isolation
    resetDatabaseSingleton();

    // Create in-memory test database
    db = await createTestDatabase({ useMemory: true });
    schemaManager = new SimpleSchemaManager(db);

    // Initialize Phase 1 schema first (for schema_version table)
    await schemaManager.initializePhase1Schema();

    // Initialize Phase 2 schema (creates usage_logs table)
    await schemaManager.initializePhase2Schema();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('upsertUsageLog', () => {
    it('should create new usage log entry', async () => {
      await upsertUsageLog(db, '2025-10-03', 3600);

      const log = await getUsageLogByDate(db, '2025-10-03');
      expect(log).toBeDefined();
      expect(log?.date).toBe('2025-10-03');
      expect(log?.seconds_used).toBe(3600);
    });

    it('should update existing usage log entry', async () => {
      // Create initial entry
      await upsertUsageLog(db, '2025-10-03', 1800);

      // Update same date
      await upsertUsageLog(db, '2025-10-03', 3600);

      const log = await getUsageLogByDate(db, '2025-10-03');
      expect(log?.seconds_used).toBe(3600);

      // Should only have one entry
      const count = await countUsageLogs(db);
      expect(count).toBe(1);
    });

    it('should handle floating point seconds', async () => {
      // Test with decimal seconds (as in real usageLog.json)
      await upsertUsageLog(db, '2025-09-13', 101.426);

      const log = await getUsageLogByDate(db, '2025-09-13');
      expect(log?.seconds_used).toBeCloseTo(101.426, 3);
    });
  });

  describe('incrementUsageLog', () => {
    it('should create new entry and increment', async () => {
      await incrementUsageLog(db, '2025-10-03', 600);

      const log = await getUsageLogByDate(db, '2025-10-03');
      expect(log?.seconds_used).toBe(600);
    });

    it('should increment existing entry', async () => {
      // Create initial entry
      await upsertUsageLog(db, '2025-10-03', 1800);

      // Increment by 600 seconds
      await incrementUsageLog(db, '2025-10-03', 600);

      const log = await getUsageLogByDate(db, '2025-10-03');
      expect(log?.seconds_used).toBe(2400);
    });

    it('should handle multiple increments', async () => {
      await incrementUsageLog(db, '2025-10-03', 300);
      await incrementUsageLog(db, '2025-10-03', 450);
      await incrementUsageLog(db, '2025-10-03', 250);

      const log = await getUsageLogByDate(db, '2025-10-03');
      expect(log?.seconds_used).toBe(1000);
    });
  });

  describe('getUsageLogByDate', () => {
    it('should return null for non-existent date', async () => {
      const log = await getUsageLogByDate(db, '2025-10-03');
      expect(log).toBeNull();
    });

    it('should return usage log for existing date', async () => {
      await upsertUsageLog(db, '2025-10-03', 1800);

      const log = await getUsageLogByDate(db, '2025-10-03');
      expect(log).toBeDefined();
      expect(log?.date).toBe('2025-10-03');
      expect(log?.seconds_used).toBe(1800);
    });
  });

  describe('getAllUsageLogs', () => {
    it('should return empty array when no logs exist', async () => {
      const logs = await getAllUsageLogs(db);
      expect(logs).toEqual([]);
    });

    it('should return all logs ordered by date descending', async () => {
      await upsertUsageLog(db, '2025-10-01', 1800);
      await upsertUsageLog(db, '2025-10-03', 2400);
      await upsertUsageLog(db, '2025-10-02', 3000);

      const logs = await getAllUsageLogs(db);
      expect(logs).toHaveLength(3);
      expect(logs[0].date).toBe('2025-10-03'); // Most recent first
      expect(logs[1].date).toBe('2025-10-02');
      expect(logs[2].date).toBe('2025-10-01');
    });
  });

  describe('getUsageLogsByDateRange', () => {
    beforeEach(async () => {
      // Setup test data
      await upsertUsageLog(db, '2025-09-28', 1000);
      await upsertUsageLog(db, '2025-09-29', 1500);
      await upsertUsageLog(db, '2025-09-30', 2000);
      await upsertUsageLog(db, '2025-10-01', 2500);
      await upsertUsageLog(db, '2025-10-02', 3000);
    });

    it('should return logs within date range', async () => {
      const logs = await getUsageLogsByDateRange(db, '2025-09-29', '2025-10-01');

      expect(logs).toHaveLength(3);
      expect(logs[0].date).toBe('2025-09-29');
      expect(logs[1].date).toBe('2025-09-30');
      expect(logs[2].date).toBe('2025-10-01');
    });

    it('should return empty array for range with no logs', async () => {
      const logs = await getUsageLogsByDateRange(db, '2025-11-01', '2025-11-30');
      expect(logs).toEqual([]);
    });

    it('should handle single-day range', async () => {
      const logs = await getUsageLogsByDateRange(db, '2025-09-30', '2025-09-30');

      expect(logs).toHaveLength(1);
      expect(logs[0].date).toBe('2025-09-30');
    });
  });

  describe('getMonthlyUsage', () => {
    beforeEach(async () => {
      // Setup test data for September and October
      await upsertUsageLog(db, '2025-09-28', 1000);
      await upsertUsageLog(db, '2025-09-29', 1500);
      await upsertUsageLog(db, '2025-09-30', 2000);
      await upsertUsageLog(db, '2025-10-01', 2500);
      await upsertUsageLog(db, '2025-10-02', 3000);
    });

    it('should calculate total usage for September', async () => {
      const total = await getMonthlyUsage(db, '2025-09');
      expect(total).toBe(4500); // 1000 + 1500 + 2000
    });

    it('should calculate total usage for October', async () => {
      const total = await getMonthlyUsage(db, '2025-10');
      expect(total).toBe(5500); // 2500 + 3000
    });

    it('should return 0 for month with no logs', async () => {
      const total = await getMonthlyUsage(db, '2025-11');
      expect(total).toBe(0);
    });
  });

  describe('deleteUsageLog', () => {
    it('should delete specific usage log', async () => {
      await upsertUsageLog(db, '2025-10-01', 1800);
      await upsertUsageLog(db, '2025-10-02', 2400);

      await deleteUsageLog(db, '2025-10-01');

      const log1 = await getUsageLogByDate(db, '2025-10-01');
      const log2 = await getUsageLogByDate(db, '2025-10-02');

      expect(log1).toBeNull();
      expect(log2).toBeDefined();
    });

    it('should handle deleting non-existent log', async () => {
      await expect(deleteUsageLog(db, '2025-10-03')).resolves.not.toThrow();
    });
  });

  describe('countUsageLogs', () => {
    it('should return 0 when no logs exist', async () => {
      const count = await countUsageLogs(db);
      expect(count).toBe(0);
    });

    it('should return correct count', async () => {
      await upsertUsageLog(db, '2025-10-01', 1800);
      await upsertUsageLog(db, '2025-10-02', 2400);
      await upsertUsageLog(db, '2025-10-03', 3000);

      const count = await countUsageLogs(db);
      expect(count).toBe(3);
    });
  });

  describe('migration from JSON', () => {
    it('should migrate usageLog.json data correctly', async () => {
      // Mock data from real usageLog.json
      const mockUsageLog = {
        '2024-01-15': 1800,
        '2024-01-14': 3600,
        '2025-09-13': 101.426,
        '2025-09-14': 622.036,
        '2025-09-30': 138.369
      };

      // Migrate data
      for (const [date, seconds] of Object.entries(mockUsageLog)) {
        await upsertUsageLog(db, date, seconds);
      }

      // Verify migration
      const allLogs = await getAllUsageLogs(db);
      expect(allLogs).toHaveLength(5);

      // Check specific entries
      const log1 = await getUsageLogByDate(db, '2024-01-15');
      expect(log1?.seconds_used).toBe(1800);

      const log2 = await getUsageLogByDate(db, '2025-09-13');
      expect(log2?.seconds_used).toBeCloseTo(101.426, 3);

      // Verify no duplicates
      const count = await countUsageLogs(db);
      expect(count).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('should handle very large usage values', async () => {
      const largeValue = 999999999; // ~31 years in seconds
      await upsertUsageLog(db, '2025-10-03', largeValue);

      const log = await getUsageLogByDate(db, '2025-10-03');
      expect(log?.seconds_used).toBe(largeValue);
    });

    it('should handle zero usage', async () => {
      await upsertUsageLog(db, '2025-10-03', 0);

      const log = await getUsageLogByDate(db, '2025-10-03');
      expect(log?.seconds_used).toBe(0);
    });

    it('should enforce UNIQUE constraint on date', async () => {
      // This should not throw because upsertUsageLog uses INSERT OR REPLACE
      await upsertUsageLog(db, '2025-10-03', 1800);
      await upsertUsageLog(db, '2025-10-03', 2400);

      const count = await countUsageLogs(db);
      expect(count).toBe(1);
    });
  });
});
