# SafeTube Testing Strategy & Improvements

## Context & Motivation

### Current Testing Challenges

During development, we've encountered several categories of runtime errors that unit tests with mocks fail to catch:

1. **IPC Method Mismatches**
   - Preload exposes a method that doesn't exist in main process
   - Main handler renamed but preload still uses old channel name
   - Frontend calls a method with typo (e.g., `getFavourites` vs `getFavorites`)

2. **Database Schema Changes**
   - Database migrations change column names/types
   - IPC handlers return data in old format
   - Frontend expects different response shape

3. **Refactoring Breakage**
   - Changes in one layer (main/preload/renderer) don't propagate
   - TypeScript compiles successfully but runtime fails
   - Integration between processes breaks silently

### The Core Problem: Mocked Tests Give False Confidence

```typescript
// Test passes with mocks
test('should get favorites', async () => {
  mockDb.get.mockResolvedValue({ count: 1 });
  const result = await getFavorites();
  expect(result).toBeDefined(); // ✅ PASS
});

// But production fails
// Runtime Error: "No handler registered for 'favorites:get-all'"
// or: SQLITE_ERROR: no such column: video_id
```

**The issue**: Unit tests verify individual components work in isolation, but don't test how processes communicate or interact with real databases.

---

## Testing Strategy Overview

### The Electron Testing Pyramid

Electron apps have three isolated processes (main, preload, renderer) that communicate via IPC. Traditional web testing pyramids don't account for cross-process integration:

```
       E2E Tests (Playwright)
      /                      \
     /   5-10 Critical Flows  \      ← Full app, real user scenarios
    /─────────────────────────\
   /                           \
  /   Integration Tests         \    ← Real DB, real IPC, no mocks
 /     30-50 Test Cases          \   ← Tests cross-process communication
/──────────────────────────────────\

    Contract Tests                   ← IPC channel validation
      10-20 Test Cases               ← Preload ↔ Main consistency


      Unit Tests (Existing)          ← Keep current vitest tests
        100+ Test Cases              ← Business logic in isolation
```

### Why This Structure?

- **Unit Tests**: Already have these, test individual functions
- **Contract Tests**: NEW - Prevent IPC mismatches (highest ROI for our issues)
- **Integration Tests**: NEW - Test real database operations and IPC flows
- **E2E Tests**: NEW - Validate complete user journeys

---

## Proposed Improvements

## 1. Type-Safe IPC Channel Names

### Problem
Currently, IPC channel names are strings scattered across codebase:

```typescript
// Main process
ipcMain.handle('database:favorites:get-all', async () => { ... });

// Preload
favoritesGetAll: () => ipcRenderer.invoke('database:favorites:get-all')

// If you rename one but not the other → runtime error
```

### Solution: Single Source of Truth

Create a shared constants file:

```typescript
// src/shared/ipc-channels.ts
export const IPC = {
  FAVORITES: {
    GET_ALL: 'database:favorites:get-all',
    ADD: 'database:favorites:add',
    REMOVE: 'database:favorites:remove',
    TOGGLE: 'database:favorites:toggle',
    IS_FAVORITE: 'database:favorites:is-favorite',
  },

  VIEW_RECORDS: {
    GET: 'database:view-records:get',
    UPDATE: 'database:view-records:update',
    GET_HISTORY: 'database:view-records:get-history',
    GET_RECENTLY_WATCHED: 'database:view-records:get-recently-watched',
  },

  SOURCES: {
    GET_ALL: 'database:sources:get-all',
    GET_BY_ID: 'database:sources:get-by-id',
    CREATE: 'database:sources:create',
    UPDATE: 'database:sources:update',
    DELETE: 'database:sources:delete',
  },

  // ... all other IPC channels
} as const;
```

**Usage everywhere:**

