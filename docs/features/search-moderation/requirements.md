# Search + Moderation Feature - Requirements Document

## Overview
Comprehensive search and parental moderation system allowing kids to discover videos from SafeTube's database and YouTube, with parent approval workflow for unapproved content.

## User Stories

### Kid User Stories
- As a kid, I want to search for videos in the SafeTube database so I can quickly find content I want to watch
- As a kid, I want the system to automatically search YouTube if my database search returns no results
- As a kid, I want to manually trigger YouTube search to find new content beyond approved sources
- As a kid, I want to add unapproved videos to my wishlist so I can request parent approval
- As a kid, I want to see which wishlist videos are pending, approved, or denied
- As a kid, I want to understand why a video was denied by seeing the parent's reason
- As a kid, I want to remove videos from my wishlist that I'm no longer interested in
- As a kid, I want to watch approved wishlist videos immediately without re-requesting

### Parent User Stories
- As a parent, I want to see my child's search history to understand their interests and monitor safety
- As a parent, I want to review wishlist videos before they're accessible to my child
- As a parent, I want to watch wishlist videos before approving to ensure appropriateness
- As a parent, I want to deny videos with explanatory reasons to help my child understand
- As a parent, I want search results cached so I can see exactly what my child saw
- As a parent, I want the moderation workflow to be simple and efficient

## Functional Requirements

### Search Functionality

#### FR-S1: Database Search
- **Primary Search**: Search all videos in `videos` table using full-text search
- **Search Fields**: Title and description
- **Search Algorithm**: SQLite FTS5 (already implemented via `videos_fts` table)
- **Performance**: Results returned in <500ms for typical queries
- **Empty Results Handling**: If 0 results, auto-trigger YouTube API search

#### FR-S2: YouTube API Search
- **Fallback Search**: Automatically triggered when database search returns 0 results
- **Manual Search**: "Search YouTube" button to explicitly search YouTube API
- **Results Replace**: YouTube search replaces current results display
- **Safety Filters**: Use YouTube API's `safeSearch` parameter set to "strict"
- **Result Limit**: Return maximum 50 results per search
- **Rate Limiting**: Respect YouTube API quota limits

#### FR-S3: Search UI Components
- **Kid Screen Search Bar**:
  - Position: Centered between title and time indicator
  - Reusable component
  - Live search with debouncing (300ms delay)
- **Source Page Search Bar**:
  - Position: Centered between breadcrumbs and time indicator
  - Same reusable component as kid screen
  - Scoped to current source initially, option to expand to all
- **Search Results Grid**: Reuse existing `VideoGrid` component
- **Search Button**: "Search YouTube" button visible in results header

#### FR-S4: Search History Tracking
- **Database Table**: New `searches` table
- **Captured Data**:
  - Search query text
  - Search timestamp (ISO date string)
  - Result count
  - Search type (database vs YouTube)
  - User context (kid vs parent, if distinguishable)
- **Retention**: Keep all search history indefinitely (future: configurable retention)

#### FR-S5: Search Result Caching
- **Caching Strategy**: New dedicated table for search results
- **Cache Duration**: 24 hours for YouTube results
- **Cache Key**: Search query + timestamp range
- **Table**: New `search_results_cache` table (see Data Requirements)

### Video Interaction

#### FR-V1: Approved Source Videos
- **Identification**: Video's `source_id` exists in `sources` table
- **Behavior**: Clickable, plays normally via existing player routing
- **Visual Indicator**: No special marking needed (standard video card)

#### FR-V2: Unapproved Source Videos
- **Identification**: Video's source not in `sources` table OR video not in `videos` table
- **Click Behavior**: Show overlay/dialog instead of playing
- **Dialog Content**:
  - Video thumbnail
  - Title
  - Description
  - Channel name
  - Duration
  - "+ Wishlist" button (primary action)
  - "Cancel" button
- **No Direct Play**: Cannot play until approved

#### FR-V3: Wishlist Button
- **Visibility**: On all unapproved video cards in search results
- **Disabled State**: If video already in wishlist (any status: pending/approved/denied)
- **Click Action**: Add video to `wishlist` table with `pending` status
- **Feedback**: Toast notification "Added to wishlist" or "Already in wishlist"

### Wishlist System

#### FR-W1: Wishlist Database Schema
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
  reviewed_by TEXT,
  denial_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(video_id)
);

