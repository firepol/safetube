# Search + Moderation Feature - Technical Design Document

## Architecture Overview

### Component Hierarchy
```
KidScreen
   SearchBar (reusable)
   SearchResultsPage
      SearchResultsHeader (with "Search YouTube" button)
      VideoGrid
          VideoCardBase (with wishlist button)
   WishlistPage
       WishlistTabs (Pending/Approved/Denied)
       VideoGrid

SourcePage
   SearchBar (reusable)
   [rest of existing components]

AdminPage
   SearchHistoryTab
      SearchHistoryTable
      CachedResultsModal
          VideoGrid
   WishlistModerationTab
      WishlistTabs (Pending/Approved/Denied)
      VideoPreviewModal
         YouTubeIframePlayer
      DenyReasonDialog
   [existing tabs]
```

## Database Design

### Schema Overview
Three new tables to support search and moderation:

#### 1. searches
```sql
CREATE TABLE searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  search_type TEXT NOT NULL CHECK(search_type IN ('database', 'youtube')),
  result_count INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_searches_timestamp ON searches(timestamp DESC);
CREATE INDEX idx_searches_query ON searches(query);
```

**Purpose**: Track all search queries for parental audit trail

**Relationships**: Linked to search_results_cache via query text
###
# 2. wishlist
```sql
CREATE TABLE wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail TEXT,
  description TEXT,
  channel_id TEXT,
  channel_name TEXT,
  duration INTEGER,
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'denied')),
  requested_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT, -- Future: for multi-parent support
  denial_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(video_id)
);

CREATE INDEX idx_wishlist_status ON wishlist(status);
CREATE INDEX idx_wishlist_requested_at ON wishlist(requested_at);
CREATE INDEX idx_wishlist_video_id ON wishlist(video_id);
```

**Purpose**: Manage video approval workflow

**Lifecycle**:
1. Kid adds video → `status='pending'`, `requested_at=NOW()`
2. Parent approves → `status='approved'`, `reviewed_at=NOW()`
3. Parent denies → `status='denied'`, `reviewed_at=NOW()`, optional `denial_reason`

#### 3. search_results_cache
```sql
CREATE TABLE search_results_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_query TEXT NOT NULL,
  video_id TEXT NOT NULL,
  video_data TEXT NOT NULL, -- JSON blob
  position INTEGER NOT NULL,
  search_type TEXT NOT NULL CHECK(search_type IN ('database', 'youtube')),
  fetch_timestamp TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(search_query, video_id, search_type)
);

CREATE INDEX idx_search_cache_query ON search_results_cache(search_query);
CREATE INDEX idx_search_cache_timestamp ON search_results_cache(fetch_timestamp);
CREATE INDEX idx_search_cache_expires ON search_results_cache(expires_at);
```

**Purpose**: Cache search results for 24 hours

**video_data JSON structure**:
```typescript
{
  id: string;
  title: string;
  thumbnail: string;
  description: string;
  duration: number;
  channelId: string;
  channelName: string;
  url: string;
  publishedAt: string;
}
```

**Cache cleanup**: Periodic job (daily) to delete expired entries where `expires_at < NOW()`## 
Component Design

### 1. SearchBar Component (Reusable)

**File**: `src/renderer/components/search/SearchBar.tsx`

**Props**:
```typescript
interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  onYouTubeSearch?: () => void; // Optional, for results page
  className?: string;
  autoFocus?: boolean;
  debounceMs?: number; // Default: 300
}
```

**Features**:
- Input field with search icon
- Debounced search trigger
- Clear button when text present
- Keyboard shortcuts (Ctrl+K to focus)
- Loading state indicator