```typescript
// Main process
import { IPC } from '@/shared/ipc-channels';
ipcMain.handle(IPC.FAVORITES.GET_ALL, async () => { ... });

// Preload
import { IPC } from '../shared/ipc-channels';
favoritesGetAll: () => ipcRenderer.invoke(IPC.FAVORITES.GET_ALL)
```

### Benefits
- ✅ **Single source of truth**: Change channel name in one place
- ✅ **TypeScript autocomplete**: IDE suggests valid channels
- ✅ **Refactoring safety**: Rename automatically updates all usages
- ✅ **Compile-time errors**: Typos caught before runtime

### Effort
- Setup: ~30 minutes
- Migration: ~1 hour to update existing code

---

## 2. Contract Tests

### Problem
No automated way to verify that:
- All preload methods have corresponding main handlers
- Main handlers exist for all IPC channels
- Response types match expectations

### Solution: Automated Contract Validation

```typescript
// __tests__/contracts/ipc-contracts.test.ts
import { IPC } from '@/shared/ipc-channels';
import { registerAllHandlers } from '@/main/ipc';

describe('IPC Contract Tests', () => {
  let registeredHandlers: Set<string>;

  beforeAll(() => {
    registeredHandlers = new Set();
    vi.spyOn(ipcMain, 'handle').mockImplementation((channel) => {
      registeredHandlers.add(channel);
    });
    registerAllHandlers();
  });

  test('all IPC channels have registered handlers', () => {
    const allChannels = Object.values(IPC)
      .flatMap(category => Object.values(category));

    allChannels.forEach(channel => {
      expect(registeredHandlers.has(channel)).toBe(true);
    });
  });

  test('handler responses match expected types', async () => {
    const handler = getHandler(IPC.FAVORITES.GET_ALL);
    const result = await handler({});

    // Validates response structure
    expect(result).toMatchObject({
      success: expect.any(Boolean),
      data: expect.arrayContaining([
        expect.objectContaining({
          videoId: expect.any(String),
          dateAdded: expect.any(String),
          sourceType: expect.stringMatching(/youtube|local|dlna|downloaded/),
        })
      ])
    });
  });
});
```

### What This Catches
- ✅ Preload defines method but main handler missing
- ✅ Main handler registered with wrong channel name
- ✅ Database schema change breaks response format
- ✅ Refactoring renames handler but not caller

### Effort
- Setup: ~1 hour
- Per test: ~5 minutes
- Target: 10-20 contract tests

---

## 3. Integration Tests

### Problem
Current tests mock DatabaseService, so they don't catch:
- SQL syntax errors
- Foreign key constraint violations
- Data type mismatches
- Real IPC handler behavior

### Solution: Test with Real Database (In-Memory)

```typescript
// __tests__/integration/favorites.integration.test.ts
import DatabaseService from '@/main/services/DatabaseService';
import { registerDatabaseHandlers } from '@/main/ipc/databaseHandlers';

describe('Favorites Integration', () => {
  let db: DatabaseService;
  let handlers: Map<string, Function>;

  beforeEach(async () => {
    // Create REAL in-memory SQLite database
    db = new DatabaseService(':memory:');

    // Run REAL migrations (production code)
    await db.runMigrations();

    // Seed test data
    await seedTestData(db);

    // Register REAL handlers
    handlers = captureHandlers();
    registerDatabaseHandlers();
  });

  afterEach(async () => {
    await db.close();
  });

  test('favorites toggle - full IPC flow', async () => {
    const handler = handlers.get('database:favorites:toggle');

    // Call like IPC would
    const result = await handler({}, 'video1', 'source1');

    expect(result.success).toBe(true);
    expect(result.data.isFavorite).toBe(true);

    // Verify in REAL database
    const dbRecord = await db.get(
      'SELECT * FROM favorites WHERE video_id = ?',
      ['video1']
    );
    expect(dbRecord).toBeTruthy();
    expect(dbRecord.video_id).toBe('video1');

    // Toggle off
    const result2 = await handler({}, 'video1', 'source1');
    expect(result2.data.isFavorite).toBe(false);

    // Verify removed
    const dbRecord2 = await db.get(
      'SELECT * FROM favorites WHERE video_id = ?',
      ['video1']
    );
    expect(dbRecord2).toBeUndefined();
  });

  test('view records persist resume position', async () => {
    const handler = handlers.get('database:view-records:update');

    // Record watching at 120 seconds
    await handler({}, 'video1', {
      source_id: 'source1',
      position: 120,
      time_watched: 30,
      duration: 600,
      watched: false
    });

    // Verify persistence
    const getHandler = handlers.get('database:view-records:get');
    const result = await getHandler({}, 'video1');

    expect(result.success).toBe(true);
    expect(result.data.position).toBe(120);
    expect(result.data.time_watched).toBe(30);
  });

  test('foreign key constraints enforced', async () => {
    const handler = handlers.get('database:favorites:add');

    // Try to add favorite for non-existent video
    const result = await handler({}, 'non-existent-video', 'source1');

    // Should fail due to foreign key constraint
    expect(result.success).toBe(false);
    expect(result.error).toContain('FOREIGN KEY constraint failed');
  });
});
```

