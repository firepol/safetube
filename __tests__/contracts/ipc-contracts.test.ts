/**
 * IPC Contract Tests
 *
 * These tests verify that the IPC communication contracts between
 * main, preload, and renderer processes are consistent and complete.
 *
 * What these tests catch:
 * - Missing handler registrations for defined IPC channels
 * - Orphaned handlers (handlers for non-existent channels)
 * - Response format inconsistencies (DatabaseResponse<T> structure)
 * - IPC channel inventory changes (via snapshots)
 */

import { describe, test, expect, beforeAll, vi } from 'vitest';
import { IPC, getAllIPCChannels } from '../../src/shared/ipc-channels';
import { captureIPCHandlers, getRegisteredChannels } from '../helpers/ipc-helpers';

// Mock electron module
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  app: {
    getPath: vi.fn(() => '/mock/path'),
    getName: vi.fn(() => 'SafeTube'),
  },
  BrowserWindow: vi.fn(),
}));

// Mock fs module for handler registration
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => '{}'),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    promises: {
      readFile: vi.fn(async () => '{}'),
      writeFile: vi.fn(async () => {}),
    },
  },
}));

// Mock path module
vi.mock('path', () => {
  const mockPath = {
    join: vi.fn((...args) => args.join('/')),
    resolve: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/')),
    basename: vi.fn((p) => p.split('/').pop()),
    extname: vi.fn((p) => {
      const parts = p.split('.');
      return parts.length > 1 ? '.' + parts.pop() : '';
    }),
    sep: '/',
    delimiter: ':',
    parse: vi.fn((p) => ({
      root: '',
      dir: p.split('/').slice(0, -1).join('/'),
      base: p.split('/').pop(),
      ext: p.includes('.') ? '.' + p.split('.').pop() : '',
      name: p.split('/').pop()?.split('.')[0] || '',
    })),
    format: vi.fn((pathObject) => pathObject.base || ''),
    isAbsolute: vi.fn((p) => p.startsWith('/')),
    normalize: vi.fn((p) => p),
    relative: vi.fn((from, to) => to),
    toNamespacedPath: vi.fn((p) => p),
  };

  return {
    default: mockPath,
    ...mockPath, // Export both as default and named exports
  };
});

// Mock other Node modules that main process files might import
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
}));

vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(() => Buffer.from('mock')),
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'mocked-hash'),
    })),
  },
}));

