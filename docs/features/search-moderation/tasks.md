# Implementation Plan

- [x] 1. Set up database schema and core interfaces
  - Create database migration script for new tables (searches, wishlist, search_results_cache)
  - Define TypeScript interfaces for new data structures
  - Update schema_version table and add migration runner logic
  - _Requirements: FR-S4, FR-W1, DR-1, DR-2, DR-3_

- [x] 1.1 Create searches table with indexes
  - Create `searches` table with proper schema and indexes
  - _Requirements: FR-S4, DR-1_

- [x] 1.2 Create wishlist table with indexes and constraints
  - Create `wishlist` table with status constraints and indexes
  - _Requirements: FR-W1, DR-2_

- [x] 1.3 Create search_results_cache table with indexes
  - Create cache table for YouTube search results
  - _Requirements: FR-S5, DR-3_

- [x] 1.4 Define TypeScript interfaces
  - Define Search, WishlistItem, WishlistStatus, SearchType, SearchResult, VideoData interfaces
  - _Requirements: DR-1, DR-2, DR-3_

- [x] 2. Implement search service with database and YouTube search
  - Create searchService.ts with database FTS5 search functionality
  - Implement YouTube API search with caching and rate limiting
  - Record all searches in database for history tracking
  - _Requirements: FR-S1, FR-S2, FR-S4, FR-S5_

- [x] 2.1 Implement database search using FTS5
  - Create searchDatabase function with proper escaping and error handling
  - _Requirements: FR-S1_

- [x] 2.2 Implement YouTube API search with caching
  - Add searchYouTube function with cache checking and API quota monitoring
  - _Requirements: FR-S2, FR-S5_

- [x] 3. Implement wishlist service with CRUD operations
  - Create wishlistService.ts with all wishlist management functions
  - Handle status transitions and emit IPC events for real-time updates
  - _Requirements: FR-W2, FR-W3_

- [x] 3.1 Create wishlist CRUD operations
  - Implement add, remove, get, approve, deny, and status update functions
  - _Requirements: FR-W2, FR-W3_

- [x] 3.2 Add wishlist status management
  - Handle status transitions and validation
  - _Requirements: FR-W3_

- [x] 4. Wire up IPC communication for search and wishlist
  - Create IPC handlers for search and wishlist operations
  - Expose handlers in preload for renderer access
  - _Requirements: IR-2_

- [x] 4.1 Implement search IPC handlers
  - Create handlers for database search, YouTube search, and search history
  - _Requirements: FR-S1, FR-S2, FR-P1_

- [x] 4.2 Implement wishlist IPC handlers
  - Create handlers for all wishlist operations and status management
  - _Requirements: FR-W2, FR-W3, FR-P2_

- [x] 5. Create reusable SearchBar component
  - Build SearchBar component with debouncing, keyboard shortcuts, and loading states
  - Style with Tailwind CSS and ensure responsive design
  - _Requirements: FR-S3_

- [x] 5.1 Implement SearchBar with input field and search icon
  - Create component with props interface and search functionality
  - _Requirements: FR-S3_

- [x] 5.2 Add debouncing and clear button functionality
  - Implement 300ms debouncing and clear button when text present
  - _Requirements: FR-S3_

- [x]* 5.3 Write SearchBar unit tests
  - Test input, debounce, keyboard shortcuts, and loading states
  - _Requirements: NFR-5_

- [x] 6. Create SearchResultsPage with grid display
  - Build search results page with SearchBar and VideoGrid integration
  - Handle database search, YouTube fallback, and loading states
  - _Requirements: FR-S1, FR-S2, FR-S3_

- [x] 6.1 Implement SearchResultsPage component with search state management
  - Create page component with search bar and results display
  - _Requirements: FR-S1, FR-S2_

- [x] 6.2 Add YouTube fallback and manual search functionality
  - Handle auto-fallback to YouTube when 0 results and manual YouTube search button
  - _Requirements: FR-S2_

