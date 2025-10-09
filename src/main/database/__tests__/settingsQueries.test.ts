import './../../services/__tests__/setup'; // Import mocks first
import DatabaseService from '../../services/DatabaseService';
import SimpleSchemaManager from '../SimpleSchemaManager';
import { resetDatabaseSingleton, createTestDatabase, cleanupTestDatabase } from './testHelpers';
import {
  getSetting,
  setSetting,
  getSettingsByNamespace,
  setSettingsByNamespace,
  deleteSetting,
  deleteSettingsByNamespace,
  getAllSettings,
  countSettings,
  settingExists,
  serializeSetting,
  deserializeSetting,
  inferType
} from '../queries/settingsQueries';
import { DEFAULT_ADMIN_PASSWORD_HASH } from '../../../shared/constants';

describe('Settings Queries', () => {
  let db: DatabaseService;
  let schemaManager: SimpleSchemaManager;

  beforeEach(async () => {
    // Reset singleton for test isolation
    resetDatabaseSingleton();

    // Create in-memory test database
    db = await createTestDatabase({ useMemory: true });
    schemaManager = new SimpleSchemaManager(db);

    // Initialize the consolidated schema
    await schemaManager.initializeSchema();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('setSetting and getSetting', () => {
    it('should set and get string setting', async () => {
      await setSetting(db, 'main.downloadPath', '/home/user/Videos');

      const value = await getSetting<string>(db, 'main.downloadPath');
      expect(value).toBe('/home/user/Videos');
    });

    it('should set and get boolean setting', async () => {
      await setSetting(db, 'main.enableVerboseLogging', true);

      const value = await getSetting<boolean>(db, 'main.enableVerboseLogging');
      expect(value).toBe(true);
    });

    it('should set and get number setting', async () => {
      await setSetting(db, 'pagination.pageSize', 50);

      const value = await getSetting<number>(db, 'pagination.pageSize');
      expect(value).toBe(50);
    });

    it('should set and get object setting', async () => {
      const config = {
        iframe: { showRelatedVideos: false, autoplay: true },
        mediasource: { maxQuality: '1080p' }
      };
      await setSetting(db, 'youtube_player.config', config);

      const value = await getSetting<typeof config>(db, 'youtube_player.config');
      expect(value).toEqual(config);
    });

    it('should return default value for non-existent setting', async () => {
      const value = await getSetting(db, 'nonexistent.key', 'default');
      expect(value).toBe('default');
    });

    it('should return undefined for non-existent setting without default', async () => {
      const value = await getSetting(db, 'nonexistent.key');
      expect(value).toBeUndefined();
    });

    it('should update existing setting', async () => {
      await setSetting(db, 'main.allowYouTubeClicksToOtherVideos', false);
      let value = await getSetting<string>(db, 'main.allowYouTubeClicksToOtherVideos');
      expect(value).toBe(false);

      await setSetting(db, 'main.allowYouTubeClicksToOtherVideos', true);
      value = await getSetting<string>(db, 'main.allowYouTubeClicksToOtherVideos');
      expect(value).toBe(true);

      // Should only have one entry for theme, plus the default password
      const count = await countSettings(db);
      expect(count).toBe(2);
    });
  });

  describe('type inference', () => {
    it('should infer boolean type', () => {
      expect(inferType(true)).toBe('boolean');
      expect(inferType(false)).toBe('boolean');
    });

    it('should infer number type', () => {
      expect(inferType(42)).toBe('number');
      expect(inferType(3.14)).toBe('number');
    });

    it('should infer string type', () => {
      expect(inferType('hello')).toBe('string');
      expect(inferType('')).toBe('string');
    });

    it('should infer object type for objects', () => {
      expect(inferType({ key: 'value' })).toBe('object');
      expect(inferType([1, 2, 3])).toBe('object');
      expect(inferType(null)).toBe('object');
    });
  });

  describe('serialization and deserialization', () => {
    it('should serialize and deserialize boolean', () => {
      const serialized = serializeSetting(true);
      const deserialized = deserializeSetting<boolean>(serialized, 'boolean');
      expect(deserialized).toBe(true);
    });

    it('should serialize and deserialize number', () => {
      const serialized = serializeSetting(42);
      const deserialized = deserializeSetting<number>(serialized, 'number');
      expect(deserialized).toBe(42);
    });

    it('should serialize and deserialize string', () => {
      const serialized = serializeSetting('hello');
      const deserialized = deserializeSetting<string>(serialized, 'string');
      expect(deserialized).toBe('hello');
    });

    it('should serialize and deserialize object', () => {
      const obj = { key: 'value', nested: { num: 42 } };
      const serialized = serializeSetting(obj);
      const deserialized = deserializeSetting<typeof obj>(serialized, 'object');
      expect(deserialized).toEqual(obj);
    });

    it('should handle null values', () => {
      const serialized = serializeSetting(null);
      const deserialized = deserializeSetting<null>(serialized, 'object');
      expect(deserialized).toBeNull();
    });
  });

  describe('getSettingsByNamespace', () => {
    beforeEach(async () => {
      // Setup test data
      await setSetting(db, 'main.downloadPath', '/home/user/Videos');
      await setSetting(db, 'main.youtubeApiKey', 'test-key');
      await setSetting(db, 'main.enableVerboseLogging', true);
      await setSetting(db, 'pagination.pageSize', 50);
      await setSetting(db, 'pagination.cacheDurationMinutes', 300);
    });

    it('should retrieve all settings for main namespace', async () => {
      const mainSettings = await getSettingsByNamespace(db, 'main');

      expect(mainSettings).toEqual({
        adminPassword: DEFAULT_ADMIN_PASSWORD_HASH,
        allowYouTubeClicksToOtherVideos: true,
        downloadPath: '/home/user/Videos',
        youtubeApiKey: 'test-key',
        enableVerboseLogging: true
      });
    });

    it('should retrieve all settings for pagination namespace', async () => {
      const paginationSettings = await getSettingsByNamespace(db, 'pagination');

      expect(paginationSettings).toEqual({
        pageSize: 50,
        cacheDurationMinutes: 300
      });
    });

    it('should return empty object for non-existent namespace', async () => {
      const settings = await getSettingsByNamespace(db, 'nonexistent');
      expect(settings).toEqual({});
    });

    it('should return keys without namespace prefix', async () => {
      const settings = await getSettingsByNamespace(db, 'main');
      expect(Object.keys(settings)).not.toContain('main.downloadPath');
      expect(Object.keys(settings)).toContain('downloadPath');
    });
  });

  describe('setSettingsByNamespace', () => {
    it('should set multiple settings at once', async () => {
      await setSettingsByNamespace(db, 'main', {
        theme: 'dark',
        language: 'en',
        autoSave: true
      });

      const settings = await getSettingsByNamespace(db, 'main');
      expect(settings).toEqual({
        adminPassword: DEFAULT_ADMIN_PASSWORD_HASH,
        allowYouTubeClicksToOtherVideos: true,
        theme: 'dark',
        language: 'en',
        autoSave: true
      });
    });

    it('should update existing namespace settings', async () => {
      await setSettingsByNamespace(db, 'main', {
        theme: 'light',
        language: 'en'
      });

      await setSettingsByNamespace(db, 'main', {
        theme: 'dark',
        fontSize: 14
      });

      const settings = await getSettingsByNamespace(db, 'main');
      expect(settings.theme).toBe('dark');
      expect(settings.language).toBe('en'); // Unchanged
      expect(settings.fontSize).toBe(14); // New
    });
  });

  describe('deleteSetting', () => {
    it('should delete specific setting', async () => {
      await setSetting(db, 'main.allowYouTubeClicksToOtherVideos', false);
      await setSetting(db, 'main.language', 'en');

      await deleteSetting(db, 'main.allowYouTubeClicksToOtherVideos');

      expect(await settingExists(db, 'main.allowYouTubeClicksToOtherVideos')).toBe(false);
      expect(await settingExists(db, 'main.language')).toBe(true);
    });

    it('should handle deleting non-existent setting', async () => {
      await expect(deleteSetting(db, 'nonexistent.key')).resolves.not.toThrow();
    });
  });

  describe('deleteSettingsByNamespace', () => {
    beforeEach(async () => {
      await setSetting(db, 'main.allowYouTubeClicksToOtherVideos', false)
      await setSetting(db, 'main.language', 'en');
      await setSetting(db, 'pagination.pageSize', 50);
    });

    it('should delete all settings in namespace', async () => {
      await deleteSettingsByNamespace(db, 'main');

      const mainSettings = await getSettingsByNamespace(db, 'main');
      const paginationSettings = await getSettingsByNamespace(db, 'pagination');

      expect(mainSettings).toEqual({});
      expect(paginationSettings).toEqual({ pageSize: 50 });
    });

    it('should handle deleting non-existent namespace', async () => {
      await expect(deleteSettingsByNamespace(db, 'nonexistent')).resolves.not.toThrow();
    });
  });

  describe('getAllSettings', () => {
    it('should return all settings with full keys', async () => {
      await setSetting(db, 'main.allowYouTubeClicksToOtherVideos', false);
      await setSetting(db, 'main.language', 'en');
      await setSetting(db, 'pagination.pageSize', 50);

      const settings = await getAllSettings(db);
      expect(settings).toEqual({
        'main.adminPassword': DEFAULT_ADMIN_PASSWORD_HASH,
        'main.allowYouTubeClicksToOtherVideos': false,
        'main.language': 'en',
        'pagination.pageSize': 50
      });
    });
  });

  describe('settingExists', () => {
    it('should return true for existing setting', async () => {
      await setSetting(db, 'main.allowYouTubeClicksToOtherVideos', false);

      expect(await settingExists(db, 'main.allowYouTubeClicksToOtherVideos')).toBe(true);
    });

    it('should return false for non-existent setting', async () => {
      expect(await settingExists(db, 'nonexistent.key')).toBe(false);
    });
  });

  describe('countSettings', () => {
    it('should return 2 when only default password and allowYouTubeClicksToOtherVideos exist', async () => {
      const count = await countSettings(db);
      expect(count).toBe(2);
    });

    it('should return correct count', async () => {
      await setSetting(db, 'main.allowYouTubeClicksToOtherVideos', false);
      await setSetting(db, 'main.language', 'en');
      await setSetting(db, 'pagination.pageSize', 50);

      const count = await countSettings(db);
      expect(count).toBe(4);
    });
  });

  describe('migration from JSON configs', () => {
    it('should migrate mainSettings.json correctly', async () => {
      // Mock data from real mainSettings.json
      const mockMainSettings = {
        downloadPath: '/home/paul/Videos/SafeTube',
        youtubeApiKey: 'your-api-key-here',
        adminPassword: 'dummy-string-not-a-hash-for-testing',
        enableVerboseLogging: true,
        allowYouTubeClicksToOtherVideos: true
      };

      // Migrate
      await setSettingsByNamespace(db, 'main', mockMainSettings);

      // Verify
      const settings = await getSettingsByNamespace(db, 'main');
      expect(settings).toEqual(mockMainSettings);
    });

    it('should migrate pagination.json correctly', async () => {
      const mockPaginationConfig = {
        pageSize: 50,
        cacheDurationMinutes: 300,
        maxCachedPages: 10
      };

      await setSettingsByNamespace(db, 'pagination', mockPaginationConfig);

      const settings = await getSettingsByNamespace(db, 'pagination');
      expect(settings).toEqual(mockPaginationConfig);
    });

    it('should migrate youtubePlayer.json correctly', async () => {
      const mockYouTubePlayerConfig = {
        youtubePlayerType: 'iframe',
        youtubePlayerConfig: {
          iframe: {
            showRelatedVideos: false,
            customEndScreen: true,
            qualityControls: true,
            autoplay: true,
            controls: true
          },
          mediasource: {
            maxQuality: '1080p',
            preferredLanguages: ['en'],
            fallbackToLowerQuality: true
          }
        },
        perVideoOverrides: {
          videoId1: {
            youtubePlayerType: 'mediasource'
          }
        }
      };

      await setSettingsByNamespace(db, 'youtube_player', mockYouTubePlayerConfig);

      const settings = await getSettingsByNamespace(db, 'youtube_player');
      expect(settings).toEqual(mockYouTubePlayerConfig);
    });

    it('should consolidate all three configs into single table', async () => {
      const mockSettings = {
        main: {
          adminPassword: DEFAULT_ADMIN_PASSWORD_HASH,
          allowYouTubeClicksToOtherVideos: true,
          downloadPath: '/home/user/Videos',
          enableVerboseLogging: true
        },
        pagination: {
          pageSize: 50,
          cacheDurationMinutes: 300
        },
        youtube_player: {
          youtubePlayerType: 'iframe',
          autoplay: true
        }
      };

      // Migrate all namespaces
      await setSettingsByNamespace(db, 'main', mockSettings.main);
      await setSettingsByNamespace(db, 'pagination', mockSettings.pagination);
      await setSettingsByNamespace(db, 'youtube_player', mockSettings.youtube_player);

      // Verify all namespaces exist
      const mainSettings = await getSettingsByNamespace(db, 'main');
      const paginationSettings = await getSettingsByNamespace(db, 'pagination');
      const youtubePlayerSettings = await getSettingsByNamespace(db, 'youtube_player');

      expect(mainSettings).toEqual(mockSettings.main);
      expect(paginationSettings).toEqual(mockSettings.pagination);
      expect(youtubePlayerSettings).toEqual(mockSettings.youtube_player);

      // Verify total count
      const count = await countSettings(db);
      expect(count).toBe(8); // 2 main + 2 pagination + 2 youtube_player + 1 adminPassword + 1 allowYouTubeClicksToOtherVideos
    });
  });

  describe('edge cases', () => {
    it('should handle very long setting values', async () => {
      const longValue = 'A'.repeat(10000);
      await setSetting(db, 'test.longValue', longValue);

      const value = await getSetting<string>(db, 'test.longValue');
      expect(value).toBe(longValue);
    });

    it('should handle special characters in keys', async () => {
      await setSetting(db, 'test.key-with_special.chars', 'value');

      const value = await getSetting<string>(db, 'test.key-with_special.chars');
      expect(value).toBe('value');
    });

    it('should handle unicode in values', async () => {
      const unicodeValue = 'Hello 世界 🌍';
      await setSetting(db, 'test.unicode', unicodeValue);

      const value = await getSetting<string>(db, 'test.unicode');
      expect(value).toBe(unicodeValue);
    });

    it('should handle nested objects', async () => {
      const nested = {
        level1: {
          level2: {
            level3: {
              value: 'deep'
            }
          }
        }
      };
      await setSetting(db, 'test.nested', nested);

      const value = await getSetting<typeof nested>(db, 'test.nested');
      expect(value).toEqual(nested);
    });

    it('should handle arrays', async () => {
      const array = [1, 'two', { three: 3 }, [4, 5]];
      await setSetting(db, 'test.array', array);

      const value = await getSetting<typeof array>(db, 'test.array');
      expect(value).toEqual(array);
    });

    it('should enforce unique key constraint', async () => {
      await setSetting(db, 'test.duplicate', 'first');
      await setSetting(db, 'test.duplicate', 'second');

      const value = await getSetting<string>(db, 'test.duplicate');
      expect(value).toBe('second');

      const count = await countSettings(db);
      expect(count).toBe(3);
    });
  });
});