**Usage**:
```tsx
// Kid Screen
<SearchBar
  placeholder="Search videos..."
  onSearch={handleDatabaseSearch}
  className="mx-auto max-w-2xl"
/>

// Source Page
<SearchBar
  placeholder="Search in this source..."
  onSearch={handleSourceSearch}
  className="max-w-md"
/>

// Search Results Page
<SearchBar
  placeholder="Search videos..."
  onSearch={handleDatabaseSearch}
  onYouTubeSearch={handleYouTubeSearch}
  className="mx-auto max-w-2xl"
/>
```

### 2. SearchResultsPage Component

**File**: `src/renderer/pages/SearchResultsPage.tsx`

**State**:
```typescript
interface SearchResultsState {
  query: string;
  results: VideoCardBaseProps[];
  searchType: 'database' | 'youtube';
  isLoading: boolean;
  error: string | null;
}
```*
*Layout**:
```tsx
<div className="min-h-screen p-6">
  <SearchBar
    onSearch={handleSearch}
    onYouTubeSearch={handleYouTubeSearch}
  />

  {isLoading && <LoadingSpinner />}

  {results.length > 0 && (
    <>
      <SearchResultsHeader
        query={query}
        resultCount={results.length}
        searchType={searchType}
        onYouTubeSearch={handleYouTubeSearch}
      />
      <VideoGrid
        videos={results}
        showFavoriteIcons={false}
        showWishlistButtons={true}
      />
    </>
  )}

  {results.length === 0 && !isLoading && (
    <EmptyState
      message="No results found"
      action={<Button onClick={handleYouTubeSearch}>Search YouTube</Button>}
    />
  )}
</div>
```

### 3. VideoCardBase Extensions

**New Props**:
```typescript
interface VideoCardBaseProps {
  // ... existing props

  // Wishlist support
  isInWishlist?: boolean;
  wishlistStatus?: 'pending' | 'approved' | 'denied';
  showWishlistButton?: boolean;
  onWishlistAdd?: (video: VideoCardBaseProps) => void;

  // Source approval check
  isApprovedSource?: boolean;
}
```

**Button Logic**:
```typescript
// Show wishlist button if:
// 1. showWishlistButton prop is true
// 2. Video is NOT from approved source
// 3. Video is NOT already in wishlist

const showWishlist = showWishlistButton &&
                     !isApprovedSource &&
                     !isInWishlist;

// Button states:
// - Not in wishlist: "+ Wishlist" (blue, clickable)
// - In wishlist: "In Wishlist" (gray, disabled)
```**Cl
ick Handler**:
```typescript
const handleCardClick = () => {
  if (isApprovedSource) {
    // Play video normally
    navigate(`/player/${encodeURIComponent(id)}`);
  } else {
    // Show video details dialog with wishlist option
    setShowDetailsDialog(true);
  }
};
```

### 4. WishlistPage Component (Kid View)

**File**: `src/renderer/pages/WishlistPage.tsx`

**State**:
```typescript
interface WishlistPageState {
  activeTab: 'pending' | 'approved' | 'denied';
  pendingVideos: WishlistItem[];
  approvedVideos: WishlistItem[];
  deniedVideos: WishlistItem[];
  isLoading: boolean;
}
```

**Layout**:
```tsx
<div className="min-h-screen p-6">
  <Header title="My Wishlist" />

  <Tabs value={activeTab} onChange={setActiveTab}>
    <Tab value="pending" label="Pending" badge={pendingCount} />
    <Tab value="approved" label="Approved" badge={approvedCount} />
    <Tab value="denied" label="Denied" badge={deniedCount} />
  </Tabs>

  <TabPanel value={activeTab} index="pending">
    <VideoGrid
      videos={pendingVideos}
      actions={[
        { label: "Remove", onClick: handleRemove }
      ]}
    />
  </TabPanel>

  <TabPanel value={activeTab} index="approved">
    <VideoGrid
      videos={approvedVideos}
      actions={[
        { label: "Play", onClick: handlePlay },
        { label: "Remove", onClick: handleRemove }
      ]}
    />
  </TabPanel>

  <TabPanel value={activeTab} index="denied">
    <VideoGrid
      videos={deniedVideos}
      actions={[
        { label: "View Reason", onClick: handleViewReason },
        { label: "Remove", onClick: handleRemove }
      ]}
    />
  </TabPanel>
</div>
```#
## 5. Admin Components

