import { migrateFavoritesSourceId, rollbackFavoritesMigration, MigrationResult as FavoritesMigrationResult } from './favoritesSourceIdMigration';
import { populateChannelIds, rollbackChannelIdMigration, ChannelIdMigrationResult } from './channelIdPopulation';
import { logger } from '../logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AppPaths } from '../appPaths';

/**
 * Migration coordinator for tracking and executing migrations
 *
 * Tracks migration versions to prevent duplicate runs
 * Coordinates multiple migrations in the correct order
 * Provides rollback capabilities
 */

interface MigrationStatus {
  version: string;
  migrations: {
    [key: string]: {
      executed: boolean;
      executedAt?: string;
      result?: any;
    };
  };
}

const CURRENT_VERSION = '1.0.0';
const MIGRATION_STATUS_FILE = 'migration-status.json';

/**
 * Get migration status from file
 */
async function getMigrationStatus(): Promise<MigrationStatus> {
  try {
    const configDir = AppPaths.getConfigDir();
    const statusPath = path.join(configDir, MIGRATION_STATUS_FILE);

    try {
      const data = await fs.readFile(statusPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      // No status file exists, return empty status
      return {
        version: CURRENT_VERSION,
        migrations: {}
      };
    }
  } catch (error) {
    logger.error(`Failed to read migration status: ${error instanceof Error ? error.message : String(error)}`);
    return {
      version: CURRENT_VERSION,
      migrations: {}
    };
  }
}

/**
 * Save migration status to file
 */
async function saveMigrationStatus(status: MigrationStatus): Promise<void> {
  try {
    const configDir = AppPaths.getConfigDir();
    const statusPath = path.join(configDir, MIGRATION_STATUS_FILE);

    await fs.writeFile(statusPath, JSON.stringify(status, null, 2), 'utf-8');
  } catch (error) {
    logger.error(`Failed to save migration status: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if a migration has been executed
 */
async function hasMigrationRun(migrationKey: string): Promise<boolean> {
  const status = await getMigrationStatus();
  return status.migrations[migrationKey]?.executed === true;
}

/**
 * Mark a migration as executed
 */
async function markMigrationExecuted(
  migrationKey: string,
  result: any
): Promise<void> {
  const status = await getMigrationStatus();

  status.migrations[migrationKey] = {
    executed: true,
    executedAt: new Date().toISOString(),
    result
  };

  await saveMigrationStatus(status);
}

/**
 * Execute all pending migrations for source validation feature
 */
export async function runSourceValidationMigrations(): Promise<{
  success: boolean;
  results: {
    favoritesSourceId?: FavoritesMigrationResult;
    channelIdPopulation?: ChannelIdMigrationResult;
  };
  errors: string[];
}> {
  const results: {
    favoritesSourceId?: FavoritesMigrationResult;
    channelIdPopulation?: ChannelIdMigrationResult;
  } = {};
  const errors: string[] = [];

  try {
    logger.info('Starting source validation migrations...');

    // Migration 1: Populate sourceId in favorites
    if (!(await hasMigrationRun('favoritesSourceId'))) {
      logger.info('Running favorites sourceId migration...');
      const result = await migrateFavoritesSourceId();
      results.favoritesSourceId = result;

      if (result.success) {
        await markMigrationExecuted('favoritesSourceId', result);
        logger.info('Favorites sourceId migration completed successfully');
      } else {
        errors.push(...result.errors);
        logger.error('Favorites sourceId migration failed');
        return { success: false, results, errors };
      }
    } else {
      logger.info('Favorites sourceId migration already executed, skipping');
    }

    // Migration 2: Populate channelId in YouTube sources
    if (!(await hasMigrationRun('channelIdPopulation'))) {
      logger.info('Running channel ID population migration...');
      const result = await populateChannelIds();
      results.channelIdPopulation = result;

      if (result.success) {
        await markMigrationExecuted('channelIdPopulation', result);
        logger.info('Channel ID population migration completed successfully');
      } else {
        errors.push(...result.errors);
        logger.error('Channel ID population migration failed');
        // Don't fail completely if channel ID population fails
        // This can be retried later when YouTube API is available
      }
    } else {
      logger.info('Channel ID population migration already executed, skipping');
    }

    const success = errors.length === 0;
    logger.info(`Source validation migrations completed: ${success ? 'success' : 'with errors'}`);

    return { success, results, errors };
  } catch (error) {
    const errorMsg = `Migration coordinator failed: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(errorMsg);
    logger.error(errorMsg);
    return { success: false, results, errors };
  }
}

/**
 * Rollback all source validation migrations
 */
export async function rollbackSourceValidationMigrations(): Promise<boolean> {
  try {
    logger.info('Rolling back source validation migrations...');

    let success = true;

    // Rollback in reverse order
    if (await hasMigrationRun('channelIdPopulation')) {
      const channelIdSuccess = await rollbackChannelIdMigration();
      if (channelIdSuccess) {
        // Remove from migration status
        const status = await getMigrationStatus();
        delete status.migrations['channelIdPopulation'];
        await saveMigrationStatus(status);
      }
      success = success && channelIdSuccess;
    }

    if (await hasMigrationRun('favoritesSourceId')) {
      const favoritesSuccess = await rollbackFavoritesMigration();
      if (favoritesSuccess) {
        // Remove from migration status
        const status = await getMigrationStatus();
        delete status.migrations['favoritesSourceId'];
        await saveMigrationStatus(status);
      }
      success = success && favoritesSuccess;
    }

    logger.info(`Rollback completed: ${success ? 'success' : 'partial failure'}`);
    return success;
  } catch (error) {
    logger.error(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Get migration status for display
 */
export async function getMigrationStatusReport(): Promise<string> {
  const status = await getMigrationStatus();

  let report = `Migration Status (v${status.version}):\n`;

  if (Object.keys(status.migrations).length === 0) {
    report += '  No migrations executed yet\n';
  } else {
    for (const [key, data] of Object.entries(status.migrations)) {
      report += `  ${key}:\n`;
      report += `    Executed: ${data.executed}\n`;
      if (data.executedAt) {
        report += `    Executed At: ${data.executedAt}\n`;
      }
      if (data.result) {
        report += `    Result: ${JSON.stringify(data.result, null, 2)}\n`;
      }
    }
  }

  return report;
}