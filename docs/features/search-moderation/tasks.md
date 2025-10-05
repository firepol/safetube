# Search + Moderation Feature - Implementation Tasks

## Phase 1: Database & Core Services (Estimated: 8-12 hours)

### Task 1.1: Database Schema Setup
**Description**: Create database migration script for new tables
**Files to Create/Modify**:
- `migrations/XX-search-moderation.sql`
- `src/main/database/migrations.ts` (add migration)

**Subtasks**:
- [x] Create `searches` table with indexes
- [x] Create `wishlist` table with indexes and constraints
- [x] Create `search_results_cache` table with indexes
- [x] Update schema_version table
- [x] Add migration runner logic
- [x] Test migration on fresh database
- [x] Test migration on existing database

**Acceptance Criteria**:
- All three tables created successfully
- Indexes applied correctly
- Unique constraints enforced (test with duplicate inserts)
- Migration idempotent (can run multiple times safely)
- Schema version updated correctly

**Dependencies**: None

**Estimated Effort**: 2-3 hours

---

### Task 1.2: TypeScript Interfaces
**Description**: Define TypeScript interfaces for new data structures
**Files to Create/Modify**:
- `src/shared/types.ts` (add new interfaces)

**Subtasks**:
- [x] Define `Search` interface
- [x] Define `WishlistItem` interface
- [x] Define `WishlistStatus` enum
- [x] Define `SearchType` enum
- [x] Define `SearchResult` interface
- [x] Define `VideoData` interface (for cache)
- [x] Export all new types

**Acceptance Criteria**:
- All interfaces match database schema
- Proper TypeScript typing (no `any` types)
- Enums provide type safety
- Interfaces support optional fields where appropriate

**Dependencies**: Task 1.1

**Estimated Effort**: 1 hour

---

### Task 1.3: Search Service (Database Search)
**Description**: Implement database full-text search using FTS5
**Files to Create/Modify**:
- `src/main/services/searchService.ts` (new file)

**Subtasks**:
- [x] Create `searchDatabase(query: string)` function
- [x] Implement FTS5 query with proper escaping
- [x] Return results as SearchResult[]
- [x] Record search in `searches` table
- [x] Handle empty results
- [x] Add error handling
- [x] Write unit tests

**Acceptance Criteria**:
- Searches videos table using FTS5 index
- Returns results in <500ms for typical queries
- Properly escapes special FTS5 characters
- Records all searches in database
- Returns empty array (not error) for no results
- Unit tests achieve >80% coverage

**Dependencies**: Task 1.1, 1.2

**Estimated Effort**: 2-3 hours

---

### Task 1.4: Search Service (YouTube Search)
**Description**: Implement YouTube API search with caching
**Files to Create/Modify**:
- `src/main/services/searchService.ts` (extend)
- `src/main/youtube-api.ts` (extend existing)

**Subtasks**:
- [x] Add `searchYouTube(query: string)` function
- [x] Check cache before API call
- [x] Call YouTube API with safeSearch='strict'
- [x] Store results in search_results_cache
- [x] Calculate expires_at (24 hours from now)
- [x] Record search in searches table
- [x] Handle API errors gracefully
- [x] Implement quota monitoring
- [x] Write unit tests

**Acceptance Criteria**:
- YouTube search returns max 50 results
- Cache hit avoids API call
- Expired cache triggers fresh API call
- Safe search enforced
- Quota exceeded handled gracefully
- Unit tests mock YouTube API

**Dependencies**: Task 1.1, 1.2, 1.3

**Estimated Effort**: 3-4 hours

---

### Task 1.5: Wishlist Service
**Description**: Implement wishlist CRUD operations
**Files to Create/Modify**:
- `src/main/services/wishlistService.ts` (new file)

**Subtasks**:
- [x] `addToWishlist(video: VideoData)` function
- [x] `removeFromWishlist(videoId: string)` function
- [x] `getWishlistByStatus(status: WishlistStatus)` function
- [x] `approveVideo(videoId: string)` function
- [x] `denyVideo(videoId: string, reason?: string)` function
- [x] `updateWishlistStatus(videoId, status)` function
- [x] Handle duplicate adds gracefully
- [x] Emit IPC events on updates
- [x] Write unit tests

**Acceptance Criteria**:
- All CRUD operations work correctly ✅
- Duplicate adds return helpful error ✅
- Status transitions validated ✅
- Database transactions used for consistency ✅
- IPC events emitted for real-time updates ✅
- Unit tests achieve >80% coverage ✅ (38 tests, 100% coverage)