### Test Helpers for Reusability

```typescript
// __tests__/helpers/db-helpers.ts
export async function createTestDb(): Promise<DatabaseService> {
  const db = new DatabaseService(':memory:');
  await db.runMigrations(); // Uses production migrations!
  return db;
}

export async function seedTestData(db: DatabaseService) {
  // Reusable seed data for all tests
  await db.run(`
    INSERT INTO sources (id, type, title, position)
    VALUES ('test-source', 'youtube_channel', 'Test Channel', 1)
  `);

  await db.run(`
    INSERT INTO videos (id, title, thumbnail, duration, source_id, is_available)
    VALUES
      ('video1', 'Test Video 1', 'thumb1.jpg', 300, 'test-source', 1),
      ('video2', 'Test Video 2', 'thumb2.jpg', 450, 'test-source', 1)
  `);
}

export function captureHandlers(): Map<string, Function> {
  const handlers = new Map();
  vi.spyOn(ipcMain, 'handle').mockImplementation((channel, handler) => {
    handlers.set(channel, handler);
  });
  return handlers;
}
```

### What This Catches
- ✅ SQL syntax errors
- ✅ Foreign key violations
- ✅ Data type mismatches
- ✅ IPC handler logic bugs
- ✅ Database migration issues
- ✅ Real query performance problems

### Benefits
- **Fast**: In-memory DB, ~100ms per test
- **Isolated**: Each test gets fresh database
- **Real**: Uses actual production code
- **No mocks**: Tests real SQL queries

### Effort
- Setup: ~2-3 hours (test helpers + infrastructure)
- Per test: ~15 minutes
- Target: 30-50 integration tests covering all IPC handlers

---

## 4. End-to-End Tests with Playwright

### Problem
Integration tests don't catch:
- UI rendering issues
- User interaction bugs
- Video playback problems
- Timing/race conditions
- Real-world user workflows

### Solution: Playwright for Electron

Automate the manual tests from `tests.md`:

