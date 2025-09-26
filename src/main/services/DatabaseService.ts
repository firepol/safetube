import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { AppPaths } from '../appPaths';
import log from '../logger';

interface DatabaseConfig {
  path: string;
  mode?: 'WAL' | 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'OFF';
  busyTimeout?: number;
  cacheSize?: number;
  synchronous?: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
  tempStore?: 'DEFAULT' | 'FILE' | 'MEMORY';
  foreignKeys?: boolean;
}

interface ConnectionPoolConfig {
  maxConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
}

interface DatabaseMetrics {
  connectionsActive: number;
  connectionsTotal: number;
  queriesExecuted: number;
  queryTimeTotal: number;
  errors: number;
}

export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private db: sqlite3.Database | null = null;
  private config: DatabaseConfig | null = null;
  private isInitialized = false;
  private isInitializing = false;
  private connectionPool: sqlite3.Database[] = [];
  private availableConnections: sqlite3.Database[] = [];
  private poolConfig: ConnectionPoolConfig = {
    maxConnections: 5,
    acquireTimeout: 10000,
    idleTimeout: 300000 // 5 minutes
  };
  private metrics: DatabaseMetrics = {
    connectionsActive: 0,
    connectionsTotal: 0,
    queriesExecuted: 0,
    queryTimeTotal: 0,
    errors: 0
  };

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Initialize the database with configuration
   */
  async initialize(config?: Partial<DatabaseConfig>): Promise<void> {
    if (this.isInitialized) {
      log.debug('[DatabaseService] Already initialized');
      return;
    }

    if (this.isInitializing) {
      log.debug('[DatabaseService] Initialization in progress, waiting...');
      // Wait for initialization to complete
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isInitializing = true;

    try {
      // Set default configuration
      const defaultConfig: DatabaseConfig = {
        path: AppPaths.getDataPath('safetube.db'),
        mode: 'WAL',
        busyTimeout: 30000,
        cacheSize: -2000, // 2MB cache
        synchronous: 'NORMAL',
        tempStore: 'MEMORY',
        foreignKeys: true
      };

      this.config = { ...defaultConfig, ...config };

      // Ensure data directory exists
      const dataDir = path.dirname(this.config.path);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        log.info(`[DatabaseService] Created data directory: ${dataDir}`);
      }

      // Create primary database connection
      await this.createConnection();

      // Configure database settings
      await this.configureDatabase();

      // Initialize connection pool
      await this.initializeConnectionPool();

      this.isInitialized = true;
      log.info('[DatabaseService] Database initialized successfully');
    } catch (error) {
      this.metrics.errors++;
      log.error('[DatabaseService] Failed to initialize database:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Create primary database connection
   */
  private createConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config) {
        reject(new Error('Database configuration not set'));
        return;
      }

      log.debug(`[DatabaseService] Creating database connection to: ${this.config.path}`);

      this.db = new sqlite3.Database(
        this.config.path,
        sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        (err) => {
          if (err) {
            this.metrics.errors++;
            log.error('[DatabaseService] Error opening database:', err);
            reject(err);
          } else {
            this.metrics.connectionsTotal++;
            log.debug('[DatabaseService] Database connection created successfully');
            resolve();
          }
        }
      );
    });
  }

  /**
   * Configure database settings (WAL mode, foreign keys, etc.)
   */
  private async configureDatabase(): Promise<void> {
    if (!this.db || !this.config) {
      throw new Error('Database not initialized');
    }

    const settings = [
      // Enable WAL mode for better concurrency
      `PRAGMA journal_mode = ${this.config.mode}`,

      // Set synchronous mode
      `PRAGMA synchronous = ${this.config.synchronous}`,

      // Set cache size
      `PRAGMA cache_size = ${this.config.cacheSize}`,

      // Set temp store location
      `PRAGMA temp_store = ${this.config.tempStore}`,

      // Enable foreign key constraints
      `PRAGMA foreign_keys = ${this.config.foreignKeys ? 'ON' : 'OFF'}`,

      // Set busy timeout
      `PRAGMA busy_timeout = ${this.config.busyTimeout}`
    ];

    for (const setting of settings) {
      await this.runPragma(setting);
    }

    log.debug('[DatabaseService] Database configuration applied');
  }

  /**
   * Run a PRAGMA statement
   */
  private runPragma(pragma: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run(pragma, (err) => {
        if (err) {
          this.metrics.errors++;
          log.error(`[DatabaseService] Error running pragma "${pragma}":`, err);
          reject(err);
        } else {
          log.debug(`[DatabaseService] Applied pragma: ${pragma}`);
          resolve();
        }
      });
    });
  }

  /**
   * Initialize connection pool for concurrent operations
   */
  private async initializeConnectionPool(): Promise<void> {
    if (!this.config) {
      throw new Error('Database configuration not set');
    }

    try {
      for (let i = 0; i < this.poolConfig.maxConnections; i++) {
        const connection = await this.createPoolConnection();
        this.connectionPool.push(connection);
        this.availableConnections.push(connection);
      }

      log.debug(`[DatabaseService] Connection pool initialized with ${this.poolConfig.maxConnections} connections`);
    } catch (error) {
      log.error('[DatabaseService] Failed to initialize connection pool:', error);
      throw error;
    }
  }

  /**
   * Create a pooled database connection
   */
  private createPoolConnection(): Promise<sqlite3.Database> {
    return new Promise((resolve, reject) => {
      if (!this.config) {
        reject(new Error('Database configuration not set'));
        return;
      }

      const connection = new sqlite3.Database(
        this.config.path,
        sqlite3.OPEN_READWRITE,
        async (err) => {
          if (err) {
            this.metrics.errors++;
            reject(err);
          } else {
            try {
              // Apply configuration to pool connection
              await this.configurePoolConnection(connection);
              this.metrics.connectionsTotal++;
              resolve(connection);
            } catch (configError) {
              this.metrics.errors++;
              reject(configError);
            }
          }
        }
      );
    });
  }

  /**
   * Configure a pooled connection with the same settings as the main connection
   */
  private configurePoolConnection(connection: sqlite3.Database): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config) {
        reject(new Error('Database configuration not set'));
        return;
      }

      const settings = [
        // Enable foreign key constraints
        `PRAGMA foreign_keys = ${this.config.foreignKeys ? 'ON' : 'OFF'}`,
        // Set busy timeout
        `PRAGMA busy_timeout = ${this.config.busyTimeout}`
      ];

      let completed = 0;
      const total = settings.length;

      for (const setting of settings) {
        connection.run(setting, (err) => {
          if (err) {
            reject(err);
            return;
          }

          completed++;
          if (completed === total) {
            resolve();
          }
        });
      }
    });
  }

  /**
   * Acquire a connection from the pool
   */
  private async acquireConnection(): Promise<sqlite3.Database> {
    const timeout = Date.now() + this.poolConfig.acquireTimeout;

    while (Date.now() < timeout) {
      if (this.availableConnections.length > 0) {
        const connection = this.availableConnections.pop()!;
        this.metrics.connectionsActive++;
        return connection;
      }

      // Wait a bit before trying again
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    throw new Error('Failed to acquire database connection within timeout');
  }

  /**
   * Release a connection back to the pool
   */
  private releaseConnection(connection: sqlite3.Database): void {
    this.availableConnections.push(connection);
    this.metrics.connectionsActive--;
  }

  /**
   * Execute a SQL query with parameters
   */
  async run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const connection = await this.acquireConnection();
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      connection.run(sql, params, function(err) {
        const duration = Date.now() - startTime;
        DatabaseService.instance!.metrics.queriesExecuted++;
        DatabaseService.instance!.metrics.queryTimeTotal += duration;
        DatabaseService.instance!.releaseConnection(connection);

        if (err) {
          DatabaseService.instance!.metrics.errors++;
          log.error('[DatabaseService] Error executing query:', err, { sql, params });
          reject(err);
        } else {
          log.debug(`[DatabaseService] Query executed in ${duration}ms:`, { sql, params: params.length });
          resolve(this);
        }
      });
    });
  }

  /**
   * Execute a query and return a single row
   */
  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const connection = await this.acquireConnection();
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      connection.get(sql, params, (err, row) => {
        const duration = Date.now() - startTime;
        this.metrics.queriesExecuted++;
        this.metrics.queryTimeTotal += duration;
        this.releaseConnection(connection);

        if (err) {
          this.metrics.errors++;
          log.error('[DatabaseService] Error executing query:', err, { sql, params });
          reject(err);
        } else {
          log.debug(`[DatabaseService] Query executed in ${duration}ms:`, { sql, params: params.length });
          resolve(row as T || null);
        }
      });
    });
  }

  /**
   * Execute a query and return all rows
   */
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const connection = await this.acquireConnection();
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      connection.all(sql, params, (err, rows) => {
        const duration = Date.now() - startTime;
        this.metrics.queriesExecuted++;
        this.metrics.queryTimeTotal += duration;
        this.releaseConnection(connection);

        if (err) {
          this.metrics.errors++;
          log.error('[DatabaseService] Error executing query:', err, { sql, params });
          reject(err);
        } else {
          log.debug(`[DatabaseService] Query executed in ${duration}ms, returned ${rows?.length || 0} rows:`, { sql, params: params.length });
          resolve((rows || []) as T[]);
        }
      });
    });
  }

  /**
   * Execute multiple statements in a transaction
   */
  async executeTransaction(queries: Array<{ sql: string; params?: any[] }>, options: { silent?: boolean } = {}): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const connection = await this.acquireConnection();
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      connection.serialize(() => {
        connection.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            this.metrics.errors++;
            this.releaseConnection(connection);
            reject(err);
            return;
          }

          let completed = 0;
          let failed = false;

          const executeNext = (index: number) => {
            if (index >= queries.length) {
              // All queries completed successfully
              connection.run('COMMIT', (commitErr) => {
                const duration = Date.now() - startTime;
                this.metrics.queriesExecuted += queries.length;
                this.metrics.queryTimeTotal += duration;
                this.releaseConnection(connection);

                if (commitErr) {
                  this.metrics.errors++;
                  log.error('[DatabaseService] Error committing transaction:', commitErr);
                  reject(commitErr);
                } else {
                  if (!options.silent) {
                    log.debug(`[DatabaseService] Transaction completed in ${duration}ms with ${queries.length} queries`);
                  } else {
                    log.debug(`[DatabaseService] Batch transaction completed with ${queries.length} queries (silent mode)`);
                  }
                  resolve();
                }
              });
              return;
            }

            const query = queries[index];
            connection.run(query.sql, query.params || [], (err) => {
              if (err && !failed) {
                failed = true;
                this.metrics.errors++;

                connection.run('ROLLBACK', () => {
                  this.releaseConnection(connection);
                  log.error('[DatabaseService] Error in transaction, rolling back:', err, { sql: query.sql });
                  reject(err);
                });
              } else if (!failed) {
                executeNext(index + 1);
              }
            });
          };

          executeNext(0);
        });
      });
    });
  }

  /**
   * Check database integrity
   */
  async checkIntegrity(): Promise<{ ok: boolean; errors: string[] }> {
    try {
      const result = await this.get<{ integrity_check: string }>('PRAGMA integrity_check');

      if (result && result.integrity_check === 'ok') {
        return { ok: true, errors: [] };
      } else {
        const errors = result ? [result.integrity_check] : ['Unknown integrity check result'];
        return { ok: false, errors };
      }
    } catch (error) {
      return {
        ok: false,
        errors: [error instanceof Error ? error.message : 'Integrity check failed']
      };
    }
  }

  /**
   * Get database health status
   */
  async getHealthStatus(): Promise<{
    initialized: boolean;
    connected: boolean;
    poolSize: number;
    activeConnections: number;
    metrics: DatabaseMetrics;
  }> {
    return {
      initialized: this.isInitialized,
      connected: this.db !== null,
      poolSize: this.connectionPool.length,
      activeConnections: this.metrics.connectionsActive,
      metrics: { ...this.metrics }
    };
  }

  /**
   * Check database health and return status
   */
  async healthCheck(): Promise<{ isHealthy: boolean; version?: string }> {
    try {
      if (!this.db) {
        return { isHealthy: false };
      }

      // Test a simple query to verify database is working
      const version = await this.get<{ version: string }>('SELECT sqlite_version() as version');

      return {
        isHealthy: true,
        version: version?.version || 'unknown'
      };
    } catch (error) {
      log.error('[DatabaseService] Health check failed:', error);
      return { isHealthy: false };
    }
  }

  /**
   * Close the database and clean up connections
   */
  async close(): Promise<void> {
    if (!this.isInitialized) {
      log.debug('[DatabaseService] Database not initialized, nothing to close');
      return;
    }

    try {
      // Close all pool connections
      for (const connection of this.connectionPool) {
        await new Promise<void>((resolve, reject) => {
          connection.close((err) => {
            if (err) {
              log.error('[DatabaseService] Error closing pool connection:', err);
              reject(err);
            } else {
              resolve();
            }
          });
        });
      }

      // Close main connection
      if (this.db) {
        await new Promise<void>((resolve, reject) => {
          this.db!.close((err) => {
            if (err) {
              log.error('[DatabaseService] Error closing main connection:', err);
              reject(err);
            } else {
              resolve();
            }
          });
        });
      }

      // Reset state
      this.db = null;
      this.connectionPool = [];
      this.availableConnections = [];
      this.isInitialized = false;
      this.config = null;

      log.info('[DatabaseService] Database closed successfully');
    } catch (error) {
      this.metrics.errors++;
      log.error('[DatabaseService] Error closing database:', error);
      throw error;
    }
  }
}

export default DatabaseService;