- [x]* 6.3 Write SearchResultsPage unit tests
  - Test search functionality, fallback behavior, and state management
  - _Requirements: NFR-5_

- [x] 7. Extend VideoCardBase to support wishlist functionality
  - Add wishlist button for unapproved videos and video details dialog
  - Handle wishlist add operations and disabled states
  - _Requirements: FR-V2, FR-V3_

- [x] 7.1 Add wishlist button and visibility logic
  - Implement "+ Wishlist" button with proper visibility and disabled states
  - _Requirements: FR-V3_

- [x] 7.2 Add video details dialog for unapproved videos
  - Create dialog showing video metadata with wishlist add functionality
  - _Requirements: FR-V2_

- [x]* 7.3 Update VideoCardBase unit tests
  - Test wishlist button functionality and dialog behavior
  - _Requirements: NFR-5_

- [x] 8. Integrate search functionality in Kid Screen and Source Page
  - Add SearchBar to both pages with proper positioning and navigation
  - Wire up search handlers and ensure responsive layout
  - _Requirements: FR-S3_

- [x] 8.1 Add SearchBar to Kid Screen header
  - Position between title and time indicator with navigation to results page
  - _Requirements: FR-S3_

- [x] 8.2 Add SearchBar to Source Page
  - Position between breadcrumbs and time indicator with source-scoped search option
  - _Requirements: FR-S3_

- [x] 9. Create WishlistContext for state management
  - Build context provider for wishlist data with real-time updates and caching
  - Implement polling and IPC event listening for status changes
  - _Requirements: FR-K2_

- [x] 9.1 Implement WishlistProvider with data loading and caching
  - Create context with wishlist data by status and 30s TTL cache
  - _Requirements: FR-K2_

- [x] 9.2 Add real-time updates and helper functions
  - Listen for IPC events and provide add, remove, refresh functions
  - _Requirements: FR-K2_

- [ ]* 9.3 Write WishlistContext unit tests
  - Test context functionality, polling, and helper functions
  - _Requirements: NFR-5_

- [x] 10. Create WishlistPage for kids with tab navigation
  - Build kid's wishlist page with Pending/Approved/Denied tabs
  - Implement remove and play functionality with badge counts
  - _Requirements: FR-K1_

- [x] 10.1 Implement WishlistPage with tab navigation
  - Create page with three tabs displaying videos by status
  - _Requirements: FR-K1_

- [x] 10.2 Add action buttons and denial reason display
  - Implement remove, play functionality and show denial reasons
  - _Requirements: FR-K1_

- [ ]* 10.3 Write WishlistPage unit tests
  - Test tab functionality, actions, and badge counts
  - _Requirements: NFR-5_

- [x] 11. Add wishlist navigation to Kid Screen
  - Add "My Wishlist" link with unread count badge
  - Ensure proper navigation flow and styling
  - _Requirements: FR-K1_

- [x] 12. Create SearchHistoryTab for admin panel
  - Build admin tab showing search history with pagination
  - Add cached results modal for viewing search results
  - _Requirements: FR-P1_

- [x] 12.1 Implement SearchHistoryTab with table display
  - Create tab with search history table and pagination
  - _Requirements: FR-P1_

- [x] 12.2 Add CachedResultsModal for viewing search results
  - Create modal displaying cached results in VideoGrid
  - _Requirements: FR-P1_

- [ ]* 12.3 Write SearchHistoryTab unit tests
  - Test table display, pagination, and modal functionality
  - _Requirements: NFR-5_

- [x] 13. Create VideoPreviewModal for parent video review
  - Build modal with YouTube iframe player and metadata display
  - Add Approve/Deny buttons without affecting time tracking
  - _Requirements: FR-P2_

- [x] 13.1 Implement VideoPreviewModal with YouTube iframe
  - Create modal with embedded player and video metadata
  - _Requirements: FR-P2_

- [x] 13.2 Add action buttons and ensure no time tracking
  - Implement Approve/Deny buttons without counting toward time limits
  - _Requirements: FR-P2_

