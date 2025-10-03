import fs from 'fs';
import path from 'path';
import { AppPaths } from '../appPaths';
import DatabaseService from '../services/DatabaseService';
import SimpleSchemaManager from './SimpleSchemaManager';
import DatabaseErrorHandler from '../services/DatabaseErrorHandler';
import log from '../logger';

interface MigrationStatus {
  tableName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  recordsProcessed: number;
  totalRecords: number;
  startTime?: string;
  endTime?: string;
  error?: string;
}

interface MigrationSummary {
  phase: 'phase1' | 'phase2';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  tableStatuses: MigrationStatus[];
  totalRecordsProcessed: number;
  totalErrors: number;
  backupPath?: string;
}

interface JsonDataLoader {
  loadVideoSources(): any[];
  loadWatchedVideos(): any[];
  loadFavorites(): any[];
  loadUsageLogs(): any[];
  loadTimeLimits(): any;
  loadMainSettings(): any;
  loadTimeExtra(): any[];
  loadPaginationSettings(): any;
  loadYouTubePlayerSettings(): any;
}

/**
 * Migration service to handle JSON to SQLite data migration
 */
export class MigrationService {
  private databaseService: DatabaseService;
  private schemaManager: SimpleSchemaManager;
  private errorHandler: DatabaseErrorHandler;
  private jsonLoader: JsonDataLoader;

  constructor(
    databaseService: DatabaseService,
    schemaManager: SimpleSchemaManager,
    errorHandler: DatabaseErrorHandler
  ) {
    this.databaseService = databaseService;
    this.schemaManager = schemaManager;
    this.errorHandler = errorHandler;
    this.jsonLoader = new FileSystemJsonLoader();
  }

  /**
   * Execute Phase 1 migration (core tables)
   */
  async executePhase1Migration(): Promise<MigrationSummary> {
    const startTime = new Date().toISOString();
    const summary: MigrationSummary = {
      phase: 'phase1',
      status: 'in_progress',
      startTime,
      tableStatuses: [],
      totalRecordsProcessed: 0,
      totalErrors: 0
    };

    try {
      log.info('[MigrationService] Starting Phase 1 migration');

      // Create backup of JSON files before migration
      summary.backupPath = await this.createBackup();

      // Initialize schema
      await this.schemaManager.initializePhase1Schema();

      // Define migration steps for Phase 1
      const migrationSteps = [
        { tableName: 'sources', migrationFn: this.migrateSources.bind(this) },
        { tableName: 'videos', migrationFn: this.migrateVideos.bind(this) },
        { tableName: 'view_records', migrationFn: this.migrateViewRecords.bind(this) },
        { tableName: 'favorites', migrationFn: this.migrateFavorites.bind(this) },
        { tableName: 'youtube_api_results', migrationFn: this.migrateYouTubeApiResults.bind(this) }
      ];

      // Execute each migration step
      for (const step of migrationSteps) {
        const status = await this.executeMigrationStep(step.tableName, step.migrationFn);
        summary.tableStatuses.push(status);
        summary.totalRecordsProcessed += status.recordsProcessed;

        if (status.error) {
          summary.totalErrors++;
        }
      }

      // Check overall success
      const failedTables = summary.tableStatuses.filter(s => s.status === 'failed');
      summary.status = failedTables.length === 0 ? 'completed' : 'failed';
      summary.endTime = new Date().toISOString();

      if (summary.status === 'completed') {
        log.info(`[MigrationService] Phase 1 migration completed successfully in ${this.calculateDuration(startTime, summary.endTime)} ms`);
        log.info(`[MigrationService] Total records processed: ${summary.totalRecordsProcessed}`);
      } else {
        log.error(`[MigrationService] Phase 1 migration failed. ${failedTables.length} tables had errors.`);
      }

      return summary;
    } catch (error) {
      summary.status = 'failed';
      summary.endTime = new Date().toISOString();
      summary.totalErrors++;

      log.error('[MigrationService] Phase 1 migration failed with critical error:', error);
      throw error;
    }
  }