**Dependencies**: Task 1.1, 1.2

**Estimated Effort**: 3-4 hours

---

### Task 1.6: IPC Handlers
**Description**: Wire up IPC communication for search and wishlist
**Files to Create/Modify**:
- `src/main/ipc/searchHandlers.ts` (new file)
- `src/main/ipc/wishlistHandlers.ts` (new file)
- `src/main/ipc/index.ts` (register handlers)
- `src/preload/index.ts` (expose to renderer)

**Subtasks**:
- [x] Implement search:database handler
- [x] Implement search:youtube handler
- [x] Implement search:history:get handler
- [x] Implement wishlist:add handler
- [x] Implement wishlist:remove handler
- [x] Implement wishlist:get:byStatus handler
- [x] Implement wishlist:approve handler
- [x] Implement wishlist:deny handler
- [x] Add IPC event emitters
- [x] Expose all handlers in preload
- [x] Write integration tests

**Acceptance Criteria**:
- All IPC handlers registered ✅
- Renderer can call all search/wishlist functions ✅
- Type-safe IPC communication ✅
- Error propagation works correctly ✅
- Integration tests verify end-to-end flow ✅

**Dependencies**: Task 1.3, 1.4, 1.5

**Estimated Effort**: 2-3 hours

---

## Phase 2: Search UI Components (Estimated: 8-10 hours)

### Task 2.1: SearchBar Component
**Description**: Create reusable search bar component
**Files to Create/Modify**:
- `src/renderer/components/search/SearchBar.tsx` (new file)
- `src/renderer/components/search/SearchBar.test.tsx` (new file)

**Subtasks**:
- [ ] Create SearchBar component with props interface
- [ ] Implement input field with search icon
- [ ] Add debouncing (300ms default)
- [ ] Add clear button when text present
- [ ] Add keyboard shortcut (Ctrl+K to focus)
- [ ] Add loading state indicator
- [ ] Style with Tailwind CSS
- [ ] Write unit tests (input, debounce, keyboard)

**Acceptance Criteria**:
- Component renders correctly
- Debouncing prevents excessive searches
- Clear button works
- Keyboard shortcut focuses input
- Loading state shows during search
- Unit tests achieve >80% coverage
- Responsive design

**Dependencies**: None

**Estimated Effort**: 2-3 hours

---

### Task 2.2: SearchResultsPage Component
**Description**: Create search results page with grid display
**Files to Create/Modify**:
- `src/renderer/pages/SearchResultsPage.tsx` (new file)
- `src/renderer/pages/SearchResultsPage.test.tsx` (new file)
- `src/renderer/App.tsx` (add route)

**Subtasks**:
- [ ] Create SearchResultsPage component
- [ ] Add SearchBar at top
- [ ] Implement search state management
- [ ] Call search IPC handlers
- [ ] Display results in VideoGrid
- [ ] Add "Search YouTube" button
- [ ] Handle auto-fallback to YouTube when 0 results
- [ ] Show loading states
- [ ] Show empty state
- [ ] Add route to App.tsx
- [ ] Write unit tests

**Acceptance Criteria**:
- Page renders with search bar
- Database search works correctly
- YouTube fallback triggers on 0 results
- Manual YouTube search button works
- Results display in grid
- Loading and empty states shown appropriately
- Unit tests achieve >80% coverage

**Dependencies**: Task 1.6, Task 2.1

**Estimated Effort**: 3-4 hours

---

### Task 2.3: VideoCardBase Wishlist Extensions
**Description**: Extend VideoCardBase to support wishlist button
**Files to Create/Modify**:
- `src/renderer/components/video/VideoCardBase.tsx` (modify)
- `src/renderer/components/video/VideoCardBase.test.tsx` (extend)

**Subtasks**:
- [ ] Add wishlist-related props to interface
- [ ] Add "+ Wishlist" button component
- [ ] Implement button visibility logic
- [ ] Add disabled state for videos in wishlist
- [ ] Handle wishlist add click
- [ ] Add video details dialog for unapproved videos
- [ ] Style wishlist button
- [ ] Update unit tests

**Acceptance Criteria**:
- Wishlist button shows only for unapproved sources
- Button disabled when video in wishlist
- Click adds video to wishlist via IPC
- Toast notification shows on success/error
- Video details dialog works for unapproved videos
- Existing functionality not broken
- Unit tests achieve >80% coverage

**Dependencies**: Task 1.6

**Estimated Effort**: 3-4 hours

---

