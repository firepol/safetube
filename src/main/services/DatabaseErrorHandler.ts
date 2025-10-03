import log from '../logger';

export interface DatabaseError extends Error {
  code?: string;
  errno?: number;
  operation?: string;
  sqliteCode?: string;
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors: string[];
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: DatabaseError;
  attempts: number;
  totalTime: number;
}

export const DatabaseErrorCodes = {
  // Connection errors
  CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  CONNECTION_TIMEOUT: 'DB_CONNECTION_TIMEOUT',

  // Query execution errors
  QUERY_TIMEOUT: 'DB_QUERY_TIMEOUT',
  SYNTAX_ERROR: 'DB_SYNTAX_ERROR',

  // Constraint errors
  CONSTRAINT_VIOLATION: 'DB_CONSTRAINT_VIOLATION',
  FOREIGN_KEY_VIOLATION: 'DB_FOREIGN_KEY_VIOLATION',
  UNIQUE_CONSTRAINT_VIOLATION: 'DB_UNIQUE_CONSTRAINT_VIOLATION',
  NOT_NULL_CONSTRAINT_VIOLATION: 'DB_NOT_NULL_CONSTRAINT_VIOLATION',
  CHECK_CONSTRAINT_VIOLATION: 'DB_CHECK_CONSTRAINT_VIOLATION',

  // Locking and concurrency errors
  DATABASE_LOCKED: 'DB_DATABASE_LOCKED',
  TABLE_LOCKED: 'DB_TABLE_LOCKED',
  BUSY: 'DB_BUSY',

  // File system errors
  DISK_FULL: 'DB_DISK_FULL',
  READONLY_DATABASE: 'DB_READONLY_DATABASE',
  PERMISSION_DENIED: 'DB_PERMISSION_DENIED',

  // Data integrity errors
  CORRUPTION: 'DB_CORRUPTION',
  SCHEMA_MISMATCH: 'DB_SCHEMA_MISMATCH',

  // Migration errors
  MIGRATION_FAILED: 'DB_MIGRATION_FAILED',
  ROLLBACK_FAILED: 'DB_ROLLBACK_FAILED',

  // Validation errors
  VALIDATION_FAILED: 'DB_VALIDATION_FAILED',

  // Unknown errors
  UNKNOWN_ERROR: 'DB_UNKNOWN_ERROR'
} as const;

/**
 * Database error handler with retry logic and error categorization
 */