```typescript
// __tests__/e2e/favorites.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test.describe('Favorites Workflow', () => {
  let app;
  let page;

  test.beforeAll(async () => {
    // Launch Electron app with test database
    app = await electron.launch({
      args: [path.join(__dirname, '../../dist/main/main/index.js')],
      env: {
        ...process.env,
        SAFETUBE_DB_PATH: './test-db.sqlite'
      }
    });
    page = await app.firstWindow();
  });

  test.afterAll(async () => {
    await app.close();
    // Clean up test database
    await fs.remove('./test-db.sqlite');
  });

  test('should add and remove favorites', async () => {
    // Navigate to source
    await page.click('[data-testid="source-item-0"]');
    await page.waitForSelector('[data-testid="video-card"]');

    // Click favorite button
    const firstVideo = page.locator('[data-testid="video-card"]').first();
    const favButton = firstVideo.locator('[data-testid="favorite-button"]');
    await favButton.click();

    // Verify active state
    await expect(favButton).toHaveClass(/active/);

    // Navigate to favorites page
    await page.click('[data-testid="nav-favorites"]');

    // Verify video appears
    const favoriteVideos = page.locator('[data-testid="video-card"]');
    await expect(favoriteVideos).toHaveCount(1);

    // Remove favorite
    await favoriteVideos.first().locator('[data-testid="favorite-button"]').click();

    // Verify empty
    await expect(favoriteVideos).toHaveCount(0);
  });

  test('favorites persist across app restarts', async () => {
    // Add favorite
    await page.click('[data-testid="source-item-0"]');
    const firstVideo = page.locator('[data-testid="video-card"]').first();
    await firstVideo.locator('[data-testid="favorite-button"]').click();

    // Restart app
    await app.close();
    app = await electron.launch({
      args: [path.join(__dirname, '../../dist/main/main/index.js')],
      env: { SAFETUBE_DB_PATH: './test-db.sqlite' }
    });
    page = await app.firstWindow();

    // Verify still favorited
    await page.click('[data-testid="nav-favorites"]');
    const favoriteVideos = page.locator('[data-testid="video-card"]');
    await expect(favoriteVideos).toHaveCount(1);
  });
});
```

### Resume Playback Test

```typescript
// __tests__/e2e/playback.spec.ts
test('should resume video from last position', async ({ page }) => {
  // Play video
  await page.click('[data-testid="source-item-0"]');
  const firstVideo = page.locator('[data-testid="video-card"]').first();
  await firstVideo.click();

  // Wait for playback
  await page.waitForSelector('[data-testid="video-player"]');
  await page.waitForTimeout(10000); // 10 seconds

  // Get position
  const position1 = await page.evaluate(() => {
    return window.videoPlayer?.getCurrentTime();
  });
  expect(position1).toBeGreaterThan(8);

  // Go back
  await page.click('[data-testid="back-button"]');

  // Play again
  await firstVideo.click();
  await page.waitForSelector('[data-testid="video-player"]');

  // Should resume near same position
  const position2 = await page.evaluate(() => {
    return window.videoPlayer?.getCurrentTime();
  });
  expect(position2).toBeGreaterThan(position1 - 2);
});
```

### Parent Access Test

```typescript
// __tests__/e2e/parent-access.spec.ts
test('should grant access with correct PIN', async ({ page }) => {
  await page.click('[data-testid="parent-access"]');

  // Enter correct PIN
  await page.fill('[data-testid="pin-input"]', '1234');
  await page.click('[data-testid="pin-submit"]');

  // Should see admin panel
  await expect(page.locator('[data-testid="admin-panel"]')).toBeVisible();
});

test('should deny access with incorrect PIN', async ({ page }) => {
  await page.click('[data-testid="parent-access"]');

  // Wrong PIN
  await page.fill('[data-testid="pin-input"]', '0000');
  await page.click('[data-testid="pin-submit"]');

  // Should show error
  await expect(page.locator('[data-testid="pin-error"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-panel"]')).not.toBeVisible();
});
```

### Database Strategy for E2E Tests

E2E tests use a **temporary test database**:

```typescript
// __tests__/e2e/fixtures/test-db.ts
export async function createTestDatabase(): Promise<string> {
  const dbPath = path.join(__dirname, `../temp/test-${Date.now()}.db`);

  // Copy seed database or create fresh
  const db = new DatabaseService(dbPath);
  await db.runMigrations();
  await seedTestData(db);
  await db.close();

  return dbPath;
}

export async function cleanupTestDatabase(dbPath: string) {
  await fs.remove(dbPath);
}

// Usage in tests
test.beforeEach(async ({ }, testInfo) => {
  testInfo.testDb = await createTestDatabase();
});

test.afterEach(async ({ }, testInfo) => {
  await cleanupTestDatabase(testInfo.testDb);
});
```