  /**
   * Execute a single migration step with error handling
   */
  private async executeMigrationStep(
    tableName: string,
    migrationFn: () => Promise<number>
  ): Promise<MigrationStatus> {
    const startTime = new Date().toISOString();
    const status: MigrationStatus = {
      tableName,
      status: 'in_progress',
      recordsProcessed: 0,
      totalRecords: 0,
      startTime
    };

    try {
      log.info(`[MigrationService] Starting migration for table: ${tableName}`);

      const result = await this.errorHandler.executeWithRetry(
        migrationFn,
        `migrate-${tableName}`,
        { maxAttempts: 2, baseDelay: 1000 }
      );

      if (result.success && result.result !== undefined) {
        status.recordsProcessed = result.result;
        status.totalRecords = result.result;
        status.status = 'completed';
        status.endTime = new Date().toISOString();

        log.info(`[MigrationService] Successfully migrated ${result.result} records to ${tableName} in ${result.totalTime}ms`);
      } else {
        status.status = 'failed';
        status.error = result.error?.message || 'Unknown migration error';
        status.endTime = new Date().toISOString();

        log.error(`[MigrationService] Failed to migrate ${tableName}:`, result.error);
      }

      return status;
    } catch (error) {
      status.status = 'failed';
      status.error = error instanceof Error ? error.message : 'Unknown error';
      status.endTime = new Date().toISOString();

      log.error(`[MigrationService] Critical error migrating ${tableName}:`, error);
      return status;
    }
  }

  /**
   * Migrate video sources from videoSources.json
   */
  private async migrateSources(): Promise<number> {
    log.debug('[MigrationService] Loading video sources from JSON');
    const sources = this.jsonLoader.loadVideoSources();

    if (!sources || sources.length === 0) {
      log.info('[MigrationService] No video sources found to migrate');
      return 0;
    }

    log.debug(`[MigrationService] Migrating ${sources.length} video sources`);

    const queries = sources.map(source => ({
      sql: `
        INSERT OR REPLACE INTO sources (
          id, type, title, sort_preference, position, url, channel_id, path, max_depth
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        source.id,
        source.type,
        source.title,
        source.sortPreference || null,
        source.url || null,
        source.channelId || null,
        source.path || null,
        source.maxDepth || null
      ]
    }));

    await this.databaseService.executeTransaction(queries);

    return sources.length;
  }

  /**
   * Migrate videos from watched.json (extracting unique video metadata)
   */
  private async migrateVideos(): Promise<number> {
    log.debug('[MigrationService] Loading watched videos to extract video metadata');
    const watchedVideos = this.jsonLoader.loadWatchedVideos();

    if (!watchedVideos || watchedVideos.length === 0) {
      log.info('[MigrationService] No watched videos found to migrate');
      return 0;
    }

    // Create a map of unique videos (avoid duplicates)
    const videoMap = new Map();

    for (const watchedVideo of watchedVideos) {
      if (!videoMap.has(watchedVideo.videoId)) {
        videoMap.set(watchedVideo.videoId, {
          id: watchedVideo.videoId,
          title: watchedVideo.title || '',
          thumbnail: watchedVideo.thumbnail || null,
          duration: watchedVideo.duration || null,
          source_id: watchedVideo.source || 'unknown',
          // Set URL based on video ID format
          url: watchedVideo.videoId.startsWith('local:') ? watchedVideo.videoId : null,
          is_available: true
        });
      }
    }

    const videos = Array.from(videoMap.values());
    log.debug(`[MigrationService] Migrating ${videos.length} unique videos`);

    const queries = videos.map(video => ({
      sql: `
        INSERT OR REPLACE INTO videos (
          id, title, thumbnail, duration, url, is_available, source_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        video.id,
        video.title,
        video.thumbnail,
        video.duration,
        video.url,
        video.is_available ? 1 : 0,
        video.source_id
      ]
    }));

    await this.databaseService.executeTransaction(queries);

    return videos.length;
  }