### Task 2.4: Integrate Search in Kid Screen
**Description**: Add search bar to kid screen header
**Files to Create/Modify**:
- `src/renderer/pages/KidScreen.tsx` (modify)

**Subtasks**:
- [ ] Import SearchBar component
- [ ] Position between title and time indicator
- [ ] Wire up onSearch handler
- [ ] Navigate to SearchResultsPage with query
- [ ] Test layout on various screen sizes

**Acceptance Criteria**:
- Search bar visible and centered
- Search navigates to results page
- Layout responsive
- Time indicator still visible
- No UI regressions

**Dependencies**: Task 2.1, Task 2.2

**Estimated Effort**: 1 hour

---

### Task 2.5: Integrate Search in Source Page
**Description**: Add search bar to source page
**Files to Create/Modify**:
- `src/renderer/pages/SourcePage.tsx` (modify)

**Subtasks**:
- [ ] Import SearchBar component
- [ ] Position between breadcrumbs and time indicator
- [ ] Wire up onSearch handler (source-scoped search)
- [ ] Option to expand search to all sources
- [ ] Test layout

**Acceptance Criteria**:
- Search bar visible and positioned correctly
- Source-scoped search works
- Expand to all sources option works
- Layout responsive
- No UI regressions

**Dependencies**: Task 2.1, Task 2.2

**Estimated Effort**: 1 hour

---

## Phase 3: Wishlist UI - Kid Side (Estimated: 6-8 hours)

### Task 3.1: WishlistContext Provider
**Description**: Create context for wishlist state management
**Files to Create/Modify**:
- `src/renderer/contexts/WishlistContext.tsx` (new file)
- `src/renderer/contexts/WishlistContext.test.tsx` (new file)

**Subtasks**:
- [ ] Create WishlistContext interface
- [ ] Implement WishlistProvider component
- [ ] Load wishlist data via IPC
- [ ] Implement polling for updates (30s interval)
- [ ] Listen for IPC events (wishlist:updated)
- [ ] Implement cache with 30s TTL
- [ ] Provide helper functions (add, remove, refresh)
- [ ] Write unit tests

**Acceptance Criteria**:
- Context provides wishlist data by status
- Real-time updates when parent takes action
- Polling refreshes stale data
- Helper functions work correctly
- Unit tests achieve >80% coverage

**Dependencies**: Task 1.6

**Estimated Effort**: 2-3 hours

---

### Task 3.2: WishlistPage Component
**Description**: Create kid's wishlist page with tabs
**Files to Create/Modify**:
- `src/renderer/pages/WishlistPage.tsx` (new file)
- `src/renderer/pages/WishlistPage.test.tsx` (new file)
- `src/renderer/App.tsx` (add route)

**Subtasks**:
- [ ] Create WishlistPage component
- [ ] Add tab navigation (Pending/Approved/Denied)
- [ ] Display video grids for each tab
- [ ] Add action buttons per tab
- [ ] Implement remove functionality
- [ ] Implement play functionality (approved tab)
- [ ] Show denial reasons (denied tab)
- [ ] Add badge counts on tabs
- [ ] Add route to App.tsx
- [ ] Write unit tests

**Acceptance Criteria**:
- Three tabs render correctly
- Videos display in appropriate tabs
- Remove works from all tabs
- Play works from approved tab
- Denial reasons visible on denied tab
- Badge counts accurate
- Unit tests achieve >80% coverage

**Dependencies**: Task 3.1

**Estimated Effort**: 3-4 hours

---

### Task 3.3: Navigation Integration
**Description**: Add "My Wishlist" link to kid screen navigation
**Files to Create/Modify**:
- `src/renderer/pages/KidScreen.tsx` (modify)
- `src/renderer/components/layout/Navigation.tsx` (modify if separate)

**Subtasks**:
- [ ] Add "My Wishlist" navigation link
- [ ] Add badge showing unread count (new approved/denied)
- [ ] Style navigation link
- [ ] Test navigation flow

**Acceptance Criteria**:
- Navigation link visible and accessible
- Badge count shows correctly
- Clicking navigates to WishlistPage
- No UI regressions

**Dependencies**: Task 3.2

**Estimated Effort**: 1 hour

---

## Phase 4: Wishlist UI - Parent Side (Estimated: 8-10 hours)

### Task 4.1: SearchHistoryTab Component
**Description**: Create admin tab for search history
**Files to Create/Modify**:
- `src/renderer/components/admin/SearchHistoryTab.tsx` (new file)
- `src/renderer/components/admin/SearchHistoryTab.test.tsx` (new file)
- `src/renderer/pages/AdminPage.tsx` (add tab)