### What E2E Tests Catch
- ✅ UI rendering bugs
- ✅ User interaction flows
- ✅ Video playback issues
- ✅ State persistence across restarts
- ✅ Visual styling (watched/clicked states)
- ✅ Complete user journeys
- ✅ Timing and race conditions

### Critical E2E Test Cases (Priority Order)

1. **Resume playback** - Core functionality
2. **Favorites workflow** - Add, remove, persist
3. **Time limit enforcement** - Daily limits work
4. **Parent PIN access** - Security critical
5. **History persistence** - Data integrity
6. **Pagination** - Large video lists
7. **Watched/clicked styles** - UI feedback
8. **Source switching** - Navigation
9. **Video completion tracking** - Watch progress
10. **Error recovery** - Network offline, missing files

### Effort
- Setup: ~4-6 hours (Playwright config, fixtures, helpers)
- Per test: ~30-45 minutes
- Target: 5-10 critical user flows

---

## Implementation Roadmap

### Phase 1: Foundation (Weekend 1, ~4 hours)

**Goal**: Catch 80% of current error types

1. **Type-Safe IPC Channels** (30 min)
   - Create `src/shared/ipc-channels.ts`
   - Define all channel constants
   - Update main process handlers
   - Update preload bridge

2. **Contract Tests** (2 hours)
   - Set up test infrastructure
   - Test all channels registered
   - Test response type validation
   - Test preload ↔ main consistency

3. **Basic Integration Tests** (1.5 hours)
   - Test helper utilities
   - Favorites integration tests
   - View records integration tests
   - Sources CRUD tests

**Success Criteria**:
- ✅ All IPC channels use constants
- ✅ Contract tests catch channel mismatches
- ✅ Integration tests use real database
- ✅ No mocks for DatabaseService

### Phase 2: Comprehensive Coverage (Weekend 2, ~6 hours)

**Goal**: Test all business logic without mocks

4. **Full Integration Test Suite** (4 hours)
   - All IPC handlers covered
   - Time tracking logic
   - History and pagination
   - Error handling paths

5. **Add data-testid Attributes** (2 hours)
   - Video cards
   - Navigation elements
   - Favorite buttons
   - Player controls
   - Parent access components

**Success Criteria**:
- ✅ 30-50 integration tests
- ✅ All IPC handlers tested
- ✅ UI elements have test IDs

### Phase 3: E2E Safety Net (When Available, ~8 hours)

**Goal**: Validate complete user journeys

6. **Playwright Setup** (3 hours)
   - Install dependencies
   - Configure for Electron
   - Create test database fixtures
   - Build app launcher helper

7. **Critical E2E Tests** (5 hours)
   - Resume playback (1 hour)
   - Favorites workflow (1 hour)
   - Time limit enforcement (1 hour)
   - Parent access (30 min)
   - History persistence (1.5 hours)

**Success Criteria**:
- ✅ 5-10 E2E tests for critical paths
- ✅ Tests use temporary databases
- ✅ Automated in CI pipeline

### Phase 4: CI Integration & Polish (1-2 hours)

8. **Continuous Integration**
   - Run contract + integration on every commit
   - Run E2E on PR/release only
   - Set up test database cleanup
   - Configure timeout policies

9. **Documentation**
   - Testing guide for new features
   - How to add new tests
   - Debugging test failures

---

## Test Database Strategy

### Integration Tests: In-Memory Database

```typescript
// Fast, isolated, perfect for integration tests
const db = new DatabaseService(':memory:');
await db.runMigrations();
```

**Pros**:
- ✅ Fast (~100ms per test)
- ✅ Isolated (each test fresh DB)
- ✅ Uses real SQL
- ✅ No cleanup needed

**Cons**:
- ❌ Doesn't test file I/O
- ❌ Can't test corruption recovery

### E2E Tests: Temporary File Database