#### SearchHistoryTab

**File**: `src/renderer/components/admin/SearchHistoryTab.tsx`

**Features**:
- Paginated table of all searches
- Click row to view cached results
- Filter by date range
- Export to CSV option

**Table Columns**:
- Query text
- Date/time
- Result count
- Search type badge

#### WishlistModerationTab

**File**: `src/renderer/components/admin/WishlistModerationTab.tsx`

**Features**:
- Tabs for pending/approved/denied
- Video preview modal
- Bulk approve/deny operations
- Status change history

**Actions**:
- Watch (opens VideoPreviewModal)
- Approve (updates status, sets reviewed_at)
- Deny (opens DenyReasonDialog)
- Reverse (for approved/denied items)

#### VideoPreviewModal

**File**: `src/renderer/components/admin/VideoPreviewModal.tsx`

**Features**:
- Embedded YouTube iframe player
- Video metadata display
- Approve/Deny buttons
- Does NOT count toward time limits (parent context)

```tsx
<Modal open={isOpen} onClose={onClose}>
  <div className="p-6">
    <h2>{video.title}</h2>

    <div className="aspect-video">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        allow="fullscreen"
      />
    </div>

    <VideoMetadata video={video} />

    <div className="flex gap-4">
      <Button onClick={handleApprove} color="green">
        Approve
      </Button>
      <Button onClick={handleDeny} color="red">
        Deny
      </Button>
      <Button onClick={onClose} variant="outline">
        Close
      </Button>
    </div>
  </div>
</Modal>
```

#### BulkModerationControls

**File**: `src/renderer/components/admin/BulkModerationControls.tsx`

**Features**:
- Multi-select video management
- Bulk approve/deny operations
- Progress tracking for batch operations

**State**:
```typescript
interface BulkModerationState {
  selectedVideos: Set<string>; // video IDs
  isSelectAll: boolean;
  isBulkOperationInProgress: boolean;
  bulkOperationProgress: {
    total: number;
    completed: number;
    failed: string[]; // video IDs that failed
  };
}
```

**UI Layout**:
```tsx
<div className="border-b border-gray-200 p-4 bg-gray-50">
  {/* Selection Controls */}
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-4">
      <Checkbox
        checked={isSelectAll}
        indeterminate={selectedVideos.size > 0 && !isSelectAll}
        onChange={handleSelectAll}
        label={`Select All (${totalVideos})`}
      />
      
      {selectedVideos.size > 0 && (
        <span className="text-sm text-gray-600">
          {selectedVideos.size} selected
        </span>
      )}
    </div>

    <div className="flex gap-2">
      <Button
        onClick={handleSelectNone}
        variant="outline"
        size="sm"
        disabled={selectedVideos.size === 0}
      >
        Clear Selection
      </Button>
    </div>
  </div>

  {/* Bulk Actions */}
  {selectedVideos.size > 0 && (
    <div className="flex items-center gap-3">
      <Button
        onClick={handleBulkApprove}
        color="green"
        disabled={isBulkOperationInProgress}
        className="flex items-center gap-2"
      >
        <CheckIcon className="w-4 h-4" />
        Approve Selected ({selectedVideos.size})
      </Button>
      
      <Button
        onClick={handleBulkDeny}
        color="red"
        disabled={isBulkOperationInProgress}
        className="flex items-center gap-2"
      >
        <XIcon className="w-4 h-4" />
        Deny Selected ({selectedVideos.size})
      </Button>

      {isBulkOperationInProgress && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Spinner className="w-4 h-4" />
          Processing {bulkOperationProgress.completed}/{bulkOperationProgress.total}...
        </div>
      )}
    </div>
  )}
</div>
```