**Subtasks**:
- [ ] Create SearchHistoryTab component
- [ ] Load search history via IPC
- [ ] Display table with columns (query, date, count, type)
- [ ] Implement pagination
- [ ] Add click handler to view cached results
- [ ] Create CachedResultsModal component
- [ ] Display cached results in VideoGrid
- [ ] Add tab to AdminPage
- [ ] Write unit tests

**Acceptance Criteria**:
- Search history table displays correctly
- Pagination works
- Clicking row shows cached results modal
- Modal displays results in grid
- Tab integrated in admin page
- Unit tests achieve >80% coverage

**Dependencies**: Task 1.6

**Estimated Effort**: 3-4 hours

---

### Task 4.2: VideoPreviewModal Component
**Description**: Create modal for parent video preview
**Files to Create/Modify**:
- `src/renderer/components/admin/VideoPreviewModal.tsx` (new file)
- `src/renderer/components/admin/VideoPreviewModal.test.tsx` (new file)

**Subtasks**:
- [ ] Create VideoPreviewModal component
- [ ] Embed YouTube iframe player
- [ ] Display video metadata
- [ ] Add Approve/Deny action buttons
- [ ] Add Close button
- [ ] Ensure playback doesn't count toward time limits
- [ ] Style modal with Tailwind
- [ ] Write unit tests

**Acceptance Criteria**:
- Modal opens and closes correctly
- YouTube iframe loads and plays
- Metadata displays accurately
- Approve/Deny buttons work
- Time tracking not affected
- Unit tests achieve >80% coverage

**Dependencies**: Task 1.6

**Estimated Effort**: 2-3 hours

---

### Task 4.3: DenyReasonDialog Component
**Description**: Create dialog for entering denial reason
**Files to Create/Modify**:
- `src/renderer/components/admin/DenyReasonDialog.tsx` (new file)
- `src/renderer/components/admin/DenyReasonDialog.test.tsx` (new file)

**Subtasks**:
- [ ] Create DenyReasonDialog component
- [ ] Add text input with 500 char limit
- [ ] Add character counter
- [ ] Add Save/Cancel buttons
- [ ] Validate input
- [ ] Call wishlist:deny IPC with reason
- [ ] Show success/error feedback
- [ ] Write unit tests

**Acceptance Criteria**:
- Dialog opens/closes correctly
- Text input works with limit enforced
- Character counter accurate
- Reason saved to database
- Success feedback shown
- Unit tests achieve >80% coverage

**Dependencies**: Task 1.6

**Estimated Effort**: 1-2 hours

---

### Task 4.4: WishlistModerationTab Component
**Description**: Create admin tab for wishlist moderation
**Files to Create/Modify**:
- `src/renderer/components/admin/WishlistModerationTab.tsx` (new file)
- `src/renderer/components/admin/WishlistModerationTab.test.tsx` (new file)
- `src/renderer/pages/AdminPage.tsx` (add tab)

**Subtasks**:
- [ ] Create WishlistModerationTab component
- [ ] Add sub-tabs (Pending/Approved/Denied)
- [ ] Load wishlist by status via IPC
- [ ] Display videos in grids
- [ ] Add Watch button (opens VideoPreviewModal)
- [ ] Add Approve button (pending tab)
- [ ] Add Deny button (opens DenyReasonDialog)
- [ ] Add Reverse button (approved/denied tabs)
- [ ] Show counts on sub-tabs
- [ ] Add tab to AdminPage
- [ ] Write unit tests

**Acceptance Criteria**:
- Three sub-tabs render correctly
- Videos display by status
- All action buttons work
- Modal integrations functional
- Status changes reflected immediately
- Tab integrated in admin page
- Unit tests achieve >80% coverage

**Dependencies**: Task 4.2, Task 4.3

**Estimated Effort**: 3-4 hours

---

## Phase 5: Testing & Polish (Estimated: 6-8 hours)

### Task 5.1: Integration Tests
**Description**: Write comprehensive integration tests
**Files to Create/Modify**:
- `tests/integration/search.test.ts` (new file)
- `tests/integration/wishlist.test.ts` (new file)

**Subtasks**:
- [ ] Test database search flow end-to-end
- [ ] Test YouTube search flow end-to-end
- [ ] Test search cache behavior
- [ ] Test add to wishlist flow
- [ ] Test parent approval flow
- [ ] Test parent denial flow
- [ ] Test status change notifications
- [ ] Test cross-user scenarios

