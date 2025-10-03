import { describe, test, expect, vi } from 'vitest';
import './setup'; // Import mocks
import DatabaseErrorHandler, { DatabaseErrorCodes } from '../DatabaseErrorHandler';

describe('DatabaseErrorHandler', () => {
  let errorHandler: DatabaseErrorHandler;

  beforeEach(() => {
    errorHandler = new DatabaseErrorHandler();
  });

  describe('categorizeError', () => {
    test('should categorize busy errors correctly', () => {
      const error = { code: 'SQLITE_BUSY', message: 'database is locked' };
      const categorized = errorHandler.categorizeError(error, 'test-operation');

      expect(categorized.code).toBe(DatabaseErrorCodes.DATABASE_LOCKED);
      expect(categorized.operation).toBe('test-operation');
      expect(categorized.sqliteCode).toBe('SQLITE_BUSY');
    });

    test('should categorize foreign key constraint errors', () => {
      const error = { code: 'SQLITE_CONSTRAINT_FOREIGNKEY', message: 'foreign key constraint failed' };
      const categorized = errorHandler.categorizeError(error);

      expect(categorized.code).toBe(DatabaseErrorCodes.FOREIGN_KEY_VIOLATION);
      expect(categorized.sqliteCode).toBe('SQLITE_CONSTRAINT_FOREIGNKEY');
    });

    test('should categorize unique constraint errors', () => {
      const error = { code: 'SQLITE_CONSTRAINT_UNIQUE', message: 'UNIQUE constraint failed' };
      const categorized = errorHandler.categorizeError(error);

      expect(categorized.code).toBe(DatabaseErrorCodes.UNIQUE_CONSTRAINT_VIOLATION);
      expect(categorized.sqliteCode).toBe('SQLITE_CONSTRAINT_UNIQUE');
    });

    test('should categorize disk full errors', () => {
      const error = { code: 'SQLITE_FULL', message: 'database or disk is full' };
      const categorized = errorHandler.categorizeError(error);

      expect(categorized.code).toBe(DatabaseErrorCodes.DISK_FULL);
    });

    test('should categorize corruption errors', () => {
      const error = { code: 'SQLITE_CORRUPT', message: 'database disk image is malformed' };
      const categorized = errorHandler.categorizeError(error);

      expect(categorized.code).toBe(DatabaseErrorCodes.CORRUPTION);
    });

    test('should categorize syntax errors', () => {
      const error = { code: 'SQLITE_ERROR', message: 'syntax error' };
      const categorized = errorHandler.categorizeError(error);

      expect(categorized.code).toBe(DatabaseErrorCodes.SYNTAX_ERROR);
    });

    test('should handle unknown errors', () => {
      const error = { code: 'UNKNOWN_CODE', message: 'unknown error' };
      const categorized = errorHandler.categorizeError(error);

      expect(categorized.code).toBe(DatabaseErrorCodes.UNKNOWN_ERROR);
    });
  });

  describe('isRetryableError', () => {
    test('should identify retryable errors', () => {
      const busyError = errorHandler.categorizeError({ code: 'SQLITE_BUSY' });
      const lockedError = errorHandler.categorizeError({ code: 'SQLITE_LOCKED' });

      expect(errorHandler.isRetryableError(busyError)).toBe(true);
      expect(errorHandler.isRetryableError(lockedError)).toBe(true);
    });

    test('should identify non-retryable errors', () => {
      const syntaxError = errorHandler.categorizeError({ code: 'SQLITE_ERROR', message: 'syntax error' });
      const constraintError = errorHandler.categorizeError({ code: 'SQLITE_CONSTRAINT_FOREIGNKEY' });

      expect(errorHandler.isRetryableError(syntaxError)).toBe(false);
      expect(errorHandler.isRetryableError(constraintError)).toBe(false);
    });
  });

  describe('executeWithRetry', () => {
    test('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await errorHandler.executeWithRetry(operation, 'test-operation');

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should retry retryable errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce({ code: 'SQLITE_BUSY', message: 'database is locked' })
        .mockRejectedValueOnce({ code: 'SQLITE_BUSY', message: 'database is locked' })
        .mockResolvedValue('success');

      const result = await errorHandler.executeWithRetry(operation, 'test-operation', {
        baseDelay: 1, // Minimize delay for testing
        maxDelay: 1
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test('should not retry non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue({
        code: 'SQLITE_CONSTRAINT_FOREIGNKEY',
        message: 'foreign key constraint failed'
      });

      const result = await errorHandler.executeWithRetry(operation, 'test-operation', {
        maxAttempts: 3,
        baseDelay: 1,
        maxDelay: 1
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(DatabaseErrorCodes.FOREIGN_KEY_VIOLATION);
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should fail after max attempts', async () => {
      const operation = vi.fn().mockRejectedValue({
        code: 'SQLITE_BUSY',
        message: 'database is locked'
      });

      const result = await errorHandler.executeWithRetry(operation, 'test-operation', {
        maxAttempts: 2,
        baseDelay: 1,
        maxDelay: 1
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(DatabaseErrorCodes.DATABASE_LOCKED);
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('createRecoveryPlan', () => {
    test('should provide recovery suggestions for busy errors', () => {
      const error = errorHandler.categorizeError({ code: 'SQLITE_BUSY' });
      const suggestions = errorHandler.createRecoveryPlan(error);

      expect(suggestions).toContain('Check for long-running transactions');
      expect(suggestions).toContain('Verify database is not being accessed by another process');
    });

    test('should provide recovery suggestions for foreign key violations', () => {
      const error = errorHandler.categorizeError({ code: 'SQLITE_CONSTRAINT_FOREIGNKEY' });
      const suggestions = errorHandler.createRecoveryPlan(error);

      expect(suggestions).toContain('Verify referenced record exists in parent table');
      expect(suggestions).toContain('Check foreign key constraint definitions');
    });

    test('should provide recovery suggestions for disk full errors', () => {
      const error = errorHandler.categorizeError({ code: 'SQLITE_FULL' });
      const suggestions = errorHandler.createRecoveryPlan(error);

      expect(suggestions).toContain('Free up disk space');
      expect(suggestions).toContain('Consider database cleanup or archiving');
    });

    test('should provide generic suggestions for unknown errors', () => {
      const error = errorHandler.categorizeError({ code: 'UNKNOWN_CODE' });
      const suggestions = errorHandler.createRecoveryPlan(error);

      expect(suggestions).toContain('Check SQLite documentation for error code');
      expect(suggestions).toContain('Review recent database operations');
    });
  });
});