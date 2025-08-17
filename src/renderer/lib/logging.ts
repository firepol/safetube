/**
 * Renderer-specific logging utility
 * Checks for verbose logging setting and only logs when enabled
 */

// Check if verbose logging is enabled via localStorage
const isVerboseLoggingEnabled = (): boolean => {
  try {
    return localStorage.getItem('ELECTRON_LOG_VERBOSE') === 'true';
  } catch {
    // Fallback to false if localStorage is not available
    return false;
  }
};

/**
 * Logs messages only when verbose logging is enabled
 * @param args - Arguments to pass to console.log
 */
export const logVerbose = (...args: any[]): void => {
  if (isVerboseLoggingEnabled()) {
    console.log('[Renderer][Verbose]', ...args);
  }
};

/**
 * Logs error messages (always logged, regardless of verbosity setting)
 * @param args - Arguments to pass to console.error
 */
export const logError = (...args: any[]): void => {
  console.error(...args);
};

/**
 * Logs warning messages (always logged, regardless of verbosity setting)
 * @param args - Arguments to pass to console.warn
 */
export const logWarning = (...args: any[]): void => {
  console.warn(...args);
};