CREATE INDEX idx_wishlist_status ON wishlist(status);
CREATE INDEX idx_wishlist_requested_at ON wishlist(requested_at);
CREATE INDEX idx_wishlist_video_id ON wishlist(video_id);
```

#### FR-W2: Wishlist States
- **Pending**: Initial state when kid adds video
- **Approved**: Parent approved, video accessible to kid
- **Denied**: Parent denied with optional reason

#### FR-W3: Wishlist State Transitions
```
pending � approved (parent action)
pending � denied (parent action)
approved � denied (parent can reverse, rare)
denied � approved (parent can reverse)
```

### Parent Features

#### FR-P1: Search History Page
- **Access**: Admin panel new tab "Search History"
- **Display**: Table with columns:
  - Search query
  - Datetime (newest first)
  - Result count
  - Search type (DB/YouTube)
- **Click Behavior**: Navigate to cached results view
- **Results View**: Reuse `VideoGrid` component with cached results
- **Pagination**: Support pagination for long search history

#### FR-P2: Wishlist Moderation Page
- **Access**: Admin panel new tab "Wishlist Moderation"
- **Display Sections**:
  - **Pending Tab**: Videos awaiting review (default)
  - **Approved Tab**: Previously approved videos
  - **Denied Tab**: Previously denied videos
- **Video Card Actions**:
  - "Watch" button (opens popup player)
  - "Approve" button (pending items)
  - "Deny" button (pending items) - opens reason dialog
  - "Reverse" button (approved/denied items)
- **Popup Player**:
  - Modal dialog with embedded YouTube iframe
  - Full playback controls
  - Close button
  - Does NOT count toward kid's time limits

#### FR-P3: Denial Reason Workflow
- **Trigger**: Parent clicks "Deny" on wishlist item
- **Dialog**: Text input for reason (optional but encouraged)
- **Character Limit**: 500 characters
- **Save**: Store reason in `wishlist.denial_reason`
- **Display to Kid**: Show indicator icon, mouseover/click to reveal

#### FR-P4: Bulk Moderation Operations
- **Multi-Select**: Checkboxes on each video card in moderation interface
- **Select All/None**: Quick selection buttons for entire list or current tab
- **Bulk Actions**: 
  - "Approve Selected" button (batch approve checked videos)
  - "Deny Selected" button (batch deny with optional shared reason)
- **Selection State**: Visual indication of selected videos with count display
- **Confirmation**: Confirmation dialog before executing bulk operations
- **Progress Feedback**: Progress indicator during batch processing
- **Error Handling**: Individual video errors don't stop batch operation
- **Transaction Safety**: Database transactions ensure consistency
- **Performance**: Batch operations complete within 5 seconds for up to 50 videos

### Kid Wishlist Interface

#### FR-K1: My Wishlist View
- **Access**: Kid screen navigation "My Wishlist"
- **Display**: Three tabs or sections:
  - **Pending**: Videos awaiting parent review
  - **Approved**: Videos ready to watch
  - **Denied**: Videos not approved
- **Pending Actions**: Remove button (withdraws request)
- **Approved Actions**:
  - Play button (standard video playback)
  - Remove button (removes from wishlist, doesn't affect approval)
- **Denied Actions**:
  - View reason (if provided)
  - Remove button (removes from view)

#### FR-K2: Wishlist Notifications
- **Status Changes**: Visual indicator when wishlist items change status
- **Unread Count**: Badge showing new approved/denied items
- **Read Tracking**: Mark items as "seen" after viewing

## Non-Functional Requirements

### NFR-1: Performance
- Search response time: <500ms for database, <2s for YouTube API
- Grid rendering: <100ms for 50 results
- Caching reduces repeated API calls by 90%

### NFR-2: Security
- YouTube API key stored securely in main settings
- Input sanitization for search queries
- SQL injection prevention via parameterized queries
- Parent authentication required for all moderation actions

### NFR-3: Usability
- Search bar accessible via keyboard shortcuts
- Clear visual distinction between approved/unapproved videos
- Intuitive status icons for wishlist states
- Responsive design for all screen sizes

### NFR-4: Reliability
- Graceful degradation if YouTube API unavailable
- Database transaction safety for wishlist operations
- Error recovery for failed searches

### NFR-5: Maintainability
- Reuse existing components (VideoGrid, VideoCardBase)
- Follow existing TypeScript patterns
- Comprehensive unit and integration tests
- Clear code comments and documentation

## Data Requirements

### DR-1: Searches Table
```typescript
interface Search {
  id: number;
  query: string;
  search_type: 'database' | 'youtube';
  result_count: number;
  timestamp: string; // ISO date
  created_at: string;
}
```

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

### DR-2: Wishlist Table
See FR-W1 for schema

### DR-3: Search Results Cache Table
**Current `youtube_api_results` Schema Analysis:**
```sql
-- EXISTING TABLE (source-specific pagination caching)
CREATE TABLE youtube_api_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  page_range TEXT NOT NULL,
  fetch_timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  UNIQUE(source_id, video_id, page_range)
);
```

**Analysis:**
- Current table is source-specific (tied to `source_id`)
- Search results need query-based caching
- **Recommendation**: Create new table `search_results_cache`

```sql
CREATE TABLE search_results_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_query TEXT NOT NULL,
  video_id TEXT NOT NULL,
  video_data TEXT NOT NULL, -- JSON blob with full video metadata
  position INTEGER NOT NULL,
  search_type TEXT NOT NULL CHECK(search_type IN ('database', 'youtube')),
  fetch_timestamp TEXT NOT NULL,
  expires_at TEXT NOT NULL, -- Calculated as fetch_timestamp + 24 hours
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(search_query, video_id, search_type)
);