```typescript
// Real file for testing persistence and restarts
const dbPath = `/tmp/test-${Date.now()}.db`;
process.env.SAFETUBE_DB_PATH = dbPath;
```

**Pros**:
- ✅ Tests real file I/O
- ✅ Tests persistence across restarts
- ✅ Can inspect DB during debugging

**Cons**:
- ❌ Slower than in-memory
- ❌ Requires cleanup

**Rule**: Never write to production database in tests!

---

## Code Structure Principles

### 1. Tests Use Production Code (No Duplication)

```typescript
// ❌ BAD: Duplicate logic in tests
test('formats video ID', async () => {
  const formatted = videoId.startsWith('yt_') ? videoId : `yt_${videoId}`;
  // ...
});

// ✅ GOOD: Use production function
import { formatVideoId } from '@/shared/utils';

test('formats video ID', async () => {
  const formatted = formatVideoId(videoId);
  // ...
});
```

### 2. Shared Test Utilities

```typescript
// __tests__/helpers/db-helpers.ts
export async function createTestDb() { ... }
export async function seedTestData(db) { ... }
export function captureHandlers() { ... }

// Used by ALL tests - no duplication
```

### 3. Type-Safe Everything

```typescript
// Single source of truth for IPC channels
export const IPC = { ... } as const;

// Explicit TypeScript interfaces
interface ElectronAPI {
  favoritesGetAll: () => Promise<DatabaseResponse<FavoriteVideo[]>>;
}
```

---

## Expected Outcomes

### Metrics

| Metric | Before | After |
|--------|--------|-------|
| **IPC mismatch errors** | Common | Prevented |
| **Database schema breaks** | Silent failures | Caught in tests |
| **Refactoring confidence** | Low | High |
| **Manual testing time** | 30+ min/release | 5 min/release |
| **Bug detection time** | Production | Development |

### Developer Experience

- **Before refactoring**: Hope nothing breaks, manual test everything
- **After implementation**: Run tests, trust the results, ship confidently

### Coverage Goals

- **Contract Tests**: 100% of IPC channels
- **Integration Tests**: 100% of IPC handlers
- **E2E Tests**: Top 5-10 user flows
- **Unit Tests**: Keep existing coverage

---

## Maintenance & Best Practices

### When to Write Each Test Type

**Unit Test**:
- Pure functions
- Utility functions
- Business logic in isolation

**Contract Test**:
- New IPC channel added
- Handler signature changes
- Response format changes

**Integration Test**:
- New IPC handler
- Database operations
- Cross-component logic

**E2E Test**:
- New critical user flow
- UI-heavy features
- Multi-step workflows

### Test Naming Convention

```typescript
// Unit: [function].[behavior]
test('formatVideoId.addsPrefixWhenMissing')

// Contract: [channel].[expectation]
test('IPC.FAVORITES.GET_ALL.isRegistered')

// Integration: [feature].[flow].[outcome]
test('favorites.toggleOn.persistsToDatabase')

// E2E: [user story]
test('user can add favorite and see it after restart')
```

### Debugging Failed Tests

1. **Contract test fails** → IPC mismatch, check channel names
2. **Integration test fails** → Check SQL or business logic
3. **E2E test fails** → Check UI, timing, or full flow

---

## Appendix: Related Documentation

- `logs/tests.md` - Manual test cases (will be automated in E2E)
- `docs/specifications.md` - Technical architecture
- `src/main/ipc/databaseHandlers.ts` - Current IPC implementation
- `src/preload/index.ts` - Current preload bridge

---

## Summary

This testing strategy provides:

1. **Type-Safe IPC Channels** - Prevent main/preload mismatches
2. **Contract Tests** - Validate IPC contracts automatically
3. **Integration Tests** - Test real database operations
4. **E2E Tests** - Validate complete user workflows

**Total implementation time**: ~20 hours over 3-4 weekends

**Expected benefit**: 90% reduction in runtime IPC/database errors

**Key principle**: Tests should use production code and test real integrations, not mocks.