- [ ]* 13.3 Write VideoPreviewModal unit tests
  - Test modal functionality, iframe loading, and action buttons
  - _Requirements: NFR-5_

- [x] 14. Create DenyReasonDialog for denial explanations
  - Build dialog with text input, character limit, and validation
  - Handle reason saving and success feedback
  - _Requirements: FR-P3_

- [x] 14.1 Implement DenyReasonDialog with text input
  - Create dialog with 500 character limit and counter
  - _Requirements: FR-P3_

- [x] 14.2 Add validation and IPC integration
  - Validate input and call wishlist:deny IPC with reason
  - _Requirements: FR-P3_

- [ ]* 14.3 Write DenyReasonDialog unit tests
  - Test dialog functionality, validation, and IPC calls
  - _Requirements: NFR-5_

- [x] 15. Create WishlistModerationTab for admin panel
  - Build admin tab with sub-tabs for wishlist moderation
  - Integrate VideoPreviewModal and DenyReasonDialog
  - _Requirements: FR-P2_

- [x] 15.1 Implement WishlistModerationTab with sub-tabs
  - Create tab with Pending/Approved/Denied sub-tabs and video grids
  - _Requirements: FR-P2_

- [x] 15.2 Add action buttons and modal integrations
  - Implement Watch, Approve, Deny, Reverse buttons with modal integrations
  - _Requirements: FR-P2_

- [ ]* 15.3 Write WishlistModerationTab unit tests
  - Test sub-tabs, action buttons, and modal integrations
  - _Requirements: NFR-5_

- [ ]* 16. Write comprehensive integration tests
  - Test end-to-end flows for search and wishlist functionality
  - Cover database search, YouTube search, wishlist operations, and parent moderation
  - _Requirements: NFR-5_

- [ ]* 17. Handle edge cases and error scenarios
  - Implement graceful handling for API quota, network issues, and database errors
  - Add retry logic and user-friendly error messages
  - _Requirements: NFR-4_

- [ ]* 18. Optimize performance and responsiveness
  - Profile and optimize search results rendering and VideoGrid performance
  - Implement lazy loading and memoization where needed
  - _Requirements: NFR-1_

- [ ]* 19. Polish UI/UX and add accessibility features
  - Refine animations, improve empty states, and add accessibility features
  - Ensure responsive design and conduct usability testing
  - _Requirements: NFR-3_

- [ ]* 20. Create documentation and API guides
  - Document search and wishlist functionality for users and developers
  - Create troubleshooting guide and update main README
  - _Requirements: NFR-5_

- [x] 21. Implement bulk moderation operations for parent efficiency
  - Add multi-select functionality to wishlist moderation interface
  - Create bulk approve/deny operations with progress tracking
  - _Requirements: FR-P4_

- [x] 21.1 Create BulkModerationControls component
  - Implement selection controls with Select All/None functionality
  - Add bulk action buttons with progress indicators
  - _Requirements: FR-P4_

- [x] 21.2 Extend VideoCardBase with selection support
  - Add checkbox overlay for multi-select functionality
  - Handle selection state and prevent conflicts with video click
  - _Requirements: FR-P4_

- [x] 21.3 Implement bulk IPC handlers and database transactions
  - Create wishlist:bulkApprove and wishlist:bulkDeny IPC handlers
  - Use database transactions for consistency and error handling
  - _Requirements: FR-P4_

- [x] 21.4 Create BulkDenyReasonDialog for shared denial reasons
  - Build dialog for entering shared denial reason for multiple videos
  - Handle optional reason input with character limit
  - _Requirements: FR-P4_

- [x] 21.5 Integrate bulk operations into WishlistModerationTab
  - Add BulkModerationControls to moderation interface
  - Wire up selection state management and bulk operations
  - _Requirements: FR-P4_

- [ ]* 21.6 Write bulk operations unit tests
  - Test selection functionality, bulk operations, and error handling
  - _Requirements: NFR-5_


