# Implementation Plan: SQLite Database Migration

## Phase 1: Core Migration Infrastructure (Critical Priority)

### 1. Database Service Infrastructure Setup

- [x] 1.1 Create SQLite dependency installation task
  - Install `sqlite3` and `@types/sqlite3` npm packages
  - Add SQLite as production dependency in package.json
  - Verify SQLite installation works across platforms (Windows, macOS, Linux)
  - **Definition of Done**: SQLite packages installed, build succeeds on all platforms, basic connection test passes
  - **Tests Required**: Unit tests for package imports, integration test for SQLite connection
  - **Code Review**: Dependency review by senior developer, security review for SQLite version

- [x] 1.2 Implement DatabaseService class structure
  - Create `src/main/services/DatabaseService.ts` with singleton pattern following existing service architecture
  - Implement connection management with WAL mode, foreign key enforcement, and performance settings
  - Add database initialization, close, and health check methods
  - Implement connection pooling for concurrent operations
  - **UPDATE**: Updated AppPaths.getDataPath() to place database in project root during development (./safetube.db)
  - **Definition of Done**: DatabaseService class created, connection established with proper configuration, health checks pass
  - **Tests Required**: Unit tests for connection management, integration tests for WAL mode, concurrent connection tests
  - **Code Review**: Architecture review by senior developer, performance configuration review

- [x] 1.3 Create database schema initialization system
  - Create `src/main/database/schema/` directory structure for SQL schema files
  - Implement Phase 1 schema creation with proper indexes and foreign key constraints
  - Create schema versioning system for future migrations
  - Add schema validation and integrity checking
  - **Definition of Done**: All Phase 1 tables created correctly, indexes established, foreign key constraints enforced
  - **Tests Required**: Schema creation tests, constraint validation tests, index performance tests
  - **Code Review**: Database design review by senior developer, SQL query review

- [x] 1.4 Implement error handling and retry mechanisms
  - Create `src/main/services/DatabaseErrorHandler.ts` with comprehensive error categorization
  - Implement retry logic with exponential backoff for lock contention
  - Add detailed logging for all database operations and errors
  - Create error recovery procedures for common failure scenarios
  - **Definition of Done**: All database errors properly categorized and logged, retry mechanisms work under load, recovery procedures tested
  - **Tests Required**: Error simulation tests, retry logic tests, concurrent operation failure tests
  - **Code Review**: Error handling review by senior developer, logging strategy review

### 2. Migration Service Implementation

- [x] 2.1 Create MigrationService class foundation
  - Create `src/main/services/MigrationService.ts` following existing service patterns
  - Implement pre-migration backup system for all JSON configuration files
  - Create migration state tracking and progress reporting
  - Add rollback capability for failed migrations
  - **Definition of Done**: MigrationService class structure complete, backup system functional, state tracking implemented
  - **Tests Required**: Unit tests for backup creation, integration tests for state tracking, rollback mechanism tests
  - **Code Review**: Service architecture review, backup strategy review by senior developer

- [x] 2.2 Implement JSON data loading utilities
  - Create utilities to load and validate all existing JSON configuration files
  - Implement data validation and consistency checking for migration source data
  - Add error handling for corrupted or missing JSON files
  - Create data transformation utilities for format conversion
  - **Definition of Done**: All JSON files can be loaded and validated, transformation utilities tested with real data
  - **Tests Required**: JSON loading tests with various data conditions, validation logic tests, transformation accuracy tests
  - **Code Review**: Data validation logic review, transformation accuracy review

- [x] 2.3 Create data validation and integrity checking system
  - Implement pre-migration data validation to ensure data quality
  - Create post-migration verification to confirm successful data transfer
  - Add data integrity checks including foreign key relationship validation
  - Implement data comparison utilities for migration verification
  - **Definition of Done**: All validation checks implemented, verification system catches data inconsistencies
  - **Tests Required**: Validation logic tests with corrupted data, verification accuracy tests, integrity check tests
  - **Code Review**: Validation logic review by senior developer, data integrity strategy review

### 3. Phase 1 Table Implementation

- [x] 3.1 Implement Sources table migration
  - Create migration logic for videoSources.json to sources table
  - Implement proper type validation and constraint checking
  - Add support for all source types (youtube_channel, youtube_playlist, local)
  - Handle edge cases like missing fields or invalid data
  - **Definition of Done**: All video sources migrated correctly, type constraints enforced, validation passes
  - **Tests Required**: Migration tests with various source configurations, constraint validation tests, edge case handling tests
  - **Code Review**: Migration logic review, data validation review by domain expert