CREATE INDEX idx_search_cache_query ON search_results_cache(search_query);
CREATE INDEX idx_search_cache_timestamp ON search_results_cache(fetch_timestamp);
CREATE INDEX idx_search_cache_expires ON search_results_cache(expires_at);
```

## Integration Requirements

### IR-1: Existing Components
- **VideoGrid**: Reuse with new `showWishlistButton` prop
- **VideoCardBase**: Extend with wishlist button support
- **AdminPage**: Add new tabs for search history and moderation
- **Navigation**: Add "My Wishlist" to kid screen navigation

### IR-2: IPC Channels (Main � Renderer)
New IPC channels needed:
```typescript
// Search
'search:database': (query: string) => SearchResult[]
'search:youtube': (query: string) => SearchResult[]
'search:history:get': () => Search[]
'search:results:cached:get': (searchId: number) => SearchResult[]

// Wishlist
'wishlist:add': (video: WishlistVideo) => Result
'wishlist:remove': (videoId: string) => Result
'wishlist:get:byStatus': (status: WishlistStatus) => WishlistItem[]
'wishlist:approve': (videoId: string) => Result
'wishlist:deny': (videoId: string, reason?: string) => Result
'wishlist:update:status': (videoId: string, status: WishlistStatus) => Result

// Bulk Operations
'wishlist:bulkApprove': (videoIds: string[]) => { success: string[], failed: string[] }
'wishlist:bulkDeny': (videoIds: string[], reason?: string) => { success: string[], failed: string[] }
```

### IR-3: YouTube API Integration
- Use existing YouTube API service patterns
- Add search endpoint support
- Implement quota monitoring
- Error handling for API failures

## Constraints and Assumptions

### Constraints
1. YouTube API quota limits: 10,000 units/day (search = 100 units)
2. SQLite database size limits: Reasonable for home use
3. No user authentication system (single kid, single parent)
4. Electron app runs locally, no server-side processing

### Assumptions
1. Parent has set up YouTube API key in main settings
2. Kid cannot access admin panel (password protected)
3. Internet connection available for YouTube searches
4. Database already contains videos from approved sources

## Success Criteria
1.  Kid can search database and YouTube seamlessly
2.  Search results display within performance targets
3.  Wishlist workflow is intuitive and requires <3 clicks per action
4.  Parent can review and moderate within 30 seconds per video
5.  Search history provides complete audit trail
6.  No unapproved content accessible to kid
7.  Component reuse achieves >70% (measured by new code vs reused)
8.  All tests pass with >80% coverage

## Open Questions
1. Should database search support advanced operators (AND, OR, quotes)?
2. Should search history be clearable by parents?
3. Should approved wishlist videos be automatically added to a source?
4. Should there be a limit on wishlist size (e.g., max 100 pending)?
5. Should YouTube search respect existing source channels (boost/filter)?
6. Should kids see why their search returned 0 database results?

## Out of Scope (Future Enhancements)
- Multi-user support (multiple kids with separate wishlists)
- Wishlist sharing/collaboration features
- Automatic approval based on rules (e.g., auto-approve from trusted channels)
- Search suggestions/autocomplete
- Trending/recommended searches
- Search analytics dashboard
- Export/import wishlist
- Batch approval operations
- Scheduled review reminders for parents