**Enhanced VideoCardBase for Selection**:
```typescript
interface VideoCardBaseProps {
  // ... existing props
  
  // Bulk selection support
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (videoId: string, selected: boolean) => void;
}
```

**Selection Checkbox Overlay**:
```tsx
{isSelectable && (
  <div className="absolute top-2 left-2 z-10">
    <Checkbox
      checked={isSelected}
      onChange={(checked) => onSelectionChange?.(id, checked)}
      className="bg-white/90 backdrop-blur-sm rounded"
      onClick={(e) => e.stopPropagation()} // Prevent video click
    />
  </div>
)}
```

## 
Data Flow

### Search Flow

#### Database Search
```
User types in SearchBar
  → Debounce 300ms
  → IPC: search:database(query)
  → Main: Query videos_fts table
  → Return results
  → Renderer: Display in VideoGrid
  → IPC: search:history:add(query, 'database', count)
  → If results.length === 0:
      → Auto-trigger YouTube search
```

#### YouTube Search
```
User clicks "Search YouTube" OR auto-triggered
  → IPC: search:youtube(query)
  → Main: Check search_results_cache
  → If cached and not expired:
      → Return cached results
  → Else:
      → YouTube API: search.list(q=query, safeSearch='strict')
      → Store in search_results_cache
      → Return results
  → Renderer: Display in VideoGrid
  → IPC: search:history:add(query, 'youtube', count)
```

### Wishlist Flow

#### Add to Wishlist
```
User clicks "+ Wishlist" on video card
  → IPC: wishlist:add(videoData)
  → Main: Check if video_id exists in wishlist
  → If exists:
      → Return error "Already in wishlist"
  → Else:
      → INSERT INTO wishlist (status='pending')
      → Return success
  → Renderer: Show toast "Added to wishlist"
  → Update button state to disabled
```

#### Parent Approval
```
Parent clicks "Approve" in admin panel
  → IPC: wishlist:approve(videoId)
  → Main: UPDATE wishlist
      SET status='approved', reviewed_at=NOW()
      WHERE video_id=videoId
  → Return success
  → Renderer: Move item to "Approved" tab
  → Notify kid (badge count update)
```

#### Parent Denial
```
Parent clicks "Deny" → DenyReasonDialog opens
  → Parent enters reason (optional)
  → IPC: wishlist:deny(videoId, reason)
  → Main: UPDATE wishlist
      SET status='denied',
          reviewed_at=NOW(),
          denial_reason=reason
      WHERE video_id=videoId
  → Return success
  → Renderer: Move item to "Denied" tab
  → Notify kid (badge count update)
```

#### Bulk Operations Flow

**Bulk Approve**:
```
Parent selects multiple videos → clicks "Approve Selected"
  → Show confirmation dialog with count
  → Parent confirms
  → IPC: wishlist:bulkApprove(videoIds[])
  → Main: Begin database transaction
  → For each videoId:
      → UPDATE wishlist SET status='approved', reviewed_at=NOW()
      → Track success/failure
  → Commit transaction
  → Return { success: successIds[], failed: failedIds[] }
  → Renderer: 
      → Update UI for successful items
      → Show error toast for failed items
      → Clear selection
      → Refresh video lists
  → Notify kid (badge count update)
```

**Bulk Deny**:
```
Parent selects multiple videos → clicks "Deny Selected"
  → Show BulkDenyReasonDialog
  → Parent enters optional shared reason
  → Parent confirms
  → IPC: wishlist:bulkDeny(videoIds[], reason?)
  → Main: Begin database transaction
  → For each videoId:
      → UPDATE wishlist SET status='denied', reviewed_at=NOW(), denial_reason=reason
      → Track success/failure
  → Commit transaction
  → Return { success: successIds[], failed: failedIds[] }
  → Renderer:
      → Update UI for successful items
      → Show error toast for failed items
      → Clear selection
      → Refresh video lists
  → Notify kid (badge count update)
```