- [x] 3.2 Implement Videos table migration
  - Extract video metadata from cache files and watched.json
  - Create comprehensive video metadata migration with proper indexing
  - Implement duplicate detection and resolution for videos from multiple sources
  - Add full-text search index creation and population
  - **Definition of Done**: All video metadata migrated and indexed, duplicate resolution working, FTS indexes populated
  - **Tests Required**: Video extraction tests, duplicate detection tests, FTS index functionality tests
  - **Code Review**: Video metadata extraction logic review, indexing strategy review

- [x] 3.3 Implement View Records table migration
  - Migrate watched.json data to view_records table with proper relationships
  - Ensure accurate position and timing data preservation
  - Implement foreign key relationships to videos and sources tables
  - Add data consistency validation for viewing history
  - **Definition of Done**: All viewing history migrated with accurate timing data, relationships established
  - **Tests Required**: Viewing history migration accuracy tests, foreign key relationship tests, data consistency tests
  - **Code Review**: Viewing history logic review, relationship integrity review

- [x] 3.4 Implement Favorites table migration
  - Migrate favorites.json data with proper source relationships
  - Handle missing or invalid source references in existing favorites
  - Implement favorite video metadata linkage with videos table
  - Add orphaned favorite detection and handling
  - **Definition of Done**: All favorites migrated with valid relationships, orphaned favorites handled appropriately
  - **Tests Required**: Favorites migration tests, relationship validation tests, orphaned favorite handling tests
  - **Code Review**: Favorites migration logic review, relationship handling review

- [x] 3.5 Implement YouTube API Results table migration (placeholder implemented)
  - Migrate .cache folder contents to youtube_api_results table
  - Preserve page range information and fetch timestamps
  - Implement cache expiration logic based on pagination settings
  - Add cache cleanup and optimization procedures
  - **Definition of Done**: Cache folder migrated completely, page ranges preserved, expiration logic working
  - **Tests Required**: Cache migration accuracy tests, page range preservation tests, expiration logic tests
  - **Code Review**: Cache migration strategy review, expiration logic review

### 4. IPC Communication Layer

- [x] 4.1 Create database IPC handler registry
  - Create `src/main/ipc/databaseHandlers.ts` following existing IPC handler patterns
  - Implement comprehensive error handling and response formatting
  - Add input validation for all IPC method parameters
  - Create structured error response system with proper error codes
  - **Definition of Done**: IPC handler registry created, all database operations accessible via IPC, error handling comprehensive
  - **Tests Required**: IPC handler tests for all operations, error response validation tests, input validation tests
  - **Code Review**: IPC architecture review, error handling strategy review

- [x] 4.2 Implement Phase 1 IPC methods
  - Add video operations: getBySource, getById, search, updateMetadata, updateAvailability
  - Add view record operations: get, update, getHistory, getRecentlyWatched
  - Add favorite operations: getAll, add, remove, isFavorite, toggle
  - Add source operations: getAll, getById, create, update, delete, validate
  - Add YouTube cache operations: getCachedResults, setCachedResults, clearCache
  - **UPDATE**: Enhanced existing admin panel IPC handlers (video-sources:save-all, video-sources:get-all) to use database with JSON fallback
  - **Definition of Done**: All Phase 1 operations accessible via IPC, proper parameter validation, consistent response format
  - **Tests Required**: Individual IPC method tests, parameter validation tests, response format tests
  - **Code Review**: IPC method implementation review, API consistency review

- [x] 4.3 Create database client utilities for renderer
  - Create `src/renderer/services/DatabaseClient.ts` for database API access
  - Implement proper error handling and response parsing
  - Add TypeScript interfaces for all database operations
  - Create React hooks for common database operations
  - **Definition of Done**: Database client complete with full TypeScript support, React hooks functional
  - **Tests Required**: Database client method tests, React hook tests, TypeScript interface validation
  - **Code Review**: Client architecture review, React integration review

### 5. Integration and Testing

- [x] 5.1 Create comprehensive unit test suite
  - Implement unit tests for DatabaseService with mock SQLite database
  - Create unit tests for MigrationService with test data sets
  - Add unit tests for all IPC handlers with mocked database operations
  - Implement unit tests for database client utilities
  - **Definition of Done**: >90% code coverage for database-related code, all unit tests passing
  - **Tests Required**: Comprehensive unit test coverage, mock validation, test data accuracy
  - **Code Review**: Test quality review, coverage analysis by senior developer

