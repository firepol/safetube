/**
 * Logging utility for controlling verbosity across different environments
 */

/**
 * Determines if verbose logging should be enabled based on the current environment
 */
function shouldLogVerbose(): boolean {
  // Check if we're in a test environment
  const isTestEnvironment =
    typeof process !== 'undefined' && process.env.NODE_ENV === 'test' ||
    typeof jest !== 'undefined' ||
    typeof (globalThis as any).vitest !== 'undefined' ||
    (typeof process !== 'undefined' && process.env.VITEST !== undefined);

  if (isTestEnvironment) {
    return typeof process !== 'undefined' && process.env.TEST_LOG_VERBOSE === 'true';
  }

  // In Electron app environment
  // Check main process environment variable
  if (typeof process !== 'undefined' && process.env.ELECTRON_LOG_VERBOSE === 'true') {
    return true;
  }

  // Check renderer process environment variable (exposed via preload)
  if (typeof window !== 'undefined' && (window as any).electron?.env?.ELECTRON_LOG_VERBOSE === 'true') {
    return true;
  }

  return false;
}

/**
 * Logs a message only if verbose logging is enabled for the current environment
 * @param args - Arguments to pass to console.log
 */
export function logVerbose(...args: any[]): void {
  if (shouldLogVerbose()) {
    console.log(...args);
  }
}

/**
 * Logs an error message (always logged, regardless of verbosity setting)
 * @param args - Arguments to pass to console.error
 */
export function logError(...args: any[]): void {
  console.error(...args);
}

/**
 * Logs a warning message (always logged, regardless of verbosity setting)
 * @param args - Arguments to pass to console.warn
 */
export function logWarning(...args: any[]): void {
  console.warn(...args);
} 