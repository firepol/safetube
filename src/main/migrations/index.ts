/**
 * Migration module exports
 *
 * Provides migration utilities for the SafeTube source validation feature
 */

export {
  migrateFavoritesSourceId,
  rollbackFavoritesMigration,
  type MigrationResult
} from './favoritesSourceIdMigration';

export {
  populateChannelIds,
  rollbackChannelIdMigration,
  type ChannelIdMigrationResult
} from './channelIdPopulation';

export {
  runSourceValidationMigrations,
  rollbackSourceValidationMigrations,
  getMigrationStatusReport
} from './migrationCoordinator';