- [ ] 5.2 Create integration test suite (TODO)
  - Implement end-to-end migration tests with real SafeTube data
  - Create database operation integration tests
  - Add IPC communication integration tests
  - Implement performance benchmarking for database operations
  - **Definition of Done**: Integration tests pass with real data, performance benchmarks within requirements
  - **Tests Required**: End-to-end migration tests, performance validation tests, IPC integration tests
  - **Code Review**: Integration test strategy review, performance benchmark review

- [ ] 5.3 Create migration testing with sample data (TODO)
  - Create comprehensive test data sets representing various SafeTube configurations
  - Implement migration accuracy verification with detailed comparison
  - Add stress testing for large datasets
  - Create migration rollback testing procedures
  - **Definition of Done**: Migration accuracy verified with diverse datasets, rollback procedures tested
  - **Tests Required**: Migration accuracy tests, stress tests with large datasets, rollback validation tests
  - **Code Review**: Test data completeness review, accuracy verification review

### 6. Phase 1 Documentation and Deployment

- [ ] 6.1 Update service integration documentation
  - Document new DatabaseService integration with existing services
  - Update IPC communication documentation with new database methods
  - Create migration procedure documentation for administrators
  - Document rollback procedures and troubleshooting guides
  - **Definition of Done**: Comprehensive documentation created, integration procedures documented
  - **Tests Required**: Documentation accuracy validation, procedure testing with documentation
  - **Code Review**: Documentation completeness review, technical accuracy review

- [ ] 6.2 Create Phase 1 deployment and activation
  - Implement migration trigger mechanism in application startup
  - Create user interface for migration progress monitoring
  - Add migration status reporting and error display
  - Implement safe rollback UI for failed migrations
  - **Definition of Done**: Migration can be triggered and monitored via UI, rollback available if needed
  - **Tests Required**: Migration UI tests, progress reporting tests, rollback UI tests
  - **Code Review**: UI implementation review, user experience review

---

## Phase 2: Extended Features (High Priority)

### 7. Phase 2 Table Implementation

- [ ] 7.1 Implement Usage Logs table migration
  - Migrate usageLog.json to usage_logs table with proper date indexing
  - Implement efficient daily usage tracking and query optimization
  - Add data validation for usage time calculations
  - Create historical usage data analysis capabilities
  - **Definition of Done**: Usage logs migrated accurately, daily tracking efficient, historical queries optimized
  - **Tests Required**: Usage data migration accuracy tests, query performance tests, validation logic tests
  - **Code Review**: Usage tracking logic review, query optimization review

- [ ] 7.2 Implement Time Limits table migration
  - Migrate timeLimits.json to time_limits table with single-row constraint
  - Implement proper validation for time limit configurations
  - Add support for warning thresholds and custom messages
  - Create time limit enforcement integration
  - **Definition of Done**: Time limits migrated correctly, validation enforced, enforcement integration working
  - **Tests Required**: Time limits migration tests, validation constraint tests, enforcement integration tests
  - **Code Review**: Time limit logic review, validation strategy review

- [ ] 7.3 Implement Usage Extras table migration
  - Migrate timeExtra.json to usage_extras table with audit trail support
  - Implement proper date-based extra time tracking
  - Add support for multiple extra time additions per day
  - Create admin interface integration for extra time management
  - **Definition of Done**: Extra time data migrated, audit trail preserved, admin interface integrated
  - **Tests Required**: Extra time migration tests, audit trail validation tests, admin interface integration tests
  - **Code Review**: Extra time tracking logic review, audit trail implementation review

- [ ] 7.4 Implement Settings table migration
  - Create `settings` table schema with key-value structure (namespace.setting format)
  - Implement type-safe query helpers in `src/main/database/queries/settingsQueries.ts`:
    - `getSetting<T>(db, key, defaultValue)` - Get single setting with type safety
    - `setSetting<T>(db, key, value, type)` - Set single setting with serialization
    - `getSettingsByNamespace(db, namespace)` - Get all settings for namespace (main.*, pagination.*, etc.)
    - `setSettingsByNamespace(db, namespace, settings)` - Bulk set for namespace
  - Consolidate mainSettings.json, pagination.json, and youtubePlayer.json into unified settings table
  - Implement serialization/deserialization helpers:
    - `serializeSetting(value)` - Convert JS value to JSON string
    - `deserializeSetting<T>(value, type)` - Convert JSON string to typed value
    - `inferType(value)` - Auto-detect setting type
  - Add migration logic to read JSON files and populate settings table with namespaced keys
  - Create integration tests using in-memory database:
    - Test migration from mock JSON settings (not production files)
    - Test retrieval using query helpers
    - Test namespace consolidation (verify all 3 configs migrate correctly)
    - Test type safety (boolean, number, string, object settings)
  - **Definition of Done**: All settings consolidated, namespacing working, query helpers type-safe, integration tests pass with mock data
  - **Tests Required**: Settings consolidation tests with mock JSON, namespacing validation tests, type safety tests, query helper tests
  - **Code Review**: Settings architecture review, query helper design review, test coverage validation