**Selection Management**:
```
Parent clicks video checkbox
  → Update selectedVideos Set
  → Update isSelectAll state based on selection count
  → Enable/disable bulk action buttons

Parent clicks "Select All"
  → Add all visible video IDs to selectedVideos
  → Set isSelectAll = true
  → Enable bulk action buttons

Parent clicks "Clear Selection"
  → Clear selectedVideos Set
  → Set isSelectAll = false
  → Disable bulk action buttons
```

## Sta
te Management

### Search State
- **Location**: SearchResultsPage component state
- **Persistence**: None (ephemeral search results)
- **Sync**: IPC calls for fresh data on mount

### Wishlist State
- **Location**: Context provider `WishlistContext`
- **Persistence**: Database (wishlist table)
- **Sync**:
  - Poll every 30 seconds for status changes
  - IPC event `wishlist:updated` for real-time updates
- **Cache**: In-memory cache with TTL 30s

**WishlistContext API**:
```typescript
interface WishlistContext {
  wishlist: {
    pending: WishlistItem[];
    approved: WishlistItem[];
    denied: WishlistItem[];
  };
  isLoading: boolean;
  addToWishlist: (video: VideoData) => Promise<Result>;
  removeFromWishlist: (videoId: string) => Promise<Result>;
  refreshWishlist: () => Promise<void>;
}
```

## IPC Communication

### IPC Handlers (Main Process)

**File**: `src/main/ipc/searchHandlers.ts`

```typescript
// Search handlers
ipcMain.handle('search:database', async (event, query: string) => {
  const db = getDatabase();
  const results = await db.all(`
    SELECT v.*, vf.rank
    FROM videos_fts vf
    JOIN videos v ON v.rowid = vf.rowid
    WHERE videos_fts MATCH ?
    ORDER BY vf.rank
    LIMIT 50
  `, [query]);

  // Record search history
  await db.run(`
    INSERT INTO searches (query, search_type, result_count, timestamp)
    VALUES (?, 'database', ?, datetime('now'))
  `, [query, results.length]);

  return results;
});

ipcMain.handle('search:youtube', async (event, query: string) => {
  // Check cache first
  const cached = await getSearchCache(query, 'youtube');
  if (cached && !isCacheExpired(cached)) {
    return cached.results;
  }

  // Call YouTube API
  const results = await youtubeService.search({
    q: query,
    maxResults: 50,
    safeSearch: 'strict',
    type: 'video'
  });

  // Cache results
  await cacheSearchResults(query, 'youtube', results);

  // Record history
  await db.run(`
    INSERT INTO searches (query, search_type, result_count, timestamp)
    VALUES (?, 'youtube', ?, datetime('now'))
  `, [query, results.length]);

  return results;
});

ipcMain.handle('search:history:get', async () => {
  const db = getDatabase();
  return await db.all(`
    SELECT * FROM searches
    ORDER BY timestamp DESC
    LIMIT 100
  `);
});
```**F
ile**: `src/main/ipc/wishlistHandlers.ts`