export class DatabaseErrorHandler {
  private defaultRetryOptions: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 100,
    maxDelay: 5000,
    backoffFactor: 2,
    retryableErrors: [
      'SQLITE_BUSY',
      'SQLITE_LOCKED',
      'SQLITE_BUSY_RECOVERY',
      'SQLITE_BUSY_SNAPSHOT',
      'SQLITE_BUSY_TIMEOUT',
      'SQLITE_CANTOPEN_NOTEMPDIR',
      'SQLITE_CANTOPEN_ISDIR',
      'SQLITE_CANTOPEN_CONVPATH'
    ]
  };

  /**
   * Categorize a database error and assign appropriate error code
   */
  categorizeError(error: any, operation?: string): DatabaseError {
    const dbError: DatabaseError = error instanceof Error ? error : new Error(String(error));

    // Preserve original properties
    if (error.code) dbError.code = error.code;
    if (error.errno) dbError.errno = error.errno;
    if (operation) dbError.operation = operation;

    // Categorize based on SQLite error codes
    const sqliteCode = error.code || error.errno?.toString() || '';
    dbError.sqliteCode = sqliteCode;

    switch (sqliteCode) {
      // Busy/Lock errors (retryable)
      case 'SQLITE_BUSY':
      case 'SQLITE_LOCKED':
      case 'SQLITE_BUSY_RECOVERY':
      case 'SQLITE_BUSY_SNAPSHOT':
        dbError.code = DatabaseErrorCodes.DATABASE_LOCKED;
        break;
      case 'SQLITE_BUSY_TIMEOUT':
        dbError.code = DatabaseErrorCodes.CONNECTION_TIMEOUT;
        break;

      // Constraint violations (not retryable)
      case 'SQLITE_CONSTRAINT':
      case 'SQLITE_CONSTRAINT_CHECK':
        dbError.code = DatabaseErrorCodes.CHECK_CONSTRAINT_VIOLATION;
        break;
      case 'SQLITE_CONSTRAINT_FOREIGNKEY':
        dbError.code = DatabaseErrorCodes.FOREIGN_KEY_VIOLATION;
        break;
      case 'SQLITE_CONSTRAINT_NOTNULL':
        dbError.code = DatabaseErrorCodes.NOT_NULL_CONSTRAINT_VIOLATION;
        break;
      case 'SQLITE_CONSTRAINT_PRIMARYKEY':
      case 'SQLITE_CONSTRAINT_UNIQUE':
        dbError.code = DatabaseErrorCodes.UNIQUE_CONSTRAINT_VIOLATION;
        break;

      // File system errors
      case 'SQLITE_CANTOPEN':
      case 'SQLITE_CANTOPEN_NOTEMPDIR':
      case 'SQLITE_CANTOPEN_ISDIR':
      case 'SQLITE_CANTOPEN_CONVPATH':
        dbError.code = DatabaseErrorCodes.CONNECTION_FAILED;
        break;
      case 'SQLITE_READONLY':
        dbError.code = DatabaseErrorCodes.READONLY_DATABASE;
        break;
      case 'SQLITE_FULL':
        dbError.code = DatabaseErrorCodes.DISK_FULL;
        break;
      case 'SQLITE_PERM':
        dbError.code = DatabaseErrorCodes.PERMISSION_DENIED;
        break;

      // Corruption errors
      case 'SQLITE_CORRUPT':
      case 'SQLITE_NOTADB':
        dbError.code = DatabaseErrorCodes.CORRUPTION;
        break;

      // Syntax errors
      case 'SQLITE_ERROR':
        // Try to detect syntax errors from message
        if (error.message?.includes('syntax error') || error.message?.includes('incomplete input')) {
          dbError.code = DatabaseErrorCodes.SYNTAX_ERROR;
        } else {
          dbError.code = DatabaseErrorCodes.UNKNOWN_ERROR;
        }
        break;

      default:
        // Check error message for common patterns
        const message = error.message?.toLowerCase() || '';

        if (message.includes('timeout')) {
          dbError.code = DatabaseErrorCodes.QUERY_TIMEOUT;
        } else if (message.includes('locked')) {
          dbError.code = DatabaseErrorCodes.DATABASE_LOCKED;
        } else if (message.includes('syntax')) {
          dbError.code = DatabaseErrorCodes.SYNTAX_ERROR;
        } else if (message.includes('foreign key constraint')) {
          dbError.code = DatabaseErrorCodes.FOREIGN_KEY_VIOLATION;
        } else if (message.includes('unique constraint') || message.includes('not unique')) {
          dbError.code = DatabaseErrorCodes.UNIQUE_CONSTRAINT_VIOLATION;
        } else {
          dbError.code = DatabaseErrorCodes.UNKNOWN_ERROR;
        }
    }

    return dbError;
  }

  /**
   * Check if an error is retryable
   */
  isRetryableError(error: DatabaseError, retryOptions?: Partial<RetryOptions>): boolean {
    const options = { ...this.defaultRetryOptions, ...retryOptions };

    // Check if the SQLite code is in the retryable list
    if (error.sqliteCode && options.retryableErrors.includes(error.sqliteCode)) {
      return true;
    }

    // Check by categorized error code
    const retryableCodes = [
      DatabaseErrorCodes.DATABASE_LOCKED,
      DatabaseErrorCodes.TABLE_LOCKED,
      DatabaseErrorCodes.BUSY,
      DatabaseErrorCodes.CONNECTION_TIMEOUT,
      DatabaseErrorCodes.QUERY_TIMEOUT
    ];

    return retryableCodes.includes(error.code as any);
  }

  /**
   * Execute an operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    retryOptions?: Partial<RetryOptions>
  ): Promise<RetryResult<T>> {
    const options = { ...this.defaultRetryOptions, ...retryOptions };
    const startTime = Date.now();
    let lastError: DatabaseError | undefined;
    let lastAttempt = 1;

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      lastAttempt = attempt;
      try {
        const result = await operation();

        const totalTime = Date.now() - startTime;

        if (attempt > 1) {
          log.info(`[DatabaseErrorHandler] Operation "${operationName}" succeeded on attempt ${attempt} after ${totalTime}ms`);
        }

        return {
          success: true,
          result,
          attempts: attempt,
          totalTime
        };
      } catch (error) {
        const dbError = this.categorizeError(error, operationName);
        lastError = dbError;

        log.warn(`[DatabaseErrorHandler] Operation "${operationName}" failed on attempt ${attempt}/${options.maxAttempts}:`, {
          error: dbError.message,
          code: dbError.code,
          sqliteCode: dbError.sqliteCode
        });

        // Check if we should retry
        if (attempt < options.maxAttempts && this.isRetryableError(dbError, options)) {
          const delay = this.calculateDelay(attempt, options);
          log.debug(`[DatabaseErrorHandler] Retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }

        // No more retries or error is not retryable
        break;
      }
    }

    const totalTime = Date.now() - startTime;

    log.error(`[DatabaseErrorHandler] Operation "${operationName}" failed after ${lastAttempt} attempts in ${totalTime}ms:`, lastError);

    return {
      success: false,
      error: lastError,
      attempts: lastAttempt,
      totalTime
    };
  }

  /**
   * Calculate delay for exponential backoff
   */
  private calculateDelay(attempt: number, options: RetryOptions): number {
    const delay = Math.min(
      options.baseDelay * Math.pow(options.backoffFactor, attempt - 1),
      options.maxDelay
    );

    // Add some jitter to avoid thundering herd
    const jitter = Math.random() * 0.1 * delay;

    return Math.floor(delay + jitter);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log error details for debugging
   */
  logError(error: DatabaseError, context?: any): void {
    const errorInfo = {
      message: error.message,
      code: error.code,
      sqliteCode: error.sqliteCode,
      operation: error.operation,
      errno: error.errno,
      stack: error.stack,
      context
    };

    log.error('[DatabaseErrorHandler] Database error details:', errorInfo);
  }

  /**
   * Create a recovery plan for specific error types
   */
  createRecoveryPlan(error: DatabaseError): string[] {
    const suggestions: string[] = [];

    switch (error.code) {
      case DatabaseErrorCodes.DATABASE_LOCKED:
      case DatabaseErrorCodes.BUSY:
        suggestions.push('Check for long-running transactions');
        suggestions.push('Verify database is not being accessed by another process');
        suggestions.push('Consider increasing busy timeout');
        break;

      case DatabaseErrorCodes.FOREIGN_KEY_VIOLATION:
        suggestions.push('Verify referenced record exists in parent table');
        suggestions.push('Check foreign key constraint definitions');
        suggestions.push('Ensure foreign keys are enabled');
        break;

      case DatabaseErrorCodes.UNIQUE_CONSTRAINT_VIOLATION:
        suggestions.push('Check for duplicate data before insertion');
        suggestions.push('Use INSERT OR REPLACE if updates are acceptable');
        suggestions.push('Verify unique constraint definitions');
        break;

      case DatabaseErrorCodes.DISK_FULL:
        suggestions.push('Free up disk space');
        suggestions.push('Consider database cleanup or archiving');
        suggestions.push('Move database to location with more space');
        break;

      case DatabaseErrorCodes.CORRUPTION:
        suggestions.push('Run PRAGMA integrity_check');
        suggestions.push('Restore from backup if available');
        suggestions.push('Consider database repair tools');
        break;

      case DatabaseErrorCodes.CONNECTION_FAILED:
        suggestions.push('Verify database file exists and is accessible');
        suggestions.push('Check file permissions');
        suggestions.push('Verify disk is not full');
        break;

      default:
        suggestions.push('Check SQLite documentation for error code');
        suggestions.push('Review recent database operations');
        suggestions.push('Consider enabling verbose logging');
    }

    return suggestions;
  }
}

export default DatabaseErrorHandler;