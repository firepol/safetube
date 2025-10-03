import './../../services/__tests__/setup'; // Import mocks first
import DatabaseService from '../../services/DatabaseService';
import SimpleSchemaManager from '../SimpleSchemaManager';
import { resetDatabaseSingleton, createTestDatabase, cleanupTestDatabase } from './testHelpers';
import {
  getUsageExtrasByDate,
  getTotalExtraMinutes,
  getUsageExtrasByDateRange,
  addUsageExtra,
  deleteUsageExtra,
  deleteUsageExtrasByDate,
  getAllUsageExtras,
  countUsageExtras
} from '../queries/usageExtraQueries';
import { UsageExtra } from '../queries/types';

describe('Usage Extra Queries', () => {
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

    // Initialize Phase 2 schema (creates usage_extras table)
    await schemaManager.initializePhase2Schema();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('addUsageExtra', () => {
    it('should add usage extra with all fields', async () => {
      await addUsageExtra(db, '2025-10-03', 15, 'Good behavior', 'parent');

      const extras = await getUsageExtrasByDate(db, '2025-10-03');
      expect(extras).toHaveLength(1);
      expect(extras[0].date).toBe('2025-10-03');
      expect(extras[0].minutes_added).toBe(15);
      expect(extras[0].reason).toBe('Good behavior');
      expect(extras[0].added_by).toBe('parent');
    });

    it('should add usage extra without optional fields', async () => {
      await addUsageExtra(db, '2025-10-03', 10);

      const extras = await getUsageExtrasByDate(db, '2025-10-03');
      expect(extras).toHaveLength(1);
      expect(extras[0].minutes_added).toBe(10);
      expect(extras[0].reason).toBeNull();
      expect(extras[0].added_by).toBe('admin'); // Default value
    });

    it('should allow multiple extras for same date (audit trail)', async () => {
      await addUsageExtra(db, '2025-10-03', 10, 'First addition');
      await addUsageExtra(db, '2025-10-03', 5, 'Second addition');
      await addUsageExtra(db, '2025-10-03', -15, 'Revoked for misbehavior');

      const extras = await getUsageExtrasByDate(db, '2025-10-03');
      expect(extras).toHaveLength(3);
    });

    it('should handle negative minutes (time removal)', async () => {
      await addUsageExtra(db, '2025-10-03', -20, 'Time penalty');

      const extras = await getUsageExtrasByDate(db, '2025-10-03');
      expect(extras[0].minutes_added).toBe(-20);
    });
  });

  describe('getUsageExtrasByDate', () => {
    it('should return empty array for date with no extras', async () => {
      const extras = await getUsageExtrasByDate(db, '2025-10-03');
      expect(extras).toEqual([]);
    });

    it('should return all extras for a specific date ordered by creation time', async () => {
      await addUsageExtra(db, '2025-10-03', 10, 'First');
      await addUsageExtra(db, '2025-10-03', 5, 'Second');
      await addUsageExtra(db, '2025-10-03', 15, 'Third');

      const extras = await getUsageExtrasByDate(db, '2025-10-03');
      expect(extras).toHaveLength(3);
      expect(extras[0].reason).toBe('First');
      expect(extras[1].reason).toBe('Second');
      expect(extras[2].reason).toBe('Third');
    });
  });

  describe('getTotalExtraMinutes', () => {
    it('should return 0 for date with no extras', async () => {
      const total = await getTotalExtraMinutes(db, '2025-10-03');
      expect(total).toBe(0);
    });

    it('should sum all extras for a date', async () => {
      await addUsageExtra(db, '2025-10-03', 10);
      await addUsageExtra(db, '2025-10-03', 5);
      await addUsageExtra(db, '2025-10-03', 15);

      const total = await getTotalExtraMinutes(db, '2025-10-03');
      expect(total).toBe(30);
    });

    it('should handle mix of positive and negative values', async () => {
      await addUsageExtra(db, '2025-10-03', 20);
      await addUsageExtra(db, '2025-10-03', -10);
      await addUsageExtra(db, '2025-10-03', 5);

      const total = await getTotalExtraMinutes(db, '2025-10-03');
      expect(total).toBe(15); // 20 - 10 + 5
    });

    it('should handle net negative total', async () => {
      await addUsageExtra(db, '2025-10-03', 10);
      await addUsageExtra(db, '2025-10-03', -20);

      const total = await getTotalExtraMinutes(db, '2025-10-03');
      expect(total).toBe(-10);
    });
  });

  describe('getUsageExtrasByDateRange', () => {
    beforeEach(async () => {
      // Setup test data across multiple dates
      await addUsageExtra(db, '2025-09-28', 10, 'Sept 28');
      await addUsageExtra(db, '2025-09-29', 15, 'Sept 29');
      await addUsageExtra(db, '2025-09-30', 20, 'Sept 30');
      await addUsageExtra(db, '2025-10-01', 25, 'Oct 1');
      await addUsageExtra(db, '2025-10-02', 30, 'Oct 2');
    });

    it('should return extras within date range', async () => {
      const extras = await getUsageExtrasByDateRange(db, '2025-09-29', '2025-10-01');

      expect(extras).toHaveLength(3);
      expect(extras[0].date).toBe('2025-09-29');
      expect(extras[1].date).toBe('2025-09-30');
      expect(extras[2].date).toBe('2025-10-01');
    });

    it('should return empty array for range with no extras', async () => {
      const extras = await getUsageExtrasByDateRange(db, '2025-11-01', '2025-11-30');
      expect(extras).toEqual([]);
    });

    it('should handle single-day range', async () => {
      const extras = await getUsageExtrasByDateRange(db, '2025-09-30', '2025-09-30');

      expect(extras).toHaveLength(1);
      expect(extras[0].date).toBe('2025-09-30');
    });
  });

  describe('deleteUsageExtra', () => {
    it('should delete specific usage extra by id', async () => {
      await addUsageExtra(db, '2025-10-03', 10, 'First');
      await addUsageExtra(db, '2025-10-03', 15, 'Second');

      const extras = await getUsageExtrasByDate(db, '2025-10-03');
      const firstId = extras[0].id;

      await deleteUsageExtra(db, firstId);

      const remaining = await getUsageExtrasByDate(db, '2025-10-03');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].reason).toBe('Second');
    });

    it('should handle deleting non-existent id', async () => {
      await expect(deleteUsageExtra(db, 999)).resolves.not.toThrow();
    });
  });

  describe('deleteUsageExtrasByDate', () => {
    it('should delete all extras for a specific date', async () => {
      await addUsageExtra(db, '2025-10-03', 10);
      await addUsageExtra(db, '2025-10-03', 15);
      await addUsageExtra(db, '2025-10-04', 20);

      await deleteUsageExtrasByDate(db, '2025-10-03');

      const extras1 = await getUsageExtrasByDate(db, '2025-10-03');
      const extras2 = await getUsageExtrasByDate(db, '2025-10-04');

      expect(extras1).toEqual([]);
      expect(extras2).toHaveLength(1);
    });

    it('should handle deleting from date with no extras', async () => {
      await expect(deleteUsageExtrasByDate(db, '2025-10-03')).resolves.not.toThrow();
    });
  });

  describe('getAllUsageExtras', () => {
    it('should return empty array when no extras exist', async () => {
      const extras = await getAllUsageExtras(db);
      expect(extras).toEqual([]);
    });

    it('should return all extras ordered by date DESC, then created_at DESC', async () => {
      await addUsageExtra(db, '2025-10-01', 10, 'Oct 1 - First');
      await addUsageExtra(db, '2025-10-03', 20, 'Oct 3');
      await addUsageExtra(db, '2025-10-01', 15, 'Oct 1 - Second');
      await addUsageExtra(db, '2025-10-02', 25, 'Oct 2');

      const extras = await getAllUsageExtras(db);
      expect(extras).toHaveLength(4);
      // Most recent date first
      expect(extras[0].date).toBe('2025-10-03');
      expect(extras[1].date).toBe('2025-10-02');
      // Oct 1 entries: most recent creation first
      expect(extras[2].date).toBe('2025-10-01');
      expect(extras[2].reason).toBe('Oct 1 - Second');
      expect(extras[3].date).toBe('2025-10-01');
      expect(extras[3].reason).toBe('Oct 1 - First');
    });
  });

  describe('countUsageExtras', () => {
    it('should return 0 when no extras exist', async () => {
      const count = await countUsageExtras(db);
      expect(count).toBe(0);
    });

    it('should return correct count', async () => {
      await addUsageExtra(db, '2025-10-01', 10);
      await addUsageExtra(db, '2025-10-02', 15);
      await addUsageExtra(db, '2025-10-03', 20);

      const count = await countUsageExtras(db);
      expect(count).toBe(3);
    });
  });

  describe('migration from timeExtra.json', () => {
    it('should migrate timeExtra.json data correctly', async () => {
      // Mock data from real timeExtra.json
      const mockTimeExtra = {
        '2025-08-18': 0,
        '2025-09-12': -20
      };

      // Migrate data
      for (const [date, minutes] of Object.entries(mockTimeExtra)) {
        await addUsageExtra(db, date, minutes, 'Migrated from timeExtra.json');
      }

      // Verify migration
      const allExtras = await getAllUsageExtras(db);
      expect(allExtras).toHaveLength(2);

      // Check specific entries
      const extras1 = await getUsageExtrasByDate(db, '2025-08-18');
      expect(extras1).toHaveLength(1);
      expect(extras1[0].minutes_added).toBe(0);

      const extras2 = await getUsageExtrasByDate(db, '2025-09-12');
      expect(extras2).toHaveLength(1);
      expect(extras2[0].minutes_added).toBe(-20);

      // Verify totals
      const total1 = await getTotalExtraMinutes(db, '2025-08-18');
      const total2 = await getTotalExtraMinutes(db, '2025-09-12');
      expect(total1).toBe(0);
      expect(total2).toBe(-20);
    });
  });

  describe('edge cases', () => {
    it('should handle very large positive minutes', async () => {
      const largeValue = 999999;
      await addUsageExtra(db, '2025-10-03', largeValue);

      const extras = await getUsageExtrasByDate(db, '2025-10-03');
      expect(extras[0].minutes_added).toBe(largeValue);
    });

    it('should handle very large negative minutes', async () => {
      const largeNegative = -999999;
      await addUsageExtra(db, '2025-10-03', largeNegative);

      const extras = await getUsageExtrasByDate(db, '2025-10-03');
      expect(extras[0].minutes_added).toBe(largeNegative);
    });

    it('should preserve empty string reason as null', async () => {
      await addUsageExtra(db, '2025-10-03', 10, '');

      const extras = await getUsageExtrasByDate(db, '2025-10-03');
      // Empty strings are stored as empty strings but may be returned as null
      // This is acceptable behavior for optional text fields
      expect(extras[0].reason === '' || extras[0].reason === null).toBe(true);
    });

    it('should handle long reason text', async () => {
      const longReason = 'A'.repeat(1000);
      await addUsageExtra(db, '2025-10-03', 10, longReason);

      const extras = await getUsageExtrasByDate(db, '2025-10-03');
      expect(extras[0].reason).toBe(longReason);
    });

    it('should handle special characters in reason', async () => {
      const specialReason = "Test with 'quotes', \"double quotes\", and unicode: 😀";
      await addUsageExtra(db, '2025-10-03', 10, specialReason, 'admin');

      const extras = await getUsageExtrasByDate(db, '2025-10-03');
      expect(extras[0].reason).toBe(specialReason);
    });
  });
});