### 8. Advanced Search Implementation

- [ ] 8.1 Implement full-text search capabilities
  - Create comprehensive search indexing for video titles and descriptions
  - Implement advanced search filters by source, date, duration, and availability
  - Add search suggestion and auto-complete functionality
  - Create search result ranking and relevance scoring
  - **Definition of Done**: Full-text search working accurately, filters functional, suggestions relevant
  - **Tests Required**: Search accuracy tests, filter functionality tests, suggestion quality tests
  - **Code Review**: Search implementation review, relevance scoring review

- [ ] 8.2 Create search performance optimization
  - Implement search query optimization and caching
  - Add search result pagination for large result sets
  - Create search analytics and performance monitoring
  - Implement background search index maintenance
  - **Definition of Done**: Search performance within 100ms requirement, pagination working, maintenance automated
  - **Tests Required**: Search performance benchmarks, pagination tests, index maintenance tests
  - **Code Review**: Performance optimization review, monitoring strategy review

### 9. UI Integration and Sync Operations

- [ ] 9.1 Implement database-backed video loading
  - Update existing video loading logic to use database instead of cache files
  - Implement efficient pagination for video lists
  - Add real-time video metadata updates from database
  - Create video availability status tracking and UI updates
  - **Definition of Done**: Video loading uses database, pagination efficient, availability tracking working
  - **Tests Required**: Video loading integration tests, pagination performance tests, availability update tests
  - **Code Review**: Video loading logic review, UI integration review

- [ ] 9.2 Create manual sync button functionality
  - Implement sync button UI components with progress indicators
  - Add comprehensive sync operations for video metadata refresh
  - Create sync status monitoring and error reporting
  - Implement background sync scheduling and management
  - **Definition of Done**: Sync buttons functional, progress visible, error handling comprehensive
  - **Tests Required**: Sync button UI tests, progress indicator tests, error handling tests
  - **Code Review**: Sync functionality review, UI/UX review

- [ ] 9.3 Create search UI integration
  - Implement search interface with database backend
  - Add advanced search filters and sorting options
  - Create search history and saved search functionality
  - Implement search result highlighting and navigation
  - **Definition of Done**: Search UI fully functional, filters working, history preserved
  - **Tests Required**: Search UI functionality tests, filter interaction tests, history preservation tests
  - **Code Review**: Search UI implementation review, user experience review

### 10. Performance Optimization and Monitoring

- [ ] 10.1 Implement database performance monitoring
  - Create performance metrics collection for all database operations
  - Add slow query detection and logging
  - Implement database health monitoring and alerting
  - Create performance analytics and optimization recommendations
  - **Definition of Done**: Performance monitoring comprehensive, slow queries detected, health alerts working
  - **Tests Required**: Performance monitoring tests, alert functionality tests, analytics accuracy tests
  - **Code Review**: Monitoring implementation review, alerting strategy review

- [ ] 10.2 Create database maintenance procedures
  - Implement automated database optimization (VACUUM, ANALYZE)
  - Add database backup and restore automation
  - Create database integrity checking schedules
  - Implement database size monitoring and cleanup procedures
  - **Definition of Done**: Maintenance automated, backups reliable, integrity checks scheduled
  - **Tests Required**: Maintenance procedure tests, backup/restore validation tests, integrity check tests
  - **Code Review**: Maintenance strategy review, backup reliability review

---

## Risk Mitigation and Quality Assurance

### 11. Data Safety and Recovery

- [ ] 11.1 Implement comprehensive backup procedures
  - Create automated JSON file backup before any migration
  - Implement incremental database backups with retention policies
  - Add backup verification and integrity checking
  - Create cross-platform backup storage and retrieval
  - **Definition of Done**: Backup procedures automated, verification working, cross-platform compatibility confirmed
  - **Tests Required**: Backup creation tests, verification accuracy tests, cross-platform restore tests
  - **Code Review**: Backup strategy review, data safety review

