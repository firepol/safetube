# Requirements Document

## Introduction
SafeTube currently stores all application data in JSON files within the `config/` directory. This migration project will transition the application from JSON-based storage to a centralized SQLite database system to improve data integrity, query performance, concurrent access handling, and prepare for advanced features like local search.

The migration follows SQLite best practices for Electron applications: database operations will be confined to the main process, with renderer processes accessing data through IPC communication channels. This ensures proper concurrency handling and data consistency.

## Requirements

### Requirement 1: Core Database Infrastructure
**User Story:** As a system administrator, I want SafeTube to use SQLite for data storage, so that data integrity and concurrent access are properly managed.

#### Acceptance Criteria
1. WHEN the application starts THEN the system SHALL initialize a SQLite database with WAL mode enabled
2. WHEN multiple processes attempt data access THEN the system SHALL route all database operations through the main process
3. WHEN database operations fail due to locks THEN the system SHALL implement retry logic with exponential backoff
4. WHEN the database is corrupted THEN the system SHALL detect corruption and restore from backup

### Requirement 2: Videos Table Implementation
**User Story:** As a developer, I want a centralized videos table, so that video metadata is consistently stored and searchable across all sources.

#### Acceptance Criteria
1. WHEN video metadata is fetched THEN the system SHALL store title, publishedAt, thumbnail, duration, url, isAvailable, description, and sourceId in the videos table
2. WHEN page cache data is updated THEN the system SHALL update corresponding video metadata in the database
3. WHEN video availability changes THEN the system SHALL update the isAvailable flag in the videos table
4. WHEN duplicate video IDs are encountered THEN the system SHALL update existing records rather than create duplicates

### Requirement 3: View Records Table Implementation
**User Story:** As a user, I want my viewing history preserved during migration, so that I can resume videos and track my progress.

#### Acceptance Criteria
1. WHEN migrating watched.json THEN the system SHALL preserve all viewing data including position, timeWatched, duration, and watch status
2. WHEN a video is played THEN the system SHALL update position and timeWatched in the view_records table
3. WHEN history data is queried THEN the system SHALL return results with proper source and video reference relationships
4. WHEN history records are created THEN the system SHALL link to both sourceId and videoId foreign keys

### Requirement 4: Favorites Table Implementation
**User Story:** As a user, I want my favorite videos preserved during migration, so that I can continue accessing my bookmarked content.

#### Acceptance Criteria
1. WHEN migrating favorites.json THEN the system SHALL preserve all favorite video references with sourceId relationships
2. WHEN a video is favorited THEN the system SHALL create a record linking sourceId and videoId
3. WHEN favorites are displayed THEN the system SHALL join with videos table to show current metadata
4. WHEN a source is deleted THEN the system SHALL handle orphaned favorite records gracefully

### Requirement 5: Sources Table Implementation
**User Story:** As a system administrator, I want video sources stored in the database, so that source configuration is centrally managed.

#### Acceptance Criteria
1. WHEN migrating videoSources.json THEN the system SHALL preserve all source configurations including type, title, url, sortOrder, and source-specific fields
2. WHEN sources are modified THEN the system SHALL update the database instead of JSON files
3. WHEN sources are queried THEN the system SHALL return properly typed source objects
4. WHEN source validation occurs THEN the system SHALL enforce type-specific constraints

### Requirement 5.1: YouTube API Results Table Implementation
**User Story:** As a developer, I want paginated API results cached in the database, so that .cache folder can be eliminated and cache management is centralized.

#### Acceptance Criteria
1. WHEN YouTube API pages are fetched THEN the system SHALL store video IDs, source ID, position, and fetch timestamp in youtube_api_results table
2. WHEN users navigate pages THEN the system SHALL store results for specific page ranges (1-50, 101-150, etc.) with possible gaps
3. WHEN cache expires based on pagination settings THEN the system SHALL repopulate expired entries automatically
4. WHEN "reset" button is clicked THEN the system SHALL delete all youtube_api_results records for that source
5. WHEN .cache folder migration occurs THEN the system SHALL preserve existing cached page data in the database

### Requirement 6: Usage Logs Table Implementation (Phase 2)
**User Story:** As a parent, I want daily usage tracking preserved during migration, so that time limits continue working correctly.

#### Acceptance Criteria
1. WHEN migrating usageLog.json THEN the system SHALL preserve all daily usage data with proper date indexing
2. WHEN usage time is tracked THEN the system SHALL efficiently update daily totals in the usage_logs table
3. WHEN usage queries occur THEN the system SHALL quickly retrieve data for time limit calculations
4. WHEN historical usage is analyzed THEN the system SHALL support date range queries

### Requirement 7: Time Limits and Usage Extras Configuration (Phase 2)
**User Story:** As a parent, I want time limit settings and bonus time stored in the database, so that parental controls are centrally managed.

#### Acceptance Criteria
1. WHEN migrating timeLimits.json THEN the system SHALL preserve all daily limit configurations and warning settings in the time_limits table
2. WHEN time limits are modified THEN the system SHALL update database instead of JSON files
3. WHEN time limit queries occur THEN the system SHALL return current day's limits efficiently
4. WHEN migrating timeExtra.json THEN the system SHALL preserve date-specific adjustments in the usage_extras table

