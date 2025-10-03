# Database Consolidation & Testing Refactoring Plan

## Executive Summary

This document outlines a comprehensive plan to consolidate scattered SQL queries across the SafeTube codebase into a maintainable repository pattern with robust testing infrastructure.

**⚠️ IMPORTANT: After thorough analysis, this migration is NOT recommended at this time.** See the [Critical Assessment](#️-critical-assessment-is-this-migration-worth-it) section for detailed reasoning and lightweight alternatives.

The plan remains documented here for:
- Future reference if project scale increases significantly
- Learning resource for repository pattern implementation
- Basis for targeted improvements (type-safe query helpers, documentation)

## Current State Analysis

### SQL Query Distribution

**Query Statistics (discovered):**
- **SELECT queries**: 93 occurrences across 9 files
- **INSERT queries**: 53 occurrences across 14 files
- **UPDATE queries**: 7 occurrences across 3 files
- **Total**: ~150+ raw SQL queries scattered throughout codebase

### Files with Database Access

#### Main Process Files
- `src/main/index.ts` - 11 SELECT, 2 INSERT, 1 UPDATE
- `src/main/timeTracking.ts` - 8 SELECT, 4 INSERT
- `src/main/videoDataService.ts` - 13 SELECT
- `src/main/services/lightweightSourceResolver.ts` - 4 SELECT
- `src/main/fileUtils.ts` - 3 SELECT, 1 INSERT
- `src/main/firstRunSetup.ts` - 3 SELECT, 1 INSERT

#### IPC Handler Files
- `src/main/services/ipcHandlerRegistry.ts` - 13 SELECT, 1 INSERT
- `src/main/ipc/databaseHandlers.ts` - 26 SELECT, 5 INSERT, 3 UPDATE

#### Preload Files
- `src/preload/youtubePageCache.ts` - Contains SELECT queries
- `src/preload/cached-youtube-sources.ts` - Contains SELECT queries

#### Schema Management
- `src/main/database/SimpleSchemaManager.ts` - Schema definitions, 6 INSERT
- `src/main/database/MigrationService.ts` - Migration queries, 4 INSERT
- `src/main/services/DatabaseService.ts` - Base database operations, 1 INSERT

### Core Problems Identified

1. **No Single Source of Truth**
   - Column renames require changes in 10+ files
   - Schema changes are error-prone
   - Query logic duplicated

2. **Testing Challenges**
   - No in-memory database setup for fast tests
   - Difficult to test database operations in isolation
   - Integration tests missing

3. **Maintainability Issues**
   - Business logic mixed with data access
   - SQL queries hard to find and update
   - No type safety for database operations

4. **Security Concerns**
   - Some queries not parameterized
   - SQL injection risk in dynamic queries

## Proposed Architecture

### Repository Pattern Structure

```
src/main/repositories/
├── types.ts                    # Shared TypeScript types & DTOs
├── BaseRepository.ts           # Shared query utilities, transaction support
├── SourceRepository.ts         # All source CRUD operations
├── VideoRepository.ts          # Video queries & metadata
├── ViewRecordRepository.ts     # Watch history operations
├── FavoriteRepository.ts       # Favorites management
├── YouTubeCacheRepository.ts   # YouTube API result cache
├── index.ts                    # Export all repositories
└── __tests__/
    ├── setup.ts                # Test database utilities
    ├── fixtures.ts             # Test data factories
    ├── SourceRepository.test.ts
    ├── VideoRepository.test.ts
    ├── ViewRecordRepository.test.ts
    ├── FavoriteRepository.test.ts
    ├── YouTubeCacheRepository.test.ts
    └── integration.test.ts     # Cross-repository operations
```

### Repository Responsibilities

#### SourceRepository
**Consolidates from:** index.ts, ipcHandlerRegistry.ts, databaseHandlers.ts, videoDataService.ts, lightweightSourceResolver.ts

**Methods:**
- `findById(id: string): Promise<Source | null>`
- `findAll(orderBy?: 'position' | 'title'): Promise<Source[]>`
- `findByType(type: SourceType): Promise<Source[]>`
- `findStale(thresholdDate: string): Promise<Source[]>`
- `create(source: CreateSourceDTO): Promise<string>`
- `update(id: string, updates: UpdateSourceDTO): Promise<void>`
- `updateVideoCount(id: string, count: number): Promise<void>`
- `updateThumbnail(id: string, thumbnail: string): Promise<void>`
- `delete(id: string): Promise<void>`
- `count(): Promise<number>`

#### VideoRepository
**Consolidates from:** index.ts, ipcHandlerRegistry.ts, databaseHandlers.ts, videoDataService.ts

**Methods:**
- `findById(id: string): Promise<Video | null>`
- `findBySource(sourceId: string): Promise<Video[]>`
- `findByIds(ids: string[]): Promise<Video[]>`
- `search(query: string, sourceId?: string): Promise<Video[]>`
- `create(video: CreateVideoDTO): Promise<void>`
- `batchUpsert(videos: CreateVideoDTO[]): Promise<void>`
- `update(id: string, updates: UpdateVideoDTO): Promise<void>`
- `updateAvailability(id: string, isAvailable: boolean): Promise<void>`
- `delete(id: string): Promise<void>`
- `deleteBySource(sourceId: string): Promise<void>`

#### ViewRecordRepository
**Consolidates from:** timeTracking.ts, ipcHandlerRegistry.ts, databaseHandlers.ts

**Methods:**
- `findByVideoId(videoId: string): Promise<ViewRecord | null>`
- `findBySourceId(sourceId: string): Promise<ViewRecord[]>`
- `findHistory(limit?: number): Promise<ViewRecordWithVideo[]>`
- `findRecentlyWatched(limit?: number): Promise<ViewRecordWithVideo[]>`
- `findLastWatched(): Promise<ViewRecordWithVideo | null>`
- `upsert(record: CreateViewRecordDTO): Promise<void>`
- `update(videoId: string, updates: UpdateViewRecordDTO): Promise<void>`
- `delete(videoId: string): Promise<void>`
- `deleteBySource(sourceId: string): Promise<void>`

#### FavoriteRepository
**Consolidates from:** ipcHandlerRegistry.ts, databaseHandlers.ts, videoDataService.ts, index.ts

**Methods:**
- `findAll(): Promise<FavoriteWithVideo[]>`
- `findByVideoId(videoId: string): Promise<Favorite | null>`
- `findBySourceId(sourceId: string): Promise<Favorite[]>`
- `isFavorite(videoId: string): Promise<boolean>`
- `add(favorite: CreateFavoriteDTO): Promise<void>`
- `remove(videoId: string): Promise<void>`
- `toggle(videoId: string, sourceId: string): Promise<boolean>`
- `count(): Promise<number>`
- `deleteBySource(sourceId: string): Promise<void>`

#### YouTubeCacheRepository
**Consolidates from:** databaseHandlers.ts, youtubePageCache.ts, cached-youtube-sources.ts

**Methods:**
- `findPage(sourceId: string, pageNumber: number, pageSize: number): Promise<CachedPage | null>`
- `findBySource(sourceId: string): Promise<YouTubeApiResult[]>`
- `savePage(sourceId: string, pageNumber: number, videos: string[], pageSize: number): Promise<void>`
- `clearSource(sourceId: string): Promise<void>`
- `deleteBySource(sourceId: string): Promise<void>`

### Type Safety & DTOs

**Benefits:**
- Compile-time type checking for all database operations
- Clear contracts for create/update operations
- Reduced runtime errors
- Better IDE autocomplete

**Example DTO:**
```typescript
export interface CreateSourceDTO {
  type: SourceType;
  title: string;
  url?: string | null;
  thumbnail?: string | null;
  channel_id?: string | null;
  path?: string | null;
  sort_preference?: string | null;
  position?: number | null;
  total_videos?: number | null;
  max_depth?: number | null;
}
```

## Testing Strategy

### In-Memory Database Setup

**Test Infrastructure (`__tests__/setup.ts`):**
```typescript
export async function createTestDatabase(): Promise<DatabaseService> {
  const db = DatabaseService.getInstance();
  await db.initialize({ path: ':memory:' });

  const schema = new SimpleSchemaManager(db);
  await schema.initializePhase1Schema();

  return db;
}

export async function cleanupTestDatabase(db: DatabaseService): Promise<void> {
  await db.close();
}
```

**Benefits:**
- Fast test execution (in-memory)
- Isolated test environment
- Real SQLite behavior
- No file system overhead

### Test Fixtures

**Fixture Factory (`__tests__/fixtures.ts`):**
```typescript
export function createSourceFixture(overrides?: Partial<CreateSourceDTO>): CreateSourceDTO {
  return {
    type: 'youtube_channel',
    title: 'Test Channel',
    url: 'https://youtube.com/@test',
    channel_id: 'UCtest123',
    ...overrides
  };
}

export function createVideoFixture(sourceId: string, overrides?: Partial<CreateVideoDTO>): CreateVideoDTO {
  return {
    id: `video_${Date.now()}`,
    title: 'Test Video',
    source_id: sourceId,
    duration: 300,
    is_available: true,
    ...overrides
  };
}
```

**Benefits:**
- Consistent test data
- Easy to create test scenarios
- Reduce boilerplate in tests

### Test Coverage Requirements

**Unit Tests per Repository:**
- ✅ All CRUD operations (create, read, update, delete)
- ✅ Query filters and sorting
- ✅ Edge cases (null values, empty results, duplicates)
- ✅ Error handling
- ✅ Transaction rollback scenarios

**Integration Tests:**
- ✅ Cross-repository operations (e.g., delete source cascades)
- ✅ Foreign key constraints
- ✅ Concurrent operations
- ✅ Full-text search functionality

### Example Test

```typescript
describe('SourceRepository', () => {
  let db: DatabaseService;
  let repository: SourceRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    repository = new SourceRepository(db);
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  test('should create and retrieve source', async () => {
    const source = createSourceFixture({
      title: 'My Channel'
    });

    const id = await repository.create(source);
    const retrieved = await repository.findById(id);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe('My Channel');
  });

  test('should handle duplicate source IDs', async () => {
    const source = createSourceFixture();
    await repository.create(source);

    // Attempt duplicate insert should throw
    await expect(repository.create(source)).rejects.toThrow();
  });

  test('should cascade delete related records', async () => {
    const sourceId = await repository.create(createSourceFixture());
    const videoRepo = new VideoRepository(db);
    await videoRepo.create(createVideoFixture(sourceId));

    await repository.delete(sourceId);

    const videos = await videoRepo.findBySource(sourceId);
    expect(videos).toHaveLength(0);
  });
});
```

## Migration Plan

### Phase 1: Foundation (Days 1-2)

**Step 1.1: Create Repository Structure**
- [ ] Create `repositories/` directory
- [ ] Implement `types.ts` with all DTOs
- [ ] Implement `BaseRepository.ts` with utilities
- [ ] Create `index.ts` exports

**Step 1.2: Implement Repositories**
- [ ] `SourceRepository` - consolidate all source queries
- [ ] `VideoRepository` - consolidate all video queries
- [ ] `ViewRecordRepository` - consolidate view record queries
- [ ] `FavoriteRepository` - consolidate favorite queries
- [ ] `YouTubeCacheRepository` - consolidate cache queries

**Step 1.3: Update DatabaseService**
- [ ] Add repository factory methods
- [ ] Keep existing methods for backward compatibility

### Phase 2: Testing Infrastructure (Days 3-4)

**Step 2.1: Test Setup**
- [ ] Create test database utilities (`setup.ts`)
- [ ] Create fixture factories (`fixtures.ts`)
- [ ] Configure vitest for in-memory database

**Step 2.2: Write Repository Tests**
- [ ] `SourceRepository.test.ts` - full coverage
- [ ] `VideoRepository.test.ts` - full coverage
- [ ] `ViewRecordRepository.test.ts` - full coverage
- [ ] `FavoriteRepository.test.ts` - full coverage
- [ ] `YouTubeCacheRepository.test.ts` - full coverage
- [ ] `integration.test.ts` - cross-repository tests

**Step 2.3: Verify Test Coverage**
- [ ] Run coverage report
- [ ] Ensure >90% coverage for repositories
- [ ] Document any uncovered edge cases

### Phase 3: Migration (Days 5-7)

**Step 3.1: Update IPC Handlers** (Non-breaking)
- [ ] Update `databaseHandlers.ts` to use repositories
- [ ] Update `ipcHandlerRegistry.ts` to use repositories
- [ ] Verify IPC contract unchanged
- [ ] Run existing IPC handler tests

**Step 3.2: Update Business Logic**
- [ ] Migrate `timeTracking.ts` to `ViewRecordRepository`
- [ ] Migrate `videoDataService.ts` to repositories
- [ ] Migrate `index.ts` to repositories
- [ ] Migrate `lightweightSourceResolver.ts` to `SourceRepository`
- [ ] Migrate `firstRunSetup.ts` to repositories
- [ ] Update `fileUtils.ts` if needed

**Step 3.3: Preload Layer**
- [ ] Evaluate moving `youtubePageCache.ts` logic to main process
- [ ] Evaluate moving `cached-youtube-sources.ts` logic to main process
- [ ] Or update to use IPC for database access

**Step 3.4: Cleanup**
- [ ] Remove direct SQL queries from business logic
- [ ] Remove duplicate query logic
- [ ] Update imports throughout codebase

### Phase 4: Validation (Day 8)

**Step 4.1: Testing**
- [ ] Run all repository unit tests
- [ ] Run all integration tests
- [ ] Run existing application tests
- [ ] Manual testing of key workflows

**Step 4.2: Build & Deploy**
- [ ] `yarn build:all` - ensure clean build
- [ ] `yarn test` - all tests pass
- [ ] `yarn lint` - no new lint errors
- [ ] Performance benchmarking

**Step 4.3: Documentation**
- [ ] Update README with repository pattern
- [ ] Document repository APIs
- [ ] Add migration guide for future changes
- [ ] Update development-tracking.md

## Benefits Summary

### Single Source of Truth
- **Before**: Column rename requires updating 10+ files
- **After**: Column rename only in repository + DTOs
- **Impact**: 90% reduction in change scope

### Type Safety
- **Before**: Raw SQL strings, runtime errors
- **After**: TypeScript types, compile-time checks
- **Impact**: Catch errors before runtime

### Testability
- **Before**: No database tests, manual testing only
- **After**: Comprehensive unit + integration tests
- **Impact**: 95%+ code coverage, fast test suite

### Maintainability
- **Before**: Business logic mixed with SQL
- **After**: Clean separation of concerns
- **Impact**: Easier to understand and modify

### Security
- **Before**: Some non-parameterized queries
- **After**: All queries parameterized via repositories
- **Impact**: Eliminate SQL injection risk

## Risk Analysis & Mitigation

### Risk 1: Breaking Changes
**Probability**: Medium
**Impact**: High
**Mitigation**:
- Incremental migration (keep old code during transition)
- Extensive testing before removing old queries
- Feature flags if needed for rollback

### Risk 2: Performance Regression
**Probability**: Low
**Impact**: Medium
**Mitigation**:
- Keep existing optimizations (batching, prepared statements)
- Benchmark critical paths before/after
- Add database query logging in development

### Risk 3: Testing Overhead
**Probability**: Low
**Impact**: Low
**Mitigation**:
- Use fixtures to reduce test boilerplate
- In-memory database for speed
- Parallel test execution

### Risk 4: Developer Learning Curve
**Probability**: Medium
**Impact**: Low
**Mitigation**:
- Comprehensive documentation
- Clear examples in tests
- Pair programming for first migrations

## Success Criteria

### Functional
- [ ] All existing features work unchanged
- [ ] All tests pass (existing + new)
- [ ] No SQL queries outside repositories
- [ ] Clean build with no errors

### Quality
- [ ] >90% test coverage for repositories
- [ ] All repositories have integration tests
- [ ] Type safety enforced throughout
- [ ] Security audit passes (parameterized queries)

### Performance
- [ ] No regression in database query performance
- [ ] Test suite runs in <30 seconds
- [ ] Application startup time unchanged

### Documentation
- [ ] Repository API documented
- [ ] Migration guide created
- [ ] Development tracking updated
- [ ] Code examples provided

## Timeline & Effort Estimate

### AI Agent Implementation Time (Realistic)

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: Foundation | 15-20 min | Repository classes, DTOs, base utilities |
| Phase 2: Testing | 20-30 min | Test infrastructure, fixtures, full test suite |
| Phase 3: Migration | 30-45 min | Updated IPC handlers, business logic |
| Phase 4: Validation | 10-15 min | Testing, documentation, deployment |
| **Total** | **1.5-2 hours** | Production-ready repository pattern |

**Note:** Original estimate of "8 days (64 hours)" was based on human developer time. As an AI agent, I can implement this much faster through parallel processing and rapid code generation.

## ⚠️ Critical Assessment: Is This Migration Worth It?

### Reality Check

While this plan is **technically sound** and could be implemented in ~2 hours, we need to honestly assess whether it's actually needed.

### Cost-Benefit Analysis

#### **Costs:**
1. **Implementation Risk**: Touching 150+ queries across 19 files - high chance of introducing bugs
2. **Testing Burden**: Need to write ~500-800 lines of test code
3. **Added Complexity**: Repository layer adds abstraction - makes codebase larger
4. **Learning Curve**: Future developers must learn the repository pattern
5. **Over-Engineering**: May be adding patterns the codebase doesn't actually need

#### **Benefits:**
1. **Maintainability**: Schema changes in one place (but how often does schema change?)
2. **Type Safety**: Already have TypeScript - repositories add marginal improvement
3. **Testability**: Currently no DB tests - but is this causing actual problems?
4. **Security**: Most queries already parameterized via DatabaseService

### Decision Framework: When This Migration Makes Sense

**✅ PROCEED if you're experiencing:**
- Frequent bugs from scattered SQL queries
- Schema changes that are painful across multiple files
- Multiple developers stepping on each other's database code
- Need for comprehensive integration tests for compliance/quality requirements

**❌ SKIP if:**
- No production bugs related to database queries
- Schema is stable (changes are rare)
- Small team or single developer
- Current approach is working fine

### **Honest Recommendation: NOT WORTH IT (Yet)**

Based on the codebase analysis:
- **Database schema is stable** - SimpleSchemaManager already provides schema management
- **Queries are mostly parameterized** - DatabaseService handles this
- **No evidence of SQL-related bugs** - existing patterns seem to work
- **Small to medium team** - coordination overhead is manageable

### Alternative: Lightweight Improvements (30-45 minutes)

Instead of full repository pattern, consider these **targeted improvements**:

#### Option A: Type-Safe Query Helpers
```typescript
// src/main/database/queries/sourceQueries.ts
export async function findSourceById(db: DatabaseService, id: string): Promise<Source | null> {
  return db.get<Source>('SELECT * FROM sources WHERE id = ?', [id]);
}

export async function findAllSources(db: DatabaseService): Promise<Source[]> {
  return db.all<Source>('SELECT * FROM sources ORDER BY position ASC, title ASC');
}
```

**Benefits:**
- Type safety for common queries
- Centralized query logic without full abstraction
- Easy to find and update queries
- No architectural changes

#### Option B: Database Documentation
- Document schema relationships in `docs/database-schema.md`
- Add JSDoc comments to complex queries
- Create ER diagram for visual reference
- Document common query patterns

#### Option C: Targeted Integration Tests
- Test only critical operations (favorites, view records)
- Use in-memory DB for speed
- Focus on business-critical paths
- ~10-15 tests vs 50+ in full migration

#### Option D: Extract Duplicate Queries
- Find identical queries across files
- Move to shared utility functions
- Keep in existing file structure
- ~5-10 query helpers total

### Recommended Path Forward

**If you want to improve database code quality:**

1. **Start with Option A** (Type-Safe Query Helpers) - 30 minutes
   - Extract most common queries
   - Add type definitions
   - Document in one place

2. **Add Option C** (Targeted Tests) if needed - 15 minutes
   - Test critical user flows
   - Catch regressions

3. **Consider full migration only if:**
   - Codebase grows significantly (10+ developers)
   - Schema changes become frequent
   - Compliance requires comprehensive testing

**If current approach is working:**
- **Do nothing** - avoid over-engineering
- Revisit this plan if problems emerge

### Conclusion

**The full repository migration is NOT recommended at this time.** The existing DatabaseService pattern with scattered queries is working adequately. The cost and risk of migration outweighs the benefits for the current project scale.

**Consider lightweight improvements** if you want incremental quality gains without architectural changes.

---

## Next Steps (If Full Migration Still Desired)

1. **Review & Approve Plan** - Stakeholder review
2. **Create Feature Branch** - `feature/database-consolidation`
3. **Begin Phase 1** - Repository implementation (~20 min)
4. **Continuous Testing** - After each phase
5. **Code Review** - Before merging
6. **Final Deployment** - After all phases validated

## Appendix A: Query Inventory

### Sources Table Queries
- `SELECT * FROM sources WHERE id = ?` (5 locations)
- `SELECT * FROM sources ORDER BY position ASC` (3 locations)
- `INSERT INTO sources (...)` (4 locations)
- `UPDATE sources SET total_videos = ?` (2 locations)
- `DELETE FROM sources WHERE id = ?` (1 location)

### Videos Table Queries
- `SELECT * FROM videos WHERE id = ?` (6 locations)
- `SELECT * FROM videos WHERE source_id = ?` (4 locations)
- `INSERT OR REPLACE INTO videos (...)` (8 locations)
- `UPDATE videos SET is_available = ?` (2 locations)

### View Records Table Queries
- `SELECT * FROM view_records WHERE video_id = ?` (4 locations)
- `INSERT OR REPLACE INTO view_records (...)` (3 locations)
- `SELECT ... FROM view_records ORDER BY last_watched` (3 locations)

### Favorites Table Queries
- `SELECT * FROM favorites` (3 locations)
- `SELECT COUNT(*) FROM favorites WHERE video_id = ?` (2 locations)
- `INSERT INTO favorites (...)` (2 locations)
- `DELETE FROM favorites WHERE video_id = ?` (2 locations)

### YouTube Cache Table Queries
- `SELECT * FROM youtube_api_results WHERE source_id = ?` (2 locations)
- `INSERT INTO youtube_api_results (...)` (2 locations)
- `DELETE FROM youtube_api_results WHERE source_id = ?` (1 location)

## Appendix B: Repository Method Signatures

### SourceRepository Complete API
```typescript
class SourceRepository extends BaseRepository {
  // READ operations
  findById(id: string): Promise<Source | null>
  findAll(orderBy?: 'position' | 'title'): Promise<Source[]>
  findByType(type: SourceType): Promise<Source[]>
  findStale(thresholdDate: string): Promise<Source[]>
  count(): Promise<number>

  // WRITE operations
  create(source: CreateSourceDTO): Promise<string>
  update(id: string, updates: UpdateSourceDTO): Promise<void>
  updateVideoCount(id: string, count: number): Promise<void>
  updateThumbnail(id: string, thumbnail: string): Promise<void>
  delete(id: string): Promise<void>
}
```

### VideoRepository Complete API
```typescript
class VideoRepository extends BaseRepository {
  // READ operations
  findById(id: string): Promise<Video | null>
  findBySource(sourceId: string): Promise<Video[]>
  findByIds(ids: string[]): Promise<Video[]>
  search(query: string, sourceId?: string): Promise<Video[]>

  // WRITE operations
  create(video: CreateVideoDTO): Promise<void>
  batchUpsert(videos: CreateVideoDTO[]): Promise<void>
  update(id: string, updates: UpdateVideoDTO): Promise<void>
  updateAvailability(id: string, isAvailable: boolean): Promise<void>
  delete(id: string): Promise<void>
  deleteBySource(sourceId: string): Promise<void>
}
```

### ViewRecordRepository Complete API
```typescript
class ViewRecordRepository extends BaseRepository {
  // READ operations
  findByVideoId(videoId: string): Promise<ViewRecord | null>
  findBySourceId(sourceId: string): Promise<ViewRecord[]>
  findHistory(limit?: number): Promise<ViewRecordWithVideo[]>
  findRecentlyWatched(limit?: number): Promise<ViewRecordWithVideo[]>
  findLastWatched(): Promise<ViewRecordWithVideo | null>

  // WRITE operations
  upsert(record: CreateViewRecordDTO): Promise<void>
  update(videoId: string, updates: UpdateViewRecordDTO): Promise<void>
  delete(videoId: string): Promise<void>
  deleteBySource(sourceId: string): Promise<void>
}
```

### FavoriteRepository Complete API
```typescript
class FavoriteRepository extends BaseRepository {
  // READ operations
  findAll(): Promise<FavoriteWithVideo[]>
  findByVideoId(videoId: string): Promise<Favorite | null>
  findBySourceId(sourceId: string): Promise<Favorite[]>
  isFavorite(videoId: string): Promise<boolean>
  count(): Promise<number>

  // WRITE operations
  add(favorite: CreateFavoriteDTO): Promise<void>
  remove(videoId: string): Promise<void>
  toggle(videoId: string, sourceId: string): Promise<boolean>
  deleteBySource(sourceId: string): Promise<void>
}
```

### YouTubeCacheRepository Complete API
```typescript
class YouTubeCacheRepository extends BaseRepository {
  // READ operations
  findPage(sourceId: string, pageNumber: number, pageSize: number): Promise<CachedPage | null>
  findBySource(sourceId: string): Promise<YouTubeApiResult[]>

  // WRITE operations
  savePage(sourceId: string, pageNumber: number, videos: string[], pageSize: number): Promise<void>
  clearSource(sourceId: string): Promise<void>
  deleteBySource(sourceId: string): Promise<void>
}
```