  /**
   * Migrate view records from watched.json
   */
  private async migrateViewRecords(): Promise<number> {
    log.debug('[MigrationService] Loading view records from watched.json');
    const watchedVideos = this.jsonLoader.loadWatchedVideos();

    if (!watchedVideos || watchedVideos.length === 0) {
      log.info('[MigrationService] No view records found to migrate');
      return 0;
    }

    log.debug(`[MigrationService] Migrating ${watchedVideos.length} view records`);

    const queries = watchedVideos.map(record => ({
      sql: `
        INSERT OR REPLACE INTO view_records (
          video_id, source_id, position, time_watched, duration,
          watched, first_watched, last_watched
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        record.videoId,
        record.source || 'unknown',
        record.position || 0,
        record.timeWatched || 0,
        record.duration || null,
        record.watched ? 1 : 0,
        record.firstWatched || new Date().toISOString(),
        record.lastWatched || new Date().toISOString()
      ]
    }));

    await this.databaseService.executeTransaction(queries);

    return watchedVideos.length;
  }

  /**
   * Migrate favorites from favorites.json
   */
  private async migrateFavorites(): Promise<number> {
    log.debug('[MigrationService] Loading favorites from JSON');
    const favoritesData = this.jsonLoader.loadFavorites();

    if (!favoritesData || !Array.isArray(favoritesData) || favoritesData.length === 0) {
      log.info('[MigrationService] No favorites found to migrate');
      return 0;
    }

    const favorites = favoritesData;
    log.debug(`[MigrationService] Migrating ${favorites.length} favorites`);

    const queries = favorites.map((favorite: any) => ({
      sql: `
        INSERT OR REPLACE INTO favorites (
          video_id, source_id, date_added
        ) VALUES (?, ?, ?)
      `,
      params: [
        favorite.videoId,
        favorite.sourceId || 'unknown',
        favorite.dateAdded || new Date().toISOString()
      ]
    }));

    await this.databaseService.executeTransaction(queries);

    return favorites.length;
  }

  /**
   * Migrate YouTube API results (placeholder - would need actual cache data)
   */
  private async migrateYouTubeApiResults(): Promise<number> {
    // For Phase 1, we'll start with empty YouTube API results
    // In Phase 2, this would migrate actual cached API data
    log.debug('[MigrationService] YouTube API results migration placeholder');
    return 0;
  }

  /**
   * Create backup of JSON files before migration
   */
  private async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(AppPaths.getDataDir(), 'backup', `migration-${timestamp}`);

    // Ensure backup directory exists
    fs.mkdirSync(backupDir, { recursive: true });

    const configDir = AppPaths.getConfigDir();
    const jsonFiles = [
      'videoSources.json',
      'watched.json',
      'favorites.json',
      'timeLimits.json',
      'usageLog.json',
      'mainSettings.json'
    ];

    for (const filename of jsonFiles) {
      const sourcePath = path.join(configDir, filename);
      const backupPath = path.join(backupDir, filename);

      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, backupPath);
        log.debug(`[MigrationService] Backed up ${filename} to ${backupPath}`);
      }
    }

    log.info(`[MigrationService] Created backup at: ${backupDir}`);
    return backupDir;
  }

  /**
   * Calculate duration between two ISO date strings in milliseconds
   */
  private calculateDuration(startTime: string, endTime: string): number {
    return new Date(endTime).getTime() - new Date(startTime).getTime();
  }

  /**
   * Execute Phase 2 migration (settings and usage data)
   */
  async executePhase2Migration(): Promise<MigrationSummary> {
    const startTime = new Date().toISOString();
    const summary: MigrationSummary = {
      phase: 'phase2',
      status: 'in_progress',
      startTime,
      tableStatuses: [],
      totalRecordsProcessed: 0,
      totalErrors: 0
    };

    try {
      log.info('[MigrationService] Starting Phase 2 migration');

      // Backup is already created in Phase 1, no need to create another

      // Initialize Phase 2 schema
      await this.schemaManager.initializePhase2Schema();

      // Define migration steps for Phase 2
      const migrationSteps = [
        { tableName: 'usage_logs', migrationFn: this.migrateUsageLogs.bind(this) },
        { tableName: 'time_limits', migrationFn: this.migrateTimeLimits.bind(this) },
        { tableName: 'usage_extras', migrationFn: this.migrateUsageExtras.bind(this) },
        { tableName: 'settings', migrationFn: this.migrateSettings.bind(this) }
      ];

      // Execute each migration step
      for (const step of migrationSteps) {
        const status = await this.executeMigrationStep(step.tableName, step.migrationFn);
        summary.tableStatuses.push(status);
        summary.totalRecordsProcessed += status.recordsProcessed;

        if (status.error) {
          summary.totalErrors++;
        }
      }

      // Check overall success
      const failedTables = summary.tableStatuses.filter(s => s.status === 'failed');
      summary.status = failedTables.length === 0 ? 'completed' : 'failed';
      summary.endTime = new Date().toISOString();

      if (summary.status === 'completed') {
        log.info(`[MigrationService] Phase 2 migration completed successfully in ${this.calculateDuration(startTime, summary.endTime)} ms`);
        log.info(`[MigrationService] Total records processed: ${summary.totalRecordsProcessed}`);
      } else {
        log.error(`[MigrationService] Phase 2 migration failed. ${failedTables.length} tables had errors.`);
      }

      return summary;
    } catch (error) {
      summary.status = 'failed';
      summary.endTime = new Date().toISOString();
      summary.totalErrors++;

      log.error('[MigrationService] Phase 2 migration failed with critical error:', error);
      throw error;
    }
  }

  /**
   * Migrate usage logs from usageLog.json
   */
  private async migrateUsageLogs(): Promise<number> {
    log.debug('[MigrationService] Loading usage logs from JSON');
    const usageLogs = this.jsonLoader.loadUsageLogs();

    if (!usageLogs || usageLogs.length === 0) {
      log.info('[MigrationService] No usage logs found to migrate');
      return 0;
    }

    log.debug(`[MigrationService] Migrating ${usageLogs.length} usage logs`);

    const queries = usageLogs.map((log: any) => ({
      sql: `
        INSERT OR REPLACE INTO usage_logs (date, seconds_used)
        VALUES (?, ?)
      `,
      params: [log.date, log.secondsUsed || 0]
    }));

    await this.databaseService.executeTransaction(queries);

    return usageLogs.length;
  }

  /**
   * Migrate time limits from timeLimits.json
   */
  private async migrateTimeLimits(): Promise<number> {
    log.debug('[MigrationService] Loading time limits from JSON');
    const timeLimits = this.jsonLoader.loadTimeLimits();

    if (!timeLimits || Object.keys(timeLimits).length === 0) {
      log.info('[MigrationService] No time limits found to migrate');
      return 0;
    }

    log.debug('[MigrationService] Migrating time limits');

    // Convert minutes to the database format and handle optional fields
    await this.databaseService.run(`
      INSERT OR REPLACE INTO time_limits (
        id, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
        warning_threshold_minutes, countdown_warning_seconds, audio_warning_seconds,
        time_up_message, use_system_beep, custom_beep_sound
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      timeLimits.monday || 0,
      timeLimits.tuesday || 0,
      timeLimits.wednesday || 0,
      timeLimits.thursday || 0,
      timeLimits.friday || 0,
      timeLimits.saturday || 0,
      timeLimits.sunday || 0,
      timeLimits.warningThresholdMinutes || null,
      timeLimits.countdownWarningSeconds || null,
      timeLimits.audioWarningSeconds || null,
      timeLimits.timeUpMessage || null,
      timeLimits.useSystemBeep ? 1 : 0,
      timeLimits.customBeepSound || null
    ]);

    return 1; // Single row
  }

  /**
   * Migrate usage extras from timeExtra.json
   */
  private async migrateUsageExtras(): Promise<number> {
    log.debug('[MigrationService] Loading usage extras from JSON');
    const timeExtras = this.jsonLoader.loadTimeExtra();

    if (!timeExtras || timeExtras.length === 0) {
      log.info('[MigrationService] No usage extras found to migrate');
      return 0;
    }

    log.debug(`[MigrationService] Migrating ${timeExtras.length} usage extras`);

    const queries = timeExtras.map((extra: any) => ({
      sql: `
        INSERT INTO usage_extras (date, minutes_added, reason, added_by)
        VALUES (?, ?, ?, ?)
      `,
      params: [
        extra.date,
        extra.minutesAdded || extra.minutes || 0,
        extra.reason || null,
        extra.addedBy || 'admin'
      ]
    }));

    await this.databaseService.executeTransaction(queries);

    return timeExtras.length;
  }

  /**
   * Migrate settings from mainSettings.json, pagination.json, and youtubePlayer.json
   */
  private async migrateSettings(): Promise<number> {
    log.debug('[MigrationService] Loading settings from JSON files');

    let recordCount = 0;

    // Migrate mainSettings.json
    const mainSettings = this.jsonLoader.loadMainSettings();
    if (mainSettings && Object.keys(mainSettings).length > 0) {
      log.debug('[MigrationService] Migrating main settings');
      const mainQueries = Object.entries(mainSettings).map(([key, value]) => ({
        sql: `
          INSERT OR REPLACE INTO settings (key, value, type)
          VALUES (?, ?, ?)
        `,
        params: [
          `main.${key}`,
          JSON.stringify(value),
          typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string'
        ]
      }));

      await this.databaseService.executeTransaction(mainQueries);
      recordCount += mainQueries.length;
    }

    // Migrate pagination.json
    const paginationSettings = this.jsonLoader.loadPaginationSettings();
    if (paginationSettings && Object.keys(paginationSettings).length > 0) {
      log.debug('[MigrationService] Migrating pagination settings');
      const paginationQueries = Object.entries(paginationSettings).map(([key, value]) => ({
        sql: `
          INSERT OR REPLACE INTO settings (key, value, type)
          VALUES (?, ?, ?)
        `,
        params: [
          `pagination.${key}`,
          JSON.stringify(value),
          typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string'
        ]
      }));

      await this.databaseService.executeTransaction(paginationQueries);
      recordCount += paginationQueries.length;
    }

    // Migrate youtubePlayer.json
    const youtubePlayerSettings = this.jsonLoader.loadYouTubePlayerSettings();
    if (youtubePlayerSettings && Object.keys(youtubePlayerSettings).length > 0) {
      log.debug('[MigrationService] Migrating YouTube player settings');
      const youtubeQueries = Object.entries(youtubePlayerSettings).map(([key, value]) => ({
        sql: `
          INSERT OR REPLACE INTO settings (key, value, type)
          VALUES (?, ?, ?)
        `,
        params: [
          `youtubePlayer.${key}`,
          JSON.stringify(value),
          typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : typeof value === 'object' ? 'object' : 'string'
        ]
      }));

      await this.databaseService.executeTransaction(youtubeQueries);
      recordCount += youtubeQueries.length;
    }

    log.debug(`[MigrationService] Migrated ${recordCount} settings`);
    return recordCount;
  }

  /**
   * Verify migration integrity by comparing record counts
   */
  async verifyMigrationIntegrity(): Promise<{
    isValid: boolean;
    errors: string[];
    counts: { [tableName: string]: { expected: number; actual: number } };
  }> {
    const result = {
      isValid: true,
      errors: [] as string[],
      counts: {} as { [tableName: string]: { expected: number; actual: number } }
    };

    try {
      // Check sources
      const sourcesJson = this.jsonLoader.loadVideoSources();
      const sourcesDb = await this.databaseService.get<{ count: number }>('SELECT COUNT(*) as count FROM sources');
      result.counts.sources = { expected: sourcesJson?.length || 0, actual: sourcesDb?.count || 0 };

      if (result.counts.sources.expected !== result.counts.sources.actual) {
        result.isValid = false;
        result.errors.push(`Sources count mismatch: expected ${result.counts.sources.expected}, got ${result.counts.sources.actual}`);
      }

      // Check view records
      const watchedJson = this.jsonLoader.loadWatchedVideos();
      const viewRecordsDb = await this.databaseService.get<{ count: number }>('SELECT COUNT(*) as count FROM view_records');
      result.counts.view_records = { expected: watchedJson?.length || 0, actual: viewRecordsDb?.count || 0 };

      if (result.counts.view_records.expected !== result.counts.view_records.actual) {
        result.isValid = false;
        result.errors.push(`View records count mismatch: expected ${result.counts.view_records.expected}, got ${result.counts.view_records.actual}`);
      }

      // Check favorites
      const favoritesJson = this.jsonLoader.loadFavorites();
      const favoritesDb = await this.databaseService.get<{ count: number }>('SELECT COUNT(*) as count FROM favorites');
      const expectedFavorites = Array.isArray(favoritesJson) ? favoritesJson.length : 0;
      result.counts.favorites = { expected: expectedFavorites, actual: favoritesDb?.count || 0 };

      if (result.counts.favorites.expected !== result.counts.favorites.actual) {
        result.isValid = false;
        result.errors.push(`Favorites count mismatch: expected ${result.counts.favorites.expected}, got ${result.counts.favorites.actual}`);
      }

      log.info('[MigrationService] Migration integrity verification completed', result);
      return result;
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Integrity verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }
}

/**
 * File system based JSON data loader
 */
class FileSystemJsonLoader implements JsonDataLoader {
  loadVideoSources(): any[] {
    try {
      const path = AppPaths.getConfigPath('videoSources.json');
      if (!fs.existsSync(path)) {
        return [];
      }
      return JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (error) {
      log.error('[FileSystemJsonLoader] Error loading video sources:', error);
      return [];
    }
  }

  loadWatchedVideos(): any[] {
    try {
      const path = AppPaths.getConfigPath('watched.json');
      if (!fs.existsSync(path)) {
        return [];
      }
      return JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (error) {
      log.error('[FileSystemJsonLoader] Error loading watched videos:', error);
      return [];
    }
  }

  loadFavorites(): any {
    try {
      const path = AppPaths.getConfigPath('favorites.json');
      if (!fs.existsSync(path)) {
        return { favorites: [] };
      }
      return JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (error) {
      log.error('[FileSystemJsonLoader] Error loading favorites:', error);
      return { favorites: [] };
    }
  }

  loadUsageLogs(): any[] {
    try {
      const path = AppPaths.getConfigPath('usageLog.json');
      if (!fs.existsSync(path)) {
        return [];
      }
      return JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (error) {
      log.error('[FileSystemJsonLoader] Error loading usage logs:', error);
      return [];
    }
  }

  loadTimeLimits(): any {
    try {
      const path = AppPaths.getConfigPath('timeLimits.json');
      if (!fs.existsSync(path)) {
        return {};
      }
      return JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (error) {
      log.error('[FileSystemJsonLoader] Error loading time limits:', error);
      return {};
    }
  }

  loadMainSettings(): any {
    try {
      const path = AppPaths.getConfigPath('mainSettings.json');
      if (!fs.existsSync(path)) {
        return {};
      }
      return JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (error) {
      log.error('[FileSystemJsonLoader] Error loading main settings:', error);
      return {};
    }
  }

  loadTimeExtra(): any[] {
    try {
      const path = AppPaths.getConfigPath('timeExtra.json');
      if (!fs.existsSync(path)) {
        return [];
      }
      const data = JSON.parse(fs.readFileSync(path, 'utf8'));
      // Handle both array format and object format
      return Array.isArray(data) ? data : (data.extras || []);
    } catch (error) {
      log.error('[FileSystemJsonLoader] Error loading time extras:', error);
      return [];
    }
  }

  loadPaginationSettings(): any {
    try {
      const path = AppPaths.getConfigPath('pagination.json');
      if (!fs.existsSync(path)) {
        return {};
      }
      return JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (error) {
      log.error('[FileSystemJsonLoader] Error loading pagination settings:', error);
      return {};
    }
  }

  loadYouTubePlayerSettings(): any {
    try {
      const path = AppPaths.getConfigPath('youtubePlayer.json');
      if (!fs.existsSync(path)) {
        return {};
      }
      return JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (error) {
      log.error('[FileSystemJsonLoader] Error loading YouTube player settings:', error);
      return {};
    }
  }
}

export default MigrationService;