### Requirement 8: Data Migration System
**User Story:** As a system administrator, I want safe migration from JSON to SQLite, so that no data is lost during the transition.

#### Acceptance Criteria
1. WHEN migration runs THEN the system SHALL backup all existing JSON files before starting
2. WHEN migration encounters errors THEN the system SHALL halt and preserve original data
3. WHEN migration completes successfully THEN the system SHALL verify data integrity AND preserve original JSON files for branch compatibility
4. WHEN rollback is needed THEN the system SHALL restore from JSON backup files
5. WHEN switching between branches THEN the original JSON files SHALL remain intact and functional
6. WHEN .cache folder is migrated THEN the system SHALL transfer existing page cache data to youtube_api_results table and mark .cache folder for removal
7. WHEN cache migration completes THEN the system SHALL eliminate dependency on .cache folder completely

### Requirement 9: IPC Communication Interface
**User Story:** As a developer, I want secure database access from renderer processes, so that UI operations can interact with the database safely.

#### Acceptance Criteria
1. WHEN renderer processes need data THEN the system SHALL provide IPC methods for all database operations
2. WHEN database operations are called via IPC THEN the system SHALL validate input parameters
3. WHEN IPC operations fail THEN the system SHALL return structured error responses
4. WHEN concurrent IPC requests occur THEN the system SHALL handle them without data corruption

### Requirement 10: Search Functionality Foundation
**User Story:** As a user, I want local search capabilities, so that I can find videos quickly without internet connectivity.

#### Acceptance Criteria
1. WHEN search queries are performed THEN the system SHALL search video titles, descriptions, and source titles
2. WHEN search indexes are created THEN the system SHALL optimize for common query patterns
3. WHEN offline search occurs THEN the system SHALL return results from local database only
4. WHEN search performance is measured THEN queries SHALL complete within 100ms for typical datasets

### Requirement 11: Sync Operations and UI Integration
**User Story:** As a user, I want manual sync controls, so that I can refresh video metadata when needed.

#### Acceptance Criteria
1. WHEN sync button is clicked THEN the system SHALL fetch fresh metadata for all videos in the source
2. WHEN sync operations run THEN the system SHALL update video metadata in the database
3. WHEN sync progress is shown THEN the system SHALL display current operation status
4. WHEN sync completes THEN the system SHALL refresh the UI with updated information

### Requirement 12: Performance and Scalability Requirements
**User Story:** As a user, I want responsive application performance, so that database operations don't slow down the interface.

#### Acceptance Criteria
1. WHEN database queries execute THEN operations SHALL complete within 50ms for typical data sets
2. WHEN large datasets are handled THEN the system SHALL use pagination for results over 100 items
3. WHEN concurrent operations occur THEN the system SHALL maintain UI responsiveness
4. WHEN database grows large THEN the system SHALL maintain consistent performance through indexing

### Requirement 13: Data Integrity and Validation
**User Story:** As a system administrator, I want robust data validation, so that database integrity is maintained.

#### Acceptance Criteria
1. WHEN data is inserted THEN the system SHALL validate all required fields and constraints
2. WHEN foreign key relationships are created THEN the system SHALL enforce referential integrity
3. WHEN data corruption is detected THEN the system SHALL log errors and prevent invalid states
4. WHEN schema migrations occur THEN the system SHALL preserve existing data while updating structure

### Requirement 14: Error Handling and Recovery
**User Story:** As a user, I want reliable error handling, so that temporary issues don't cause data loss.

#### Acceptance Criteria
1. WHEN database locks occur THEN the system SHALL retry operations up to 3 times with exponential backoff
2. WHEN critical errors happen THEN the system SHALL maintain application stability and log detailed error information
3. WHEN recovery is needed THEN the system SHALL provide mechanisms to restore from backup
4. WHEN database is inaccessible THEN the system SHALL degrade gracefully and notify the user

### Requirement 15: Configuration and Settings Migration (Phase 2)
**User Story:** As a user, I want application settings preserved during migration, so that my preferences are maintained.

#### Acceptance Criteria
1. WHEN mainSettings.json is migrated THEN the system SHALL preserve all application configuration in the settings table
2. WHEN pagination.json is migrated THEN the system SHALL maintain current page state and cache expiration preferences in the settings table
3. WHEN YouTube player settings are migrated THEN the system SHALL preserve quality and playback preferences
4. WHEN settings are accessed THEN the system SHALL provide both individual and bulk configuration retrieval using type-safe query helpers
5. WHEN pagination settings control cache expiration THEN the system SHALL use database settings to determine youtube_api_results cache validity
6. WHEN settings are queried THEN the system SHALL use type-safe query helpers to avoid duplicate queries and ensure type safety
7. WHEN integration tests run THEN the system SHALL use in-memory database instances instead of production safetube.db
8. WHEN settings are migrated from JSON THEN the system SHALL verify migration accuracy with integration tests using mock JSON fixtures