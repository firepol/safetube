/**
 * Centralized database query helpers
 * All queries are type-safe and accept DatabaseService as dependency injection
 */

// Export all types
export * from './types';

// Export source queries
export * from './sourceQueries';

// Export video queries
export * from './videoQueries';

// Export view record queries
export * from './viewRecordQueries';

// Export favorite queries
export * from './favoriteQueries';

// Export YouTube cache queries
export * from './youtubeCacheQueries';

// Export usage log queries (Phase 2)
export * from './usageLogQueries';

// Export time limit queries (Phase 2)
export * from './timeLimitQueries';

// Export usage extra queries (Phase 2)
export * from './usageExtraQueries';

// Export settings queries (Phase 2)
export * from './settingsQueries';