```typescript
ipcMain.handle('wishlist:add', async (event, video: VideoData) => {
  const db = getDatabase();

  try {
    await db.run(`
      INSERT INTO wishlist (
        video_id, title, thumbnail, description,
        channel_id, channel_name, duration, url,
        status, requested_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
    `, [
      video.id, video.title, video.thumbnail, video.description,
      video.channelId, video.channelName, video.duration, video.url
    ]);

    // Notify parent (if online)
    mainWindow?.webContents.send('wishlist:updated');

    return { success: true };
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return { success: false, error: 'Video already in wishlist' };
    }
    throw error;
  }
});

ipcMain.handle('wishlist:approve', async (event, videoId: string) => {
  const db = getDatabase();

  await db.run(`
    UPDATE wishlist
    SET status = 'approved',
        reviewed_at = datetime('now'),
        updated_at = datetime('now')
    WHERE video_id = ?
  `, [videoId]);

  // Notify kid
  mainWindow?.webContents.send('wishlist:updated');

  return { success: true };
});

ipcMain.handle('wishlist:deny', async (event, videoId: string, reason?: string) => {
  const db = getDatabase();

  await db.run(`
    UPDATE wishlist
    SET status = 'denied',
        reviewed_at = datetime('now'),
        denial_reason = ?,
        updated_at = datetime('now')
    WHERE video_id = ?
  `, [reason || null, videoId]);

  // Notify kid
  mainWindow?.webContents.send('wishlist:updated');

  return { success: true };
});

ipcMain.handle('wishlist:get:byStatus', async (event, status: WishlistStatus) => {
  const db = getDatabase();
  return await db.all(`
    SELECT * FROM wishlist
    WHERE status = ?
    ORDER BY requested_at DESC
  `, [status]);
});

// Bulk Operations Handlers
ipcMain.handle('wishlist:bulkApprove', async (event, videoIds: string[]) => {
  const db = getDatabase();
  const results = { success: [], failed: [] };

  // Use transaction for consistency
  await db.run('BEGIN TRANSACTION');
  
  try {
    for (const videoId of videoIds) {
      try {
        await db.run(`
          UPDATE wishlist
          SET status = 'approved',
              reviewed_at = datetime('now'),
              updated_at = datetime('now')
          WHERE video_id = ? AND status = 'pending'
        `, [videoId]);
        
        results.success.push(videoId);
      } catch (error) {
        console.error(`Failed to approve video ${videoId}:`, error);
        results.failed.push(videoId);
      }
    }
    
    await db.run('COMMIT');
    
    // Notify kid of updates
    mainWindow?.webContents.send('wishlist:updated');
    
    return results;
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
});

ipcMain.handle('wishlist:bulkDeny', async (event, videoIds: string[], reason?: string) => {
  const db = getDatabase();
  const results = { success: [], failed: [] };

  // Use transaction for consistency
  await db.run('BEGIN TRANSACTION');
  
  try {
    for (const videoId of videoIds) {
      try {
        await db.run(`
          UPDATE wishlist
          SET status = 'denied',
              reviewed_at = datetime('now'),
              denial_reason = ?,
              updated_at = datetime('now')
          WHERE video_id = ? AND status = 'pending'
        `, [reason || null, videoId]);
        
        results.success.push(videoId);
      } catch (error) {
        console.error(`Failed to deny video ${videoId}:`, error);
        results.failed.push(videoId);
      }
    }
    
    await db.run('COMMIT');
    
    // Notify kid of updates
    mainWindow?.webContents.send('wishlist:updated');
    
    return results;
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
});
```

### IPC Event Emitters

**Real-time updates**:
```typescript
// Main process
mainWindow?.webContents.send('wishlist:updated');
mainWindow?.webContents.send('search:completed', { query, resultCount });

// Renderer process
window.electron.on('wishlist:updated', () => {
  wishlistContext.refreshWishlist();
});
```## Se
curity Considerations

### Input Sanitization
- **Search Queries**: Sanitize before FTS5 matching (escape special characters)
- **Denial Reasons**: HTML escape to prevent XSS
- **YouTube API**: Use official client library with built-in sanitization

### SQL Injection Prevention
- **Parameterized Queries**: All database queries use placeholders
- **Prepared Statements**: Pre-compile frequently used queries

### YouTube API Safety
- **Safe Search**: Always use `safeSearch='strict'` parameter
- **Content Validation**: Double-check content type is 'video'
- **Quota Monitoring**: Track API usage to prevent quota exhaustion

### Access Control
- **Parent Actions**: All moderation actions require admin authentication
- **Kid Actions**: Limited to add/remove from wishlist, play approved videos
- **IPC Validation**: Validate user context for privileged operations

## Error Handling

### Search Errors

```typescript
try {
  const results = await window.electron.searchDatabase(query);
  setResults(results);
} catch (error) {
  if (error.code === 'DATABASE_ERROR') {
    showError('Search temporarily unavailable. Please try again.');
  } else if (error.code === 'YOUTUBE_API_ERROR') {
    showError('YouTube search unavailable. Try database search instead.');
  } else {
    showError('Search failed. Please try again.');
  }
  // Log error for debugging
  console.error('Search error:', error);
}
```

### Wishlist Errors

```typescript
try {
  await window.electron.wishlistAdd(video);
  showToast('Added to wishlist!');
} catch (error) {
  if (error.message.includes('already in wishlist')) {
    showToast('Video already in wishlist');
  } else {
    showError('Failed to add to wishlist. Please try again.');
  }
}
```

## Performance Optimization

### Search Performance
- **FTS5 Index**: Use existing full-text search index for O(log n) search
- **Result Limit**: Cap at 50 results to prevent UI overload
- **Debouncing**: 300ms delay prevents excessive searches
- **Caching**: 24-hour cache reduces YouTube API calls by 90%

### Rendering Performance
- **Virtualization**: Consider react-window for >100 results
- **Lazy Loading**: Load video thumbnails lazily as they scroll into view
- **Memoization**: Memoize VideoCardBase to prevent unnecessary re-renders

### Database Performance
- **Indexes**: All foreign keys and frequently queried columns indexed
- **Query Optimization**: Use EXPLAIN QUERY PLAN to validate query efficiency
- **Connection Pooling**: Reuse database connection (single connection for Electron)## T
esting Strategy

### Unit Tests
- **SearchBar**: Input handling, debouncing, keyboard shortcuts
- **VideoCardBase**: Wishlist button logic, approved source detection
- **IPC Handlers**: All search and wishlist handlers
- **Database Functions**: CRUD operations, cache management

### Integration Tests
- **Search Flow**: Database → YouTube fallback → Results display
- **Wishlist Flow**: Add → Parent review → Status update → Kid notification
- **Cache Behavior**: Hit/miss scenarios, expiration

### E2E Tests
- **Kid Search Journey**: Search → View results → Add to wishlist → View wishlist
- **Parent Moderation Journey**: View pending → Watch video → Approve/deny → Verify kid sees update
- **Cross-user Scenarios**: Parent approves while kid is browsing

## Migration Strategy

### Database Migration
- **Migration Script**: `migrations/XX-search-moderation.sql`
- **Backward Compatibility**: New tables don't affect existing functionality
- **Data Preservation**: No changes to existing tables

```sql
-- Migration: XX-search-moderation.sql

-- Create searches table
CREATE TABLE IF NOT EXISTS searches (
  -- ... (as defined above)
);

-- Create wishlist table
CREATE TABLE IF NOT EXISTS wishlist (
  -- ... (as defined above)
);

-- Create search_results_cache table
CREATE TABLE IF NOT EXISTS search_results_cache (
  -- ... (as defined above)
);

-- Update schema_version
UPDATE schema_version
SET version = version + 1,
    phase = 'search-moderation',
    updated_at = datetime('now')
WHERE id = 1;
```

### UI Integration
- **Phase 1**: Add SearchBar to KidScreen (non-functional)
- **Phase 2**: Wire up database search
- **Phase 3**: Add YouTube search fallback
- **Phase 4**: Add wishlist functionality
- **Phase 5**: Add parent moderation UI

## Future Enhancements
- **Search Suggestions**: Autocomplete based on history
- **Advanced Filters**: Duration, date, channel
- **Smart Recommendations**: ML-based suggestions
- **Batch Operations**: Multi-select approve/deny
- **Scheduled Reviews**: Remind parents to review pending items