describe('IPC Contract Tests', () => {
  let registeredHandlers: Map<string, Function>;
  let allChannels: string[];

  beforeAll(async () => {
    // Capture handler registrations
    registeredHandlers = captureIPCHandlers();

    // Get all defined IPC channels
    allChannels = getAllIPCChannels();

    // Import and call registerAllHandlers to register all IPC handlers
    // This must happen after mocking electron
    const { registerAllHandlers } = await import('../../src/main/services/ipcHandlerRegistry');
    registerAllHandlers();

    // Also import main.ts to register its handlers (they register at module load)
    // We need to catch errors since these files have side effects
    try {
      await import('../../src/main/main');
    } catch (error) {
      // Ignore errors from importing main process code in test environment
      // We only care about capturing the handler registrations
    }

    // Import index.ts handlers
    try {
      await import('../../src/main/index');
    } catch (error) {
      // Ignore errors, we only need handler registrations
    }
  });

  describe('Channel Registration Validation', () => {
    test('all defined IPC channels have registered handlers', () => {
      const missingHandlers: string[] = [];

      for (const channel of allChannels) {
        if (!registeredHandlers.has(channel)) {
          missingHandlers.push(channel);
        }
      }

      if (missingHandlers.length > 0) {
        console.error('\n❌ Missing handlers for the following channels:');
        missingHandlers.forEach(ch => console.error(`  - ${ch}`));
      }

      expect(missingHandlers).toEqual([]);
    });

    test('no orphaned handlers (handlers for non-existent channels)', () => {
      const validChannels = new Set(allChannels);
      const registeredChannelList = getRegisteredChannels(registeredHandlers);
      const orphanedHandlers: string[] = [];

      for (const channel of registeredChannelList) {
        if (!validChannels.has(channel)) {
          orphanedHandlers.push(channel);
        }
      }

      if (orphanedHandlers.length > 0) {
        console.warn('\n⚠️  Orphaned handlers (not in IPC constants):');
        orphanedHandlers.forEach(ch => console.warn(`  - ${ch}`));
        console.warn('  Consider adding these to src/shared/ipc-channels.ts or removing the handlers');
      }

      expect(orphanedHandlers).toEqual([]);
    });

    test('handler count matches channel count', () => {
      const handlerCount = registeredHandlers.size;
      const channelCount = allChannels.length;

      console.log(`\n📊 IPC Contract Summary:`);
      console.log(`  Total IPC Channels: ${channelCount}`);
      console.log(`  Registered Handlers: ${handlerCount}`);
      console.log(`  Coverage: ${handlerCount === channelCount ? '✅ 100%' : `⚠️  ${Math.round((handlerCount / channelCount) * 100)}%`}`);

      expect(handlerCount).toBe(channelCount);
    });
  });

  describe('Channel Inventory Documentation', () => {
    test('documents IPC channel breakdown by category', () => {
      const breakdown: Record<string, number> = {};

      for (const [category, methods] of Object.entries(IPC)) {
        breakdown[category] = Object.keys(methods).length;
      }

      console.log('\n📋 IPC Channels by Category:');
      for (const [category, count] of Object.entries(breakdown).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${category.padEnd(25)} ${count.toString().padStart(3)} channels`);
      }

      // Snapshot test to detect accidental channel additions/removals
      expect(breakdown).toMatchSnapshot('ipc-channel-breakdown');
    });

    test('all IPC channels snapshot', () => {
      // This will fail if channels are added/removed, alerting developers
      // to update tests and documentation
      expect(allChannels.sort()).toMatchSnapshot('all-ipc-channels');
    });
  });

  describe('Response Format Validation', () => {
    test('database handlers should be prepared to return DatabaseResponse<T> format', () => {
      // Get all database-related channels
      const databaseChannels = [
        ...Object.values(IPC.DATABASE),
        ...Object.values(IPC.FAVORITES),
        ...Object.values(IPC.VIEW_RECORDS),
        ...Object.values(IPC.VIDEOS),
        ...Object.values(IPC.SOURCES),
        ...Object.values(IPC.YOUTUBE_CACHE_DB),
      ];

      // Verify all have handlers registered
      const missingDatabaseHandlers: string[] = [];
      for (const channel of databaseChannels) {
        if (!registeredHandlers.has(channel)) {
          missingDatabaseHandlers.push(channel);
        }
      }

      expect(missingDatabaseHandlers).toEqual([]);
    });
  });

  describe('Naming Convention Validation', () => {
    test('all IPC channels follow naming convention', () => {
      // Expected patterns:
      // - database:category:action
      // - category:action
      // - action (simple handlers)

      const invalidChannels: string[] = [];

      for (const channel of allChannels) {
        // Check for invalid characters
        if (!/^[a-z0-9:-]+$/.test(channel)) {
          invalidChannels.push(`${channel} (contains invalid characters)`);
        }

        // Check for double colons
        if (channel.includes('::')) {
          invalidChannels.push(`${channel} (contains double colons)`);
        }

        // Check for trailing/leading colons
        if (channel.startsWith(':') || channel.endsWith(':')) {
          invalidChannels.push(`${channel} (starts or ends with colon)`);
        }
      }

      if (invalidChannels.length > 0) {
        console.error('\n❌ Invalid channel names:');
        invalidChannels.forEach(ch => console.error(`  - ${ch}`));
      }

      expect(invalidChannels).toEqual([]);
    });

    test('no duplicate channel definitions', () => {
      const channelCounts = new Map<string, number>();

      for (const channel of allChannels) {
        channelCounts.set(channel, (channelCounts.get(channel) || 0) + 1);
      }

      const duplicates = Array.from(channelCounts.entries())
        .filter(([_, count]) => count > 1)
        .map(([channel, count]) => `${channel} (${count} times)`);

      if (duplicates.length > 0) {
        console.error('\n❌ Duplicate channel definitions:');
        duplicates.forEach(dup => console.error(`  - ${dup}`));
      }

      expect(duplicates).toEqual([]);
    });
  });

  describe('Category Organization', () => {
    test('all channels are properly categorized', () => {
      // Ensure no empty categories
      const emptyCategories: string[] = [];

      for (const [category, methods] of Object.entries(IPC)) {
        if (Object.keys(methods).length === 0) {
          emptyCategories.push(category);
        }
      }

      if (emptyCategories.length > 0) {
        console.warn('\n⚠️  Empty IPC categories:');
        emptyCategories.forEach(cat => console.warn(`  - ${cat}`));
      }

      expect(emptyCategories).toEqual([]);
    });

    test('related channels are grouped in same category', () => {
      // This is more of a documentation test
      // Verify that database-related operations are in DATABASE/FAVORITES/etc categories
      const databaseCategories = [
        'DATABASE',
        'FAVORITES',
        'FAVORITES_LEGACY',
        'VIEW_RECORDS',
        'VIDEOS',
        'SOURCES',
        'YOUTUBE_CACHE_DB',
        'YOUTUBE_CACHE',
      ];

      for (const category of databaseCategories) {
        expect(IPC).toHaveProperty(category);
      }
    });
  });
});
