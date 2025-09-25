import fs from 'fs';
import path from 'path';
import DatabaseService from '../services/DatabaseService';
import log from '../logger';

interface SchemaVersion {
  version: number;
  phase: 'phase1' | 'phase2';
  updated_at: string;
}

interface SchemaValidationResult {
  isValid: boolean;
  errors: string[];
  missingTables: string[];
  phase: 'phase1' | 'phase2' | 'none';
}

export class SchemaManager {
  private databaseService: DatabaseService;
  private schemaDir: string;

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
    this.schemaDir = path.join(__dirname, 'schema');
  }

  /**
   * Initialize database schema for the specified phase
   */
  async initializeSchema(phase: 'phase1' | 'phase2' = 'phase1'): Promise<void> {
    try {
      log.info(`[SchemaManager] Initializing ${phase} schema`);

      // Check current schema version
      const currentVersion = await this.getCurrentSchemaVersion();

      if (currentVersion && currentVersion.phase === phase) {
        log.debug(`[SchemaManager] Schema ${phase} already initialized`);
        return;
      }

      // Load and execute schema SQL
      const schemaContent = await this.loadSchemaFile(`${phase}.sql`);
      await this.executeSchemaStatements(schemaContent);

      // Validate schema after creation
      const validation = await this.validateSchema(phase);
      if (!validation.isValid) {
        throw new Error(`Schema validation failed: ${validation.errors.join(', ')}`);
      }

      log.info(`[SchemaManager] Schema ${phase} initialized successfully`);
    } catch (error) {
      log.error(`[SchemaManager] Failed to initialize schema ${phase}:`, error);
      throw error;
    }
  }

  /**
   * Load schema SQL file
   */
  private async loadSchemaFile(filename: string): Promise<string> {
    try {
      const filePath = path.join(this.schemaDir, filename);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Schema file not found: ${filePath}`);
      }

      const content = fs.readFileSync(filePath, 'utf8');
      log.debug(`[SchemaManager] Loaded schema file: ${filename}`);

      return content;
    } catch (error) {
      log.error(`[SchemaManager] Error loading schema file ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Execute schema SQL statements
   */
  private async executeSchemaStatements(schemaContent: string): Promise<void> {
    try {
      // Split SQL content into individual statements
      const statements = this.splitSqlStatements(schemaContent);

      log.debug(`[SchemaManager] Executing ${statements.length} schema statements`);

      // Debug: log first few statements
      statements.slice(0, 3).forEach((stmt, i) => {
        log.debug(`[SchemaManager] Statement ${i + 1}:`, stmt.substring(0, 100) + '...');
      });

      // Execute statements individually (needed for FTS and triggers)
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        try {
          await this.databaseService.run(statement);
          log.debug(`[SchemaManager] Executed statement ${i + 1}/${statements.length}`);
        } catch (error) {
          log.error(`[SchemaManager] Error executing statement ${i + 1}: ${statement.substring(0, 100)}...`, error);
          throw error;
        }
      }

      log.debug('[SchemaManager] Schema statements executed successfully');
    } catch (error) {
      log.error('[SchemaManager] Error executing schema statements:', error);
      throw error;
    }
  }

  /**
   * Split SQL content into individual statements
   */
  private splitSqlStatements(content: string): string[] {
    // Remove comments but preserve original formatting for triggers
    let cleaned = content
      .replace(/--.*$/gm, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

    // Split on semicolons followed by newline or end of string (safer for triggers)
    const statements = cleaned
      .split(/;\s*(?:\n|$)/)
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && stmt !== ';');

    return statements;
  }

  /**
   * Get current schema version from database
   */
  async getCurrentSchemaVersion(): Promise<SchemaVersion | null> {
    try {
      // Check if schema_version table exists
      const tableExists = await this.databaseService.get(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='schema_version'
      `);

      if (!tableExists) {
        return null;
      }

      // Get current version
      const version = await this.databaseService.get<SchemaVersion>(`
        SELECT version, phase, updated_at
        FROM schema_version
        WHERE id = 1
      `);

      return version;
    } catch (error) {
      log.error('[SchemaManager] Error getting current schema version:', error);
      return null;
    }
  }

  /**
   * Validate database schema
   */
  async validateSchema(expectedPhase: 'phase1' | 'phase2'): Promise<SchemaValidationResult> {
    try {
      const result: SchemaValidationResult = {
        isValid: true,
        errors: [],
        missingTables: [],
        phase: 'none'
      };

      // Get all tables in database
      const tables = await this.databaseService.all<{ name: string }>(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);

      const tableNames = tables.map(t => t.name);
      log.debug('[SchemaManager] Found tables:', tableNames);

      // Define expected tables for each phase
      const phase1Tables = [
        'sources',
        'videos',
        'videos_fts',
        'view_records',
        'favorites',
        'youtube_api_results',
        'schema_version'
      ];

      const phase2Tables = [
        ...phase1Tables,
        'usage_logs',
        'time_limits',
        'usage_extras',
        'settings'
      ];

      const expectedTables = expectedPhase === 'phase1' ? phase1Tables : phase2Tables;

      // Check for missing tables
      for (const table of expectedTables) {
        if (!tableNames.includes(table)) {
          result.missingTables.push(table);
          result.errors.push(`Missing table: ${table}`);
        }
      }

      // Validate foreign key constraints
      const fkErrors = await this.validateForeignKeyConstraints();
      result.errors.push(...fkErrors);

      // Validate indexes
      const indexErrors = await this.validateIndexes(expectedPhase);
      result.errors.push(...indexErrors);

      // Check schema version
      const schemaVersion = await this.getCurrentSchemaVersion();
      if (schemaVersion) {
        result.phase = schemaVersion.phase;

        if (schemaVersion.phase !== expectedPhase) {
          result.errors.push(`Schema phase mismatch: expected ${expectedPhase}, got ${schemaVersion.phase}`);
        }
      } else {
        result.errors.push('Schema version not found');
      }

      result.isValid = result.errors.length === 0;

      if (!result.isValid) {
        log.warn('[SchemaManager] Schema validation failed:', result.errors);
      } else {
        log.debug(`[SchemaManager] Schema validation passed for ${expectedPhase}`);
      }

      return result;
    } catch (error) {
      log.error('[SchemaManager] Error during schema validation:', error);
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error'],
        missingTables: [],
        phase: 'none'
      };
    }
  }

  /**
   * Validate foreign key constraints
   */
  private async validateForeignKeyConstraints(): Promise<string[]> {
    try {
      const errors: string[] = [];

      // Check foreign key constraint violations
      const violations = await this.databaseService.all(`PRAGMA foreign_key_check`);

      if (violations.length > 0) {
        violations.forEach((violation: any) => {
          errors.push(`Foreign key violation in table ${violation.table}: ${JSON.stringify(violation)}`);
        });
      }

      return errors;
    } catch (error) {
      return [`Error checking foreign key constraints: ${error instanceof Error ? error.message : error}`];
    }
  }

  /**
   * Validate database indexes
   */
  private async validateIndexes(phase: 'phase1' | 'phase2'): Promise<string[]> {
    try {
      const errors: string[] = [];

      // Get all indexes
      const indexes = await this.databaseService.all<{ name: string; tbl_name: string }>(`
        SELECT name, tbl_name FROM sqlite_master
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);

      const indexNames = indexes.map(i => i.name);

      // Define expected indexes for Phase 1
      const expectedIndexes = [
        'idx_sources_type',
        'idx_sources_title',
        'idx_videos_source_id',
        'idx_videos_title',
        'idx_videos_published_at',
        'idx_videos_updated_at',
        'idx_view_records_video_id',
        'idx_view_records_source_id',
        'idx_view_records_last_watched',
        'idx_view_records_watched',
        'idx_favorites_video_id',
        'idx_favorites_source_id',
        'idx_favorites_date_added',
        'idx_youtube_api_source_id',
        'idx_youtube_api_page_range',
        'idx_youtube_api_position',
        'idx_youtube_api_fetch_timestamp'
      ];

      // Check for missing indexes
      for (const expectedIndex of expectedIndexes) {
        if (!indexNames.includes(expectedIndex)) {
          errors.push(`Missing index: ${expectedIndex}`);
        }
      }

      return errors;
    } catch (error) {
      return [`Error validating indexes: ${error instanceof Error ? error.message : error}`];
    }
  }

  /**
   * Drop all schema objects (for testing/cleanup)
   */
  async dropSchema(): Promise<void> {
    try {
      log.warn('[SchemaManager] Dropping entire schema');

      // Get all tables
      const tables = await this.databaseService.all<{ name: string }>(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);

      // Drop all tables (this will also drop associated indexes and triggers)
      const dropStatements = tables.map(table => `DROP TABLE IF EXISTS ${table.name}`);

      if (dropStatements.length > 0) {
        const queries = dropStatements.map(sql => ({ sql, params: [] }));
        await this.databaseService.executeTransaction(queries);
      }

      log.info('[SchemaManager] Schema dropped successfully');
    } catch (error) {
      log.error('[SchemaManager] Error dropping schema:', error);
      throw error;
    }
  }
}

export default SchemaManager;