import './../../services/__tests__/setup'; // Import mocks first
import DatabaseService from '../../services/DatabaseService';
import SimpleSchemaManager from '../SimpleSchemaManager';
import { resetDatabaseSingleton, createTestDatabase, cleanupTestDatabase } from './testHelpers';
import {
  getTimeLimits,
  getTimeLimitForDay,
  upsertTimeLimits,
  updateDayLimit,
  initializeDefaultTimeLimits
} from '../queries/timeLimitQueries';
import { TimeLimit } from '../queries/types';

describe('Time Limit Queries', () => {
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

    // Initialize Phase 2 schema (creates time_limits table with default row)
    await schemaManager.initializePhase2Schema();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('getTimeLimits', () => {
    it('should return default time limits after schema initialization', async () => {
      const limits = await getTimeLimits(db);

      expect(limits).toBeDefined();
      expect(limits?.id).toBe(1);
      expect(limits?.monday).toBe(0);
      expect(limits?.tuesday).toBe(0);
      expect(limits?.wednesday).toBe(0);
      expect(limits?.thursday).toBe(0);
      expect(limits?.friday).toBe(0);
      expect(limits?.saturday).toBe(0);
      expect(limits?.sunday).toBe(0);
      expect(limits?.use_system_beep).toBe(0); // SQLite stores boolean as 0/1
    });
  });

  describe('upsertTimeLimits', () => {
    it('should update time limits configuration', async () => {
      await upsertTimeLimits(db, {
        monday: 30,
        tuesday: 30,
        wednesday: 30,
        thursday: 30,
        friday: 45,
        saturday: 90,
        sunday: 90,
        warning_threshold_minutes: 3,
        countdown_warning_seconds: 60,
        audio_warning_seconds: 10,
        time_up_message: "Time's up for today!",
        use_system_beep: false,
        custom_beep_sound: ''
      });

      const limits = await getTimeLimits(db);
      expect(limits?.monday).toBe(30);
      expect(limits?.friday).toBe(45);
      expect(limits?.saturday).toBe(90);
      expect(limits?.warning_threshold_minutes).toBe(3);
      expect(limits?.countdown_warning_seconds).toBe(60);
      expect(limits?.audio_warning_seconds).toBe(10);
      expect(limits?.time_up_message).toBe("Time's up for today!");
    });

    it('should handle null optional fields', async () => {
      await upsertTimeLimits(db, {
        monday: 30,
        tuesday: 30,
        wednesday: 30,
        thursday: 30,
        friday: 45,
        saturday: 90,
        sunday: 90,
        warning_threshold_minutes: null,
        countdown_warning_seconds: null,
        audio_warning_seconds: null,
        time_up_message: null,
        use_system_beep: false,
        custom_beep_sound: null
      });

      const limits = await getTimeLimits(db);
      expect(limits?.monday).toBe(30);
      expect(limits?.warning_threshold_minutes).toBeNull();
      expect(limits?.countdown_warning_seconds).toBeNull();
      expect(limits?.time_up_message).toBeNull();
    });

    it('should maintain single row (id = 1)', async () => {
      // First update
      await upsertTimeLimits(db, {
        monday: 30,
        tuesday: 30,
        wednesday: 30,
        thursday: 30,
        friday: 45,
        saturday: 90,
        sunday: 90,
        warning_threshold_minutes: 3,
        countdown_warning_seconds: 60,
        audio_warning_seconds: 10,
        time_up_message: "First message",
        use_system_beep: false,
        custom_beep_sound: null
      });

      // Second update should replace, not insert
      await upsertTimeLimits(db, {
        monday: 60,
        tuesday: 60,
        wednesday: 60,
        thursday: 60,
        friday: 90,
        saturday: 120,
        sunday: 120,
        warning_threshold_minutes: 5,
        countdown_warning_seconds: 120,
        audio_warning_seconds: 20,
        time_up_message: "Second message",
        use_system_beep: true,
        custom_beep_sound: '/path/to/sound.mp3'
      });

      const limits = await getTimeLimits(db);
      expect(limits?.id).toBe(1);
      expect(limits?.monday).toBe(60);
      expect(limits?.time_up_message).toBe("Second message");
      expect(limits?.use_system_beep).toBe(1); // SQLite stores boolean as 0/1

      // Verify only one row exists
      const allRows = await db.all<TimeLimit>('SELECT * FROM time_limits');
      expect(allRows).toHaveLength(1);
    });
  });

  describe('getTimeLimitForDay', () => {
    beforeEach(async () => {
      // Setup test data
      await upsertTimeLimits(db, {
        monday: 30,
        tuesday: 35,
        wednesday: 40,
        thursday: 45,
        friday: 50,
        saturday: 90,
        sunday: 100,
        warning_threshold_minutes: null,
        countdown_warning_seconds: null,
        audio_warning_seconds: null,
        time_up_message: null,
        use_system_beep: false,
        custom_beep_sound: null
      });
    });

    it('should return correct limit for Sunday (0)', async () => {
      const limit = await getTimeLimitForDay(db, 0);
      expect(limit).toBe(100);
    });

    it('should return correct limit for Monday (1)', async () => {
      const limit = await getTimeLimitForDay(db, 1);
      expect(limit).toBe(30);
    });

    it('should return correct limit for Wednesday (3)', async () => {
      const limit = await getTimeLimitForDay(db, 3);
      expect(limit).toBe(40);
    });

    it('should return correct limit for Saturday (6)', async () => {
      const limit = await getTimeLimitForDay(db, 6);
      expect(limit).toBe(90);
    });

    it('should return 0 for uninitialized database', async () => {
      // Reset to default (all zeros)
      await upsertTimeLimits(db, {
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0,
        warning_threshold_minutes: null,
        countdown_warning_seconds: null,
        audio_warning_seconds: null,
        time_up_message: null,
        use_system_beep: false,
        custom_beep_sound: null
      });

      const limit = await getTimeLimitForDay(db, 1);
      expect(limit).toBe(0);
    });
  });

  describe('updateDayLimit', () => {
    it('should update specific day limit', async () => {
      // Initial state: all zeros
      await updateDayLimit(db, 'monday', 45);

      const limits = await getTimeLimits(db);
      expect(limits?.monday).toBe(45);
      expect(limits?.tuesday).toBe(0); // Other days unchanged
    });

    it('should update multiple days independently', async () => {
      await updateDayLimit(db, 'monday', 30);
      await updateDayLimit(db, 'friday', 60);
      await updateDayLimit(db, 'saturday', 90);

      const limits = await getTimeLimits(db);
      expect(limits?.monday).toBe(30);
      expect(limits?.friday).toBe(60);
      expect(limits?.saturday).toBe(90);
      expect(limits?.tuesday).toBe(0); // Unchanged days remain at default
    });

    it('should reject invalid day names', async () => {
      await expect(updateDayLimit(db, 'invalid', 30)).rejects.toThrow('Invalid day of week');
      await expect(updateDayLimit(db, 'Mon', 30)).rejects.toThrow('Invalid day of week');
    });

    it('should accept case-insensitive day names', async () => {
      await updateDayLimit(db, 'Monday', 45);
      await updateDayLimit(db, 'TUESDAY', 50);

      const limits = await getTimeLimits(db);
      expect(limits?.monday).toBe(45);
      expect(limits?.tuesday).toBe(50);
    });
  });

  describe('initializeDefaultTimeLimits', () => {
    it('should not overwrite existing configuration', async () => {
      // Set custom limits
      await upsertTimeLimits(db, {
        monday: 45,
        tuesday: 45,
        wednesday: 45,
        thursday: 45,
        friday: 60,
        saturday: 90,
        sunday: 90,
        warning_threshold_minutes: 5,
        countdown_warning_seconds: 120,
        audio_warning_seconds: 20,
        time_up_message: "Custom message",
        use_system_beep: true,
        custom_beep_sound: '/custom/sound.mp3'
      });

      // Try to initialize defaults (should do nothing)
      await initializeDefaultTimeLimits(db);

      const limits = await getTimeLimits(db);
      expect(limits?.monday).toBe(45); // Should NOT be reset to 0
      expect(limits?.time_up_message).toBe("Custom message");
    });
  });

  describe('migration from timeLimits.json', () => {
    it('should migrate timeLimits.json data correctly', async () => {
      // Mock data from real timeLimits.json
      const mockTimeLimits = {
        Monday: 30,
        Tuesday: 30,
        Wednesday: 30,
        Thursday: 30,
        Friday: 45,
        Saturday: 90,
        Sunday: 90,
        warningThresholdMinutes: 3,
        countdownWarningSeconds: 60,
        audioWarningSeconds: 10,
        timeUpMessage: "Time's up for today! Here's your schedule:",
        useSystemBeep: false,
        customBeepSound: ""
      };

      // Migrate: convert capitalized day names to lowercase
      await upsertTimeLimits(db, {
        monday: mockTimeLimits.Monday,
        tuesday: mockTimeLimits.Tuesday,
        wednesday: mockTimeLimits.Wednesday,
        thursday: mockTimeLimits.Thursday,
        friday: mockTimeLimits.Friday,
        saturday: mockTimeLimits.Saturday,
        sunday: mockTimeLimits.Sunday,
        warning_threshold_minutes: mockTimeLimits.warningThresholdMinutes,
        countdown_warning_seconds: mockTimeLimits.countdownWarningSeconds,
        audio_warning_seconds: mockTimeLimits.audioWarningSeconds,
        time_up_message: mockTimeLimits.timeUpMessage,
        use_system_beep: mockTimeLimits.useSystemBeep,
        custom_beep_sound: mockTimeLimits.customBeepSound || null
      });

      // Verify migration
      const limits = await getTimeLimits(db);
      expect(limits?.monday).toBe(30);
      expect(limits?.friday).toBe(45);
      expect(limits?.saturday).toBe(90);
      expect(limits?.sunday).toBe(90);
      expect(limits?.warning_threshold_minutes).toBe(3);
      expect(limits?.countdown_warning_seconds).toBe(60);
      expect(limits?.audio_warning_seconds).toBe(10);
      expect(limits?.time_up_message).toBe("Time's up for today! Here's your schedule:");
      expect(limits?.use_system_beep).toBe(0); // SQLite stores boolean as 0/1

      // Verify only one row exists
      const allRows = await db.all<TimeLimit>('SELECT * FROM time_limits');
      expect(allRows).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle very large time limit values', async () => {
      const largeValue = 999999; // ~694 days
      await upsertTimeLimits(db, {
        monday: largeValue,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0,
        warning_threshold_minutes: null,
        countdown_warning_seconds: null,
        audio_warning_seconds: null,
        time_up_message: null,
        use_system_beep: false,
        custom_beep_sound: null
      });

      const limits = await getTimeLimits(db);
      expect(limits?.monday).toBe(largeValue);
    });

    it('should handle empty time up message', async () => {
      await upsertTimeLimits(db, {
        monday: 30,
        tuesday: 30,
        wednesday: 30,
        thursday: 30,
        friday: 45,
        saturday: 90,
        sunday: 90,
        warning_threshold_minutes: 3,
        countdown_warning_seconds: 60,
        audio_warning_seconds: 10,
        time_up_message: '',
        use_system_beep: false,
        custom_beep_sound: null
      });

      const limits = await getTimeLimits(db);
      expect(limits?.time_up_message).toBe('');
    });

    it('should enforce single-row constraint via CHECK', async () => {
      // Attempting to insert row with id != 1 should fail
      await expect(
        db.run(
          `INSERT INTO time_limits (id, monday, tuesday, wednesday, thursday, friday, saturday, sunday)
           VALUES (2, 30, 30, 30, 30, 30, 30, 30)`
        )
      ).rejects.toThrow();
    });
  });
});