**Acceptance Criteria**:
- All critical flows tested
- Tests run reliably in CI
- Coverage >80% for integration paths
- Tests use realistic data
- Mocking appropriate (YouTube API)

**Dependencies**: All previous tasks

**Estimated Effort**: 3-4 hours

---

### Task 5.2: Edge Case Handling
**Description**: Handle edge cases and error scenarios
**Files to Modify**: Various component and service files

**Subtasks**:
- [ ] Handle YouTube API quota exhausted
- [ ] Handle network offline during search
- [ ] Handle corrupted cache data
- [ ] Handle database locked errors
- [ ] Handle simultaneous wishlist updates
- [ ] Handle invalid video IDs
- [ ] Add retry logic for transient failures
- [ ] Test all error paths

**Acceptance Criteria**:
- All identified edge cases handled gracefully
- Error messages user-friendly
- No crashes or uncaught exceptions
- Retry logic works correctly
- Tests verify error handling

**Dependencies**: Task 5.1

**Estimated Effort**: 2-3 hours

---

### Task 5.3: Performance Optimization
**Description**: Optimize for performance and responsiveness
**Files to Modify**: Various component files

**Subtasks**:
- [ ] Profile search results rendering
- [ ] Optimize VideoGrid with virtualization if needed
- [ ] Lazy load video thumbnails
- [ ] Memoize expensive computations
- [ ] Reduce re-renders in VideoCardBase
- [ ] Optimize database queries with EXPLAIN
- [ ] Add performance metrics logging
- [ ] Test with large datasets (1000+ videos)

**Acceptance Criteria**:
- Search results render in <100ms
- Grid scrolling smooth with 100+ items
- Database queries <500ms
- No unnecessary re-renders
- Performance metrics logged

**Dependencies**: Task 5.1

**Estimated Effort**: 2-3 hours

---

### Task 5.4: UI/UX Polish
**Description**: Polish UI and improve user experience
**Files to Modify**: Various component files

**Subtasks**:
- [ ] Refine animations and transitions
- [ ] Improve empty states
- [ ] Add helpful tooltips
- [ ] Ensure consistent spacing/typography
- [ ] Test on various screen sizes
- [ ] Improve loading states
- [ ] Add accessibility features (ARIA labels, keyboard nav)
- [ ] Conduct usability testing

**Acceptance Criteria**:
- Animations smooth and purposeful
- Empty states informative
- Tooltips helpful
- Responsive on all screen sizes
- Accessibility score >90%
- Positive usability feedback

**Dependencies**: All previous tasks

**Estimated Effort**: 2-3 hours

---

### Task 5.5: Documentation
**Description**: Document new features and APIs
**Files to Create/Modify**:
- `docs/features/search-moderation/README.md` (new file)
- `docs/features/search-moderation/api.md` (new file)
- `README.md` (update with feature description)

**Subtasks**:
- [ ] Document search functionality for users
- [ ] Document wishlist workflow for users
- [ ] Document parent moderation process
- [ ] Document IPC API
- [ ] Document database schema
- [ ] Add code comments where needed
- [ ] Create troubleshooting guide
- [ ] Update main README

**Acceptance Criteria**:
- User-facing docs clear and comprehensive
- API docs accurate and complete
- Code comments helpful
- Troubleshooting guide covers common issues
- README updated

**Dependencies**: All previous tasks

**Estimated Effort**: 1-2 hours

---

## Summary

### Total Estimated Effort: 36-48 hours

### Phase Breakdown:
- **Phase 1**: Database & Core Services (8-12h)
- **Phase 2**: Search UI Components (8-10h)
- **Phase 3**: Wishlist UI - Kid Side (6-8h)
- **Phase 4**: Wishlist UI - Parent Side (8-10h)
- **Phase 5**: Testing & Polish (6-8h)

### Critical Path:
1. Phase 1 (database/services) must complete first
2. Phase 2 and Phase 3 can partially overlap after Phase 1
3. Phase 4 depends on Phase 1 only
4. Phase 5 depends on all previous phases

### Risk Mitigation:
- Start with database schema (Task 1.1) to unblock everything else
- Implement IPC handlers early (Task 1.6) to enable UI development
- Build reusable components first (SearchBar, VideoCardBase) before pages
- Test incrementally throughout development
- Document as you build to avoid final rush

### Testing Targets:
- Unit test coverage: >80%
- Integration test coverage: >80%
- E2E tests for critical user journeys
- Performance benchmarks for search and rendering

### Success Metrics:
- All user stories from requirements.md implemented
- All acceptance criteria met
- No high-priority bugs
- Performance targets achieved
- Documentation complete