- [ ] 11.2 Create robust rollback mechanisms
  - Implement complete rollback to JSON-based storage
  - Add partial rollback for failed Phase 2 migration
  - Create rollback verification and data integrity checking
  - Implement rollback progress monitoring and error handling
  - **Definition of Done**: Rollback procedures complete and tested, verification comprehensive
  - **Tests Required**: Complete rollback tests, partial rollback tests, verification accuracy tests
  - **Code Review**: Rollback strategy review, data integrity verification review

### 12. Quality Assurance and Validation

- [ ] 12.1 Create comprehensive data validation framework
  - Implement migration data validation with detailed reporting
  - Add ongoing data integrity monitoring
  - Create data consistency checking across all tables
  - Implement validation error reporting and resolution guidance
  - **Definition of Done**: Validation framework comprehensive, integrity monitoring active, error guidance helpful
  - **Tests Required**: Validation accuracy tests, integrity monitoring tests, error reporting tests
  - **Code Review**: Validation framework review, monitoring strategy review

- [ ] 12.2 Implement end-to-end system testing
  - Create full application testing with database backend
  - Add user workflow testing with database operations
  - Implement load testing for concurrent database access
  - Create system resilience testing under various failure conditions
  - **Definition of Done**: End-to-end tests pass, user workflows validated, system resilient under load
  - **Tests Required**: Complete system tests, user workflow validation, load testing, resilience testing
  - **Code Review**: System testing strategy review, load testing approach review

### 13. Documentation and Training

- [ ] 13.1 Create user migration documentation
  - Write comprehensive migration guide for end users
  - Create troubleshooting guide for common migration issues
  - Add FAQ section for migration-related questions
  - Create rollback instructions for users
  - **Definition of Done**: User documentation complete, troubleshooting guide comprehensive, FAQ helpful
  - **Tests Required**: Documentation accuracy validation, user testing of procedures
  - **Code Review**: Documentation clarity review, technical accuracy review

- [ ] 13.2 Create technical documentation
  - Document complete database schema with relationships
  - Create API documentation for all IPC methods
  - Write performance tuning guide for database operations
  - Document maintenance and monitoring procedures
  - **Definition of Done**: Technical documentation comprehensive, API docs accurate, procedures documented
  - **Tests Required**: Documentation accuracy validation, procedure testing
  - **Code Review**: Technical documentation review, completeness verification

---

## Deployment and Monitoring

### 14. Production Deployment Preparation

- [ ] 14.1 Create deployment validation procedures
  - Implement pre-deployment testing checklist
  - Create deployment verification procedures
  - Add post-deployment monitoring and validation
  - Implement emergency rollback procedures
  - **Definition of Done**: Deployment procedures tested, verification comprehensive, rollback ready
  - **Tests Required**: Deployment procedure tests, verification accuracy tests, rollback speed tests
  - **Code Review**: Deployment strategy review, emergency procedures review

- [ ] 14.2 Implement production monitoring
  - Create production database performance monitoring
  - Add application health monitoring with database integration
  - Implement user experience monitoring for database operations
  - Create alerting system for database-related issues
  - **Definition of Done**: Production monitoring comprehensive, health checks active, alerting functional
  - **Tests Required**: Monitoring accuracy tests, health check validation, alerting system tests
  - **Code Review**: Production monitoring review, alerting strategy review

---

## Success Criteria and Acceptance

### Overall Phase 1 Acceptance Criteria
- All Phase 1 tables (videos, view_records, favorites, sources, youtube_api_results) implemented and populated
- JSON file migration completed with 100% data preservation
- Database operations perform within 50ms for typical datasets
- IPC communication layer fully functional with comprehensive error handling
- Migration can be completed and rolled back safely
- All existing application functionality preserved with database backend

### Overall Phase 2 Acceptance Criteria
- All Phase 2 tables (usage_logs, time_limits, usage_extras, settings) implemented and populated
- Advanced search functionality operational with <100ms query times
- Manual sync operations functional with progress monitoring
- Settings consolidated successfully from multiple JSON files
- Performance monitoring and maintenance procedures active

### Quality Gates
- >90% test coverage for all database-related code
- Zero data loss during migration verified through comprehensive testing
- Performance benchmarks met for all database operations
- Cross-platform compatibility verified (Windows, macOS, Linux)
- Rollback procedures tested and functional
- User documentation complete and validated

This implementation plan provides a comprehensive, step-by-step approach to migrating SafeTube from JSON-based storage to SQLite database while maintaining data integrity, performance, and user experience throughout the transition.